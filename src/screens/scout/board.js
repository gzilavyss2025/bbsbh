import { pitchArsenalFor } from '../../api/pitchArsenal.js'
import { MIN_COMMAND_PITCHES } from '../../api/commandMap.js'
import { pitchTiles } from '../../lib/pitcherCard/card.js'
import { REGIONS, rollUp } from '../../lib/zone/regions.js'

// THE SCOUT'S PITCHER BOARD (#1410): the pitch pills and the map for one
// stance, from the nightly stores. Pure, so test/scout-board.test.js runs it.
//
// The pills are the Now Pitching card's tiles (pitchTiles: integer shares that
// add to 100, and mph). A type under USAGE_FLOOR percent gets no pill but
// still counts in All, and at most MAX_TYPES get one (#1408).
export const USAGE_FLOOR = 5
export const MAX_TYPES = 6

const add = (a, b) => a.map((x, i) => x + (b[i] ?? 0))

// `arsenal` is the pitch-arsenal shard, `command` this pitcher's pitch-command
// entry, `stance` the side the hitter stands on ('L' | 'R'). Null when the
// stores hold nothing for this pitcher against this stance ("Not posted").
export function pitcherBoard({ arsenal, command, pitcherId, stance }) {
  const rows = pitchArsenalFor(arsenal, pitcherId, true, stance)
  const byCode = command?.mlb
  if (!rows || !byCode) return null
  const tiles = pitchTiles(rows)
  const types = tiles.filter((t) => !t.other && Number(t.pct) >= USAGE_FLOOR).slice(0, MAX_TYPES)
  const cellsOf = (code) => byCode[code]?.[stance]?.cells ?? null
  // All pools every type the command store holds for this stance, pill or not.
  const allCodes = Object.keys(byCode).filter(cellsOf)
  return { tiles, types, all: mapOf(allCodes.map(cellsOf)), byType: Object.fromEntries(types.map((t) => [t.code, mapOf([cellsOf(t.code)].filter(Boolean))])) }
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
