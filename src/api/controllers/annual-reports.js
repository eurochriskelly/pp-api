const annualReportsServiceFactory = require('../services/annual-reports');

module.exports = (db) => {
  const service = annualReportsServiceFactory(db);

  return {
    getYearsSummary: async (req, res, next) => {
      try {
        const years = await service.getYearsSummary();
        res.json({ data: years });
      } catch (err) {
        next(err);
      }
    },

    getAnnualReport: async (req, res, next) => {
      try {
        const { year } = req.params;
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum)) {
          return res.status(400).json({ error: 'Invalid year parameter' });
        }
        const report = await service.getAnnualReport(yearNum);
        res.json({ data: report });
      } catch (err) {
        if (err.message === 'No data found for year') {
          return res.status(404).json({ error: err.message });
        }
        next(err);
      }
    },
  };
};
