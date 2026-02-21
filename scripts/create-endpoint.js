#!/usr/bin/env node

/**
 * PP-API Endpoint Scaffolding Script
 *
 * Generates boilerplate for new API endpoints following the 3-layer architecture.
 *
 * Usage:
 *   node scripts/create-endpoint.js <METHODS> <PATH> [options]
 *
 * Examples:
 *   node scripts/create-endpoint.js GET api/venues
 *   node scripts/create-endpoint.js GET,POST,PUT,DELETE api/tournaments/:id/teams
 *   node scripts/create-endpoint.js POST api/reports --auth=required
 *   node scripts/create-endpoint.js POST api/internal/cleanup --internal
 *   node scripts/create-endpoint.js GET api/stats --no-tests
 *
 * Options:
 *   --auth=<mode>       Auth mode: none, required, admin (default: none)
 *   --internal          Mark as internal/test endpoint
 *   --no-tests          Skip generating test files
 *   --no-mock           Skip generating mock service
 *   --dry-run           Print what would be generated without creating files
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);

// Find option flags first
const optionFlags = args.filter((arg) => arg.startsWith('--'));
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

if (positionalArgs.length < 2) {
  console.error(
    'Usage: node scripts/create-endpoint.js <METHODS> <PATH> [options]'
  );
  console.error('Example: node scripts/create-endpoint.js GET,POST api/venues');
  console.error('Options:');
  console.error(
    '  --auth=<mode>    Auth mode: none, required, admin (default: none)'
  );
  console.error('  --internal       Mark as internal/test endpoint');
  console.error('  --no-tests       Skip generating test files');
  console.error('  --no-mock        Skip generating mock service');
  console.error('  --dry-run        Preview without creating files');
  process.exit(1);
}

const methods = positionalArgs[0].split(',').map((m) => m.toUpperCase().trim());
const endpointPath = positionalArgs[1];
const options = {
  auth: 'none',
  internal: false,
  tests: true,
  mock: true,
  dryRun: false,
  ...parseOptions(optionFlags),
};

function parseOptions(optArgs) {
  const opts = {};
  for (const arg of optArgs) {
    if (arg.startsWith('--auth=')) {
      opts.auth = arg.split('=')[1];
    } else if (arg === '--internal') {
      opts.internal = true;
    } else if (arg === '--no-tests') {
      opts.tests = false;
    } else if (arg === '--no-mock') {
      opts.mock = false;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    }
  }
  return opts;
}

// Parse path components
const pathParts = endpointPath.replace(/^api\//, '').split('/');
const resourceName = pathParts[pathParts.length - 1].replace(/^:/, '');
const parentResource =
  pathParts.length > 1
    ? pathParts[pathParts.length - 2].replace(/^:/, '')
    : null;
const isNested = endpointPath.includes('/:');
const fileName = resourceName.replace(/-([a-z])/g, (_, letter) =>
  letter.toUpperCase()
);

// Convert to various naming conventions
const pascalCase = toPascalCase(fileName);
const camelCase = toCamelCase(fileName);
const kebabCase = toKebabCase(fileName);

function toPascalCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toKebabCase(str) {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

// Generate file paths
const paths = {
  route: `src/api/routes/${kebabCase}.ts`,
  controller: `src/api/controllers/${kebabCase}.ts`,
  service: `src/api/services/${kebabCase}.ts`,
  mockService: `src/api/services/mocks/${kebabCase}.ts`,
  unitTest: `test/unit/api/controllers/${kebabCase}.spec.js`,
  apiTestDir: `test/api/${getNextTestNumber()}-${kebabCase}`,
};

function getNextTestNumber() {
  // Find existing test directories and determine next number
  const testDir = 'test/api';
  if (!fs.existsSync(testDir)) return '1';

  const dirs = fs
    .readdirSync(testDir)
    .filter((d) => /^\d+-/.test(d))
    .map((d) => parseInt(d.split('-')[0], 10))
    .filter((n) => !isNaN(n));

  const maxNum = dirs.length > 0 ? Math.max(...dirs) : 0;
  return String(maxNum + 1);
}

// Generate file contents
const templates = {
  route: generateRoute(),
  controller: generateController(),
  service: generateService(),
  mockService: generateMockService(),
  unitTest: generateUnitTest(),
  apiTest: generateApiTest(),
};

function generateRoute() {
  const authSetup =
    options.auth !== 'none'
      ? `
const protect = require('../middleware/auth')(db, useMock);
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  ${
    options.auth === 'admin'
      ? `
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }`
      : ''
  }
  next();
};`
      : '';

  const routes = methods
    .map((method) => {
      const lowerMethod = method.toLowerCase();
      const isGet = method === 'GET';
      const isCreate = method === 'POST';
      const isUpdate = method === 'PUT';
      const isDelete = method === 'DELETE';

      let route = '';
      let middleware = '';

      if (options.auth !== 'none' && (isCreate || isUpdate || isDelete)) {
        middleware = 'protect, requireAuth, ';
      }

      if (isGet) {
        route = `router.get('/', ${middleware}ctrl.getAll);
  router.get('/:id', ${middleware}ctrl.getById);`;
      } else if (isCreate) {
        route = `router.post('/', ${middleware}ctrl.create);`;
      } else if (isUpdate) {
        route = `router.put('/:id', ${middleware}ctrl.update);`;
      } else if (isDelete) {
        route = `router.delete('/:id', ${middleware}ctrl.delete);`;
      }

      return route;
    })
    .join('\n  ');

  return `import express from 'express';
import ${camelCase}Controller from '../controllers/${kebabCase}';

/**
 * ${pascalCase} Routes
 * 
 * Base: /api/${parentResource ? parentResource + '/:' + parentResource + 'Id/' : ''}${kebabCase}
 * 
 * ${methods.map((m) => `- ${m}: ${getEndpointDescription(m)}`).join('\n * ')}
 */
