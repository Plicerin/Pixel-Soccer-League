export type MatchRowLike = {
  bundle_json?: string | null;
};

export function isGhostMatchRow(row: MatchRowLike): boolean {
  if (!row?.bundle_json) return false;
  try {
    const bundle = JSON.parse(row.bundle_json);
    return bundle?.sessionActive === false;
  } catch {
    return false;
  }
}

export function filterGhostMatchRows<T extends MatchRowLike>(rows: T[]): T[] {
  return rows.filter((row) => !isGhostMatchRow(row));
}
