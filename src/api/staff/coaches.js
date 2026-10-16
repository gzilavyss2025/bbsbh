import { getJson } from '../statsapi.js'

// A club's coaching staff for one season — the team page's Coaching staff card.
// Spoiler-free: who is on a staff says nothing about a score (open surface, ADR-0034).
//
// `/api/v1/teams/{id}/coaches` is the endpoint fetchManager (game.js) reads for the manager.
// It returns one row per JERSEY NUMBER a person wore, not one per job (verified live,
// 2026 Brewers: Pat Murphy is listed as #00 and #49). So this keeps the first row of each
// person. `title` is the specific role ("Lead Hitting Coach"); `job` is only its group
// ("Hitting Coach"), so the title wins and the job is the fallback.
//
// The manager is matched by jobId, not by name: 'MNGR' or the fill-in 'NTRM'. An
// 'Associate Manager' (jobId 'ASSM') is a senior advisor, not a second skipper. An active
// interim replaces the permanent manager, the same call fetchManager makes (game.js).
const MANAGER_JOB_IDS = new Set(['MNGR', 'NTRM'])

export function coachingStaffFrom(roster) {
  const rows = Array.isArray(roster) ? roster : []
  const hasInterim = rows.some((r) => r.jobId === 'NTRM')
  const seen = new Set()
  const staff = []
  for (const r of rows) {
    const id = r.person?.id
    const name = r.person?.fullName
    if (!id || !name || seen.has(id)) continue
    if (hasInterim && r.jobId === 'MNGR') continue
    seen.add(id)
    staff.push({
      id,
      name,
      jersey: r.jerseyNumber ?? '',
      title: r.title || r.job || '',
      manager: MANAGER_JOB_IDS.has(r.jobId),
    })
  }
  // Array.sort is stable: the manager moves to the front, every other row keeps its place.
  return staff.sort((a, b) => Number(b.manager) - Number(a.manager))
}

// MiLB clubs often have no staff on file: that reads as an empty list, never an error.
export async function fetchCoachingStaff(teamId, season) {
  if (!teamId) return []
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/coaches${season ? `?season=${season}` : ''}`)
    return coachingStaffFrom(data.roster)
  } catch {
    return []
  }
}
