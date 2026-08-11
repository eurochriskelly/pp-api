const test = require('node:test');
const assert = require('node:assert/strict');

const tournamentRoutes =
  require('../../../../src/api/routes/tournaments').default;
const fixtureRoutes =
  require('../../../../src/api/routes/tournaments/fixtures').default;

function routes(router) {
  return router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => ({
        method: method.toUpperCase(),
        path: layer.route.path,
      }))
    );
}

function assertRoute(routeList, method, path) {
  assert.ok(
    routeList.some((route) => route.method === method && route.path === path),
    `Expected ${method} ${path} to be registered`
  );
}

test('routes registered for advertised fixture import and match-day capabilities', () => {
  const tournamentRouteList = routes(tournamentRoutes({ main: {} }, true));
  const fixtureRouteList = routes(fixtureRoutes({ main: {} }, true));

  assertRoute(tournamentRouteList, 'POST', '/:tournamentId/validate-tsv');
  assertRoute(tournamentRouteList, 'POST', '/:tournamentId/fixtures');
  assertRoute(tournamentRouteList, 'PUT', '/:tournamentId/status');
  assertRoute(tournamentRouteList, 'POST', '/:tournamentId/reset');
  assertRoute(tournamentRouteList, 'POST', '/:tournamentId/squads');
  assertRoute(tournamentRouteList, 'PUT', '/:tournamentId/squads/:squadId');
  assertRoute(tournamentRouteList, 'DELETE', '/:tournamentId/squads/:squadId');
  assertRoute(
    tournamentRouteList,
    'GET',
    '/:tournamentId/squads/:squadId/players'
  );
  assertRoute(
    tournamentRouteList,
    'POST',
    '/:tournamentId/squads/:squadId/players'
  );
  assertRoute(
    tournamentRouteList,
    'DELETE',
    '/:tournamentId/squads/:squadId/players/:playerId'
  );
  assertRoute(fixtureRouteList, 'GET', '/');
  assertRoute(fixtureRouteList, 'POST', '/:fixtureId/start');
  assertRoute(fixtureRouteList, 'POST', '/:fixtureId/score');
  assertRoute(fixtureRouteList, 'POST', '/:fixtureId/end');
  assertRoute(fixtureRouteList, 'PUT', '/rewind');
  assertRoute(fixtureRouteList, 'POST', '/:fixtureId/carded');
});
