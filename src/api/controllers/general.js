const { II } = require("../../lib/logging");
const { jsonToCsv, sendXsls } = require("../../lib/utils");
const generalService = require("../services/general.service");

module.exports = (db) => {
  const generalSvc = generalService(db);

  return {
    listPitches: async (req, res) => {
      try {
        const pitches = await generalSvc.listPitches(req.params.tournamentId);
        res.json({ data: pitches });
      } catch (err) {
        throw err;
      }
    },

    listStandings: async (req, res) => {
      const { tournamentId } = req.params;
      const { format = "json", category } = req.query;
      try {
        const { groups, data } = await generalSvc.listStandings(tournamentId, category);
        switch (format) {
          case "csv":
            const csv = jsonToCsv(data);
            res.setHeader("Content-Disposition", 'attachment; filename="standings.csv"');
            res.set("Content-Type", "text/csv; charset=utf-8");
            res.send(csv);
            break;
          case "xlsx":
            sendXsls(data, res, "standings");
            break;
          default:
            res.json({ groups, data });
            break;
        }
      } catch (err) {
        throw err;
      }
    },
  };
};

