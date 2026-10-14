// The Command card's pure view (#2014). One pitcher's pitch-command entry, the picked hand, pitch
// and cell, and the league block in; the switch, the chips, the four tiles, the 25 cells in camera
// view, the pitch marks and the readout out. No React, no fetch.
import { MIN_COMMAND_PITCHES, commandHandCounts, commandPitchMarks, commandRank, commandTypes, commandView } from '../../../../../api/commandMap.js'
import { pitchLabel } from '../../../../../api/pitchArsenal.js'
import { ordinal } from '../../../../../lib/format.js'
import { GRID, viewCol } from '../../../../../lib/zone/zoneGeometry.js'

const HAND_WORD = { L: 'vs left-handed batters', R: 'vs right-handed batters' }
// Each tile's rate, label, and base: the count its rate is out of.
const TILES = [
  ['zonePct', 'Zone', (v) => `of ${fmt(v.pitches)} pitches`],
  ['heartPct', 'Heart', (v) => `of ${fmt(v.pitches)} pitches`],
  ['firstZonePct', '1st pitch', (v) => `of ${fmt(sum(v.firstPitch))} first pitches`],
  ['whiffPct', 'Whiff', (v) => `of ${fmt(sum(v.swings))} swings`],
]
const ROW_WORD = ['Above the zone', 'Top third', 'Middle third', 'Bottom third', 'Below the zone']
// By VIEW column, camera view: column 0 is the first-base side, column 4 the third-base side.
const COL_WORD = ['off the plate, 1B side', '1B-side third', 'middle', '3B-side third', 'off the plate, 3B side']
const STEPS = 5
export const HEART = 12 // the stored index of middle-middle; the readout opens on it

const fmt = (n) => n.toLocaleString('en-US')
const sum = (a) => (a ?? []).reduce((x, y) => x + y, 0)
const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0)
// A percentile rank reads 1st to 99th: the mid-rank of the end of a big pool rounds to 0 or 100.
const rankWord = (p) => ordinal(Math.min(99, Math.max(1, p)))

// MLB when he has an MLB grid, else Triple-A (the live tab's rule): the default 'mlb' would drop a
// Triple-A-only arm.
export const levelOf = (entry) => (commandView(entry, { level: 'mlb' }) ? 'mlb' : 'aaa')

// A cell's words, by VIEW column. A right-handed batter stands on the third-base side (camera right).
function cellWords(row, col, stand) {
  if (!stand || col === 2) return `${ROW_WORD[row]}, ${COL_WORD[col]}`
  const inside = stand === 'R' ? col > 2 : col < 2
  return `${ROW_WORD[row]}, ${col === 0 || col === 4 ? 'off the plate, ' : ''}${inside ? 'inside' : 'away'} to a ${stand === 'R' ? 'righty' : 'lefty'}`
}

export function commandModView(entry, { stand = null, code = null, cell = HEART, league = null } = {}) {
  const level = levelOf(entry)
  if (!commandView(entry, { level })) return null
  const handN = commandHandCounts(entry, level)
  const total = handN.L + handN.R
  const types = commandTypes(entry, { level, stand })
  if (!types.some((t) => t.code === code)) code = null
  const v = commandView(entry, { level, code, stand })
  const name = code ? pitchLabel(code) : 'All pitches'
  const thin = !v || v.pitches < MIN_COMMAND_PITCHES
  // The league pool is MLB, all pitches, both hands: his line goes beside it only in that view.
  const ranked = league && level === 'mlb' && !code && !stand
  const tiles = TILES.map(([key, label, base], i) => {
    if (thin) return { key, label, value: '—', caption: 'too few pitches', lead: false }
    const r = ranked && commandRank(league, v, key)
    const caption = r?.median != null ? `MLB ${r.median}%${r.pct != null ? ` · ${rankWord(r.pct)}` : ''}` : base(v)
    return { key, label, value: v[key] == null ? '—' : `${v[key]}%`, caption, lead: i === 0 }
  })
  const rank = ranked && !thin && commandRank(league, v, 'zonePct')
  const view = {
    level,
    code,
    stand,
    total,
    hands: [
      { stand: null, label: 'Both', n: total },
      { stand: 'L', label: 'vs LHB', n: handN.L },
      { stand: 'R', label: 'vs RHB', n: handN.R },
    ],
    chips: [{ code: null, name: 'All pitches', n: sum(types.map((t) => t.pitches)), thin: false }, ...types.map((t) => ({ code: t.code, name: pitchLabel(t.code), n: t.pitches, thin: t.thin }))],
    label: `${name} · ${HAND_WORD[stand] ?? 'vs both hands'}${level === 'aaa' ? ' · Triple-A' : ''}`,
    tiles,
    note: `${rank?.n ? `The MLB middle${rank.pct != null ? ' and his rank are' : ' is'} among ${fmt(rank.n)} pitchers with ${fmt(league.minPitches)}+ pitches. ` : ''}Counted off the 5×5 grid below. Not Savant's published rates.`,
    thin: null,
    cells: null,
    marks: [],
    readout: null,
  }
  if (thin) {
    const n = v?.pitches ?? 0
    const noun = n === 1 ? 'pitch' : 'pitches'
    // "8 changeups"; a name that ends in s ("eephus") or a code with no name takes "pitches".
    const word = name === code ? code : name.toLowerCase() // caps-js-exempt: a pitch name mid-sentence ("8 changeups")
    const what = !code ? noun : /s$/.test(word) || name === code ? `${word} ${noun}` : `${word}${n === 1 ? '' : 's'}`
    view.thin = `Only ${n} ${what}${stand ? ` ${HAND_WORD[stand]}` : ''}. Too few to draw a map (the floor is ${MIN_COMMAND_PITCHES}).`
    return view
  }
  // Screen order, row by row; viewCol mirrors the stored column for the camera (and is its own inverse).
  view.cells = Array.from({ length: GRID * GRID }, (_, k) => {
    const row = Math.floor(k / GRID)
    const col = k % GRID
    const i = row * GRID + viewCol(col)
    const n = v.cells[i]
    const where = cellWords(row, col, stand)
    return { i, n, step: n ? Math.ceil((n / v.max) * STEPS) : 0, where, label: `${where}: ${fmt(n)} ${n === 1 ? 'pitch' : 'pitches'}, ${pct(n, v.pitches)}%` }
  })
  // Each mapped pitch's centroid, in percent of the map (stored frame mirrored like a cell).
  view.marks = commandPitchMarks(entry, { level, stand })
    .filter((m) => m.pitches >= MIN_COMMAND_PITCHES && (!code || m.code === code))
    .map((m) => ({ code: m.code, x: +(((viewCol(m.mark.col) + 0.5) / GRID) * 100).toFixed(2), y: +(((m.mark.row + 0.5) / GRID) * 100).toFixed(2) }))
  const c = view.cells.find((x) => x.i === cell) ?? view.cells[HEART]
  const count = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`
  const at = (k) => v[k]?.[c.i] ?? 0
  view.readout = {
    where: c.where,
    facts: [
      count(c.n, 'pitch', 'pitches'),
      `${pct(c.n, v.pitches)}% of his ${fmt(v.pitches)}`,
      count(at('whiffs'), 'whiff', 'whiffs'),
      count(at('calledStrikes'), 'called strike', 'called strikes'),
      `${fmt(at('homers'))} HR`,
    ],
  }
  return view
}
