// Site-wide search — the footer's player/team/matchup lookups. All
// spoiler-free: search surfaces identity and schedule only, never a score.

import { SEARCHABLE_SPORT_IDS } from '../lib/teams.js'
import { getJson } from './statsapi.js'
import { fetchTeams } from './schedule.js'

// Name search across every person the Stats API knows (current and retired
// alike — the endpoint doesn't distinguish). Matches on either name part as a
// prefix ("jud" -> Judge, Jud Fabian). Active players sort first, since a
// footer search is almost always for someone playing right now; capped at
// `limit` so a common surname doesn't flood the dropdown. Degrades to [] so a
// flaky request just shows "no results" rather than an error state.
//
// Cached in-memory per normalized query for the session — retyping/backspacing
// to a query already searched this visit (e.g. "jud" -> "judg" -> "jud") reuses
// the result instead of refetching. No TTL: a person's id/name/position/team
// is effectively static within a session. Capped at MAX_SEARCH_CACHE entries,
// evicting the oldest, so a long session's search box doesn't grow unbounded.
const searchPeopleCache = new Map()
const MAX_SEARCH_CACHE = 200

export async function searchPeople(query, limit = 8) {
  const q = (query ?? '').trim()
  if (q.length < 2) return []
  const key = q.toLowerCase()
  if (searchPeopleCache.has(key)) return searchPeopleCache.get(key)
  try {
    const data = await getJson(
      `/api/v1/people/search?names=${encodeURIComponent(q)}&hydrate=currentTeam`,
    )
    const result = (data.people ?? [])
      .map((p) => ({
        id: p.id,
        name: p.fullName ?? '',
        active: !!p.active,
        pos: p.primaryPosition?.abbreviation ?? '',
        team: p.currentTeam?.name ?? '',
      }))
      .sort((a, b) => Number(b.active) - Number(a.active))
      .slice(0, limit)
    if (searchPeopleCache.size >= MAX_SEARCH_CACHE) {
      searchPeopleCache.delete(searchPeopleCache.keys().next().value)
    }
    searchPeopleCache.set(key, result)
    return result
  } catch {
    return []
  }
}

// Every active club across every searchable level, fetched once and cached
// for the session. The /teams endpoint has no search param and (verified)
// ignores a comma-joined sportIds list, so a cross-level directory needs one
// request per level up front — the same SEARCHABLE_SPORT_IDS fan-out
// resolveGame already does — rather than a fresh multi-request round trip on
// every keystroke. Degrades to whatever levels succeeded; only truly empty if
// every level failed.
let teamDirectoryPromise = null
export function fetchTeamDirectory() {
  if (!teamDirectoryPromise) {
    teamDirectoryPromise = Promise.allSettled(
      SEARCHABLE_SPORT_IDS.map((sportId) => fetchTeams(sportId)),
    ).then((results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
  }
  return teamDirectoryPromise
}

// Pure client-side filter over a fetchTeamDirectory() list — substring match
// on the full team name, case-insensitive ("brew" -> Brewers).
export function searchTeams(directory, query, limit = 8) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return []
  return (directory ?? [])
    .filter((t) => (t.name ?? '').toLowerCase().includes(q))
    .slice(0, limit)
}
