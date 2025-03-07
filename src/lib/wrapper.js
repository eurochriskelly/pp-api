module.exports = (app) => ({
  GET: (path) => {
    const pathVars = path
      .split("/")
      .filter((x) => x.trim())
      .filter((x) => x.startsWith(":"));
    return pathVars;
  },
});
