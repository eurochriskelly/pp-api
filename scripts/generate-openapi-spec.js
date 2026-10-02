#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'src', 'api', 'routes');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs', 'api');
const SCHEMAS_DIR = path.join(DOCS_DIR, 'components', 'schemas');

// Explicit mount prefixes for the few route modules whose prefix cannot be
// derived from their file path alone.
const MOUNT_PREFIXES = {
  'users/index.ts': ['/api'],
  'auth/index.ts': ['/api/auth', '/auth'],
  'internal/index.ts': ['/api/internal'],
  'tournaments/index.ts': ['/api/tournaments'],
  'tournaments/fixtures/index.ts': ['/api/tournaments/{tournamentId}/fixtures'],
  'tournaments/teams/index.ts': ['/api/tournaments/{tournamentId}/teams'],
  'tournaments/reports.ts': ['/api/tournaments/{tournamentId}/reports'],
};

const DIRECT_APP_ROUTES = [
  {
    method: 'get',
    path: '/health',
    tag: 'system',
    summary: 'Health check',
  },
];

const RESPONSE_SCHEMAS = {
  'GET /api/annual-reports': { array: 'YearsSummary' },
  'GET /api/annual-reports/{year}': 'AnnualReport',

  'GET /api/auth/users': { array: 'Error' }, // generic user list, no schema yet
  'GET /api/clubs': { array: 'Error' },
  'GET /api/clubs/{clubId}': 'Error',
  'GET /api/clubs/{clubId}/logo': { binary: 'image/png' },
  'POST /api/clubs/{clubId}/logo': { binary: 'image/*' },

  'GET /api/events': { array: 'Event' },
  'GET /api/events/search': { array: 'Event' },
  'POST /api/events': 'Event',
  'GET /api/events/{eventId}': 'Event',
  'PUT /api/events/{eventId}': 'Event',

  'GET /api/listings': { array: 'Listing' },
  'POST /api/listings': 'Listing',
  'GET /api/listings/{listingId}': 'Listing',
  'PUT /api/listings/{listingId}': 'Listing',
  'GET /api/listings/{listingId}/events': { array: 'Event' },
  'GET /api/listings/{listingId}/timeline': 'ListingTimeline',

  'GET /api/regions': { array: 'Error' },
  'GET /api/regions/{regionId}': 'Error',
  'GET /api/regions/{regionId}/clubs': { array: 'ClubTeam' },

  'GET /api/rulesets': { array: 'Ruleset' },
  'POST /api/rulesets': 'Ruleset',
  'GET /api/rulesets/{rulesetId}': 'Ruleset',
  'PUT /api/rulesets/{rulesetId}': 'Ruleset',

  'GET /api/series': { array: 'Series' },
  'POST /api/series': 'Series',
  'GET /api/series/{seriesId}': 'Series',
  'PUT /api/series/{seriesId}': 'Series',
  'GET /api/series/{seriesId}/championships': { array: 'Championship' },

  'GET /api/championships': { array: 'Championship' },
  'POST /api/championships': 'Championship',
  'GET /api/championships/{championshipId}': 'Championship',
  'PUT /api/championships/{championshipId}': 'Championship',
  'GET /api/championships/{championshipId}/entrants': {
    array: 'ChampionshipEntrant',
  },
  'POST /api/championships/{championshipId}/entrants': 'ChampionshipEntrant',
  'GET /api/championships/{championshipId}/entrants/{entrantId}':
    'ChampionshipEntrant',
  'PUT /api/championships/{championshipId}/entrants/{entrantId}':
    'ChampionshipEntrant',
  'GET /api/championships/{championshipId}/rounds': {
    array: 'ChampionshipRound',
  },
  'POST /api/championships/{championshipId}/rounds': 'ChampionshipRound',
  'GET /api/championships/{championshipId}/standings': {
    array: 'ChampionshipStanding',
  },

  'GET /api/teams': { array: 'Error' },
  'GET /api/teams/{teamId}': 'Error',
  'GET /api/teams/{teamId}/logo': { binary: 'image/png' },
  'POST /api/teams/{teamId}/logo': { binary: 'image/png' },

  'GET /api/tournaments': { array: 'TournamentSummary' },
  'GET /api/tournaments/templates': { array: 'TournamentTemplate' },
  'POST /api/tournaments': 'Tournament',
  'GET /api/tournaments/{tournamentId}': 'Tournament',
  'PUT /api/tournaments/{tournamentId}': 'Tournament',
  'POST /api/tournaments/{tournamentId}/competitions': 'TournamentCompetition',
  'GET /api/tournaments/{tournamentId}/categories': { array: 'Category' },
  'GET /api/tournaments/{tournamentId}/fixtures': { array: 'Fixture' },
  'POST /api/tournaments/{tournamentId}/fixtures': { array: 'Fixture' },
  'GET /api/tournaments/{tournamentId}/squads': { array: 'Squad' },
  'POST /api/tournaments/{tournamentId}/squads': 'Squad',
  'GET /api/tournaments/{tournamentId}/squads/{squadId}': 'Squad',
  'PUT /api/tournaments/{tournamentId}/squads/{squadId}': 'Squad',
  'GET /api/tournaments/{tournamentId}/squads/{squadId}/players': {
    array: 'Player',
  },
  'POST /api/tournaments/{tournamentId}/squads/{squadId}/players': 'Player',
  'GET /api/tournaments/{tournamentId}/squads/{squadId}/players/{playerId}':
    'Player',
  'PUT /api/tournaments/{tournamentId}/squads/{squadId}/players/{playerId}':
    'Player',
  'GET /api/tournaments/{tournamentId}/pitches': { array: 'Pitch' },
  'GET /api/tournaments/{tournamentId}/standings': { array: 'Standing' },
  'GET /api/tournaments/{tournamentId}/club/{clubId}/logo': {
    binary: 'image/png',
  },
  'POST /api/tournaments/{tournamentId}/club/{clubId}/teamsheet': {
    binary: 'application/pdf',
  },
  'GET /api/tournaments/{tournamentId}/carded-players': {
    array: 'CardedPlayer',
  },
  'GET /api/tournaments/{tournamentId}/finals-results': {
    array: 'FinalsResult',
  },

  'GET /api/users': { array: 'Error' },
  'GET /api/users/{userId}': 'Error',
};

