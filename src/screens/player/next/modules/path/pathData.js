// The Path slot's loader (#1894). Four requests of its own beyond the shared player context (two,
// joined with the other slots): one MiLB year-by-year per level (5) and, once he has debuted, his
// MLB year-by-year (1). "Here now" uses the tile-level rule (currentActivitySportId): a rehab
// assignment, or a debuted player on no club, is still at the majors.
import { playerContext } from '../../../../../api/player/context.js'
import { fetchMilbYearByYear, fetchPersonStats } from '../../../../../api/person-fetch.js'

export async function loadPath(id, asOf, group) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const debutDate = ctx.bio.debut && !(ctx.cutoff && ctx.bio.debut >= ctx.cutoff) ? ctx.bio.debut : null
  const [milb, mlb] = await Promise.all([
    fetchMilbYearByYear(id, group),
    debutDate ? fetchPersonStats(id, { type: 'yearByYear', group, sportId: 1 }) : [],
  ])
  return { bio: ctx.bio, milb, mlb, group, debutDate, currentSportId: ctx.currentActivitySportId }
}
