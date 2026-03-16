import fs from 'fs';
import path from 'path';

export interface RouteDefinition {
  method: string;
  path: string;
  source: string;
}

const ROUTE_BASES: Array<{ file: string; basePath: string }> = [
  {
    file: 'src/api/routes/tournaments/index.ts',
    basePath: '/api/tournaments',
  },
  {
    file: 'src/api/routes/tournaments/fixtures/index.ts',
    basePath: '/api/tournaments/:tournamentId/fixtures',
  },
  {
    file: 'src/api/routes/tournaments/teams/index.ts',
    basePath: '/api/tournaments/:tournamentId/teams',
  },
  { file: 'src/api/routes/regions/index.ts', basePath: '/api/regions' },
  { file: 'src/api/routes/general.ts', basePath: '/api' },
  { file: 'src/api/routes/auth/index.ts', basePath: '/api/auth' },
  { file: 'src/api/routes/system/index.ts', basePath: '/api/system' },
  { file: 'src/api/routes/clubs/index.ts', basePath: '/api/clubs' },
  {
    file: 'src/api/routes/annual-reports/index.ts',
    basePath: '/api/annual-reports',
  },
  { file: 'src/api/routes/teams/index.ts', basePath: '/api/teams' },
  { file: 'src/api/routes/series/index.ts', basePath: '/api/series' },
  { file: 'src/api/routes/rulesets/index.ts', basePath: '/api/rulesets' },
  {
    file: 'src/api/routes/championships/index.ts',
    basePath: '/api/championships',
  },
  { file: 'src/api/routes/events/index.ts', basePath: '/api/events' },
  { file: 'src/api/routes/listings/index.ts', basePath: '/api/listings' },
  { file: 'src/api/routes/users/index.ts', basePath: '/api' },
  { file: 'src/api/routes/internal/index.ts', basePath: '/api/internal' },
];

const DIRECT_ROUTES: RouteDefinition[] = [
  {
    method: 'POST',
    path: '/api/tournaments/:tournamentId/club/:clubId/teamsheet',
    source: 'src/api/index.ts',
  },
  { method: 'POST', path: '/api/clubs/:id/logo', source: 'src/api/index.ts' },
  { method: 'POST', path: '/api/teams/:id/logo', source: 'src/api/index.ts' },
  { method: 'POST', path: '/api/upload', source: 'src/api/index.ts' },
  { method: 'GET', path: '/health', source: 'src/api/index.ts' },
];

export function loadRouteInventory(rootDir: string): RouteDefinition[] {
  const routes: RouteDefinition[] = [...DIRECT_ROUTES];

  ROUTE_BASES.forEach(({ file, basePath }) => {
    const absolutePath = path.resolve(rootDir, file);
    if (!fs.existsSync(absolutePath)) return;

    const source = fs.readFileSync(absolutePath, 'utf8');
    const routeMatches = source.matchAll(
      /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g
    );

    for (const match of routeMatches) {
      const method = match[1].toUpperCase();
      const routePath = normalizePath(basePath, match[2]);
      routes.push({
        method,
        path: routePath,
        source: file,
      });
    }
  });

  return routes.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });
}

function normalizePath(basePath: string, routePath: string): string {
  if (routePath === '/') return basePath;

  return `${basePath.replace(/\/+$/, '')}/${routePath.replace(/^\/+/, '')}`;
}
