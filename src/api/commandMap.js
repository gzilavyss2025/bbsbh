// WHERE HE PUTS IT — the season command map's reader.
//
// The arsenal card says what a pitcher throws and how hard. This says where he
// puts it, which is the same shape of hole a hitter's spray map fills.
//
// SPOILER FOOTING — spoiler-FREE, and it needs no SealBox. Every number here is
// a season aggregate over games already final: a count of pitches in a cell,
// and what those pitches earned. Nothing is a running score, a line, or a
// result of a game in progress — the same footing as the pitch arsenal it is
// swept beside, and as WAR and the milestones. The player page is an open
// surface (ADR-0034).
//
// The data is the nightly gen-pitch-arsenal.mjs precompute, sharded by
// personId % 100 like the mix. Counters are 25-value arrays over the 5x5
// command grid (src/lib/zone/zoneGeometry.js), whose middle nine cells are the
// strike zone's own thirds.
import { shardKey100 } from '../lib/shardKey.js'
import { staticJsonBy } from './staticJson.js'
import { GRID, inHeart, inZone } from '../lib/zone/zoneGeometry.js'

export const fetchCommandShard = staticJsonBy((key) => `/data/pitch-command/${key}.json`, {
  fallback: null,
})

export async function fetchCommandFor(personId) {
  if (personId == null) return null
  const shard = await fetchCommandShard(shardKey100(personId))
  return shard?.pit?.[String(personId)] ?? null
}

// Below this many pitches a split says more about the sample than the pitcher,
// so the card grays it rather than drawing a map out of a dozen dots. Matches
// the spray card's own floor in spirit: enough to have a shape.
export const MIN_COMMAND_PITCHES = 50

const zeros = () => new Array(GRID * GRID).fill(0)
const addInto = (into, arr) => {
  if (arr) for (let i = 0; i < into.length; i++) into[i] += arr[i] ?? 0
  return into
}

// One view over a pitcher's grid, summed across whichever pitch types and
// batter hands the caller asked for. `code` null means every type; `stand` null
// means both hands.
//
// Returns null when the level has no grid at all — below Triple-A there is no
// pitch tracking, so the card stands down rather than drawing an empty zone
// (the degrade convention).
export function commandView(entry, { level = 'mlb', code = null, stand = null } = {}) {
  const byCode = entry?.[level]
  if (!byCode || !Object.keys(byCode).length) return null

  const totals = {
    cells: zeros(), whiffs: zeros(), calledStrikes: zeros(), homers: zeros(), swings: zeros(), firstPitch: zeros(),
  }
  for (const [c, byStand] of Object.entries(byCode)) {
    if (code && c !== code) continue
    for (const [s, hand] of Object.entries(byStand)) {
      if (stand && s !== stand) continue
      for (const field of Object.keys(totals)) addInto(totals[field], hand[field])
    }
  }

  const sum = (a) => a.reduce((x, y) => x + y, 0)
  const pitches = sum(totals.cells)
  if (pitches === 0) return null

  // The facts, all counted off this same grid — none of them is Savant's
  // published rate, and the card says so rather than implying agreement.
  let inZoneN = 0
  let heartN = 0
  for (let i = 0; i < totals.cells.length; i++) {
    const cell = { col: i % GRID, row: Math.floor(i / GRID) }
    if (inZone(cell)) inZoneN += totals.cells[i]
    if (inHeart(cell)) heartN += totals.cells[i]
  }
  const swings = sum(totals.swings)
  const firstPitches = sum(totals.firstPitch)
  let firstStrikes = 0
  for (let i = 0; i < totals.firstPitch.length; i++) {
    const cell = { col: i % GRID, row: Math.floor(i / GRID) }
    if (inZone(cell)) firstStrikes += totals.firstPitch[i]
  }

  return {
    ...totals,
    pitches,
    max: Math.max(...totals.cells),
    zonePct: pct(inZoneN, pitches),
    heartPct: pct(heartN, pitches),
    // Whiff rate is per SWING, which is the only denominator that means
    // anything — a pitcher who is never swung at has no whiff rate, not a
    // perfect one.
    whiffPct: pct(sum(totals.whiffs), swings),
    // The one command number a scorer feels every at-bat. A first pitch in the
    // zone; nothing here claims it is Savant's F-Strike, which also counts
    // fouls and balls in play.
    firstZonePct: pct(firstStrikes, firstPitches),
    // NOT `homers` — that name is the per-cell array spread in above, and
    // shadowing it with the scalar left the card calling .map on a number.
    homersAllowed: sum(totals.homers),
  }
}

function pct(n, d) {
  return d > 0 ? Math.round((n / d) * 100) : null
}

// The pitch types he actually throws, most-thrown first, with the count for the
// selected hand — the card's chip row, in the arsenal's own order.
export function commandTypes(entry, { level = 'mlb', stand = null } = {}) {
  const byCode = entry?.[level]
  if (!byCode) return []
  const rows = []
  for (const [code, byStand] of Object.entries(byCode)) {
    let n = 0
    for (const [s, hand] of Object.entries(byStand)) {
      if (stand && s !== stand) continue
      n += (hand.cells ?? []).reduce((a, b) => a + b, 0)
    }
    if (n > 0) rows.push({ code, pitches: n, thin: n < MIN_COMMAND_PITCHES })
  }
  return rows.sort((a, b) => b.pitches - a.pitches)
}

// How many pitches he threw to each hand, for the split chips' own counts.
export function commandHandCounts(entry, level = 'mlb') {
  const out = { L: 0, R: 0 }
  for (const byStand of Object.values(entry?.[level] ?? {})) {
    for (const [s, hand] of Object.entries(byStand)) {
      out[s] += (hand.cells ?? []).reduce((a, b) => a + b, 0)
    }
  }
  return out
}
