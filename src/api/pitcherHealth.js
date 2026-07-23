// In-game pitching health: the "laboring index" (P3) and the fastball
// velocity-decay flag (P4) from .scratch/metric-engines/pitching-health.md.
//
// SPOILER NOTE — same footing as pitchers.js (ADR-0009): everything here is
// driven by the reveal high-water mark. `computeVeloDecay` walks only plays in
// revealed half-innings; `laboringFor` reads a pitcher row that
// computePitcherLines already clamped to `revealedThrough`. Neither is wrapped
// in a SealBox — a still-active pitcher needs partial-outing granularity.
//
import { halfIndex } from './select.js'

// The laboring index deliberately compares raw volume against the pitcher's
// OWN season norm (pitches per inning) rather than weighting pitches by
// situation — leverage-weighted pitch counts were tested and found to add
// nothing over raw counts (see the doc's research findings). Baselines come
// from workload.json (spoiler-free nightly precompute, src/api/workload.js).

// Fastball-family pitch type codes; velocity trends only mean something
// within one pitch type ("throwing more changeups" is not fatigue).
const FASTBALL_CODES = new Set(['FF', 'FT', 'SI', 'FA'])

// Below this many revealed outs the in-game pitches-per-inning sample is too
// thin to call anyone laboring (two innings of work).
const MIN_LABOR_OUTS = 6
// Flag threshold: tonight's P/IP this far above his season norm reads as
// laboring. Descriptive, not predictive — see the metric-engines doc.
const LABOR_RATIO = 1.15

// Sustained fastball drop (mph) that earns the fatigue flag. ~1 mph is the
// average full-start decay, so 1.5+ is a genuine outlier signal.
const VELO_DROP_FLAG = 1.5
const MIN_ANCHOR_PITCHES = 5
const MIN_CURRENT_PITCHES = 3

function ipToOuts(ip) {
  const [full, part] = String(ip ?? '0.0').split('.')
  return (Number(full) || 0) * 3 + (Number(part) || 0)
}

// The laboring read for one Pitchers-table row (a `computePitcherLines` row,
// already reveal-clamped) against his season baseline from workload.json.
// Returns null when there's no baseline (no workload data, MiLB, debut) or
// the revealed sample is too thin; otherwise
// { pitchesPerInning, baseline, ratio, laboring, ip }. `ip` (the row's own
// reveal-clamped innings-pitched string, e.g. "2.1") rides along so the
// Margin Notes text can say what it's measured through — this updates every
// time revealedThrough advances, since it's read straight off the same
// reveal-clamped row each render, never a one-time snapshot.
export function laboringFor(line, workloadEntry) {
  const outs = ipToOuts(line?.ip)
  const pitches = line?.pitches ?? 0
  if (outs < MIN_LABOR_OUTS || pitches <= 0) return null
  const season = workloadEntry?.season
  if (!season?.pitches || !season?.outs) return null
  const baseline = season.pitches / (season.outs / 3)
  if (!Number.isFinite(baseline) || baseline <= 0) return null
  const pitchesPerInning = pitches / (outs / 3)
  const ratio = pitchesPerInning / baseline
  return {
    pitchesPerInning,
    baseline,
    ratio,
    laboring: ratio >= LABOR_RATIO,
    ip: line.ip,
  }
}

// Fastball velocity decay per pitcher over the REVEALED portion of the game.
// Returns a map: pitcherId -> { drop, anchor, current, type, flagged } for
// pitchers with enough tracked fastballs; pitchers without tracking (most
// MiLB parks) simply never appear — callers hide the chip.
export function computeVeloDecay(feed, revealedThrough) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  // pitcherId -> code -> [{ half, velo }]
  const samples = {}

  for (const p of plays) {
    const inn = p?.about?.inning
    const half = p?.about?.halfInning
    if (!inn || !half) continue
    if (halfIndex(inn, half) > revealedThrough) continue // sealed — never read
    const pid = p?.matchup?.pitcher?.id
    if (!pid) continue
    for (const e of p.playEvents ?? []) {
      if (!e.isPitch) continue
      const code = e.details?.type?.code
      const velo = e.pitchData?.startSpeed
      if (!code || !FASTBALL_CODES.has(code) || typeof velo !== 'number') continue
      const byCode = (samples[pid] ??= {})
      ;(byCode[code] ??= []).push({ half: halfIndex(inn, half), velo })
    }
  }

  const out = {}
  for (const [pid, byCode] of Object.entries(samples)) {
    // His most-used fastball type carries the signal.
    const codes = Object.entries(byCode).sort((a, b) => b[1].length - a[1].length)
    const [code, list] = codes[0]
    if (list.length < MIN_ANCHOR_PITCHES + MIN_CURRENT_PITCHES) continue

    const halves = [...new Set(list.map((s) => s.half))].sort((a, b) => a - b)
    if (halves.length < 2) continue // one inning of work — no trend yet

    // Anchor: his first two innings of work. Current: his latest revealed one.
    const anchorHalves = new Set(halves.slice(0, 2))
    const currentHalf = halves[halves.length - 1]
    const anchorList = list.filter((s) => anchorHalves.has(s.half) && s.half !== currentHalf)
    const currentList = list.filter((s) => s.half === currentHalf)
    if (anchorList.length < MIN_ANCHOR_PITCHES || currentList.length < MIN_CURRENT_PITCHES)
      continue

    const mean = (xs) => xs.reduce((t, s) => t + s.velo, 0) / xs.length
    const anchor = mean(anchorList)
    const current = mean(currentList)
    const drop = anchor - current
    out[pid] = {
      drop,
      anchor,
      current,
      type: code,
      flagged: drop >= VELO_DROP_FLAG,
    }
  }
  return out
}
