// THE HITTER GRID's reader (#1411 Part B, ADR-0096): what a hitter did with each
// pitch, by where it was, for the Matchup Scout's hitter map.
//
// SPOILER FOOTING — spoiler-FREE, no SealBox. Season sums over Final games,
// written by the nightly gen-pitch-arsenal.mjs before the day's games: the
// same footing as the pitch-command shards beside it. The Scout is an open
// surface (ADR-0034).
//
// A season store (ADR-0086): hitter-grid/{season}/{NN}.json, bucketed on
// personId % 100, each { season, bat: { [id]: entry }, post: { [id]: entry } },
// and hitter-grid/{season}/league.json, { season, bat: entry, post: entry }.
// An entry is { mlb: { [pitchCode]: { [pitcherHand]: { [stand]: counters } } } }:
// MLB only for now; a Triple-A phase would add `aaa` beside it.
// Counters are 25-value arrays over the 5x5 command grid (feed frame, the
// commandCell order): pitches, swings, whiffs, paEnd, wobaFixed, bipUntracked
// (balls in play with no launch data), xwobaBip (the xwOBA (est.) of the
// tracked ones, ADR-0097), calledStrikes, inPlay and speedSum (the start speed
// of every pitch that has one; #1911). Sums only. An all-zero counter is absent.
// `xwoba: true` on a file says the season's xwobaBip is complete; without it
// the file has no xwobaBip.
// THE PLATE FILE (#1911): calledStrikes, inPlay and speedSum are NOT in those
// shards. They sit in hitter-grid/{season}/NN.plate.json, the same bucket and
// the same { bat, post } shape, each counter at the same code/hand/stand path.
// It is written only when every row of the season has them, and read only
// when a caller asks (`plate: true`): a missing file means "not on file".
import { shardKey100 } from '../../lib/shardKey.js'
import { GRID } from '../../lib/zone/zoneGeometry.js'
import { currentSeasonOf, staticJsonBy } from '../staticJson.js'

const fetchFile = staticJsonBy((key) => `/data/hitter-grid/${key}.json`, { fallback: null })
const fetchPlateFile = staticJsonBy((key) => `/data/hitter-grid/${key}.plate.json`, { fallback: null })
const asGrid = (season, reg, post, file) =>
  reg || post ? { season, reg: reg ?? null, post: post ?? null, ...(file?.xwoba && { xwoba: true }) } : null

// One part (reg or post) with the plate counters put onto the same code/hand/stand path.
// A base path the plate file lacks is marked `noPlate`: hitterCounters reads it as unknown.
function joinPart(base, extra) {
  if (!base) return base
  const out = structuredClone(base)
  for (const [c, byHand] of Object.entries(out.mlb ?? {})) {
    for (const [h, byStand] of Object.entries(byHand)) {
      for (const [s, counters] of Object.entries(byStand)) {
        const plate = extra?.mlb?.[c]?.[h]?.[s]
        if (plate) Object.assign(counters, plate)
        else counters.noPlate = true
      }
    }
  }
  return out
}

// The grid with its plate counters, flagged `plate: true`; the grid as it was with no plate file.
export const joinPlate = (grid, plate) =>
  plate ? { ...grid, reg: joinPart(grid.reg, plate.reg), post: joinPart(grid.post, plate.post), plate: true } : grid

// One season, never pooled with another (the 2026 zone is not the 2025 zone).
// Pass the pitch-command season so both maps read the same one.
// `plate: true` also reads the plate file and joins it (the grid then carries `plate: true`).
// -> null | { season, reg: entry | null, post: entry | null, xwoba?: true, plate?: true }
export async function fetchHitterGridFor(personId, season, { plate = false } = {}) {
  if (personId == null) return null
  season ??= await currentSeasonOf('hitter-grid')
  if (season == null) return null
  const key = `${season}/${shardKey100(personId)}`
  const [shard, extra] = await Promise.all([fetchFile(key), plate ? fetchPlateFile(key) : null])
  const grid = asGrid(season, shard?.bat?.[personId], shard?.post?.[personId], shard)
  return grid && joinPlate(grid, extra && asGrid(season, extra.bat?.[personId], extra.post?.[personId]))
}

// Every hitter summed, the same shape as one hitter's grid.
export async function fetchHitterLeague(season) {
  season ??= await currentSeasonOf('hitter-grid')
  if (season == null) return null
  const league = await fetchFile(`${season}/league`)
  return asGrid(season, league?.bat, league?.post, league)
}

// The counters, in file order. The generator imports this list.
export const PLATE_FIELDS = ['calledStrikes', 'inPlay', 'speedSum']
export const FIELDS = ['pitches', 'swings', 'whiffs', 'paEnd', 'wobaFixed', 'bipUntracked', 'xwobaBip', ...PLATE_FIELDS]

// The counters for one view, summed. `scope` 'R' (regular season), 'P'
// (postseason) or null (both); `hand` the pitcher's hand or null (both);
// `stand` the hitter's side or null (both); `code` a pitch type or null (all).
// `stands` names the sides in the sum: a switch hitter with both hands pooled
// has two, and the league's colour scale should be read for his one.
// `wobaSum` is wobaFixed + xwobaBip, cell by cell, when the season's xwOBA is
// on file (`grid.xwoba`), and null when not: wobaFixed alone would read as a
// low xwOBA (ADR-0096, ADR-0097). calledStrikes, inPlay and speedSum are null
// when the grid was not joined with its plate file (`plate: true`), or when a path in
// the view has none in that file: unknown, not 0.
// Null when nothing matches.
export function hitterCounters(grid, { code = null, hand = null, stand = null, scope = null } = {}) {
  const out = Object.fromEntries(FIELDS.map((f) => [f, new Array(GRID * GRID).fill(0)]))
  const stands = new Set()
  let plateGap = false
  const parts = scope === 'R' ? [grid?.reg] : scope === 'P' ? [grid?.post] : [grid?.reg, grid?.post]
  for (const part of parts) {
    for (const [c, byHand] of Object.entries(part?.mlb ?? {})) {
      if (code && c !== code) continue
      for (const [h, byStand] of Object.entries(byHand)) {
        if (hand && h !== hand) continue
        for (const [s, counters] of Object.entries(byStand)) {
          if (stand && s !== stand) continue
          stands.add(s)
          if (counters.noPlate) plateGap = true
          for (const f of FIELDS) counters[f]?.forEach((v, i) => { out[f][i] += v })
        }
      }
    }
  }
  if (!stands.size) return null
  const { xwobaBip, ...counters } = out
  if (!grid.plate || plateGap) for (const f of PLATE_FIELDS) counters[f] = null
  const wobaSum = grid.xwoba ? out.wobaFixed.map((v, i) => v + xwobaBip[i]) : null
  return { ...counters, wobaSum, stands: [...stands].sort() }
}

const total = (a) => a.reduce((x, y) => x + y, 0)
const rate = (n, d) => (d > 0 ? n / d : null)

// The whole-type rate per metric, wherever the pitch was thrown: the league's
// flat line beside the expected value (docs/scout-design.md, Gary item 12).
// Null for null counters (hitterCounters found nothing).
export const flatRates = (c) => c && ({
  xwoba: c.wobaSum ? rate(total(c.wobaSum), total(c.paEnd)) : null,
  whiff: rate(total(c.whiffs), total(c.swings)),
  swing: rate(total(c.swings), total(c.pitches)),
})
