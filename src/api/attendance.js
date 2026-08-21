// Per-team, per-season HOME-game attendance: games counted, season total,
// average, high, low, and how many dates filled the park. Read from the
// static public/data/attendance.json a nightly scripts/gen-attendance.mjs
// precomputes (build-time-fetch pattern). Surfaced by the Team hub's Ballpark
// card — the club's own figures, plus where each of them stands among the
// other 29 clubs.
//
// THREE RANKS, NOT ONE, because they answer three different questions and they
// disagree. AVERAGE is how many people came on a normal night. TOTAL is how
// many came all year, which is the same number times a different schedule — a
// club with 68 home dates outdraws one with 62 on the same average. FILL is
// the share of the seats that were sold, and it is the only one of the three
// that is not mostly a measure of how many seats a club built: Fenway seats
// 37,755 and Dodger Stadium 56,000, so ranking those two by heads rewards the
// concrete. Same argument, at more length, in around-the-game/gate.js.
//
// THE GENERATOR SHIPS THE FIGURES; THE RANKING LIVES HERE — the same split
// gate.js documents. attendance.json holds each club's own totals and nothing
// about the other 29. The one exception is the sellout count, which the
// generator has to derive because it needs the per-game gates that never
// leave it; it ships the threshold it used (`selloutFill`) alongside, so the
// card can label the number rather than hard-code a second copy of it.
//
// Spoiler-free: a season aggregate over FINAL games' attendance carries no
// live-game score (same footing as WAR / comeback-wins), so no SealBox.
// Degrades to null with no file, or for any club with no home games ingested
// yet (early season, or MiLB — the generator is MLB only).

import { staticJson } from './staticJson.js'

export const fetchAttendance = staticJson('/data/attendance.json')

// One team's raw totals for a season, or null if the file has no row for it.
export function attendanceFor(data, teamId, season) {
  return data?.seasons?.[season]?.byTeamId?.[teamId] ?? null
}

// Percent of the listed seats that were sold across a club's measured dates,
// one decimal, or null when no date was measurable. NEVER CLAMPED at 100:
// capacity is a listed figure, not a turnstile cap, and standing room puts a
// real gate over it — clamping would erase exactly the clubs the stat finds.
function fillRate(row) {
  if (!row?.seats || row.seated == null) return null
  return Math.round((row.seated / row.seats) * 1000) / 10
}

// Standard competition ("1224") rank of one club within the pool, best first:
// ties SHARE the best rank, the same convention comebackRatesFor and
// gate.js's `ranked` already use. A club with no value for that field ranks
// null rather than last — it has not earned a place either way.
function rankIn(rows, value) {
  if (value == null) return { rank: null, of: rows.length, tied: false }
  const ahead = rows.filter((v) => v > value).length
  return { rank: ahead + 1, of: rows.length, tied: rows.filter((v) => v === value).length > 1 }
}

// The Ballpark card's shape: this club's own attendance figures, plus its
// rank by average, by season total, and by fill rate among every club with a
// row this season. Null when the club has no row yet.
export function attendanceRatesFor(data, teamId, season) {
  const byTeamId = data?.seasons?.[season]?.byTeamId
  const mine = byTeamId?.[teamId]
  if (!byTeamId || !mine || mine.avg == null) return null
  const all = Object.values(byTeamId)
  const fill = fillRate(mine)
  const byAvg = rankIn(all.map((r) => r.avg).filter((v) => v != null), mine.avg)
  const byTotal = rankIn(all.map((r) => r.total).filter((v) => v != null), mine.total)
  // The fill pool is only the clubs whose park has a listed capacity, so its
  // `of` can be smaller than the other two — the card prints that pool's own
  // size rather than implying a rank out of thirty it was not measured in.
  const byFill = rankIn(all.map(fillRate).filter((v) => v != null), fill)
  return {
    games: mine.games,
    avg: mine.avg,
    high: mine.high,
    low: mine.low,
    total: mine.total,
    sellouts: mine.sellouts ?? null,
    // How many of this club's dates could be measured against a capacity —
    // the sellout count's own denominator, which is the whole home schedule
    // except in the rare season with a game played abroad.
    selloutOf: mine.capGames ?? null,
    // The share of capacity the count was taken at (0.95 -> 95), so the card
    // labels the number with the definition it was counted under.
    selloutPct: data.selloutFill != null ? Math.round(data.selloutFill * 100) : null,
    fill,
    rank: byAvg.rank,
    of: byAvg.of,
    tied: byAvg.tied,
    totalRank: byTotal.rank,
    totalOf: byTotal.of,
    totalTied: byTotal.tied,
    fillRank: byFill.rank,
    fillOf: byFill.of,
    fillTied: byFill.tied,
  }
}
