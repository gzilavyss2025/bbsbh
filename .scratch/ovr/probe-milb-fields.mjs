// List the stat fields statsapi really returns for a minor leaguer, per stat
// type, so a "rough bars" idea (K%, BB%, ISO...) is checked against a live
// response and not guessed.
// Usage: node .scratch/ovr/probe-milb-fields.mjs <personId> <hitting|pitching> <season>
const [id, group, season = '2026'] = process.argv.slice(2)
import { getJson } from '../../scripts/lib/statsapi.mjs'
const TYPES = ['season', 'seasonAdvanced', 'sabermetrics', 'expectedStatistics', 'statSplits', 'sabermetricsAdvanced', 'winProbability', 'sprayChart']
const LEVELS = { 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'Rk', 17: 'Winter' }
for (const [sportId, label] of Object.entries(LEVELS)) {
  for (const type of TYPES) {
    const extra = type === 'statSplits' ? '&sitCodes=vl,vr' : ''
    const j = await getJson(`/api/v1/people/${id}/stats?stats=${type}&group=${group}&season=${season}&sportId=${sportId}${extra}`).catch(() => ({}))
    const splits = j.stats?.[0]?.splits ?? []
    if (!splits.length) continue
    const stat = splits[0].stat ?? {}
    console.log(`\n## ${label} (sportId ${sportId}) stats=${type}: ${splits.length} split(s); team ${splits[0].team?.name}`)
    console.log(JSON.stringify(stat))
  }
}
