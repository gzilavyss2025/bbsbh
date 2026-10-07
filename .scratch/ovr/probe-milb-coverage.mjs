// For each minor-league level, take a handful of real players off the level's
// own season leaderboard and report, per stat type, which fields are present
// (share of players) so "degrades gracefully" is measured. 2026.
// Usage: node .scratch/ovr/probe-milb-coverage.mjs
import { getJson } from '../../scripts/lib/statsapi.mjs'
const LEVELS = { 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'Rk' }
const WANT = {
  hitting: ['plateAppearances', 'strikeoutsPerPlateAppearance', 'walksPerPlateAppearance', 'iso', 'babip', 'totalSwings', 'swingAndMisses', 'ballsInPlay', 'groundHits', 'flyHits', 'lineHits', 'ops', 'stolenBases'],
  pitching: ['battersFaced', 'strikeoutsPerPlateAppearance', 'walksPerPlateAppearance', 'strikeoutsMinusWalksPercentage', 'whiffPercentage', 'homeRunsPerPlateAppearance', 'babip', 'groundOuts', 'airOuts', 'era', 'whip'],
}
for (const group of ['hitting', 'pitching']) {
  for (const [sportId, label] of Object.entries(LEVELS)) {
    const lb = await getJson(`/api/v1/stats?stats=season&group=${group}&season=2026&sportId=${sportId}&playerPool=ALL&limit=400`)
    const ids = (lb.stats?.[0]?.splits ?? []).filter((s) => (s.stat.plateAppearances ?? s.stat.battersFaced) >= 100).slice(0, 40).map((s) => s.player.id)
    let n = 0
    const have = {}
    for (const id of ids) {
      const j = await getJson(`/api/v1/people/${id}/stats?stats=seasonAdvanced&group=${group}&season=2026&sportId=${sportId}`)
      const st = j.stats?.[0]?.splits?.[0]?.stat
      if (!st) continue
      n++
      for (const f of WANT[group]) if (st[f] != null && st[f] !== '' && st[f] !== '.---') have[f] = (have[f] ?? 0) + 1
    }
    console.log(`${group} ${label}: ${n}/${ids.length} players with seasonAdvanced; field coverage:`,
      Object.fromEntries(WANT[group].map((f) => [f, `${have[f] ?? 0}/${n}`])))
    if (ids.length) console.log(`   sample personIds: ${ids.slice(0, 3).join(', ')}`)
  }
}
