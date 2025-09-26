#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * API Documentation Generator
 * Parses route files and generates OpenAPI YAML documentation
 */

class ApiDocGenerator {
  constructor() {
    this.routesDir = path.join(__dirname, '../src/api/routes');
    this.docsDir = path.join(__dirname, '../docs/api');
    this.pathsDir = path.join(this.docsDir, 'paths');
    this.pathMappings = {}; // Store path -> file mapping
  }

  async generate() {
    console.log('🔍 Analyzing route files...');

    // Get all route files
    const routeFiles = fs
      .readdirSync(this.routesDir)
      .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

    for (const routeFile of routeFiles) {
      await this.processRouteFile(routeFile);
    }

    // Update the main openapi.yaml file
    this.updateMainOpenApiYaml();

    console.log('✅ API documentation generated successfully!');
  }

  async processRouteFile(routeFile) {
    const filePath = path.join(this.routesDir, routeFile);
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract resource name from filename
    const resourceName = path.basename(routeFile, path.extname(routeFile));

    console.log(`📝 Processing ${resourceName} routes...`);

    // Parse the route definitions
    const routes = this.parseRoutes(content, resourceName);

    // Group routes by path
    const routesByPath = {};
    for (const route of routes) {
      if (!routesByPath[route.fullPath]) {
        routesByPath[route.fullPath] = [];
      }
      routesByPath[route.fullPath].push(route);
    }

    // Create resource directory
    const resourceDir = path.join(this.pathsDir, resourceName);
    if (!fs.existsSync(resourceDir)) {
      fs.mkdirSync(resourceDir, { recursive: true });
    }

    // Generate YAML files for each unique path
    for (const [path, pathRoutes] of Object.entries(routesByPath)) {
      this.generatePathYaml(resourceDir, path, pathRoutes);
    }
  }

