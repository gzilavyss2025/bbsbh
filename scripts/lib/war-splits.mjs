// Per-team WAR splits for a traded player's season. Extracted from
// gen-war.mjs on 2026-08-28 so the retry and carry-forward behavior below can
// be unit-tested (test/war-splits.test.js) — the generator itself runs its
// work at import time and cannot be imported by a test.
//
// The bulk sabermetrics leaderboard gives one row per player: the season
// TOTAL, even for a player with `numTeams > 1`, with no way to split it out of
// that row. Per-team WAR only comes back from a per-PLAYER query, which
// returns the total split PLUS one row per team stint. That is one request per
// traded player — ~180 a night as of 2026-08 — against an endpoint that
// intermittently 500s on a player the very next request serves fine.
//
// Before this module existed, a single non-2xx on any ONE of those ~180
// players threw and aborted the whole generator: war.json was never written,
// and both consumers used the previous day's file without saying so
// (gen-milb-alumni.mjs:74 throws only if war.json is MISSING, never if it is
// stale; gen-former-teammates.mjs:239 catches the read and degrades peak WAR
// to 0). That is exactly what happened on 2026-08-28, the first nightly run
// after the splits feature shipped — one HTTP 500 on person 622761, and the
// same URL returned 200 three times a minute later.
//
// Two changes prevent it:
//
//   1. Each player is retried with exponential backoff before counting as
//      failed, since the observed failure is transient.
//   2. A player who still fails CARRIES FORWARD his previous value from the
//      committed war.json rather than vanishing from the file. Dropping him
//      silently would be worse than stale: a deadline acquisition's per-team
//      split would just disappear off his player page with nothing on screen
//      to say why. Carried ids are returned so the caller can report a count.
//
// A systemic outage is not the same as a flake, and must not be papered over.
// If more than MAX_CARRIED_RATIO of the traded players fail, teamWarSplits
// THROWS instead of returning: the WAR step goes red, war.json is not
// rewritten, and the workflow's `steps.war.outcome == 'success'` gates hold
// the consumers off yesterday's file deliberately rather than by accident.

export const MAX_CARRIED_RATIO = 0.25

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function splitsUrl(id, group, season) {
  return (
    `https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=sabermetrics&group=${group}` +
    `&season=${season}&sportId=1`
  )
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// One player's team stints, retried. Throws only once every attempt is spent.
export async function fetchTeamSplits(id, group, season, opts = {}) {
  const { fetchImpl = fetch, attempts = 3, delayMs = 400, sleepImpl = sleep } = opts
  let lastErr
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(splitsUrl(id, group, season))
      if (!res.ok) {
        throw new Error(
          `statsapi sabermetrics ${group} team splits for person ${id}: HTTP ${res.status}`,
        )
      }
      const json = await res.json()
      return (json.stats?.[0]?.splits ?? []).filter((s) => s.team)
    } catch (err) {
      lastErr = err
      if (attempt < attempts) await sleepImpl(delayMs * 2 ** (attempt - 1))
    }
  }
  throw lastErr
}

// `previous` is the prior run's byTeam map (war.json's batByTeam/pitByTeam),
// used only to carry a failed player forward. Returns { byTeam, carried }.
export async function teamWarSplits(ids, group, season, opts = {}) {
  const { previous = {}, ...fetchOpts } = opts
  const byTeam = {}
  const carried = []
  for (const id of ids) {
    let splits
    try {
      splits = await fetchTeamSplits(id, group, season, fetchOpts)
    } catch {
      // Carry the previous value forward when there is one. A player with no
      // previous entry simply stays absent, the same as before — but he still
      // counts as carried, so the ratio check below sees the real failure rate.
      const prev = previous[id]
      if (prev) byTeam[id] = prev
      carried.push(id)
      continue
    }
    const rows = []
    for (const split of splits) {
      const w = num(split.stat?.war)
      if (w != null) rows.push({ teamId: split.team.id, war: Math.round(w * 10) / 10 })
    }
    if (rows.length) byTeam[id] = rows
  }
  if (ids.length && carried.length / ids.length > MAX_CARRIED_RATIO) {
    throw new Error(
      `statsapi sabermetrics ${group} team splits failed for ${carried.length} of ${ids.length} ` +
        `traded players (over ${Math.round(MAX_CARRIED_RATIO * 100)}%) — treating as an outage ` +
        `rather than carrying that much of the file forward`,
    )
  }
  return { byTeam, carried }
}
