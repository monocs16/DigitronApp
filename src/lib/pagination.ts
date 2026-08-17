export const MAX_PAGE_SIZE = 50;

export type PaginatedResult<Row> = {
  rows: Row[];
  count: number;
};

export type PageRequest = {
  page: number;
  pageSize?: number;
  search?: string;
};

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

export function getPageRange(page: number, requestedPageSize = MAX_PAGE_SIZE) {
  const normalizedPage = normalizePositiveInteger(page, 1);
  const pageSize = Math.min(
    normalizePositiveInteger(requestedPageSize, MAX_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const from = (normalizedPage - 1) * pageSize;

  return { from, to: from + pageSize - 1, pageSize };
}

export function getPaginationSummary(page: number, pageSize: number, count: number) {
  const normalizedCount = Math.max(0, Math.floor(count));
  const range = getPageRange(page, pageSize);
  const totalPages = Math.max(1, Math.ceil(normalizedCount / range.pageSize));

  if (normalizedCount === 0) return { from: 0, to: 0, totalPages };

  return {
    from: range.from + 1,
    to: Math.min(range.to + 1, normalizedCount),
    totalPages,
  };
}

export function clampPageToCount(page: number, count: number, pageSize: number): number {
  const { totalPages } = getPaginationSummary(page, pageSize, count);
  return Math.min(normalizePositiveInteger(page, 1), totalPages);
}
