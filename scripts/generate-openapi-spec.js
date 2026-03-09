#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'src', 'api', 'routes');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs', 'api');

const ROUTE_MOUNTS = [
  {
    file: 'tournaments/index.ts',
    prefixes: ['/api/tournaments'],
    tag: 'tournaments',
  },
  {
    file: 'tournaments/fixtures/index.js',
    prefixes: ['/api/tournaments/{tournamentId}/fixtures'],
    tag: 'fixtures',
  },
  {
    file: 'regions/index.js',
    prefixes: ['/api/regions'],
    tag: 'regions',
  },
  {
    file: 'general.js',
    prefixes: ['/api'],
    tag: 'general',
  },
  {
    file: 'auth/index.js',
    prefixes: ['/api/auth', '/auth'],
    tag: 'auth',
  },
  {
    file: 'system/index.js',
    prefixes: ['/api/system'],
    tag: 'system',
  },
  {
    file: 'clubs/index.js',
    prefixes: ['/api/clubs'],
    tag: 'clubs',
  },
  {
    file: 'annual-reports/index.js',
    prefixes: ['/api/annual-reports'],
    tag: 'annual-reports',
  },
  {
    file: 'teams/index.ts',
    prefixes: ['/api/teams'],
    tag: 'teams',
  },
  {
    file: 'events/index.js',
    prefixes: ['/api/events'],
    tag: 'events',
  },
  {
    file: 'listings/index.js',
    prefixes: ['/api/listings'],
    tag: 'listings',
  },
  {
    file: 'users/index.js',
    prefixes: ['/api'],
    tag: 'users',
  },
  {
    file: 'internal/index.ts',
    prefixes: ['/api/internal'],
    tag: 'internal',
    internalOnly: true,
  },
];

