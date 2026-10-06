// The pure half of scripts/gen-notable.mjs, part 4: the file shape, the merge, the seed.
import { gameHead } from './games.mjs'
import { GAME_TYPES, LEAGUE_NAMES } from './rules.mjs'

export const KINDS = ['nohitters', 'cycles', 'tripleplays']

// EVERY KEY A FILE MAY CARRY, in one place. test/notable.test.js reads the committed
// files and fails on any key at any depth that is not here. The score is in a row on
// purpose (D5, `runs`). Nothing else about the game is: no inning line, no hit totals,
// no other players. Add a key here only with a reason.
export const ALLOWED_KEYS = {
  doc: ['coverage', 'rows'],
  coverage: ['seasons', 'through', 'leagues', 'gameTypes'],
  row: [
    // every kind
    'gamePk', 'officialDate', 'gameType', 'gameNumber', 'away', 'home',
    // the kind's own: no-hitter (side, pitchers, shortened, lost), cycle (player, side),
    // triple play (side)
    'side', 'pitchers', 'shortened', 'lost', 'player',
  ],
  club: ['id', 'abbr', 'name', 'runs'],
  person: ['id', 'name'],
}
export const ALL_ALLOWED_KEYS = new Set(Object.values(ALLOWED_KEYS).flat())

// One feat is one row. A no-hitter or a triple play is kept once for each gamePk and
// side. A cycle is kept once for each gamePk and player.
export function rowKey(kind, row) {
  return kind === 'cycles' ? `${row.gamePk}:${row.player?.id}` : `${row.gamePk}:${row.side}`
}

export const rowSeason = (row) => Number(String(row.officialDate).slice(0, 4))

// Newest first. The tiebreaks are not results: gamePk, then the key.
export function sortRows(kind, rows) {
  return rows.slice().sort((a, b) => {
    if (a.officialDate !== b.officialDate) return a.officialDate < b.officialDate ? 1 : -1
    if (a.gamePk !== b.gamePk) return b.gamePk - a.gamePk
    const ka = rowKey(kind, a)
    const kb = rowKey(kind, b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

// THE MERGE REPLACES WHOLE SEASONS. It is not a per-key merge, on purpose
// (scripts/CLAUDE.md asks a generator that does not use reassignable-merge.mjs to say
// why). A row is keyed on a gamePk and a side or a player, and the API can correct those
// after the fact: a game scored again, a player credited to the other club, a feat the
// feed drops. A per-key merge would keep the old row beside the corrected one for ever
// (a ghost row, the gen-umpire-accuracy.mjs incident). So a run drops every row of each
// season it swept, in all three files, and writes what it found. Seasons it did not
// sweep stay as they were.
export function mergeRows(kind, prevRows, seasons, freshRows) {
  const swept = new Set(seasons)
  const kept = (prevRows ?? []).filter((row) => !swept.has(rowSeason(row)))
  const seen = new Set(kept.map((row) => rowKey(kind, row)))
  const added = []
  for (const row of freshRows) {
    const key = rowKey(kind, row)
    if (seen.has(key)) continue
    seen.add(key)
    added.push(row)
  }
  return sortRows(kind, [...kept, ...added])
}

// The coverage block is the file's own clock (there is no generatedAt, as in
// long-at-bats/). `through` is the last day with a played game in any swept season, and
// it never moves back.
export function mergeCoverage(prev, seasons, through) {
  const all = new Set([...(prev?.seasons ?? []), ...seasons])
  return {
    seasons: [...all].sort((a, b) => a - b),
    through: [prev?.through ?? '', through ?? ''].reduce((a, b) => (b > a ? b : a)),
    leagues: [...LEAGUE_NAMES],
    gameTypes: [...GAME_TYPES],
  }
}

export const emptyDoc = () => ({ coverage: { seasons: [], through: '', leagues: [...LEAGUE_NAMES], gameTypes: [...GAME_TYPES] }, rows: [] })

// ---- the seed (D3) ----

const SIDES = ['home', 'away']
const isPerson = (p) => Number.isInteger(p?.id) && typeof p?.name === 'string' && p.name !== ''

// The kind's own fields of a seed row, or an Error naming the row.
function seedFields(kind, seed) {
  const where = `scripts/notable-seed.json, ${kind}, gamePk ${seed.gamePk}`
  if (!SIDES.includes(seed.side)) throw new Error(`${where}: "side" must be "home" or "away"`)
  if (kind === 'tripleplays') return { side: seed.side }
  if (kind === 'cycles') {
    if (!isPerson(seed.player)) throw new Error(`${where}: "player" needs an integer id and a name`)
    return { player: { id: seed.player.id, name: seed.player.name }, side: seed.side }
  }
  if (!Array.isArray(seed.pitchers) || seed.pitchers.length === 0 || !seed.pitchers.every(isPerson)) {
    throw new Error(`${where}: "pitchers" needs at least one { id, name }`)
  }
  return {
    side: seed.side,
    pitchers: seed.pitchers.map((p) => ({ id: p.id, name: p.name })),
    ...(seed.shortened === true ? { shortened: true } : {}),
    ...(seed.lost === true ? { lost: true } : {}),
  }
}

// Adds each seed row whose season this run swept. The date, the clubs and the score
// come from that season's game map, so a seed row names only the gamePk, the season and
// the kind's own fields (`note` is for people and is never written). A gamePk the map
// does not hold is not a played AL or NL game of that season: the run FAILS, with the
// row named. A seed row for a season this run did not sweep WAITS: if a run swept it
// earlier, the row is in the file already, and if none did, a later run adds it. A swept
// row for the same key wins over the seed row.
//
// `gameMaps` is Map<season, Map<gamePk, game>> for the seasons swept in this run.
export function applySeed(kind, rows, seedRows, gameMaps) {
  const out = rows.slice()
  const seen = new Set(out.map((row) => rowKey(kind, row)))
  let applied = 0
  let waiting = 0
  for (const seed of seedRows ?? []) {
    const map = gameMaps.get(seed.season)
    if (!map) {
      waiting += 1
      continue
    }
    const game = map.get(seed.gamePk)
    if (!game) {
      throw new Error(
        `scripts/notable-seed.json, ${kind}: gamePk ${seed.gamePk} is not a played AL or NL game ` +
          `of ${seed.season} (regular season or postseason). Fix the gamePk or the season, or drop the row.`,
      )
    }
    const row = { ...gameHead(game), ...seedFields(kind, seed) }
    const key = rowKey(kind, row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
    applied += 1
  }
  return { rows: sortRows(kind, out), applied, waiting }
}

// ---- the file ----

// One row to a line, so a nightly diff shows the rows that moved and no more.
export function serializeDoc(doc) {
  const rows = doc.rows.length ? `\n${doc.rows.map((r) => JSON.stringify(r)).join(',\n')}\n` : ''
  return `{"coverage":${JSON.stringify(doc.coverage)},"rows":[${rows}]}\n`
}
