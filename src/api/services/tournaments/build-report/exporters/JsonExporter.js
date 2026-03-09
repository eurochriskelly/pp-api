/**
 * Exporter for JSON format (default)
 */
class JsonExporter {
  export(reportData) {
    // For JSON format, we simply return the data as-is
    return reportData;
  }
}

module.exports = { JsonExporter };