const DIRECT_APP_ROUTES = [
  {
    method: 'post',
    path: '/api/tournaments/{tournamentId}/club/{clubId}/teamsheet',
    tag: 'tournaments',
    summary: 'Upload teamsheet PDF for a tournament club',
    requestBody: {
      required: true,
      content: {
        'application/pdf': {
          schema: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  },
  {
    method: 'post',
    path: '/api/clubs/{id}/logo',
    tag: 'clubs',
    summary: 'Upload a club logo image',
    requestBody: {
      required: true,
      content: {
        'image/*': {
          schema: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  },
  {
    method: 'post',
    path: '/api/teams/{id}/logo',
    tag: 'teams',
    summary: 'Upload a team logo image',
    requestBody: {
      required: true,
      content: {
        'image/png': {
          schema: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  },
  {
    method: 'post',
    path: '/api/upload',
    tag: 'system',
    summary: 'Upload a file payload',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
          },
        },
      },
    },
  },
  {
    method: 'get',
    path: '/health',
    tag: 'system',
    summary: 'Health check',
  },
];

function normalizePath(prefix, routePath) {
  const cleanedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '');
  const cleanedRoute = routePath === '/' ? '' : routePath;
  let full = `${cleanedPrefix}${cleanedRoute}`;

  if (!full.startsWith('/')) {
    full = `/${full}`;
  }

  full = full.replace(/\/+/g, '/');
  if (full.length > 1 && full.endsWith('/')) {
    full = full.slice(0, -1);
  }

  return full.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

function routeFileMethods(content) {
  const methods = [];
  const regex =
    /router\.(get|post|put|delete|patch)\s*\(\s*(["'`])([^"'`]+)\2/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    methods.push({
      method: match[1].toLowerCase(),
      routePath: match[3],
    });
  }

  return methods;
}

function pathParams(pathname) {
  const names = [];
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;
  while ((match = regex.exec(pathname)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function humanSummary(method, pathname) {
  const verb =
    {
      get: 'Get',
      post: 'Create',
      put: 'Update',
      patch: 'Patch',
      delete: 'Delete',
    }[method] || method.toUpperCase();

  const lastSegment = pathname
    .split('/')
    .filter(Boolean)
    .reverse()
    .find((seg) => !seg.startsWith('{'));

  const target = lastSegment ? lastSegment.replace(/-/g, ' ') : 'resource';
  return `${verb} ${target}`;
}

function operationId(method, pathname) {
  return `${method}_${pathname
    .replace(/[{}]/g, '')
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/-/g, '_')}`;
}

function defaultResponses() {
  return {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Error',
          },
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/Error',
          },
        },
      },
    },
  };
}

function addOperation(paths, item) {
  const canonicalPath = item.path.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, '{}');
  const existingPath = Object.keys(paths).find(
    (p) => p.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, '{}') === canonicalPath
  );
  const targetPath = existingPath || item.path;

  if (!paths[targetPath]) {
    paths[targetPath] = {};
  }

  const params = pathParams(targetPath).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: {
      type: 'string',
    },
  }));

  const op = {
    tags: [item.tag],
    summary: item.summary || humanSummary(item.method, targetPath),
    operationId: operationId(item.method, targetPath),
    responses: defaultResponses(),
  };

  if (item.internalOnly) {
    op.description =
      'Internal/test endpoint. Available when NODE_ENV is not production.';
    op['x-internal-only'] = true;
  }

  if (params.length) {
    op.parameters = params;
  }

  if (item.requestBody) {
    op.requestBody = item.requestBody;
  } else if (['post', 'put', 'patch'].includes(item.method)) {
    op.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
          },
        },
      },
    };
  }

  paths[targetPath][item.method] = op;
}

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, value] = token.slice(2).split('=');
    args[key] = value;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const serverUrl =
    args.server || process.env.OPENAPI_SERVER_URL || 'http://localhost:4001';

  const paths = {};

  for (const mount of ROUTE_MOUNTS) {
    const absRouteFile = path.join(ROUTES_DIR, mount.file);
    const content = fs.readFileSync(absRouteFile, 'utf8');
    const methods = routeFileMethods(content);

    for (const m of methods) {
      for (const prefix of mount.prefixes) {
        addOperation(paths, {
          method: m.method,
          path: normalizePath(prefix, m.routePath),
          tag: mount.tag,
          internalOnly: mount.internalOnly,
        });
      }
    }
  }

  for (const direct of DIRECT_APP_ROUTES) {
    addOperation(paths, direct);
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Gaelic Tournament API',
      version: '1.0.0',
      description:
        'Auto-generated OpenAPI specification from mounted Express routes in pp-api.',
      license: {
        name: 'UNLICENSED',
        url: 'https://example.com/license',
      },
    },
    servers: [
      {
        url: serverUrl,
        description: 'Local API server',
      },
    ],
    security: [{}, { bearerAuth: [] }],
    tags: [
      { name: 'auth', description: 'Authentication and account flows' },
      {
        name: 'tournaments',
        description: 'Tournament lifecycle and reporting',
      },
      { name: 'fixtures', description: 'Fixture scheduling and match state' },
      { name: 'regions', description: 'Regions and regional club data' },
      { name: 'general', description: 'General cross-domain read endpoints' },
      { name: 'system', description: 'System diagnostics and health' },
      { name: 'clubs', description: 'Club management and media' },
      { name: 'annual-reports', description: 'Annual reporting data' },
      { name: 'teams', description: 'Team management and media' },
      { name: 'events', description: 'Events CRUD and search' },
      { name: 'listings', description: 'Public listings and iCal endpoints' },
      { name: 'users', description: 'User and role management' },
      {
        name: 'internal',
        description: 'Non-production internal test endpoints',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  };

  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const jsonPath = path.join(DOCS_DIR, 'openapi.json');
  const yamlPath = path.join(DOCS_DIR, 'openapi.yaml');

  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + '\n');
  fs.writeFileSync(
    yamlPath,
    yaml.dump(spec, {
      noRefs: true,
      lineWidth: -1,
      quotingType: '"',
    })
  );

  console.log(`Generated OpenAPI spec:`);
  console.log(`- ${yamlPath}`);
  console.log(`- ${jsonPath}`);
  console.log(`Routes documented: ${Object.keys(paths).length}`);
}

main();
