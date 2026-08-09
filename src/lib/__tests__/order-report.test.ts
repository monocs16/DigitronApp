import { describe, expect, it } from "vitest";
import {
  filterReportRows,
  matchesReportFilter,
  type ReportField,
  type ReportFilter,
} from "@/lib/order-report";

describe("matchesReportFilter", () => {
  it("compares text without case or accent differences", () => {
    expect(matchesReportFilter("Diagnóstico eléctrico", "text", "contains", "ELECTRICO")).toBe(
      true,
    );
    expect(matchesReportFilter("ABC-123", "text", "starts_with", "abc")).toBe(true);
  });

  it("uses numeric comparisons instead of lexicographic comparisons", () => {
    expect(matchesReportFilter(100, "number", "greater_than", "20")).toBe(true);
    expect(matchesReportFilter(10, "number", "less_than_or_equal", "10")).toBe(true);
    expect(matchesReportFilter(10, "number", "equals", "not-a-number")).toBe(false);
  });

  it("compares dates by calendar day", () => {
    expect(matchesReportFilter("2026-08-09T23:30:00Z", "date", "equals", "2026-08-09")).toBe(true);
    expect(matchesReportFilter("2026-08-08", "date", "before", "2026-08-09")).toBe(true);
  });

  it("supports empty and boolean operators", () => {
    expect(matchesReportFilter(null, "text", "is_empty", "")).toBe(true);
    expect(matchesReportFilter("value", "text", "is_not_empty", "")).toBe(true);
    expect(matchesReportFilter(true, "boolean", "is_true", "")).toBe(true);
    expect(matchesReportFilter(false, "boolean", "is_false", "")).toBe(true);
  });
});

describe("filterReportRows", () => {
  type Row = { name: string; total: number; closed: boolean };
  const fields: ReportField<Row>[] = [
    { id: "name", label: "Name", group: "Order", type: "text", value: (row) => row.name },
    {
      id: "total",
      label: "Total",
      group: "Budget",
      type: "number",
      value: (row) => row.total,
    },
    {
      id: "closed",
      label: "Closed",
      group: "Order",
      type: "boolean",
      value: (row) => row.closed,
    },
  ];
  const rows: Row[] = [
    { name: "Televisor", total: 100, closed: false },
    { name: "Radio", total: 25, closed: true },
    { name: "Parlante", total: 150, closed: true },
  ];

  it("groups AND conditions and starts an alternative with OR", () => {
    const filters: ReportFilter[] = [
      { id: "1", field: "total", operator: "greater_than", value: "50", connector: "and" },
      { id: "2", field: "closed", operator: "is_false", value: "", connector: "and" },
      { id: "3", field: "name", operator: "equals", value: "Radio", connector: "or" },
    ];

    expect(filterReportRows(rows, fields, filters)).toEqual([rows[0], rows[1]]);
  });
});
