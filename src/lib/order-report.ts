export type ReportFieldType = "text" | "number" | "date" | "boolean";

export type ReportOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false";

export type FilterConnector = "and" | "or";

export type ReportFilter = {
  id: string;
  field: string;
  operator: ReportOperator;
  value: string;
  connector: FilterConnector;
};

export type ReportValue = string | number | boolean | null | undefined;

export type ReportField<Row> = {
  id: string;
  label: string;
  group: string;
  type: ReportFieldType;
  value: (row: Row) => ReportValue;
  format?: (value: ReportValue) => string;
};

export const OPERATORS_BY_TYPE: Record<ReportFieldType, ReportOperator[]> = {
  text: [
    "contains",
    "not_contains",
    "equals",
    "not_equals",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  number: [
    "equals",
    "not_equals",
    "greater_than",
    "greater_than_or_equal",
    "less_than",
    "less_than_or_equal",
    "is_empty",
    "is_not_empty",
  ],
  date: [
    "equals",
    "not_equals",
    "before",
    "after",
    "on_or_before",
    "on_or_after",
    "is_empty",
    "is_not_empty",
  ],
  boolean: ["is_true", "is_false"],
};

export const VALUELESS_OPERATORS = new Set<ReportOperator>([
  "is_empty",
  "is_not_empty",
  "is_true",
  "is_false",
]);

function isEmpty(value: ReportValue) {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeText(value: ReportValue) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function dateOnly(value: ReportValue) {
  if (isEmpty(value)) return Number.NaN;
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function matchesReportFilter(
  value: ReportValue,
  type: ReportFieldType,
  operator: ReportOperator,
  expected: string,
) {
  if (operator === "is_empty") return isEmpty(value);
  if (operator === "is_not_empty") return !isEmpty(value);
  if (operator === "is_true") return value === true;
  if (operator === "is_false") return value === false;

  if (type === "number") {
    if (isEmpty(value) || expected.trim() === "") return false;
    const actualNumber = Number(value);
    const expectedNumber = Number(expected);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    if (operator === "equals") return actualNumber === expectedNumber;
    if (operator === "not_equals") return actualNumber !== expectedNumber;
    if (operator === "greater_than") return actualNumber > expectedNumber;
    if (operator === "greater_than_or_equal") return actualNumber >= expectedNumber;
    if (operator === "less_than") return actualNumber < expectedNumber;
    if (operator === "less_than_or_equal") return actualNumber <= expectedNumber;
    return false;
  }

  if (type === "date") {
    const actualDate = dateOnly(value);
    const expectedDate = dateOnly(expected);
    if (!Number.isFinite(actualDate) || !Number.isFinite(expectedDate)) return false;
    if (operator === "equals") return actualDate === expectedDate;
    if (operator === "not_equals") return actualDate !== expectedDate;
    if (operator === "before") return actualDate < expectedDate;
    if (operator === "after") return actualDate > expectedDate;
    if (operator === "on_or_before") return actualDate <= expectedDate;
    if (operator === "on_or_after") return actualDate >= expectedDate;
    return false;
  }

  const actualText = normalizeText(value);
  const expectedText = normalizeText(expected);
  if (operator === "contains") return actualText.includes(expectedText);
  if (operator === "not_contains") return !actualText.includes(expectedText);
  if (operator === "equals") return actualText === expectedText;
  if (operator === "not_equals") return actualText !== expectedText;
  if (operator === "starts_with") return actualText.startsWith(expectedText);
  if (operator === "ends_with") return actualText.endsWith(expectedText);
  return false;
}

export function filterReportRows<Row>(
  rows: Row[],
  fields: ReportField<Row>[],
  filters: ReportFilter[],
) {
  if (filters.length === 0) return rows;
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  return rows.filter((row) => {
    let currentAndGroup = true;
    let anyOrGroup = false;

    for (const [index, filter] of filters.entries()) {
      const field = fieldsById.get(filter.field);
      if (!field) continue;
      const matches = matchesReportFilter(
        field.value(row),
        field.type,
        filter.operator,
        filter.value,
      );

      if (index > 0 && filter.connector === "or") {
        anyOrGroup ||= currentAndGroup;
        currentAndGroup = matches;
      } else {
        currentAndGroup &&= matches;
      }
    }

    return anyOrGroup || currentAndGroup;
  });
}

export function formatReportValue<Row>(field: ReportField<Row>, row: Row, emptyLabel: string) {
  const value = field.value(row);
  if (isEmpty(value)) return emptyLabel;
  if (field.format) return field.format(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}
