const { ReportBuilder } = require('./ReportBuilder');
const { JsonExporter } = require('./exporters/JsonExporter');
const { CsvExporter } = require('./exporters/CsvExporter');

module.exports = {
  buildReport,
  buildReportCSV,
};

async function buildReport(tournamentId, select) {
  const reportBuilder = new ReportBuilder(select);
  const reportData = await reportBuilder.build(tournamentId);

  const exporter = new JsonExporter();
  return exporter.export(reportData);
}

async function buildReportCSV(tournamentId, select) {
  const reportBuilder = new ReportBuilder(select);
  const reportData = await reportBuilder.build(tournamentId);

  const exporter = new CsvExporter();
  return exporter.export(reportData);
}
