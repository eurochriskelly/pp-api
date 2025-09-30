const { ReportBuilder } = require('./ReportBuilder');
const { JsonExporter } = require('./exporters/JsonExporter');
const { CsvExporter } = require('./exporters/CsvExporter');

module.exports = {
  buildReport,
  buildReportCSV,
};

async function buildReport(tournamentId, select, category) {
  const reportBuilder = new ReportBuilder(select);
  const reportData = await reportBuilder.build(tournamentId, category);

  const exporter = new JsonExporter();
  const result = exporter.export(reportData);

  // If a category is specified, filter the categories array
  if (category) {
    result.categories = result.categories.filter(
      (cat) => cat.category.toUpperCase() === category.toUpperCase()
    );
  }
  return result;
}

async function buildReportCSV(tournamentId, select) {
  const reportBuilder = new ReportBuilder(select);
  const reportData = await reportBuilder.build(tournamentId);

  const exporter = new CsvExporter();
  return exporter.export(reportData);
}
