import { MIN_COMMAND_PITCHES } from '../../api/commandMap.js'
import { pitchTiles } from '../../lib/pitcherCard/card.js'
import { REGIONS, rollUp } from '../../lib/zone/regions.js'

// THE SCOUT'S PITCHER BOARD (#1410, #1411): the pitch pills and the map for
// one stance and one scope, from the nightly stores. Pure, so
// test/scout-page.test.js runs it.
//
// The pills are the Now Pitching card's tiles (pitchTiles: integer shares that
// add to 100, and mph). A type under USAGE_FLOOR percent gets no pill but
// still counts in All, and at most MAX_TYPES get one (#1408).
export const USAGE_FLOOR = 5
export const MAX_TYPES = 6

const add = (a, b) => a.map((x, i) => x + (b[i] ?? 0))

// SCOPE. Each shard keeps the regular season under `pit` and, since ADR-0094
// (#1418), the MLB postseason under `post`, in the same shape. Regular reads
// `pit`, Postseason `post`, All adds the two. A shard written before #1418 has
// no `post`: then `scoped` is false, the maps hold the regular season whatever
// Scope says, and the page keeps its "Regular season" tag (Gary, item 9).
const PARTS = { reg: ['pit'], post: ['post'], all: ['pit', 'post'] }

// `arsenal` is the pitch-arsenal shard, `command` the pitch-command shard (both
// whole buckets), `stance` the side the hitter stands on ('L' | 'R'). Null when
// the stores hold nothing for this pitcher, stance and scope ("Not posted").
export function pitcherBoard({ arsenal, command, pitcherId, stance, scope = 'all' }) {
  const scoped = Boolean(arsenal && command && 'post' in arsenal && 'post' in command)
  const parts = scoped ? PARTS[scope] ?? PARTS.all : PARTS.reg
  const rows = mergeRows(parts.map((k) => sideRows(arsenal?.[k]?.[pitcherId]?.mlb, stance)))
  const cmds = parts.map((k) => command?.[k]?.[pitcherId]?.mlb).filter(Boolean)
  if (!rows.length || !cmds.length) return null
  const cellsOf = (code) => {
    const list = cmds.map((m) => m[code]?.[stance]?.cells).filter(Boolean)
    return list.length ? list.reduce(add) : null
  }
  const tiles = pitchTiles(rows)
  const types = tiles.filter((t) => !t.other && Number(t.pct) >= USAGE_FLOOR).slice(0, MAX_TYPES)
  // All pools every type the command store holds for this stance, pill or not.
  const allCodes = [...new Set(cmds.flatMap((m) => Object.keys(m)))].filter(cellsOf)
  return {
    scoped,
    tiles,
    types,
    codes: allCodes,
    all: mapOf(allCodes.map(cellsOf)),
    byType: Object.fromEntries(types.map((t) => [t.code, mapOf([cellsOf(t.code)].filter(Boolean))])),
  }
}

// One side of the plate's rows from a pitch-arsenal entry's `vs` pairs
// ([pitches, avgVelo]), the way pitchArsenalFor's sideRow reads them.
function sideRows(types, stance) {
  return (types ?? []).flatMap((t) => (t.vs?.[stance] ? [{ code: t.code, pitches: t.vs[stance][0], avgVelo: t.vs[stance][1] }] : []))
}

// Regular season plus postseason, one row per pitch type: pitches add, the
// average velocity weighs each part by its pitches. Most-thrown first.
function mergeRows(lists) {
  const by = new Map()
  for (const r of lists.flat()) {
    const m = by.get(r.code) ?? { code: r.code, pitches: 0, velo: 0 }
    m.pitches += r.pitches
    m.velo += (r.avgVelo ?? 0) * r.pitches
    by.set(r.code, m)
  }
  return [...by.values()]
    .filter((m) => m.pitches > 0)
    .map((m) => ({ code: m.code, pitches: m.pitches, avgVelo: m.velo / m.pitches }))
    .sort((a, b) => b.pitches - a.pitches)
}

// One map: each region's share and count. Under MIN_COMMAND_PITCHES the whole
// map is hatched and prints counts only (a pattern drawn from a few pitches
// is not one). Tones s1..s4 step against the busiest region, the Command
// Map's ramp.
export function mapOf(cellLists) {
  const cells = cellLists.length ? cellLists.reduce(add) : Array(25).fill(0)
  const n = cells.reduce((a, b) => a + b, 0)
  const regionN = rollUp(cells)
  const thin = n < MIN_COMMAND_PITCHES
  const share = Object.fromEntries(REGIONS.map((r) => [r, n ? regionN[r] / n : 0]))
  const max = Math.max(...REGIONS.map((r) => share[r]))
  const cellsOut = Object.fromEntries(
    REGIONS.map((r) => [r, thin
      ? { tone: 'gray', count: regionN[r] }
      : { tone: `s${max ? Math.ceil((share[r] / max) * 4) : 0}`, value: `${Math.round(share[r] * 100)}` }]),
  )
  return { n, thin, regionN, share, cells: cellsOut }
}

// The Savant board folds the knuckle curve and the slow curve into CU (the
// #1408 spike, confirmed on savant-matchup.json: no KC row for any batter).
// So a KC or CS pill reads the hitter's CU row, and says so.
const BOARD_CODE = { KC: 'CU', CS: 'CU' }

// The hitter's board row for one of the pitcher's types: { row, as }, where
// `as` is the board's own code when it differs from the pill's, else null.
export function boardRow(line, code) {
  const as = BOARD_CODE[code] ?? null
  return { row: line?.[as ?? code] ?? null, as }
}