const REQUEST_SCHEMAS = {
  'POST /api/championships': 'ChampionshipCreate',
  'PUT /api/championships/{championshipId}': 'ChampionshipCreate',
  'POST /api/championships/{championshipId}/entrants':
    'ChampionshipEntrantCreate',
  'POST /api/championships/{championshipId}/rounds':
    'ChampionshipRoundCreate',
  'PUT /api/championships/{championshipId}/entrants/{entrantId}':
    'ChampionshipEntrantCreate',

  'POST /api/events': 'EventCreate',
  'PUT /api/events/{eventId}': 'EventCreate',

  'POST /api/listings': 'ListingCreate',
  'PUT /api/listings/{listingId}': 'ListingCreate',

  'POST /api/rulesets': 'RulesetCreate',
  'PUT /api/rulesets/{rulesetId}': 'RulesetCreate',

  'POST /api/series': 'SeriesCreate',
  'PUT /api/series/{seriesId}': 'SeriesCreate',

  'POST /api/tournaments': 'TournamentCreate',
  'PUT /api/tournaments/{tournamentId}': 'TournamentCreate',
  'POST /api/tournaments/{tournamentId}/competitions':
    'TournamentCompetitionCreate',
  'POST /api/tournaments/{tournamentId}/squads': 'SquadCreate',
  'PUT /api/tournaments/{tournamentId}/squads/{squadId}': 'SquadCreate',
  'POST /api/tournaments/{tournamentId}/squads/{squadId}/players':
    'PlayerCreate',
  'PUT /api/tournaments/{tournamentId}/squads/{squadId}/players/{playerId}':
    'PlayerCreate',
};

