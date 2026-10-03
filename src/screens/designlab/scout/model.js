// MATCHUP SCOUT — the design prototype's own head-to-head helpers, run on
// ./fixture.js (issue #1408, spec docs/scout-design.md). The region geometry
// is lib/zone/regions.js, the hitter metrics lib/scout/metrics.js and the
// labels lib/scout/format.js, all shared with the page. Nothing here fetches.

// ---------------------------------------------------------------------------
// HEAD TO HEAD. The cutoff is a date (ADR-0087, ADR-0088): a plate appearance
// counts only when its game is dated before the cutoff. The totals are built
// from the same filtered rows, so the line and the list cannot disagree.
export const h2hBefore = (rows, cutoff) => rows.filter((r) => r.date < cutoff)


const HITS = { single: 1, double: 2, triple: 3, home_run: 4 }
const NO_AB = new Set(['walk', 'intent_walk', 'hit_by_pitch', 'sac_fly', 'sac_bunt'])

export function h2hTotals(rows) {
  const t = { pa: rows.length, ab: 0, h: 0, tb: 0, bb: 0, hbp: 0, sf: 0, k: 0 }
  for (const { event } of rows) {
    if (!NO_AB.has(event)) t.ab++
    if (HITS[event]) { t.h++; t.tb += HITS[event] }
    if (event === 'walk' || event === 'intent_walk') t.bb++
    if (event === 'hit_by_pitch') t.hbp++
    if (event === 'sac_fly') t.sf++
    if (event === 'strikeout' || event === 'strikeout_double_play') t.k++
  }
  const rate = (n, d) => (d > 0 ? (n / d).toFixed(3).replace(/^0/, '') : '—')
  t.slash = [rate(t.h, t.ab), rate(t.h + t.bb + t.hbp, t.ab + t.bb + t.hbp + t.sf), rate(t.tb, t.ab)].join('/')
  return t
}
