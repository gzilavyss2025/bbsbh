// The reverse of gen-manager-history.mjs's byPersonId table: for each manager,
// who held a coach job on the same club-season. A client cannot scan the 100
// shards for that, so the generator writes it once. Pure, so it is unit-tested
// (scripts/CLAUDE.md).
//
// Returns { [managerId]: [[personId, seasonsTogether, laterManaged 0|1]] },
// most seasons first. `laterManaged` = he held a Manager/Interim row in the
// first season he coached under this manager or any season after it.
// A club-season shared by two managers credits its staff to both.
const MANAGER_JOB_IDS = new Set(['MNGR', 'NTRM']) // same rule as src/api/managers.js

export function buildStaffIndex(byPersonId) {
  const managersAt = new Map() // `${teamId}:${season}` -> Set of managerIds
  const coachesAt = new Map() // same key -> Set of coach personIds
  const lastManaged = new Map() // personId -> latest season he held a manager job
  for (const [id, stints] of Object.entries(byPersonId)) {
    for (const s of stints) {
      const key = `${s.teamId}:${s.season}`
      if (MANAGER_JOB_IDS.has(s.jobId)) {
        if (!managersAt.has(key)) managersAt.set(key, new Set())
        managersAt.get(key).add(Number(id))
        lastManaged.set(id, Math.max(lastManaged.get(id) ?? 0, s.season))
      } else {
        if (!coachesAt.has(key)) coachesAt.set(key, new Set())
        coachesAt.get(key).add(Number(id))
      }
    }
  }
  // managerId -> personId -> seasons together
  const together = {}
  for (const [key, managers] of managersAt) {
    const season = Number(key.split(':')[1])
    for (const m of managers) {
      for (const p of coachesAt.get(key) ?? []) {
        if (p === m) continue
        ;((together[m] ??= {})[p] ??= new Set()).add(season)
      }
    }
  }
  const out = {}
  for (const [m, people] of Object.entries(together)) {
    out[m] = Object.entries(people)
      .map(([p, seasons]) => [
        Number(p),
        seasons.size,
        (lastManaged.get(p) ?? 0) >= Math.min(...seasons) ? 1 : 0,
      ])
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
  }
  return out
}
