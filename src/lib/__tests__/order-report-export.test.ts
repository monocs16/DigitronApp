import { describe, expect, it } from "vitest";
import { buildReportCsv, buildReportExcel } from "@/lib/order-report-export";

describe("buildReportCsv", () => {
  it("keeps the requested column order and escapes CSV values", () => {
    const csv = buildReportCsv(["Cliente", "Orden"], [["Pérez, Juan", 'RPT-"001"']]);

    expect(csv).toBe('\uFEFFCliente,Orden\r\n"Pérez, Juan","RPT-""001"""');
  });

  it("protects spreadsheet programs from formulas without changing numbers", () => {
    const csv = buildReportCsv(["Texto", "Total"], [["=2+2", 1250.5]]);

    expect(csv).toContain("'=2+2,1250.5");
  });
});

describe("buildReportExcel", () => {
  it("creates an Excel worksheet with ordered headers and typed numbers", () => {
    const excel = buildReportExcel("Órdenes/servicio", ["Total", "Cliente"], [[1250.5, "A&B"]]);

    expect(excel).toContain('ss:Name="Órdenes servicio"');
    expect(excel.indexOf("Total")).toBeLessThan(excel.indexOf("Cliente"));
    expect(excel).toContain('<Data ss:Type="Number">1250.5</Data>');
    expect(excel).toContain("A&amp;B");
  });

  it("exports formula-like text as literal text", () => {
    const excel = buildReportExcel("Reporte", ["Texto"], [["@SUM(A1:A2)"]]);

    expect(excel).toContain("&apos;@SUM(A1:A2)");
    expect(excel).not.toContain("ss:Formula");
  });
});
