const refresh = (path) => {
  const modulePath = require.resolve(path);
  delete require.cache[modulePath];
  return require(modulePath);
}

let routes = require('./routes');
const useMockEndpoints = (app) => {
  Object.keys(routes).forEach(route => {
    const value = routes[route];
    app.get(route, async (req, res) => {
      console.log('Requested route: ', route);
      const data = refresh(`./data/${value}.js`);
      console.log('Route', route);
      res.json(data);
      routes = refresh('./routes');
    })
  })
}

module.exports = {
  useMockEndpoints,
}

