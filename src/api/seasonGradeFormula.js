// Season Grade turns two deliberately separate measures into one verdict:
// Quality says how strong the team has played; Surprise says how far it has
// outperformed or underperformed its preseason expectation. Surprise adjusts
// only the remaining headroom (or footing), so it can distinguish an
// extraordinary season without letting a merely surprising team outrank the
// league's genuinely elite clubs.
export const SEASON_GRADE_ACHIEVEMENT_WEIGHT = 0.6

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round1 = (n) => Math.round(n * 10) / 10

export function seasonGradeFromScores(quality, surprise) {
  if (!Number.isFinite(quality) || !Number.isFinite(surprise)) return null

  const boundedQuality = clamp(quality, 0, 10)
  const boundedSurprise = clamp(surprise, 0, 10)
  const surpriseDirection = (boundedSurprise - 5) / 5
  const availableRange = surpriseDirection >= 0 ? 10 - boundedQuality : boundedQuality
  const adjustment = SEASON_GRADE_ACHIEVEMENT_WEIGHT * surpriseDirection * availableRange

  return {
    score: round1(clamp(boundedQuality + adjustment, 0, 10)),
    adjustment: round1(adjustment),
    quality: boundedQuality,
    surprise: boundedSurprise,
  }
}

export function seasonGradeFor(qualitySummary, surpriseSummary) {
  return seasonGradeFromScores(qualitySummary?.score, surpriseSummary?.score)
}
