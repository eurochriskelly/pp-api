/**
 * Exporter for JSON format (default)
 */
export class JsonExporter {
  export(reportData: unknown): unknown {
    // For JSON format, we simply return the data as-is
    return reportData;
  }
}

export default JsonExporter;
