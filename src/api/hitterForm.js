import { getJson } from './statsapi.js'

// The PLAYER page's "Recent form" card for hitters: how he's hit over his
// last 7 / 15 / 30 games against his own full-season line — the hitter
// analog of workload.js's pitcher recent-appearances precompute, but fetched
// live per-player rather than read from a nightly file (there's no existing
// batch precompute for lastXGames splits). Four `lastXGames` windows fan out
// in parallel, same Promise.all idiom as fetchPitchingAdvanced /
// fetchAllStarRosterIds in person-fetch.js. Each split degrades to null on
// its own (a rookie with under 30 games this season just has a null last30,
// which nulls the whole card — see hitterFormView).
//
// Name note: src/api/recentForm.js is an unrelated, already-shipped TEAM page
// module (the "Last 10 Games" roster projection consumed by
// screens/team/data/loadRoster.js) — this file is the PLAYER page's per-hitter
// stat-line card and intentionally carries a different name (hitterForm, not
// recentForm) so the two "recent form" features never collide on one path.
export async function fetchHitterForm(personId, season) {
  if (!personId || !season) return null
  const urls = {
    last7: `/api/v1/people/${personId}/stats?stats=lastXGames&limit=7&group=hitting&season=${season}`,
    last15: `/api/v1/people/${personId}/stats?stats=lastXGames&limit=15&group=hitting&season=${season}`,
    last30: `/api/v1/people/${personId}/stats?stats=lastXGames&limit=30&group=hitting&season=${season}`,
    season: `/api/v1/people/${personId}/stats?stats=season&group=hitting&season=${season}`,
  }
  const entries = Object.entries(urls)
  const results = await Promise.all(
    entries.map(([, path]) => getJson(path).then(statFor).catch(() => null)),
  )
  const out = {}
  entries.forEach(([key], i) => {
    out[key] = results[i]
  })
  return out
}

function statFor(data) {
  return data?.stats?.[0]?.splits?.[0]?.stat ?? null
}

// Signed OPS-points delta, e.g. "+.102 OPS" / "−.054 OPS" — same U+2212
// minus-sign convention as PitcherWorkloadCard's signedPct, applied to a rate
// delta instead of a percentage.
function signedOpsDelta(delta) {
  const sign = delta < 0 ? '−' : '+'
  return `${sign}${Math.abs(delta).toFixed(3).replace(/^0(?=\.)/, '')} OPS`
}

// avg/ops etc. come back from statsapi as already-formatted strings
// (".179", "1.021", …) — rendered as-is, never re-parsed for display.
const line = (s) => (s?.avg != null && s?.ops != null ? `${s.avg} · ${s.ops} OPS` : null)

// Pure view over fetchHitterForm's output: `{ facts: [{label, value}] }` or
// null. Requires only last30 — a missing last7/last15 (a hitter with fewer
// than 15 team games played) just drops that fact rather than nulling the
// whole card, since last30 alone is still a useful "recent form" read.
export function hitterFormView({ last7, last15, last30, season } = {}) {
  if (!last30 || !(Number(last30.gamesPlayed) > 0)) return null

  const facts = []
  const l7 = line(last7)
  if (l7) facts.push({ label: 'Last 7 games', value: l7 })
  const l15 = line(last15)
  if (l15) facts.push({ label: 'Last 15 games', value: l15 })
  const l30 = line(last30)
  if (l30) facts.push({ label: 'Last 30 games', value: l30 })

  if (last15?.homeRuns != null && last15?.rbi != null) {
    facts.push({ label: 'HR / RBI, last 15', value: `${last15.homeRuns} HR · ${last15.rbi} RBI` })
  }

  const l15Ops = parseFloat(last15?.ops)
  const seasonOps = parseFloat(season?.ops)
  if (Number.isFinite(l15Ops) && Number.isFinite(seasonOps)) {
    facts.push({ label: 'Vs. season', value: signedOpsDelta(l15Ops - seasonOps) })
  }

  return { facts }
}
