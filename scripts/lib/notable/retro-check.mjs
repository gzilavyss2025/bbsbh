// The pure half of `gen-notable.mjs --check-retrosheet`, part 1: read the Retrosheet rows
// and give every game one label. retro-report.mjs prints it, retro-run.mjs does the files.
//
// THE CHECK IS A REPORT. It writes no index row and no seed row. A person adds a seed row
// to scripts/notable-seed.json when a `missed` row is a true miss (D3). Retrosheet is a
// build-time source run by hand (ADR-0100): the caller passes extracted CSV rows, and
// nothing here downloads.
//
// MATCHING NEEDS NO TEAM-CODE TABLE. A Retrosheet game matches an index row by the same
// official date and the same away and home runs. Either game of a doubleheader day
// matches, because the API and Retrosheet number some old doubleheaders in opposite
// orders (the 1904-06-20 case, .scratch/old-games/findings.md Step 1). The side must also
// agree: the side of the club that threw the no-hitter, and of the club that turned the
// triple play, which is how the index row's `side` reads (see featSide below). A score coincidence on a day with a different club is a known weakness of this
// join, so the report prints the clubs on both sides for a person to read.
//
// WHAT RETROSHEET HOLDS (nohitters.zip and tripleplays.zip, 2026-10-06). gameinfo.csv has
// one row per game. teamstats.csv has one row per club per game: `b_h` is the club's hits,
// `d_tp` its triple plays in the field, `vishome` its side ('v' or 'h'). Every listed game
// has exactly one qualifying club in both files.
import { isKeptGame, isMajorLeagueClub, isPlayed } from './rules.mjs'

// The seven labels, in the order the report prints them.
export const LABELS = [
  'matched', 'side-differs', 'out-of-scope-type', 'season-not-swept',
  'dropped-league', 'not-in-api', 'missed',
]

// The kinds this check covers. Retrosheet has no cycle list today: cycles.zip is a copy of
// 3HR.zip (findings.md Step 2).
export const CHECK_KINDS = ['nohitters', 'tripleplays']

// The teamstats column that picks the club, for each kind.
const KIND_COLUMN = { nohitters: 'b_h', tripleplays: 'd_tp' }
const qualifies = {
  nohitters: (row) => row.b_h === '0',
  tripleplays: (row) => Number(row.d_tp) > 0,
}
// The index row's `side` is the club that DID the feat: for a no-hitter, the club that
// threw it (kinds.mjs noHitterRow), which is the OTHER club than the one with 0 hits; for a
// triple play, the club that turned it. `clubSide` is the side of the qualifying club.
const featSide = {
  nohitters: (clubSide) => (clubSide === 'away' ? 'home' : 'away'),
  tripleplays: (clubSide) => clubSide,
}

const GAMEINFO_COLUMNS = ['gid', 'visteam', 'hometeam', 'date', 'number', 'vruns', 'hruns', 'gametype', 'forfeit', 'season']
const TEAMSTATS_COLUMNS = ['gid', 'team', 'vishome']

// Not a Retrosheet game type the index may hold (D6, D13).
const OUT_OF_SCOPE = new Set(['exhibition', 'allstar'])

// A bad input file: a missing file or a lost column. The run exits 1 for this and for
// nothing else.
export class RetroInputError extends Error {}

function requireColumns(rows, file, columns) {
  if (!rows.length) return
  const missing = columns.filter((c) => !(c in rows[0]))
  if (missing.length) throw new RetroInputError(`${file} has no "${missing.join('", "')}" column`)
}