export default (db: any, useMock: boolean) => {
  const router = express.Router({ mergeParams: true });
  const ctrl = ${camelCase}Controller(db, useMock);
  ${authSetup}
  ${routes}

  return router;
};
`;
}

function getEndpointDescription(method) {
  switch (method) {
    case 'GET':
      return 'List all or get by ID';
    case 'POST':
      return 'Create new';
    case 'PUT':
      return 'Update existing';
    case 'DELETE':
      return 'Delete';
    case 'PATCH':
      return 'Partial update';
    default:
      return method;
  }
}

function generateController() {
  const imports = [
    `import { Request, Response, NextFunction } from 'express';`,
  ];
  if (methods.includes('POST') || methods.includes('PUT')) {
    imports.push(`import { z } from 'zod';`);
  }

  const validationSchemas = [];
  if (methods.includes('POST')) {
    validationSchemas.push(`
const createSchema = z.object({
  // TODO: Define your schema
  name: z.string().min(1).max(100),
  // email: z.string().email().optional(),
});`);
  }
  if (methods.includes('PUT')) {
    validationSchemas.push(`
const updateSchema = z.object({
  // TODO: Define your schema (all fields optional for updates)
  name: z.string().min(1).max(100).optional(),
  // email: z.string().email().optional(),
});`);
  }

  const controllerMethods = [];

  if (methods.includes('GET')) {
    controllerMethods.push(`
    getAll: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
        
        const { data, total } = await dbSvc.getAll(page, limit);
        
        res.json({
          data,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (err) {
        next(err);
      }
    },

    getById: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const numericId = parseInt(id, 10);
        
        if (isNaN(numericId)) {
          res.status(400).json({
            error: 'INVALID_ID',
            message: 'ID must be a valid number',
          });
          return;
        }

        const data = await dbSvc.getById(numericId);
        
        if (!data) {
          res.status(404).json({
            error: 'NOT_FOUND',
            message: \`${pascalCase} with ID \${id} not found\`,
          });
          return;
        }

        res.json({ data });
      } catch (err) {
        next(err);
      }
    },`);
  }

  if (methods.includes('POST')) {
    controllerMethods.push(`
    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = createSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            details: result.error.flatten(),
          });
          return;
        }

        const created = await dbSvc.create(result.data);
        res.status(201).json({ data: created });
      } catch (err: any) {
        if (err.message?.includes('DUPLICATE_ENTRY')) {
          res.status(409).json({ error: 'Resource already exists' });
          return;
        }
        next(err);
      }
    },`);
  }

  if (methods.includes('PUT')) {
    controllerMethods.push(`
    update: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const numericId = parseInt(id, 10);
        
        if (isNaN(numericId)) {
          res.status(400).json({
            error: 'INVALID_ID',
            message: 'ID must be a valid number',
          });
          return;
        }

        const result = updateSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            details: result.error.flatten(),
          });
          return;
        }

        const existing = await dbSvc.getById(numericId);
        if (!existing) {
          res.status(404).json({
            error: 'NOT_FOUND',
            message: \`${pascalCase} with ID \${id} not found\`,
          });
          return;
        }

        const updated = await dbSvc.update(numericId, result.data);
        res.json({ data: updated });
      } catch (err) {
        next(err);
      }
    },`);
  }

  if (methods.includes('DELETE')) {
    controllerMethods.push(`
    delete: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const numericId = parseInt(id, 10);
        
        if (isNaN(numericId)) {
          res.status(400).json({
            error: 'INVALID_ID',
            message: 'ID must be a valid number',
          });
          return;
        }

        const existing = await dbSvc.getById(numericId);
        if (!existing) {
          res.status(404).json({
            error: 'NOT_FOUND',
            message: \`${pascalCase} with ID \${id} not found\`,
          });
          return;
        }

        await dbSvc.delete(numericId);
        res.json({ message: '${pascalCase} deleted successfully' });
      } catch (err) {
        next(err);
      }
    },`);
  }

  return `${imports.join('\n')}
import serviceFactory from '../services/${kebabCase}';
import mockServiceFactory from '../services/mocks/${kebabCase}';
${validationSchemas.join('')}

export default (db: any, useMock: boolean) => {
  const factory = useMock ? mockServiceFactory : serviceFactory;
  const dbSvc = factory(db);

  return {${controllerMethods.join('')}
  };
};
`;
}

function generateService() {
  const serviceMethods = [];

  if (methods.includes('GET')) {
    serviceMethods.push(`
    getAll: async (page: number, limit: number) => {
      const offset = (page - 1) * limit;
      const [data, [{ total }]] = await Promise.all([
        select(
          'SELECT * FROM ${kebabCase.replace(/-/g, '_')} ORDER BY id DESC LIMIT ? OFFSET ?',
          [limit, offset]
        ),
        select('SELECT COUNT(*) as total FROM ${kebabCase.replace(/-/g, '_')}'),
      ]);
      return { data, total };
    },

    getById: async (id: number) => {
      const results = await select(
        'SELECT * FROM ${kebabCase.replace(/-/g, '_')} WHERE id = ?',
        [id]
      );
      return results[0] || null;
    },`);
  }

  if (methods.includes('POST')) {
    serviceMethods.push(`
    create: async (data: { name: string }) => {
      try {
        const id = await insert(
          'INSERT INTO ${kebabCase.replace(/-/g, '_')} (name, created_at) VALUES (?, NOW())',
          [data.name]
        );
        return { id, ...data };
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          throw new Error('DUPLICATE_ENTRY: ${pascalCase} already exists');
        }
        throw err;
      }
    },`);
  }

  if (methods.includes('PUT')) {
    serviceMethods.push(`
    update: async (id: number, data: Partial<{ name: string }>) => {
      const affected = await update(
        'UPDATE ${kebabCase.replace(/-/g, '_')} SET name = COALESCE(?, name), updated_at = NOW() WHERE id = ?',
        [data.name, id]
      );
      
      if (affected === 0) {
        throw new Error('RESOURCE_NOT_FOUND');
      }
      
      return await this.getById(id);
    },`);
  }

  if (methods.includes('DELETE')) {
    serviceMethods.push(`
    delete: async (id: number) => {
      const affected = await remove('DELETE FROM ${kebabCase.replace(/-/g, '_')} WHERE id = ?', [id]);
      
      if (affected === 0) {
        throw new Error('RESOURCE_NOT_FOUND');
      }
      
      return { deleted: true };
    },`);
  }

  const dbHelperImport =
    methods.includes('GET') ||
    methods.includes('POST') ||
    methods.includes('PUT') ||
    methods.includes('DELETE')
      ? `const { select, insert, update, delete: remove, transaction } = dbHelper(db);`
      : '';

  return `import dbHelper from '../../lib/db-helper';

export default (db: any) => {
${dbHelperImport ? dbHelperImport + '\n' : ''}
  return {${serviceMethods.join('')}
  };
};
`;
}

function generateMockService() {
  const mockMethods = [];

  if (methods.includes('GET')) {
    mockMethods.push(`
    getAll: async (page: number, limit: number) => {
      const start = (page - 1) * limit;
      const data = mockData.slice(start, start + limit);
      return { data, total: mockData.length };
    },

    getById: async (id: number) => {
      return mockData.find(item => item.id === id) || null;
    },`);
  }

  if (methods.includes('POST')) {
    mockMethods.push(`
    create: async (data: any) => {
      const item = { id: nextId++, ...data, createdAt: new Date().toISOString() };
      mockData.push(item);
      return item;
    },`);
  }

  if (methods.includes('PUT')) {
    mockMethods.push(`
    update: async (id: number, data: any) => {
      const index = mockData.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error('RESOURCE_NOT_FOUND');
      }
      mockData[index] = { ...mockData[index], ...data, updatedAt: new Date().toISOString() };
      return mockData[index];
    },`);
  }

  if (methods.includes('DELETE')) {
    mockMethods.push(`
    delete: async (id: number) => {
      const index = mockData.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error('RESOURCE_NOT_FOUND');
      }
      mockData.splice(index, 1);
      return { deleted: true };
    },`);
  }

  return `let mockData: any[] = [];
let nextId = 1;

export default () => ({
${mockMethods.join('')}

  // For test cleanup
  __reset: () => {
    mockData = [];
    nextId = 1;
  },
});
`;
}

function generateUnitTest() {
  const tests = [];

  if (methods.includes('GET')) {
    tests.push(`
test('getAll returns paginated list', async () => {
  const controller = controllerFactory({}, true);
  
  const req = { query: { page: '1', limit: '10' } };
  const res = createMockRes();
  const next = (err) => { if (err) throw err; };
  
  await controller.getAll(req, res, next);
  
  assert.equal(res.statusCode, 200);
  assert.ok(res.jsonData?.data);
  assert.ok(res.jsonData?.meta);
});

test('getById returns 404 for non-existent ID', async () => {
  const controller = controllerFactory({}, true);
  
  const req = { params: { id: '9999' } };
  const res = createMockRes();
  const next = (err) => { if (err) throw err; };
  
  await controller.getById(req, res, next);
  
  assert.equal(res.statusCode, 404);
  assert.ok(res.jsonData?.error);
});`);
  }

  if (methods.includes('POST')) {
    tests.push(`
test('create returns 201 on success', async () => {
  const controller = controllerFactory({}, true);
  
  const req = { body: { name: 'Test ${pascalCase}' } };
  const res = createMockRes();
  const next = (err) => { if (err) throw err; };
  
  await controller.create(req, res, next);
  
  assert.equal(res.statusCode, 201);
  assert.ok(res.jsonData?.data?.id);
});

test('create returns 400 on invalid input', async () => {
  const controller = controllerFactory({}, true);
  
  const req = { body: {} }; // Missing required name
  const res = createMockRes();
  const next = (err) => { if (err) throw err; };
  
  await controller.create(req, res, next);
  
  assert.equal(res.statusCode, 400);
  assert.ok(res.jsonData?.error);
});`);
  }

  return `const test = require('node:test');
const assert = require('node:assert/strict');
const controllerFactory = require('../../../../src/api/controllers/${kebabCase}');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.jsonData = data; return this; },
  };
}

${tests.join('\n')}
`;
}

function generateApiTest() {
  return `name: Create ${pascalCase}
method: POST
url: $T_HOST/api/${endpointPath.replace(/^api\//, '')}
body:
  content: |-
    {
      "name": "Test ${pascalCase}"
    }
  content_type: application/json
headers:
- name: Content-Type
  value: application/json
${
  options.auth !== 'none'
    ? `- name: Authorization
  value: Bearer $T_TOKEN`
    : ''
}
`;
}

// Execute
console.log('PP-API Endpoint Scaffolding');
console.log('===========================\n');
console.log(`Methods: ${methods.join(', ')}`);
console.log(`Path: ${endpointPath}`);
console.log(`Resource: ${pascalCase}`);
console.log(`Options:`, options);
console.log('');

if (options.dryRun) {
  console.log('DRY RUN - Files that would be created:\n');
}

// Create files
let filesCreated = 0;

function writeFile(filePath, content) {
  if (options.dryRun) {
    console.log(`\n=== ${filePath} ===`);
    console.log(content);
    return;
  }

  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping (exists): ${filePath}`);
    return;
  }

  fs.writeFileSync(fullPath, content);
  console.log(`✅ Created: ${filePath}`);
  filesCreated++;
}

writeFile(paths.route, templates.route);
writeFile(paths.controller, templates.controller);
writeFile(paths.service, templates.service);

if (options.mock) {
  writeFile(paths.mockService, templates.mockService);
}

if (options.tests) {
  writeFile(paths.unitTest, templates.unitTest);
  writeFile(`${paths.apiTestDir}/1-create.posting.yaml`, templates.apiTest);
}

// Print registration instructions
console.log('\n' + '='.repeat(50));
console.log('Next steps:');
console.log('='.repeat(50));
console.log(`\n1. Register the route in src/api/index.js:`);
console.log(`   const ${camelCase}Routes = require('./routes/${kebabCase}');`);
console.log(
  `   app.use('/api/${parentResource ? parentResource + '/:' + parentResource + 'Id/' : ''}${kebabCase}', ${camelCase}Routes(dbMain, ARGS.useMock));`
);

if (methods.includes('POST') || methods.includes('PUT')) {
  console.log(`\n2. Update the validation schemas in the controller`);
}

console.log(`\n3. Update the database table name in the service`);
console.log(`   Current: ${kebabCase.replace(/-/g, '_')}`);

console.log(`\n4. Run linting and type checking:`);
console.log(`   npm run lint:fix`);
console.log(`   npm run build`);

if (options.tests) {
  console.log(`\n5. Run tests:`);
  console.log(`   npm run test:unit`);
  console.log(`   npm run test:api`);
}

if (!options.dryRun) {
  console.log(`\n✨ Created ${filesCreated} files`);
}
