// Pulls the 2026 MLB season line (PA, IP, name, position, team) for every player, so
// calibrate.mjs can label disagreements and apply playing-time floors.
// war.json and savant-percentiles.json carry ids only.
// Output: $OVR_CACHE/mlb-lines.json (default /tmp/ovr-cache). Not committed.
// Run: node .scratch/ovr/pull-mlb-lines.mjs [season]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fetchLevelSeasonStats } from '../../src/api/statsLevels.js'

const season = Number(process.argv[2]) || 2026
const cache = process.env.OVR_CACHE || join(tmpdir(), 'ovr-cache')
mkdirSync(cache, { recursive: true })
const out = { season, hitting: {}, pitching: {} }
for (const group of ['hitting', 'pitching']) {
  const splits = await fetchLevelSeasonStats(1, group, season) // sportId 1 = MLB
  for (const x of splits) {
    const id = x.player?.id
    if (!id) continue
    const prev = out[group][id]
    const pa = x.stat?.plateAppearances ?? 0
    // a traded player can appear once per stint; keep the larger line
    if (prev && prev.pa >= pa && prev.ip >= Number(x.stat?.inningsPitched ?? 0)) continue
    out[group][id] = {
      name: x.player?.fullName ?? '', pos: x.position?.abbreviation ?? '', team: x.team?.abbreviation ?? x.team?.name ?? '',
      pa, ip: Number(x.stat?.inningsPitched ?? 0), gs: x.stat?.gamesStarted ?? 0, g: x.stat?.gamesPlayed ?? 0,
      ops: x.stat?.ops != null ? Number(x.stat.ops) : null, era: x.stat?.era != null ? Number(x.stat.era) : null,
      hr: x.stat?.homeRuns ?? 0, bf: x.stat?.battersFaced ?? 0,
    }
  }
  console.log(group, Object.keys(out[group]).length)
}
writeFileSync(join(cache, 'mlb-lines.json'), JSON.stringify(out))
