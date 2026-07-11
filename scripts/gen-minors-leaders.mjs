// Regenerates public/data/minors-leaders.json — the ALL-MINORS combined leader
// pool: every full-season farm level's season lines (hitting + pitching), summed
// per player across the levels he's climbed this year, so a two-level slugger
// ranks on his COMBINED total (see src/api/statsLevels.js for the why + the math).
//
// Why static, unlike the live per-level/org/team leader pools: this one board is
// league-wide across four levels — eight full-level stat pulls, ~4-5MB raw and
// several thousand players — far too heavy to fetch + combine on a phone page
// load. So a daily cron precomputes the combined pool (see
// .github/workflows/update-nightly-data.yml) and the app just reads the shaped
// file (src/api/minorsLeaders.js) and ranks it client-side with the same
// computeLeaders it uses everywhere. Same build-time-fetch pattern as war.js /
// rehab.js (docs/data-enrichment.md §5); still spoiler-free (season aggregates).
//
// Unlike the FanGraphs/rehab generators — which keep self-contained copies of
// their logic — this imports the app's OWN combine AND ranking (statsLevels.js +
// teamLeaders.js). Those modules are pure and node-safe, and the live scopes use
// the very same combineToPool + computeLeaders, so importing keeps the static
// board in exact lockstep with the live ones rather than risking a drifting copy.
//
// It stores PRE-RANKED leaderboards, not the raw ~4,700-player pool: the pool is
// ~2.4MB (committed daily = a lot of git churn), while the top rows per category
// are a couple dozen KB. Ranking over the FULL pool here (not a trimmed one) is
// also what keeps the leader-relative qualifier's playing-time floor correct —
// the app can't reproduce that floor from a trimmed pool, so it must be baked in.
// Run by hand: node scripts/gen-minors-leaders.mjs
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchLevelSeasonStats, combineToPool } from '../src/api/statsLevels.js'
import { computeLeaders, ALL_CATEGORIES } from '../src/api/teamLeaders.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'minors-leaders.json')
const teamsFile = join(here, '..', 'public', 'data', 'teams.json')
const season = new Date().getFullYear()

// Same "leader shows its MLB parent affiliate's mark, not its own farm club's"
// resolution TeamLeaders.jsx's live scopes get from api/statsLevels.js's
// attachDisplayTeams — reimplemented here (rather than imported) because that
// version reads public/data/teams.json via a same-origin `fetch()`, which has
// no base URL in a plain Node script; this reads the same file straight off
// disk instead. Keeps the precomputed all-minors board's leader tags (and the
// favorite-team highlight, which keys off the same field) in step with every
// live scope.
async function attachDisplayTeams(pool) {
  const { bySportId } = JSON.parse(await readFile(teamsFile, 'utf8'))
  const byId = new Map(Object.values(bySportId ?? {}).flat().map((t) => [t.id, t]))
  return pool.map((p) => {
    const team = byId.get(p.teamId)
    if (!team?.parentOrgId) return { ...p, displayTeamId: p.teamId, displayTeamAbbr: p.teamAbbr }
    const parent = byId.get(team.parentOrgId)
    return {
      ...p,
      displayTeamId: team.parentOrgId,
      displayTeamAbbr: parent?.abbreviation ?? p.teamAbbr,
    }
  })
}

// The four full-season farm levels (AAA/AA/A+/A) — matches ORG_SPORT_IDS in
// api/leaders.js; Rookie/complex ball is excluded, as it is from every board.
const LEVEL_SPORT_IDS = [11, 12, 13, 14]

// A little deeper than any page shows (the leaders page renders 10) so a future
// "see more" has headroom without a regen.
const DEPTH = 25

const settled = (results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

const [hit, pit] = await Promise.all([
  Promise.allSettled(LEVEL_SPORT_IDS.map((sid) => fetchLevelSeasonStats(sid, 'hitting', season))),
  Promise.allSettled(LEVEL_SPORT_IDS.map((sid) => fetchLevelSeasonStats(sid, 'pitching', season))),
])
const pool = await attachDisplayTeams(combineToPool(settled(hit), settled(pit)))

// Rank the full pool once per category, exactly as the app would, and keep the
// top DEPTH rows — the SAME 'leader-relative' qualifier the leaders page passes.
const leaders = {}
for (const category of ALL_CATEGORIES) {
  const entries = computeLeaders(pool, category, { limit: DEPTH, qualifier: 'leader-relative' })
  if (entries.length) leaders[category.key] = entries
}

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ season, generatedAt: new Date().toISOString(), poolSize: pool.length, leaders }),
)
const cats = Object.keys(leaders).length
console.log(`wrote ${out} (${pool.length} players ranked across ${cats} categories, top ${DEPTH} each)`)
