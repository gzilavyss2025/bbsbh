// Projected starters — the RULE for a LIKELY starting pitcher when MLB has not
// announced a probable pitcher. Pure: it takes `{ pitchers: { id: { name, teamId,
// apps: [{ d, p, gs }] } } }` — workload.json's shape — and does day math.
//
// WHERE THE ROWS COME FROM matters more than the rule. Do not hand this
// workload.json's own `apps` to a card: that file keeps regular-season games
// only and is up to a day old, so in October it shows a pitcher who started
// game 1 of the series as fully rested (that happened on 2026-10-01, with Chris
// Sale). `liveStarters.js` is the caller to use: it reads live game logs with
// every game type and passes them here.
//
// Spoiler class: spoiler-FREE. Every input is a COMPLETED appearance strictly
// before the game's date (the same gate `priorApps` in workload.js uses), so a
// caller needs no SealBox and nothing here reads the feed.
//
// The rule, in plain words. A club's rotation is whoever has made starts lately.
// The next starter is the rested one whose last start is OLDEST. A pitcher is
// rested at four or more days between his last start and the game date. A
// pitcher who relieved after his last start has been used another way, so he is
// left out. A "regular" (two or more starts in the last 35 days) ranks above a
// one-start pitcher, who is usually a spot starter or an opener's partner.
//
// How good is it? A one-off backtest over the last 28 days of the 2026 REGULAR
// season (592 team-games, each projected from data strictly before its date)
// named the exact starter 51% of the time and had him in the top two 82% of the
// time. Two names is therefore the honest answer; one name is wrong about half
// the time. NOTHING in October has been measured. Rotations shrink then, clubs
// skip their fifth starter and run bullpen games, and the rule knows none of
// that. Short "starts" (an opener's 20 to 40 pitches) count as starts; ignoring
// them was tried and did not raise the overall hit rate, so it was not adopted.
// The model also does not know off days or injuries; the workload file lists
// active-roster pitchers only, which drops the injured list for free. Rerun the
// backtest with `.scratch/projected-starters/backtest.mjs`; ADR-0089 has the
// reasoning.
//
// MLB only: workload.json carries no minor-league pitcher, so every other level
// gets an empty list and its caller keeps "Not posted yet".

import { dayIndex } from '../workload.js'

// Days between a pitcher's last start and the game, minus the day he started.
// Four is the usual five-day cycle's floor.
export const MIN_REST_DAYS = 4
// How far back a start still counts as "lately".
export const START_WINDOW_DAYS = 35
// Starts inside that window that make a pitcher a regular rather than a spot starter.
export const REGULAR_STARTS = 2

const byOldestStart = (a, b) => b.restDays - a.restDays

// Up to `limit` likely starters for `teamId` on `asOfDate` ('YYYY-MM-DD'), best
// guess first. Each row: { id, name, restDays, lastStart, lastPitches }. Empty
// for missing data, an unknown club, or a missing date.
export function projectStarters(data, teamId, asOfDate, limit = 2) {
  if (!data?.pitchers || teamId == null || !asOfDate) return []
  const asOfIdx = dayIndex(asOfDate)
  if (!Number.isFinite(asOfIdx)) return []

  const regulars = []
  const spots = []
  for (const [id, p] of Object.entries(data.pitchers)) {
    if (Number(p.teamId) !== Number(teamId)) continue
    const prior = (p.apps ?? [])
      .map((a) => ({ ...a, idx: dayIndex(a.d) }))
      .filter((a) => Number.isFinite(a.idx) && a.idx < asOfIdx)
      .sort((a, b) => b.idx - a.idx)
    const starts = prior.filter((a) => a.gs && asOfIdx - a.idx <= START_WINDOW_DAYS)
    if (starts.length === 0) continue
    const last = starts[0]
    const restDays = asOfIdx - last.idx - 1
    if (restDays < MIN_REST_DAYS) continue
    if (prior.some((a) => !a.gs && a.idx > last.idx)) continue
    const row = { id, name: p.name ?? '', restDays, lastStart: last.d, lastPitches: last.p ?? null }
    ;(starts.length >= REGULAR_STARTS ? regulars : spots).push(row)
  }
  return [...regulars.sort(byOldestStart), ...spots.sort(byOldestStart)].slice(0, limit)
}
