// Career timeline — the club-by-club "Team history" rail (and the manager
// page's "Playing career" rail, the same component). This module owns the
// FETCH side of it: the per-club logo tint, each farm club's parent org, and
// the one entry point that shapes and enriches a whole rail. The pure shaping
// is careerTimelineView in person/careerRegister.js.
//
// Split out of person-fetch.js when that file hit its size budget; nothing
// here reads a live game feed, so it carries the same spoiler-free footing as
// the rest of the player-page fetchers.

import { teamLogoUrl } from '../lib/teams.js'
import { tintFromSvg } from '../lib/logoTint.js'
import { careerTimelineView } from './person.js'
import { fetchPersonStats, fetchMilbYearByYear } from './person-fetch.js'
import { fetchTeam } from './team.js'
import { historicalParentOrg } from './milbHistory.js'

// A soft background wash for a team, derived from its own logo colors so the
// full-color mark reads cleanly on it with no border or drop shadow (see
// lib/logoTint.js). The mlbstatic logo CDN serves its SVGs cross-origin, so we
// read the actual fills out of the markup rather than keeping a per-club color
// table — statsapi has no color field, and there are hundreds of MiLB clubs.
// Tries the (clean, two-color) cap mark first, then the full primary. Memoized
// per team id, since a career timeline re-requests the same clubs, and degrades
// to null so a club whose logo is missing or colorless (a black/silver cap)
// just gets a plain neutral cell.
const logoTintCache = new Map()
export function fetchTeamLogoTint(teamId) {
  if (!teamId) return Promise.resolve(null)
  if (logoTintCache.has(teamId)) return logoTintCache.get(teamId)
  const p = (async () => {
    for (const variant of ['cap', 'base']) {
      try {
        const res = await fetch(teamLogoUrl(teamId, variant))
        if (!res.ok) continue
        const tint = tintFromSvg(await res.text())
        if (tint) return tint
      } catch {
        // try the next variant, else fall through to the neutral null below
      }
    }
    return null
  })()
  logoTintCache.set(teamId, p)
  return p
}

// Enrich a careerTimelineView's entries IN PLACE with each stop's logo tint,
// hover label, and — for a MiLB stop — its MLB affiliate at the time (id,
// name, tint) — the shared treatment behind both the player page's "Team
// history" and the manager page's "Playing career" timelines. Tint is
// resolved per DISTINCT team (it doesn't depend on when he was there); the
// affiliate is resolved per STOP, because an affiliate can be reassigned to a
// different parent org between two separate stints at the same club. MLB
// stops use the club name alone and carry no affiliate (a club has no
// affiliate of its own); a farm club's title appends its parent org in
// parens ("Nashville Sounds (Milwaukee Brewers)"), preferring the
// hand-curated historical org for that season over the club's live parent.
// The affiliate fields feed CareerTimeline's hover/tap swap — see its own
// header — and are absent (not merely null) whenever no parent org resolves,
// so the component's `e.affiliateTeamId &&` guard stays a plain existence
// check. Returns the same `entries` for chaining.
export async function enrichTimelineEntries(entries) {
  const tintByTeam = new Map()
  const teamTint = async (teamId) => {
    if (!tintByTeam.has(teamId)) tintByTeam.set(teamId, fetchTeamLogoTint(teamId))
    return tintByTeam.get(teamId)
  }
  await Promise.all([...new Set((entries ?? []).map((e) => e.teamId))].map(teamTint))
  await Promise.all(
    (entries ?? []).map(async (e) => {
      e.tint = await teamTint(e.teamId)
      if (e.sportId === 1) {
        e.title = e.teamName
        return
      }
      const [hist, team] = await Promise.all([historicalParentOrg(e.teamId, e.minSeason), fetchTeam(e.teamId)])
      const parentOrgId = hist?.id ?? team?.parentOrgId ?? null
      const parentOrgName = hist?.name ?? team?.parentOrgName ?? ''
      e.title = parentOrgName ? `${e.teamName} (${parentOrgName})` : e.teamName
      if (parentOrgId) {
        e.affiliateTeamId = parentOrgId
        e.affiliateName = parentOrgName
        e.affiliateTint = await teamTint(parentOrgId)
      }
    }),
  )
  return entries
}

// Resolve every farm club in a set of year-by-year splits to the MLB org it
// belonged to THAT SEASON, and hand back the plain `(teamId, season) => orgId`
// lookup careerTimelineView's season sort takes. Per (club, season), not per
// club: an affiliate changes parent orgs between two stints at the same club,
// and the hand-curated historical org for that year outranks the club's live
// parent for exactly that reason (same precedence enrichTimelineEntries uses).
// Both sources are cheap — a static file and the static club list — so this
// costs no statsapi call in the ordinary case. An unresolved club is simply
// absent from the map; the sort then falls back per season, so this never has
// to be complete to be safe.
async function resolveTimelineOrgs(splits) {
  const pairs = new Map()
  for (const s of splits ?? []) {
    const teamId = s.team?.id
    const season = Number(s.season)
    if (!teamId || !season || s.sport?.id === 1) continue
    pairs.set(`${teamId}|${season}`, { teamId, season })
  }
  const orgs = new Map()
  await Promise.all(
    [...pairs].map(async ([key, { teamId, season }]) => {
      const [hist, team] = await Promise.all([historicalParentOrg(teamId, season), fetchTeam(teamId)])
      const orgId = hist?.id ?? team?.parentOrgId ?? null
      if (orgId) orgs.set(key, orgId)
    }),
  )
  return (teamId, season) => orgs.get(`${teamId}|${season}`) ?? null
}

// The one way to build a "Team history" timeline: resolve each farm club's
// parent org (so a traded season's stops group by org rather than by level),
// shape the stints, then enrich the entries with tint/label/affiliate. Both
// callers — the player page and the manager page's playing career — go through
// here, so the two rails can't order a season differently. Returns the
// timeline object, or null when nothing qualifies.
export async function buildCareerTimeline(splits, group, debutYear) {
  const orgOf = await resolveTimelineOrgs(splits)
  const timeline = careerTimelineView(splits, group, debutYear, orgOf)
  if (!timeline) return null
  await enrichTimelineEntries(timeline.entries)
  return timeline
}

// The clubs a manager/coach played for as a PLAYER — the same "Team history"
// timeline the player page shows, sourced from his own year-by-year splits (MLB
// + the MiLB level fan-out) and shaped by careerTimelineView. `group` is the
// playing group fetchManagerPlaying already resolved; `debutYear` (from the
// bio's mlbDebutDate) lets the shaper drop post-debut rehab/option-down MiLB
// noise. Returns the enriched entries[] (for <CareerTimeline>) or null when he
// has no qualifying playing history (most MiLB-only managers predate coverage).
export async function fetchPlayingTimeline(personId, group, debutYear) {
  if (!personId || !group) return null
  const [mlbYby, milbYby] = await Promise.all([
    fetchPersonStats(personId, { type: 'yearByYear', group, sportId: 1 }),
    fetchMilbYearByYear(personId, group),
  ])
  const timeline = await buildCareerTimeline([...mlbYby, ...milbYby], group, debutYear)
  return timeline?.entries ?? null
}
