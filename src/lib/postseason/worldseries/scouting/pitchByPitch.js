import { hitterCounters } from '../../../../api/scout/hitterGrid.js'
import { pitchMark } from '../../../pitch/pitchTypes.js'

// PITCH BY PITCH (#2316, slice 2): for the probable starter's arsenal, how the opposing
// club's regular hitters do against each pitch, set against the league. Pure. Open surface
// (ADR-0034): season sums over Final games, no reveal-only module.
//
// PLACEHOLDER THRESHOLDS. Gary tunes these in the PR.
export const EDGE_BAND = 0.01 // xwOBA this far (more than) below the league: Arm; above: Bats
export const MIN_PA = 10 // plate-appearance-ending pitches the hitters need on a pitch, or no figure
export const MIN_USE = 0.05 // a pitch under this share of his arsenal is left out
export const MAX_HITTERS = 9 // the club's regulars: its hitters with the most postseason PA

const sum = (a) => a.reduce((x, y) => x + y, 0)

// byDateRange hitting splits (the Hot bats read) -> person ids, most plate appearances first.
// A pitcher who batted is not a regular.
export function topHitters(splits, n = MAX_HITTERS) {
  return (splits ?? [])
    .filter((s) => s.player?.id != null && s.position?.abbreviation !== 'P')
    .map((s) => ({ id: s.player.id, pa: Number(s.stat?.plateAppearances) || 0 }))
    .filter((s) => s.pa > 0)
    .sort((a, b) => b.pa - a.pa)
    .slice(0, n)
    .map((s) => s.id)
}

// 'away' | 'home': the seat `clubId` holds in an upcoming game, or null when it holds neither.
export const seatOf = (game, clubId) => (game.awayId === clubId ? 'away' : game.homeId === clubId ? 'home' : null)

// Whole numbers that sum to 100 (largest remainder).
function shares(counts) {
  const total = sum(counts)
  const exact = counts.map((c) => (c / total) * 100)
  const out = exact.map(Math.floor)
  const order = exact.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; k < 100 - sum(out); k++) out[order[k][1]]++
  return out
}

// xwOBA (est.) over the pitch-ending pitches of the grids that carry it; null under MIN_PA.
function xwobaOf(grids, code, hand) {
  let woba = 0
  let pa = 0
  for (const g of grids) {
    const c = g && hitterCounters(g, { code, hand })
    if (!c?.wobaSum) continue
    woba += sum(c.wobaSum)
    pa += sum(c.paEnd)
  }
  return pa >= MIN_PA ? woba / pa : null
}

// arsenal: [{ code, pitches }] (the pitcher's season row); hitters: the hitters' grids
// (fetchHitterGridFor); league: fetchHitterLeague; hand: the pitcher's 'R' | 'L' | ''.
// -> null | { hitters, rows: [{ key, code, name, mark, uses, xwoba, league, edge }] }, edge 'arm' | 'bats' | 'even',
// or null for a row with no figure to call (a row of dashes is not "Even"). Null when no row has a figure.
// The call is made on the printed (three-place) figures, so the pill never disagrees with them.
export function pitchByPitchModel({ arsenal, hitters, league, hand }) {
  const grids = (hitters ?? []).filter(Boolean)
  const total = sum((arsenal ?? []).map((p) => p.pitches || 0))
  if (!grids.length || !total) return null
  const kept = arsenal.filter((p) => p.pitches / total >= MIN_USE).sort((a, b) => b.pitches - a.pitches)
  const uses = shares(kept.map((p) => p.pitches))
  const third = (x) => (x == null ? null : Math.round(x * 1000) / 1000)
  const rows = kept.map((p, i) => {
    const mark = pitchMark(p.code)
    const xwoba = third(xwobaOf(grids, p.code, hand || null))
    const lg = third(xwobaOf([league], p.code, hand || null))
    const diff = xwoba == null || lg == null ? null : Math.round((xwoba - lg) * 1000) / 1000
    return {
      key: `${mark.code}-${i}`,
      code: mark.code,
      name: mark.name,
      mark,
      uses: uses[i],
      xwoba,
      league: lg,
      edge: diff == null ? null : diff < -EDGE_BAND ? 'arm' : diff > EDGE_BAND ? 'bats' : 'even',
    }
  })
  return rows.some((r) => r.xwoba != null) ? { hitters: grids.length, rows } : null
}
