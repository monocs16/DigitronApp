export type ReportExportCell = string | number | null | undefined;

function protectSpreadsheetText(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: ReportExportCell) {
  const text =
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : protectSpreadsheetText(value == null ? "" : String(value));

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function excelCell(value: ReportExportCell, styleId?: string) {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell${style}><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  const text = protectSpreadsheetText(value == null ? "" : String(value));
  return `<Cell${style}><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
}

export function buildReportCsv(headers: string[], rows: ReportExportCell[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildReportExcel(sheetName: string, headers: string[], rows: ReportExportCell[][]) {
  const safeSheetName =
    sheetName
      .replaceAll(/[\\/?*[\]:]/g, " ")
      .trim()
      .slice(0, 31) || "Reporte";
  const worksheetRows = [
    `<Row>${headers.map((header) => excelCell(header, "Header")).join("")}</Row>`,
    ...rows.map((row) => `<Row>${row.map((cell) => excelCell(cell)).join("")}</Row>`),
  ].join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style></Styles>',
    `<Worksheet ss:Name="${escapeXml(safeSheetName)}"><Table>${worksheetRows}</Table></Worksheet>`,
    "</Workbook>",
  ].join("");
}
