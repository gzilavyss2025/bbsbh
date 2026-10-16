import { getJson } from '../statsapi.js'

// A club's coaching staff for one season — the team page's Coaching staff card.
// Spoiler-free: who is on a staff says nothing about a score (open surface, ADR-0034).
//
// `/api/v1/teams/{id}/coaches` is the endpoint fetchManager (game.js) reads for the manager.
// It returns one row per JERSEY NUMBER a person wore, not one per job (verified live,
// 2026 Brewers: Pat Murphy is listed as #00 and #49), so a person is one card however many rows. `title` is the specific role ("Lead Hitting Coach"); `job` is only its group
// ("Hitting Coach"), so the title wins and the job is the fallback.
//
// The manager is matched by jobId, not by name: 'MNGR' or the fill-in 'NTRM'. An
// 'Associate Manager' (jobId 'ASSM') is a senior advisor, not a second skipper. An active
// interim replaces the permanent manager, the same call fetchManager makes (game.js).
const MANAGER_JOB_IDS = new Set(['MNGR', 'NTRM'])

export function coachingStaffFrom(roster) {
  const rows = Array.isArray(roster) ? roster : []
  const hasInterim = rows.some((r) => r.jobId === 'NTRM')
  // Group the rows by person, in the order each person first appears. One person can carry
  // several jobs (verified live, 2026: the Phillies' Don Mattingly is listed as Bench Coach and
  // as Interim Manager, the Giants' Bench Coach and Third Base Coach is one man), so the first
  // row is not always the right one.
  const byId = new Map()
  for (const r of rows) {
    const id = r.person?.id
    if (!id || !r.person?.fullName) continue
    if (hasInterim && r.jobId === 'MNGR') continue
    if (!byId.has(id)) byId.set(id, [])
    byId.get(id).push(r)
  }
  const staff = [...byId.values()].map((mine) => {
    const lead = mine.find((r) => MANAGER_JOB_IDS.has(r.jobId))
    // A manager reads as his managing job. Anyone else reads as every distinct title he holds.
    const titles = lead ? [lead] : mine
    return {
      id: mine[0].person.id,
      name: mine[0].person.fullName,
      jersey: mine[0].jerseyNumber ?? '',
      title: [...new Set(titles.map((r) => r.title || r.job).filter(Boolean))].join(' / '),
      manager: Boolean(lead),
    }
  })
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
