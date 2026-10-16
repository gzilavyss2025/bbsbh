// THE GAME LOG PAGER (#2086), shared by the batter log (#1890) and the pitcher log (#1851) so the two
// read as one part. Board "BatterGameLog": a first page, then "Show 20 more · N left"; when none are
// left the button reads "Show less" and folds back to the first page. No row is lost.
export const STEP = 20

// `limit` is how many rows show now (Infinity is all of them); `first` is the first page.
export function pageOf(total, limit, first, step = STEP) {
  const left = Math.max(0, total - limit)
  return {
    canToggle: total > first,
    left,
    label: left > 0 ? `Show ${Math.min(step, left)} more · ${left} left` : 'Show less',
    next: left > 0 ? limit + step : first,
  }
}
