// THE SEASON VIEW (#1202). A page that reads a season store shows one season,
// every season combined, or one season compared with another. The address
// carries the request (lib/route.js's seasonParams: `seasonYear` a year or
// 'all', `vs` a year); the store's seasons.json says what is on file. This
// resolves one against the other, and words what the page prints about it.
//
// Pure, no fetch. hooks/useSeasonView.js reads the index and calls it.

// The rule is staticJson.js's seasonFolderOf, so the page and its reader can
// never disagree: nothing, or a year not on file, is `current`. `current` is
// the latest season with data, so in winter it still names the last complete
// season, until the new season's first game is on file (#1199, question 4).
//
// `vs` is a second season on file. It is dropped for 'all' (already every
// season) and for the shown season itself.
//
// -> { seasons, current, shown, vs, label }. `shown` is a year, 'all', or null
// when the store has no index yet. `label` names the years `shown` covers.
export function resolveSeasonView({ seasons = [], current = null } = {}, { seasonYear, vs } = {}) {
  const onFile = (y) => y != null && seasons.includes(Number(y))
  const shown = seasonYear === 'all' ? (seasons.length ? 'all' : null) : onFile(seasonYear) ? Number(seasonYear) : current
  const compare = shown != null && shown !== 'all' && onFile(vs) && Number(vs) !== shown ? Number(vs) : null
  return {
    seasons,
    current,
    shown,
    vs: compare,
    label: shown === 'all' ? seasonRangeLabel(seasons) : shown == null ? '' : String(shown),
  }
}

// The years a combined figure covers, first to last: '2026–2027'. A reader must
// see how many seasons are in the number, so a combined view never says only
// "All". One season is just that year.
export function seasonRangeLabel(seasons) {
  if (!seasons?.length) return ''
  const first = Math.min(...seasons)
  const last = Math.max(...seasons)
  return first === last ? String(first) : `${first}–${last}`
}

// The picker's choices: each season, newest first, then every season
// combined. None when only one season is on file — a picker with one choice
// is not a choice, and "all" would be that same season.
export function seasonOptions(view) {
  if ((view?.seasons?.length ?? 0) < 2) return []
  return [
    ...[...view.seasons].sort((a, b) => b - a).map((y) => ({ key: y, label: String(y) })),
    { key: 'all', label: `All ${seasonRangeLabel(view.seasons)}` },
  ]
}

// The compare choices for a one-season view: every other season, newest first.
export function compareOptions(view) {
  if (view?.shown == null || view.shown === 'all') return []
  return view.seasons
    .filter((y) => y !== view.shown)
    .sort((a, b) => b - a)
    .map((y) => ({ key: y, label: `vs ${y}` }))
}

const DIGITS = { count: 0, dec1: 1, dec2: 2, pct: 1 }
const finite = (v) => typeof v === 'number' && Number.isFinite(v)

// One figure in its unit: 'count', 'dec1', 'dec2', or 'pct' (a fraction,
// printed as a percentage). A season with no figure prints a dash.
export function seasonValue(v, format) {
  if (!finite(v)) return '—'
  const shown = format === 'pct' ? v * 100 : v
  return `${shown.toFixed(DIGITS[format] ?? 0)}${format === 'pct' ? '%' : ''}`
}

// A change between two seasons, worded with what it compares: '+3.1% vs 2026'.
// A rate's change is the difference of the two rates, in the rate's own unit.
// Null when either season has no figure (a rookie has no 2026 row): no change
// is not a zero change.
export function seasonDelta(cur, prev, vsYear, format) {
  if (!finite(cur) || !finite(prev)) return null
  const scale = format === 'pct' ? 100 : 1
  const digits = DIGITS[format] ?? 0
  const diff = Number(((cur - prev) * scale).toFixed(digits))
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±'
  return `${sign}${Math.abs(diff).toFixed(digits)}${format === 'pct' ? '%' : ''} vs ${vsYear}`
}

// A leader board's compare column, for a compare season `vs` (null: no
// column). `mode` 'change' prints the change in this row's figure; 'side'
// prints the other season's figure beside this one (#1199, question 3).
// `cell(cur, prev)` takes this season's figure and the vs season's.
export function compareColumn(vs, mode, format) {
  if (vs == null) return null
  return mode === 'side'
    ? { head: String(vs), cell: (cur, prev) => seasonValue(prev, format) }
    : { head: 'Change', cell: (cur, prev) => seasonDelta(cur, prev, vs, format) ?? '—' }
}

// The same column for a board of rows: `value(row)` reads a row's figure, and
// `prevOf(row)` finds that row in the vs season, or null (a 2027 rookie has no
// 2026 row, and his cell is the dash). -> { head, cell(row) }, or null with no
// compare season.
export function boardCompare({ vs, mode, format, value, prevOf }) {
  const col = compareColumn(vs, mode, format)
  if (!col) return null
  return {
    head: col.head,
    cell: (row) => {
      const prev = prevOf(row)
      return col.cell(value(row), prev == null ? null : value(prev))
    },
  }
}
