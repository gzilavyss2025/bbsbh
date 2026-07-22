// Season-long foul-ball aggregates, read from a static same-origin file
// (public/data/fouls.json) precomputed nightly by scripts/gen-fouls.mjs (the
// build-time-fetch pattern — see src/api/CLAUDE.md and war.js). Foul balls are
// not pre-totaled anywhere in the API, so the generator sweeps completed games'
// play-by-play; this module just reads the shaped file and derives view models.
//
// Spoiler note: this is a COMPLETED-GAME season aggregate — counts of fouls hit
// across games already Final — so it carries no live game's score, on the same
// footing as war.js / League Leaders (a foul count is not a run, hit, or out).
// It's spoiler-FREE and needs no SealBox; it can render pregame on TeamInfo /
// PlayerPage. Degrades to null on any failure — a missing card, not a crash.
//
// Cached in-memory for the session (the file changes once a day).
let cached

export async function fetchFouls() {
  if (cached !== undefined) return cached
  try {
    const res = await fetch('/data/fouls.json')
    if (!res.ok) throw new Error(`fouls.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

// Qualifier floors for the leaderboards, exported so a caller (or a test) can
// reference the same minimums the ranking uses. Batters qualify on games
// played, pitchers on total pitches thrown — a one-appearance cameo shouldn't
// top a rate board (same idea as the live leader boards' playing-time floor).
export const MIN_BATTER_GAMES = 20
export const MIN_PITCHER_PITCHES = 200

// Literature priors for UI copy (SABR/Retrosheet + FanGraphs) — the empirical
// "battling to two strikes via fouls" edge, so live foul counts can carry
// meaning from day one without our own correlation study. See
// .scratch/metric-engines/foul-tracker.md's research findings.
export const FOUL_PRIORS = {
  hitProbFoulRoute2K: 0.291,
  hitProbOtherRoute2K: 0.102,
  hitProbFoulRoute2K3Fouls: 0.335,
  source: 'SABR BRJ 2018 (Howard), Retrosheet 1945-2015',
}

const round = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : n)

// One batter's foul view model with derived rates, or null when he isn't in the
// file (a non-MLB player, or one who never fouled a pitch off in a swept game).
export function batterFoulLine(data, personId) {
  const b = data?.batters?.[personId] ?? data?.batters?.[String(personId)]
  if (!b) return null
  const g = b.g || 0
  const pa = b.pa || 0
  return {
    name: b.name,
    teamId: b.teamId ?? null,
    g,
    pa,
    pitchesSeen: b.pitchesSeen || 0,
    fouls: b.fouls || 0,
    twoStrikeFouls: b.twoStrikeFouls || 0,
    maxGameFouls: b.maxGameFouls || 0,
    maxGamePk: b.maxGamePk ?? null,
    maxGamePa: b.maxGamePa || 0,
    maxGamePitches: b.maxGamePitches || 0,
    maxGameOpponentId: b.maxGameOpponentId ?? null,
    maxGameDate: b.maxGameDate ?? null,
    foulsPerGame: g ? round(b.fouls / g) : null,
    foulsPerPA: pa ? round(b.fouls / pa, 3) : null,
    twoStrikeFoulsPerGame: g ? round(b.twoStrikeFouls / g) : null,
  }
}

// One pitcher's foul view model with derived rates, or null when absent.
// `foulsToWhiffs` is the informative pitcher cut (high = missing the barrel,
// not the bat); null when he has no whiffs to divide by.
export function pitcherFoulLine(data, personId) {
  const p = data?.pitchers?.[personId] ?? data?.pitchers?.[String(personId)]
  if (!p) return null
  const pitches = p.pitches || 0
  const whiffs = p.whiffs || 0
  const g = p.g || 0
  return {
    name: p.name,
    teamId: p.teamId ?? null,
    g,
    pitches,
    fouls: p.fouls || 0,
    whiffs,
    isStarter: !!p.isStarter,
    foulPct: pitches ? round(p.fouls / pitches, 3) : null,
    foulsToWhiffs: whiffs ? round(p.fouls / whiffs) : null,
    foulsPerGame: g ? round(p.fouls / g) : null,
  }
}

// Ranked foul leaderboards for a scope ('league' or a numeric teamId).
// `minGames` overrides the batter games floor (defaults to MIN_BATTER_GAMES).
// Returns { batters: { byFouls, byFoulsPerGame }, pitchers: { byFoulPct,
// byFoulsToWhiffs } } — each an array of ranked rows, or empty arrays on missing
// data. Pitchers always use the MIN_PITCHER_PITCHES floor.
export function foulLeaders(data, { scope = 'league', minGames = MIN_BATTER_GAMES } = {}) {
  const empty = { batters: { byFouls: [], byFoulsPerGame: [] }, pitchers: { byFoulPct: [], byFoulsToWhiffs: [] } }
  if (!data) return empty
  const teamFilter = scope !== 'league' ? Number(scope) : null
  const inScope = (teamId) => teamFilter == null || teamId === teamFilter

  const batterRows = Object.keys(data.batters ?? {})
    .map((id) => ({ personId: Number(id), ...batterFoulLine(data, id) }))
    .filter((r) => r && inScope(r.teamId) && r.g >= minGames)
  const pitcherRows = Object.keys(data.pitchers ?? {})
    .map((id) => ({ personId: Number(id), ...pitcherFoulLine(data, id) }))
    .filter((r) => r && inScope(r.teamId) && r.pitches >= MIN_PITCHER_PITCHES)

  const byDesc = (key) => (a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity)

  return {
    batters: {
      byFouls: [...batterRows].sort(byDesc('fouls')),
      byFoulsPerGame: [...batterRows].sort(byDesc('foulsPerGame')),
    },
    pitchers: {
      byFoulPct: [...pitcherRows].sort(byDesc('foulPct')),
      byFoulsToWhiffs: [...pitcherRows.filter((r) => r.foulsToWhiffs != null)].sort(byDesc('foulsToWhiffs')),
    },
  }
}

// League-wide foul rates: overall, by inning (with the starter/reliever split),
// and by pitch type (sorted by foul rate, highest first). Null-safe — returns
// null when the file (or its league block) is missing.
export function leagueFoulRates(data) {
  const league = data?.league
  if (!league) return null
  const rate = (fouls, pitches) => (pitches ? Number((fouls / pitches).toFixed(4)) : null)
  const totals = league.totals ?? { pitches: 0, fouls: 0, twoStrikeFouls: 0 }

  const byInning = (league.byInning ?? []).map((r) => ({
    inning: r.inning,
    pitches: r.pitches,
    fouls: r.fouls,
    foulRate: rate(r.fouls, r.pitches),
    vsStarter: { ...r.vsStarter, foulRate: rate(r.vsStarter?.fouls ?? 0, r.vsStarter?.pitches ?? 0) },
    vsReliever: { ...r.vsReliever, foulRate: rate(r.vsReliever?.fouls ?? 0, r.vsReliever?.pitches ?? 0) },
  }))

  const byPitchType = (league.byPitchType ?? [])
    .map((r) => ({ ...r, foulRate: rate(r.fouls, r.pitches) }))
    .sort((a, b) => (b.foulRate ?? -Infinity) - (a.foulRate ?? -Infinity))

  return {
    foulRate: rate(totals.fouls, totals.pitches),
    totals,
    byInning,
    byPitchType,
  }
}
