import { ReportBuilder } from './ReportBuilder';
import { JsonExporter } from './exporters/JsonExporter';
import { CsvExporter } from './exporters/CsvExporter';

export interface SelectFunction {
  (sql: string, params?: any[]): Promise<any[]>;
}

export async function buildReport(
  tournamentId: number,
  select: SelectFunction,
  category?: string
): Promise<any> {
  const reportBuilder = new ReportBuilder(select);
  const reportData = await reportBuilder.build(tournamentId, category);

  const exporter = new JsonExporter();
  const result = exporter.export(reportData) as any;

  if (category) {
    result.categories = result.categories.filter(
      (cat: any) => cat.category.toUpperCase() === category.toUpperCase()
    );
  }
  return result;
}

export async function buildReportCSV(
  tournamentId: number,
  select: SelectFunction
): Promise<{
  tournamentInfo: (string | number)[][];
  fixtures: (string | number)[][];
  standings: (string | number)[][];
}> {
  const reportBuilder = new ReportBuilder(select);
  const reportData = await reportBuilder.build(tournamentId);

  const exporter = new CsvExporter();
  return exporter.export(reportData);
}

export { ReportBuilder, JsonExporter, CsvExporter };
export default { buildReport, buildReportCSV };
