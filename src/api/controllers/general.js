const { II } = require("../../lib/logging");
const { jsonToCsv, sendXsls } = require("../../lib/utils");
const generalService = require("../services/general.service");

module.exports = (db) => {
  const dbSvc = generalService(db);

  return {

    listTeams: async (req, res) => {
      try {
        const phase = req.query.stage.split('_').shift();
        const groupNumber = req.query.group || 0;
        const teams = await dbSvc.listTeams(
          req.params.tournamentId,
          req.query.category,
          phase,
          groupNumber,
        );
        res.json({ data: teams });
      } catch (err) {
        console.log(err);
        res.status(500).json({ code: 500, message: 'Internal Server Error' });
      }
    },

    listPitches: async (req, res) => {
      try {
        const pitches = await dbSvc.listPitches(req.params.tournamentId);
        res.json({ data: pitches });
      } catch (err) {
        console.log(err);
        res.status(500).json({ code: 500, message: 'Internal Server Error' });
      }
    },

    listStandings: async (req, res) => {
      const { tournamentId } = req.params;
      const { format = "json", category } = req.query;
      try {
        const { groups, data } = await dbSvc.listStandings(tournamentId, category);
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
        console.log(err);
        res.status(500).json({ code: 500, message: 'Internal Server Error' });
      }
    },
  };
};

