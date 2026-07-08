// Fetching + pure selectors over the app's own Top-100-prospects snapshot
// (public/data/top-prospects.json), refreshed weekly off-device — see
// docs/top-prospects.md. This is a same-origin static asset, not the public
// MLB Stats API (mlb.js's territory) or a shaping of a /people response
// (person.js's territory), so it gets its own small file.

const SNAPSHOT_URL = '/data/top-prospects.json'
const EMPTY_SNAPSHOT = { generatedAt: null, source: null, count: 0, players: [], orgProspects: [] }

// Session-memoized, mirrors fetchTeamDirectory's caching pattern in mlb.js.
// Degrades to an empty snapshot on any failure (404 before the first weekly
// Action run, malformed JSON, network) — callers never need their own
// try/catch, and the app just renders as if no player is ranked.
let prospectsPromise = null
export function fetchTopProspects() {
  if (!prospectsPromise) {
    prospectsPromise = fetch(SNAPSHOT_URL)
      .then((res) => (res.ok ? res.json() : EMPTY_SNAPSHOT))
      .catch(() => EMPTY_SNAPSHOT)
  }
  return prospectsPromise
}

export function prospectRankById(players, playerId) {
  const row = (players ?? []).find((p) => p.playerId === playerId)
  return row ? row.rank : null
}

// A player's rank on his OWN org's farm-system leaderboard (distinct from
// prospectRankById's overall Top 100 rank) — used for the player-page's
// second pill, and null for anyone not in their org's list at all.
export function orgProspectRankById(orgProspects, playerId) {
  const row = (orgProspects ?? []).find((p) => p.playerId === playerId)
  return row ? row.orgRank : null
}

// Everything a ProspectPill needs for one player, resolved from a single
// fetchTopProspects() snapshot with no extra fetching: the overall Top 100
// rank when he's ranked there, else his own org's farm-system rank (1-30)
// plus that org's team id for the pill's logo — no affiliate-roster
// resolution needed (unlike orgProspectsForTeam's table), since the
// snapshot's own teamId field already IS the player's parent org. Both
// rank fields are null when he's unranked anywhere.
export function prospectBadge(snapshot, playerId) {
  const orgRow = (snapshot?.orgProspects ?? []).find((p) => p.playerId === playerId)
  return {
    rank: prospectRankById(snapshot?.players, playerId),
    orgRank: orgRow?.orgRank ?? null,
    orgTeamId: orgRow?.teamId ?? null,
    orgTeamName: orgRow?.team ?? null,
  }
}

// Pure — no fetching. rosterIdsByTeam: { [teamId]: number[] } (person ids on
// a team's active roster); prospectPlayerIds: Set<number> (every ranked
// player's id). Used by the MiLB game-card badge.
export function countProspectsByTeam(rosterIdsByTeam, prospectPlayerIds) {
  const out = {}
  for (const [teamId, ids] of Object.entries(rosterIdsByTeam ?? {})) {
    out[teamId] = (ids ?? []).filter((id) => prospectPlayerIds.has(id)).length
  }
  return out
}

// ---------------------------------------------------------------------------
// Team-page prospect table — one org's full farm-system leaderboard, with
// each prospect's CURRENT affiliate resolved by live roster membership
// rather than the scraped (sometimes ambiguous, e.g. "ALL (2)") level
// string, so the table can show a real affiliate logo next to the level.
// ---------------------------------------------------------------------------

// This org's prospects, ranked. `orgTeamId` is the MLB parent's team id —
// the same id whether you're looking at the parent's own page or one of its
// affiliates' pages (see teams.js's parentOrgId).
export function orgProspectsForTeam(orgProspects, orgTeamId) {
  return (orgProspects ?? [])
    .filter((p) => p.teamId === orgTeamId)
    .sort((a, b) => a.orgRank - b.orgRank)
}

// affiliateRosterIds: { [affiliateTeamId]: number[] } (from
// fetchRosterIdsForTeams). Flips it into playerId -> affiliateTeamId so a
// prospect row can look up which specific affiliate he's actually on right
// now. A player on none of the org's full-season affiliate rosters (most
// often a complex/rookie-leaguer — those aren't in AFFILIATE_SPORT_IDS)
// simply won't resolve, and the caller falls back to the scraped level text.
export function prospectAffiliateMap(affiliateRosterIds) {
  const out = new Map()
  for (const [teamId, ids] of Object.entries(affiliateRosterIds ?? {})) {
    for (const id of ids) out.set(id, Number(teamId))
  }
  return out
}
