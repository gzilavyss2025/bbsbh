// The jump-bar groups of the live World Series page (layout C). Pure. A group with no data is
// left out, and the page draws no section for it either. Input: { now, series, scout, compare,
// rosters }, each a boolean. -> [{ key, label }] in page order.
const GROUPS = [
  { key: 'now', label: 'Now' },
  { key: 'series', label: 'Series' },
  { key: 'scout', label: 'Scout' },
  { key: 'compare', label: 'Compare' },
  { key: 'rosters', label: 'Rosters' },
]

export const seriesGroups = (has) => GROUPS.filter((g) => has[g.key])
