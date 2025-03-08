const XLSX = require('xlsx');

module.exports = {
  jsonToCsv,
  sendXsls,
  mysqlCurrentTime,
}

function mysqlCurrentTime() {
  const pad = (number) => number.toString().padStart(2, '0');
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

function jsonToCsv(jsonData) {
  const fields = Object.keys(jsonData[0]);
  const replacer = (key, value) => (value === null ? "" : value);
  const csv = jsonData.map((row) =>
    fields
      .map((fieldName) => JSON.stringify(row[fieldName], replacer))
      .join(",")
  );
  csv.unshift(fields.join(","));
  return csv.join("\r\n");
}

function sendXsls(jsonData, res, sheetname) {
  console.log('Request to send data as xsl format: ' + sheetname);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(jsonData);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetname);
  console.log('foo')

  // Generate the XLSX file
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

  // Set headers and send the file
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="data_${sheetname}.xlsx"`
  );
  res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
}