const QUERY_PARAMS = {
  'GET /api/championships': [
    { name: 'seriesId', schema: { type: 'integer' } },
    { name: 'year', schema: { type: 'integer' } },
    {
      name: 'status',
      schema: {
        type: 'string',
        enum: ['draft', 'open', 'in-progress', 'completed', 'archived'],
      },
    },
  ],
  'GET /api/events': [
    { name: 'startDate', schema: { type: 'string', format: 'date' } },
    { name: 'start_date', schema: { type: 'string', format: 'date' } },
    { name: 'endDate', schema: { type: 'string', format: 'date' } },
    { name: 'end_date', schema: { type: 'string', format: 'date' } },
    { name: 'organizerId', schema: { type: 'string' } },
    { name: 'organizer_id', schema: { type: 'string' } },
    { name: 'limit', schema: { type: 'integer' } },
  ],
  'GET /api/events/search': [
    { name: 'q', schema: { type: 'string' } },
    { name: 'include_past', schema: { type: 'boolean' } },
  ],
  'GET /api/listings/{listingId}/events': [
    { name: 'search', schema: { type: 'string' } },
    { name: 'sport', schema: { type: 'string' } },
    { name: 'region', schema: { type: 'string' } },
    { name: 'startDate', schema: { type: 'string', format: 'date' } },
    { name: 'start_date', schema: { type: 'string', format: 'date' } },
    { name: 'endDate', schema: { type: 'string', format: 'date' } },
    { name: 'end_date', schema: { type: 'string', format: 'date' } },
    { name: 'include_past', schema: { type: 'boolean' } },
  ],
  'GET /api/listings/{listingId}': [
    { name: 'expand', schema: { type: 'string', enum: ['events'] } },
  ],
  'GET /api/series': [
    {
      name: 'status',
      schema: { type: 'string', enum: ['active', 'inactive'] },
    },
  ],
  'GET /api/tournaments': [
    { name: 'status', schema: { type: 'string' } },
    { name: 'category', schema: { type: 'string' } },
    { name: 'region', schema: { type: 'string' } },
    { name: 'userId', schema: { type: 'string' } },
    { name: 'role', schema: { type: 'string' } },
  ],
  'GET /api/tournaments/{tournamentId}/fixtures': [
    { name: 'pitch', schema: { type: 'string' } },
    { name: 'category', schema: { type: 'string' } },
    { name: 'outcome', schema: { type: 'string' } },
    { name: 'order', schema: { type: 'string' } },
  ],
  'GET /api/tournaments/{tournamentId}/teams': [
    { name: 'stage', schema: { type: 'string' } },
    { name: 'group', schema: { type: 'string' } },
  ],
  'GET /api/users': [{ name: 'filter', schema: { type: 'string' } }],
  'GET /api/auth/users': [{ name: 'filter', schema: { type: 'string' } }],
  'GET /api/clubs': [
    { name: 'search', schema: { type: 'string' } },
    { name: 'limit', schema: { type: 'integer' } },
  ],
};

function getRouteFiles(dir, base = '') {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...getRouteFiles(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.ts')) {
      result.push(rel);
    }
  }
  return result;
}

function getMountPrefixes(relFile) {
  if (MOUNT_PREFIXES[relFile]) return MOUNT_PREFIXES[relFile];
  const resource = relFile.replace(/\/index\.ts$/, '');
  return [`/api/${resource}`];
}

function getTag(relFile) {
  return relFile
    .replace(/\/index\.ts$/, '')
    .replace(/\.ts$/, '')
    .split('/')
    .pop();
}

function parseRouteMethods(content) {
  const methods = [];
  const regex =
    /router\.(get|post|put|delete|patch)\s*\(\s*(["'`])([^"'`]+)\2/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    methods.push({ method: match[1].toLowerCase(), routePath: match[3] });
  }
  return methods;
}

function normalizeParamPath(routePath) {
  return routePath.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
}

function combinePaths(prefix, routePath) {
  const normalized = normalizeParamPath(routePath);
  if (normalized === '/') return prefix;
  const base = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return `${base}${normalized}`;
}

function pathParams(pathname) {
  const names = [];
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;
  while ((match = regex.exec(pathname)) !== null) names.push(match[1]);
  return names;
}

function humanSummary(method, pathname) {
  const verb =
    {
      get: 'Get',
      post: 'Create',
      put: 'Update',
      delete: 'Delete',
      patch: 'Patch',
    }[method] || method.toUpperCase();
  const last = pathname
    .split('/')
    .filter(Boolean)
    .reverse()
    .find((seg) => !seg.startsWith('{'));
  return `${verb} ${last ? last.replace(/-/g, ' ') : 'resource'}`;
}

function operationId(method, pathname) {
  return `${method}_${pathname
    .replace(/[{}]/g, '')
    .replace(/^\//, '')
    .replace(/\//g, '_')
    .replace(/-/g, '_')}`;
}

function schemaRef(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function schemaShape(spec) {
  if (!spec) return null;
  if (typeof spec === 'string') return schemaRef(spec);
  if (spec.array) return { type: 'array', items: schemaRef(spec.array) };
  if (spec.binary) {
    return { type: 'string', format: 'binary' };
  }
  return { type: 'object' };
}

function responseContent(spec) {
  if (spec && spec.binary) {
    return {
      [spec.binary]: {
        schema: { type: 'string', format: 'binary' },
      },
    };
  }
  return {
    'application/json': {
      schema: schemaShape(spec) || { type: 'object' },
    },
  };
}

function defaultResponses(spec) {
  return {
    200: {
      description: 'Successful response',
      content: responseContent(spec),
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': { schema: schemaRef('Error') },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': { schema: schemaRef('Error') },
      },
    },
  };
}

function buildOperation(item) {
  const key = `${item.method.toUpperCase()} ${item.path}`;
  const responseSpec = RESPONSE_SCHEMAS[key];
  const requestSchemaName = REQUEST_SCHEMAS[key];
  const queryParams = QUERY_PARAMS[key] || [];
  const pathParamNames = pathParams(item.path);

  const op = {
    tags: [item.tag],
    summary: item.summary || humanSummary(item.method, item.path),
    operationId: operationId(item.method, item.path),
    responses: defaultResponses(responseSpec),
  };

  if (item.internalOnly) {
    op.description =
      'Internal/test endpoint. Available when NODE_ENV is not production.';
    op['x-internal-only'] = true;
  }

  const parameters = [];
  for (const name of pathParamNames) {
    parameters.push({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }
  for (const q of queryParams) {
    parameters.push({
      name: q.name,
      in: 'query',
      required: false,
      schema: q.schema,
    });
  }
  if (parameters.length) op.parameters = parameters;

  if (requestSchemaName) {
    op.requestBody = {
      required: true,
      content: {
        'application/json': { schema: schemaRef(requestSchemaName) },
      },
    };
  } else if (['post', 'put', 'patch'].includes(item.method)) {
    op.requestBody = {
      required: false,
      content: {
        'application/json': { schema: { type: 'object' } },
      },
    };
  }

  return op;
}

function addOperation(paths, item) {
  const canonical = item.path.replace(/\{[^}]+\}/g, '{}');
  const existing = Object.keys(paths).find(
    (p) => p.replace(/\{[^}]+\}/g, '{}') === canonical
  );
  const targetPath = existing || item.path;
  if (!paths[targetPath]) paths[targetPath] = {};
  paths[targetPath][item.method] = buildOperation(item);
}

function transformRefs(obj) {
  if (Array.isArray(obj)) return obj.map(transformRefs);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === '$ref' && typeof value === 'string') {
        const match = value.match(/\/([^/]+)\.ya?ml#\/(.+)$/);
        if (match) {
          out[key] = `#/components/schemas/${match[2]}`;
        } else {
          out[key] = value;
        }
      } else {
        out[key] = transformRefs(value);
      }
    }
    return out;
  }
  return obj;
}