  parseRoutes(content, resourceName) {
    const routes = [];

    // Match router.METHOD('path', handler) patterns
    const routeRegex =
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*([^)]+)\)/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      const [, method, routePath, handler] = match;

      routes.push({
        method: method.toUpperCase(),
        path: routePath,
        handler: handler.trim(),
        resource: resourceName,
        fullPath: this.buildFullPath(resourceName, routePath),
      });
    }

    return routes;
  }

  buildFullPath(resourceName, routePath) {
    // Map resource names to their base paths
    const basePaths = {
      auth: '/auth',
      tournaments: '/tournaments',
      fixtures: '/tournaments/{tournamentId}/fixtures',
      players: '/tournaments/{tournamentId}/squads/{squadId}/players',
      squads: '/tournaments/{tournamentId}/squads',
      regions: '/regions',
      system: '/api/system',
      general: '', // general routes might be mixed
    };

    const basePath = basePaths[resourceName] || `/${resourceName}`;
    let fullPath = routePath === '/' ? basePath : `${basePath}${routePath}`;

    // Convert Express.js params (:param) to OpenAPI format ({param})
    fullPath = fullPath.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');

    return fullPath;
  }

  generatePathYaml(resourceDir, fullPath, routes) {
    // Create a filename from the full path
    const filename = this.pathToFilename(fullPath);
    const filePath = path.join(resourceDir, `${filename}.yaml`);

    // Store the mapping for updating main openapi.yaml
    this.pathMappings[fullPath] =
      `./paths/${routes[0].resource}/${filename}.yaml`;

    // Generate YAML structure with all operations for this path
    const yaml = this.generatePathYamlContent(fullPath, routes);

    fs.writeFileSync(filePath, yaml);
    console.log(`  📄 Generated ${filename}.yaml`);
  }

  routeToFilename(routePath, method) {
    // Convert route path to a filename
    let filename = routePath
      .replace(/^\//, '') // Remove leading slash
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/\//g, '-') // Replace slashes with dashes
      .replace(/:/g, 'by-') // Replace :param with by-param
      .replace(/\{([^}]+)\}/g, '$1') // Remove curly braces from params
      .toLowerCase();

    if (!filename) {
      filename = 'list';
    }

    return `${method.toLowerCase()}-${filename}`;
  }

  generateYamlContent(route) {
    const yaml = `---
${route.method.toLowerCase()}:
  summary: "${this.generateSummary(route)}"
  ${this.generateParameters(route)}
  ${this.generateRequestBody(route)}
  responses:
    "200":
      description: "Success"
      content:
        application/json:
          schema:
            type: object
    "400":
      description: "Bad Request"
      content:
        application/json:
          schema:
            $ref: "../../components/schemas/Error.yaml"
    "500":
      description: "Internal Server Error"
      content:
        application/json:
          schema:
            $ref: "../../components/schemas/Error.yaml"
`;

    return yaml;
  }

  generateSummary(route) {
    const actionMap = {
      GET: 'Get',
      POST: 'Create',
      PUT: 'Update',
      DELETE: 'Delete',
    };

    const action = actionMap[route.method] || route.method;
    const resource =
      route.resource.charAt(0).toUpperCase() + route.resource.slice(1);

    if (route.path.includes(':id') || route.path.includes('{')) {
      return `${action} ${resource} by ID`;
    } else if (route.path === '/') {
      return `${action} ${resource}`;
    } else {
      return `${action} ${resource} ${route.path.replace(/^\//, '').replace(/\//g, ' ')}`;
    }
  }

  generateParameters(route) {
    const params = [];

    // Extract path parameters
    const pathParamRegex = /:(\w+)|\{(\w+)\}/g;
    let paramMatch;
    while ((paramMatch = pathParamRegex.exec(route.path)) !== null) {
      const paramName = paramMatch[1] || paramMatch[2];
      params.push(`      - name: ${paramName}
        in: path
        required: true
        schema:
          type: string`);
    }

    if (params.length > 0) {
      return `  parameters:\n${params.join('\n')}`;
    }

    return '';
  }

  generateRequestBody(route) {
    // Add request body for POST/PUT methods
    if (['POST', 'PUT'].includes(route.method)) {
      return `  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
`;
    }

    return '';
  }

  pathToFilename(fullPath) {
    // Convert path to filename
    return (
      fullPath
        .replace(/^\//, '') // Remove leading slash
        .replace(/\//g, '-') // Replace slashes with dashes
        .replace(/:/g, 'by-') // Replace :param with by-param
        .replace(/\{([^}]+)\}/g, '$1') // Remove curly braces from params
        .toLowerCase() || 'root'
    );
  }

  generatePathYamlContent(fullPath, routes) {
    let yaml = '---\n';

    // Group routes by method
    const methods = {};
    for (const route of routes) {
      methods[route.method.toLowerCase()] = route;
    }

    // Generate each method
    for (const [method, route] of Object.entries(methods)) {
      yaml += `${method}:\n`;
      yaml += `  summary: "${this.generateSummary(route)}"\n`;

      const params = this.generateParameters(route);
      if (params) {
        yaml += params + '\n';
      }

      const requestBody = this.generateRequestBody(route);
      if (requestBody) {
        yaml += requestBody + '\n';
      }

      yaml += `  responses:\n`;
      yaml += `    "200":\n`;
      yaml += `      description: "Success"\n`;
      yaml += `      content:\n`;
      yaml += `        application/json:\n`;
      yaml += `          schema:\n`;
      yaml += `            type: object\n`;
      yaml += `    "400":\n`;
      yaml += `      description: "Bad Request"\n`;
      yaml += `      content:\n`;
      yaml += `        application/json:\n`;
      yaml += `          schema:\n`;
      yaml += `            $ref: "../../components/schemas/Error.yaml"\n`;
      yaml += `    "500":\n`;
      yaml += `      description: "Internal Server Error"\n`;
      yaml += `      content:\n`;
      yaml += `        application/json:\n`;
      yaml += `          schema:\n`;
      yaml += `            $ref: "../../components/schemas/Error.yaml"\n`;
    }

    return yaml;
  }

  updateMainOpenApiYaml() {
    console.log('📝 Updating main openapi.yaml file...');

    // Read the current openapi.yaml
    const openApiPath = path.join(this.docsDir, 'openapi.yaml');
    let openApiContent = fs.readFileSync(openApiPath, 'utf8');

    // Generate the paths section from our mappings
    const pathsSection = Object.entries(this.pathMappings)
      .map(([pathKey, ref]) => `  ${pathKey}:\n    $ref: '${ref}'`)
      .join('\n');

    // Use regex to replace the paths section
    const pathsRegex = /(paths:[\s\S]*?)(?=components:|$)/;
    openApiContent = openApiContent.replace(
      pathsRegex,
      `paths:\n${pathsSection}\n\n`
    );

    fs.writeFileSync(openApiPath, openApiContent);
  }

  yamlFilenameToPath(resourceDir, yamlFile) {
    // Convert filename back to path
    const method = yamlFile.split('-')[0].toUpperCase();
    const pathPart = yamlFile.replace(/^\w+-/, '').replace('.yaml', '');

    // Convert back to route format
    let routePath = pathPart
      .replace(/-by-/g, '/:')
      .replace(/-by-/g, '/{')
      .replace(/-([a-zA-Z0-9]+)$/g, '/{$1}')
      .replace(/-and-/g, '/')
      .replace(/-([a-zA-Z0-9]+)-/g, '/$1/')
      .replace(/^list$/, '/')
      .replace(/^\//, '');

    if (!routePath.startsWith('/')) {
      routePath = '/' + routePath;
    }

    // Map resource to base path
    const basePaths = {
      auth: '/auth',
      tournaments: '/tournaments',
      fixtures: '/tournaments/{tournamentId}/fixtures',
      players: '/tournaments/{tournamentId}/squads/{squadId}/players',
      squads: '/tournaments/{tournamentId}/squads',
      regions: '/regions',
      system: '/api/system',
      general: '', // general routes might be mixed
    };

    const basePath = basePaths[resourceDir] || `/${resourceDir}`;
    const fullPath = routePath === '/' ? basePath : `${basePath}${routePath}`;

    return fullPath;
  }
}

// Run the generator
if (require.main === module) {
  const generator = new ApiDocGenerator();
  generator.generate().catch(console.error);
}

module.exports = ApiDocGenerator;
