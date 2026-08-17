export function buildIlikeOrFilter(columns: readonly string[], value: string): string {
  const escaped = value
    .trim()
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const pattern = `"%${escaped}%"`;

  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