function loadSchemas() {
  const schemas = {};
  for (const file of fs.readdirSync(SCHEMAS_DIR)) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
    const doc = yaml.load(
      fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8')
    );
    const name = Object.keys(doc)[0];
    schemas[name] = transformRefs(doc[name]);
  }
  return schemas;
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

  for (const relFile of getRouteFiles(ROUTES_DIR)) {
    const absRouteFile = path.join(ROUTES_DIR, relFile);
    const content = fs.readFileSync(absRouteFile, 'utf8');
    const methods = parseRouteMethods(content);
    const prefixes = getMountPrefixes(relFile);
    const tag = getTag(relFile);
    const internalOnly = relFile === 'internal/index.ts';

    for (const m of methods) {
      for (const prefix of prefixes) {
        addOperation(paths, {
          method: m.method,
          path: combinePaths(prefix, m.routePath),
          tag,
          internalOnly,
        });
      }
    }
  }

  for (const direct of DIRECT_APP_ROUTES) {
    addOperation(paths, direct);
  }

  const tags = [
    { name: 'auth', description: 'Authentication and account flows' },
    { name: 'tournaments', description: 'Tournament lifecycle and reporting' },
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
    { name: 'reports', description: 'Tournament report snapshots' },
    { name: 'series', description: 'Series management' },
    { name: 'championships', description: 'Championships and entrants' },
    { name: 'rulesets', description: 'Tournament rulesets' },
    { name: 'internal', description: 'Non-production internal test endpoints' },
  ];

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'PitchPerfect Tournament API',
      version: '1.0.0',
      description:
        'Auto-generated OpenAPI specification from mounted Express routes in pp-api.',
      license: { name: 'UNLICENSED', url: 'https://example.com/license' },
    },
    servers: [{ url: serverUrl, description: 'Local API server' }],
    security: [{}, { bearerAuth: [] }],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: loadSchemas(),
    },
  };

  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const jsonPath = path.join(DOCS_DIR, 'openapi.json');
  const yamlPath = path.join(DOCS_DIR, 'openapi.yaml');

  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + '\n');
  fs.writeFileSync(
    yamlPath,
    yaml.dump(spec, { noRefs: true, lineWidth: -1, quotingType: '"' })
  );

  console.log(`Generated OpenAPI spec:`);
  console.log(`- ${yamlPath}`);
  console.log(`- ${jsonPath}`);
  console.log(`Routes documented: ${Object.keys(paths).length}`);
}

main();
