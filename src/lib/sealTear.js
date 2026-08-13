// The kraft seal's tear — where the cover splits, as pure math.
//
// `SealBox`'s cover is a strip of kraft tape over a score. When it is torn off
// it should tear like tape: a jagged split across the middle, the two halves
// peeling out of frame. This module decides only WHERE that split runs. The
// motion itself is CSS (styles/12a-seal-tear.css), and the split is handed over as
// two `clip-path` polygons cut from one shared edge, so the halves separate
// along exactly the same line and leave no seam.
//
// Nothing here touches a score, a feed, or a reveal mark. A tear path is a
// decoration on a cover that, by ADR-0002, holds no data at all — read
// SealBox.jsx's header before wiring any of this to something that does.
//
// THE SEED IS THE STAMP'S SEED. `stampSeed` (lib/stampArt.js) already answers
// "give this game a number that never changes" for the Logbook stamp's wear
// filter, for the same reason this needs one: a keepsake that re-rolls its own
// roughness on every render is not a keepsake. A seal is the same promise at a
// smaller scale — the same seal must tear identically forever, on every device,
// across a reload — so this reuses that function rather than adding a second
// answer to the same question, and only mixes the half-index in on top so the
// eighteen-plus seals within one game each tear their own way.
//
// The PRNG below is NOT a second hash. `stampSeed`'s output goes straight to
// SVG `feTurbulence`, which expands one integer into noise itself; a polygon has
// to be expanded here instead, so the seed needs something to expand it. Keep
// that split — derive the seed there, spend it here.
import { stampSeed } from './stampArt.js'

// The edge is drawn as a run of vertices across the cover, alternating above
// and below the midline so it always reads as a tear rather than a fold. Nine
// vertices is what a ~360px-wide cover can show as distinct teeth at arm's
// length; more just reads as a ragged straight line.
export const TEAR_VERTICES = 9

// Where the split runs (per cent of the cover's height) and how far a tooth may
// stray from it. 9% of a 132px cover is ~12px of swing, which is a tear; much
// more and the two halves stop reading as one cover that came apart.
export const TEAR_MIDLINE = 50
export const TEAR_SWING = 9

// The shortest tooth, as a fraction of TEAR_SWING. Without a floor a vertex can
// land on the midline, and a flat spot in the middle of a tear looks like a cut.
const TEAR_MIN_TOOTH = 0.35

// A seed, scattered. The seeds this module is handed differ by small, regular
// steps (one half-inning to the next), and a plain linear generator fed
// near-neighbour seeds hands back near-identical first values — which would put
// a near-identical first tooth on every seal in a game, the one thing the
// half-index is mixed in to prevent. The xor-shift-multiply finaliser below
// spreads those neighbours across the whole 32-bit range before the first
// vertex is drawn.
function tearRandom(seed) {
  let s = Math.abs(Math.trunc(Number(seed) || 0)) >>> 0
  s = Math.imul(s ^ (s >>> 15), 2246822519) >>> 0
  s = (s ^ (s >>> 13)) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const pct = (n) => Math.round(n * 100) / 100

// The seal's own seed: this game's stamp seed, stepped by the half it covers.
// 137 is coprime with 1000, so no two halves of one game share a seed until the
// thousandth — which no game reaches. A missing or unusable gamePk/halfIndex
// falls back exactly as `stampSeed` does: a fixed number, never a random one.
export function sealTearSeed(gamePk, halfIndex) {
  const half = Number(halfIndex)
  const step = Number.isFinite(half) ? Math.abs(Math.trunc(half)) : 0
  return (stampSeed(gamePk) * 31 + step * 137) % 1000
}

// The shared edge, left to right, as [x%, y%] pairs. Both polygons are cut from
// this one list — that is what makes the two halves fit back together.
export function sealTearEdge(seed) {
  const next = tearRandom(seed)
  const edge = []
  for (let i = 0; i < TEAR_VERTICES; i += 1) {
    const x = (i / (TEAR_VERTICES - 1)) * 100
    const tooth = TEAR_MIN_TOOTH + (1 - TEAR_MIN_TOOTH) * next()
    const y = TEAR_MIDLINE + (i % 2 === 0 ? -1 : 1) * tooth * TEAR_SWING
    edge.push([pct(x), pct(y)])
  }
  return edge
}

// The two `clip-path` values, ready to hand to CSS. `top` keeps everything
// above the edge, `bottom` everything below it.
export function sealTearPolygons(seed) {
  const edge = sealTearEdge(seed)
  const points = edge.map(([x, y]) => `${x}% ${y}%`)
  return {
    top: `polygon(0% 0%, 100% 0%, ${[...points].reverse().join(', ')})`,
    bottom: `polygon(${points.join(', ')}, 100% 100%, 0% 100%)`,
  }
}
