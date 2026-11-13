// The Awards page's table shapes (#2546): pure reshaping of the history file and
// the live season into rows of columns, so the page only draws. Spoiler-free: an
// award is not a game result (ADR-0034).

export const ALL_MLB_FIRST_KEY = 'All-MLB First Team'
export const ALL_MLB_SECOND_KEY = 'All-MLB Second Team'
export const ALL_MLB_KEY = 'All-MLB Teams'

// Awards with a roster of winners per league (one per position, or a whole team).
// The live "winners" table folds them behind one button so it stays short.
const ROSTER_KEYS = new Set(['Silver Slugger', 'Gold Glove', ALL_MLB_FIRST_KEY, ALL_MLB_SECOND_KEY])

export function isRosterAward(key) {
  return ROSTER_KEYS.has(key)
}

const LEAGUE_COLUMNS = [
  { key: 'AL', label: 'American League', short: 'AL' },
  { key: 'NL', label: 'National League', short: 'NL' },
]
const ALL_MLB_COLUMNS = [
  { key: 'First', label: 'First Team', short: '1st' },
  { key: 'Second', label: 'Second Team', short: '2nd' },
]
const PLAIN_COLUMNS = [{ key: 'MLB', label: 'Major League Baseball', short: 'MLB' }]

// "Pete Crow-Armstrong" -> ["Pete", "Crow-Armstrong"]; a one-word name is all last name.
export function splitName(full) {
  const name = (full ?? '').trim()
  const i = name.indexOf(' ')
  return i === -1 ? ['', name] : [name.slice(0, i), name.slice(i + 1)]
}

function columnKeyOf(recipient) {
  return recipient.league || 'MLB'
}

// The two All-MLB families as one, each winner tagged with its team in `league`'s
// place, so the history table draws them as two columns like AL and NL.
export function mergeAllMlb(families) {
  const first = families.find((f) => f.key === ALL_MLB_FIRST_KEY)
  const second = families.find((f) => f.key === ALL_MLB_SECOND_KEY)
  const rest = families.filter((f) => f !== first && f !== second)
  if (!first && !second) return rest
  const years = {}
  for (const [fam, tag] of [[first, 'First'], [second, 'Second']]) {
    for (const [year, recipients] of Object.entries(fam?.years ?? {})) {
      years[year] = [...(years[year] ?? []), ...recipients.map((r) => ({ ...r, league: tag }))]
    }
  }
  return [...rest, { key: ALL_MLB_KEY, label: ALL_MLB_KEY, years }]
}

function columnsFor(family) {
  if (family.key === ALL_MLB_KEY) return ALL_MLB_COLUMNS
  const split = Object.values(family.years).some((rs) => rs.some((r) => r.league))
  return split ? LEAGUE_COLUMNS : PLAIN_COLUMNS
}

// One award's past winners: { columns, rows: [{ year, cells: { AL: [...], NL: [...] } }] },
// newest first, leaving out `skipSeason` (the season the live table already shows).
export function pastWinners(family, skipSeason = null) {
  const columns = columnsFor(family)
  const rows = Object.keys(family.years)
    .map(Number)
    .filter((y) => y !== skipSeason)
    .sort((a, b) => b - a)
    .map((year) => {
      const cells = Object.fromEntries(columns.map((c) => [c.key, []]))
      for (const r of family.years[year]) cells[columnKeyOf(r)]?.push(r)
      return { year, cells }
    })
  return { columns, rows }
}

// The live season's families (loadSeasonAwards) as table rows: { key, label, split,
// cells: [{ league, status, recipients }] }. A league-less award is one cell.
export function seasonRows(families) {
  return families.map((f) => ({
    key: f.key,
    label: f.label,
    split: f.awards.some((a) => a.league),
    cells: f.awards.map((a) => ({ id: a.id, league: a.league, status: a.status, recipients: a.recipients ?? [] })),
  }))
}

export function countAnnounced(families) {
  return families.filter((f) => f.awards.every((a) => a.status === 'announced')).length
}