const isoDate = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`

// One entry per Retrosheet game and qualifying club (a game where both clubs qualify gives
// two). `gameinfoRows` and `teamstatsRows` are lib/csv.mjs parseCsv of the two files.
export function retroEntries(kind, gameinfoRows, teamstatsRows) {
  requireColumns(gameinfoRows, 'gameinfo.csv', GAMEINFO_COLUMNS)
  requireColumns(teamstatsRows, 'teamstats.csv', [...TEAMSTATS_COLUMNS, KIND_COLUMN[kind]])
  const byGid = new Map()
  for (const row of teamstatsRows) {
    if (!byGid.has(row.gid)) byGid.set(row.gid, [])
    byGid.get(row.gid).push(row)
  }
  const entries = []
  for (const g of gameinfoRows) {
    const sides = (byGid.get(g.gid) ?? [])
      .filter(qualifies[kind])
      .map((r) => featSide[kind](r.vishome === 'v' ? 'away' : 'home'))
    if (!sides.length) {
      throw new RetroInputError(`${kind}: game ${g.gid} has no club with ${KIND_COLUMN[kind]} to match in teamstats.csv`)
    }
    for (const side of sides) {
      entries.push({
        kind,
        gid: g.gid,
        date: isoDate(g.date),
        number: Number(g.number),
        vis: g.visteam,
        home: g.hometeam,
        vruns: Number(g.vruns),
        hruns: Number(g.hruns),
        gametype: g.gametype,
        forfeit: g.forfeit,
        season: Number(g.season) || Number(g.date.slice(0, 4)),
        side,
      })
    }
  }
  return entries
}

const sameScore = (entry, away, home) => away === entry.vruns && home === entry.hruns

// The index rows of this kind on the entry's date with the entry's score.
const indexCandidates = (entry, doc) =>
  (doc?.rows ?? []).filter((r) => r.officialDate === entry.date && sameScore(entry, r.away?.runs, r.home?.runs))

// What the API says about a date and score: the played games with that score.
function classifyApi(entry, games) {
  const same = (games ?? []).filter((g) => isPlayed(g) && sameScore(entry, g.away.runs, g.home.runs))
  if (!same.length) return { label: 'not-in-api', games: [] }
  const kept = same.filter(isKeptGame)
  if (kept.length) return { label: 'missed', games: kept }
  // Both clubs are major league but the game type is not one the index keeps (a spring
  // game, say): the index leaves it out on purpose, as it does an exhibition.
  const majors = same.filter((g) => isMajorLeagueClub(g.away) && isMajorLeagueClub(g.home))
  if (majors.length) return { label: 'out-of-scope-type', games: majors }
  return { label: 'dropped-league', games: same }
}

// -> one result per entry: { ...entry, label, gamePks, api }. `index` is { kind: doc } for
// the kinds being checked. `scheduleFor(date)` -> the day's games in games.mjs gameFromRow
// shape. It is called at most once for each date, and only for a game the index does not
// explain.
export async function labelEntries(entries, index, scheduleFor) {
  const days = new Map()
  const dayOf = (date) => {
    if (!days.has(date)) days.set(date, scheduleFor(date))
    return days.get(date)
  }
  const results = []
  for (const entry of entries) {
    const doc = index[entry.kind]
    const found = indexCandidates(entry, doc)
    const hit = found.filter((r) => r.side === entry.side)
    let out
    if (hit.length) out = { label: 'matched', gamePks: [...new Set(hit.map((r) => r.gamePk))] }
    else if (found.length) out = { label: 'side-differs', gamePks: [...new Set(found.map((r) => r.gamePk))] }
    else if (OUT_OF_SCOPE.has(entry.gametype)) out = { label: 'out-of-scope-type', gamePks: [] }
    else if (!doc?.coverage?.seasons?.includes(entry.season)) out = { label: 'season-not-swept', gamePks: [] }
    else {
      const { label, games } = classifyApi(entry, await dayOf(entry.date))
      out = {
        label,
        gamePks: games.map((g) => g.gamePk),
        api: games.map((g) => `${g.away.abbr || g.away.name} @ ${g.home.abbr || g.home.name}`),
      }
    }
    results.push({ ...entry, ...out })
  }
  return results
}

// Index rows, in a season both sources cover, that Retrosheet does not hold. A season is
// covered by the index when its coverage block names it, and by Retrosheet when it lies
// between the first and the last season of that Retrosheet file (an inference: the file
// lists feats and does not say which seasons it reads). Not an error: a person reads it.
export function indexOnlyRows(entries, index) {
  const out = []
  for (const kind of CHECK_KINDS) {
    const doc = index[kind]
    const mine = entries.filter((e) => e.kind === kind)
    if (!doc || !mine.length) continue
    const seasons = mine.map((e) => e.season)
    const [first, last] = [Math.min(...seasons), Math.max(...seasons)]
    const held = new Set(mine.map((e) => `${e.date}|${e.vruns}|${e.hruns}|${e.side}`))
    for (const row of doc.rows) {
      const season = Number(row.officialDate.slice(0, 4))
      if (!doc.coverage.seasons.includes(season) || season < first || season > last) continue
      if (held.has(`${row.officialDate}|${row.away.runs}|${row.home.runs}|${row.side}`)) continue
      out.push({
        kind, gamePk: row.gamePk, officialDate: row.officialDate, gameNumber: row.gameNumber,
        away: row.away.abbr, home: row.home.abbr, awayRuns: row.away.runs, homeRuns: row.home.runs, side: row.side,
      })
    }
  }
  return out
}

export async function checkRetrosheet({ entries, index, scheduleFor }) {
  return { results: await labelEntries(entries, index, scheduleFor), indexOnly: indexOnlyRows(entries, index) }
}
