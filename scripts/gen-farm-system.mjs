// Regenerates public/data/farm-system.json — the FACTS behind
// /farm-system-rankings ("The Farm Report", src/screens/reports/FarmSystemPage.jsx): every organisation's
// four full-season affiliates with their won-lost records, and every ranked
// prospect that organisation holds.
//
// It ships facts only. The Farm Index itself — the value curve over prospect
// ranks, the level weights on affiliate winning, the readiness share and the
// three-pillar composite — is computed in src/api/reports/farmSystem.js, where
// it is pure, unit-tested (test/farm-system.test.js) and, crucially, VISIBLE:
// an index whose weights are buried in a nightly script is an index nobody can
// argue with, and this one should be arguable. See docs/farm-index.md for the
// research pass behind the weights.
//
// THREE SOURCES, ONE JOIN:
//
//   1. public/data/affiliates.json (gen-affiliates.mjs) — org id -> its four
//      full-season clubs, each with the sportId that names its level.
//   2. public/data/top-prospects.json (fetch-top-prospects.mjs) — MLB
//      Pipeline's Top 100, each row carrying the MLB org's teamId.
//   3. LIVE: minor-league standings, for the affiliates' records.
//
// (1) and (2) are read off disk rather than refetched, so this generator can
// only ever be as fresh as the two that feed it. That is the right coupling:
// both already run nightly, both are the canonical copy of what they hold, and
// refetching either here would give the app two answers to the same question.
// A missing file degrades to an empty section rather than crashing (readJsonOr),
// the same MiLB-degrades-gracefully convention every reader here follows.
//
// STANDINGS ARE FETCHED BY LEAGUE, NOT BY SPORT. `?sportId=11` returns
// `records: []` — an empty success, not an error, which is exactly the shape
// that would have shipped a page of blank records with nothing failing.
// Verified live: /api/v1/leagues?sportId=11 lists the International (117) and
// Pacific Coast (112) leagues, and /api/v1/standings?leagueId=117 returns the
// divisions. So the sweep is: sportId -> leagues -> standings, per level.
//
// SPOILER-FREE. A minor-league club's season won-lost record and a prospect's
// published ranking are season aggregates over completed games in a different
// league — the same footing as WAR, the standings and the leader boards, all
// of which this app has always shown live (ADR-0034: a stat line is not a
// score). Nothing here touches tonight's MLB game.
//
// Run by hand:
//   node scripts/gen-farm-system.mjs
//   node scripts/gen-farm-system.mjs --season=2026
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic, readJsonOr } from './lib/io.js'
import { parseArgs } from './lib/args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'public', 'data')
const out = join(dataDir, 'farm-system.json')

// The four full-season levels, in ladder order. Rookie ball (16) is left out
// deliberately: its schedules are short, its leagues re-form year to year, and
// a 28-game complex record is noise standing next to a 140-game Triple-A one.
const LEVELS = [
  { sportId: 11, label: 'AAA' },
  { sportId: 12, label: 'AA' },
  { sportId: 13, label: 'A+' },
  { sportId: 14, label: 'A' },
]

// ---- pure reducers (exported for test/farm-system.test.js) ----

// Flatten a standings response into { [teamId]: { w, l } }. The counts are
// shipped rather than the API's own `winningPercentage` string ('.612'), so
// the reader can tell a club that has not played (0-0, no rate) from one
// playing .000 baseball — the difference between "no data" and "terrible",
// which an org's index must not confuse.
export function recordsFromStandings(standings) {
  const byTeamId = {}
  for (const rec of standings?.records ?? []) {
    for (const t of rec.teamRecords ?? []) {
      const id = t?.team?.id
      if (id == null) continue
      byTeamId[id] = { w: Number(t.wins) || 0, l: Number(t.losses) || 0 }
    }
  }
  return byTeamId
}

// One organisation's row: its affiliates (each with a record, where one
// exists) and its ranked prospects, ordered best rank first.
export function orgRow(affiliates, recordsBySportId, prospects) {
  return {
    affiliates: (affiliates ?? [])
      .filter((a) => LEVELS.some((l) => l.sportId === a.sportId))
      .map((a) => {
        const rec = recordsBySportId[a.sportId]?.[a.id] ?? null
        return {
          id: a.id,
          name: a.name,
          sportId: a.sportId,
          level: LEVELS.find((l) => l.sportId === a.sportId)?.label ?? null,
          w: rec?.w ?? null,
          l: rec?.l ?? null,
        }
      })
      .sort((a, b) => a.sportId - b.sportId),
    prospects: (prospects ?? [])
      .map((p) => ({
        rank: p.rank,
        playerId: p.playerId,
        name: p.name,
        position: p.position,
        level: p.levelRaw ?? null,
        age: p.age ?? null,
      }))
      .sort((a, b) => a.rank - b.rank),
  }
}

// ---- the sweep ----

async function fetchLevelRecords(season) {
  const bySportId = {}
  for (const level of LEVELS) {
    const leagues = await getJson(`/api/v1/leagues?sportId=${level.sportId}&season=${season}`)
    const merged = {}
    for (const league of leagues?.leagues ?? []) {
      const standings = await getJson(
        `/api/v1/standings?leagueId=${league.id}&season=${season}&standingsTypes=regularSeason`,
      )
      Object.assign(merged, recordsFromStandings(standings))
    }
    bySportId[level.sportId] = merged
    console.log(`  ${level.label}: ${Object.keys(merged).length} clubs with a record`)
  }
  return bySportId
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const season = Number(args.season) || new Date().getUTCFullYear()

  const affiliates = await readJsonOr(join(dataDir, 'affiliates.json'), null)
  const prospects = await readJsonOr(join(dataDir, 'top-prospects.json'), null)
  if (!affiliates?.byOrgId) {
    throw new Error('public/data/affiliates.json is missing or empty — run gen-affiliates.mjs first')
  }

  console.log(`${season}: fetching minor-league standings`)
  const recordsBySportId = await fetchLevelRecords(season)

  const byOrg = new Map()
  for (const p of prospects?.players ?? []) {
    if (p.teamId == null) continue
    if (!byOrg.has(p.teamId)) byOrg.set(p.teamId, [])
    byOrg.get(p.teamId).push(p)
  }

  const orgs = {}
  for (const [orgId, list] of Object.entries(affiliates.byOrgId)) {
    orgs[orgId] = orgRow(list, recordsBySportId, byOrg.get(Number(orgId)) ?? [])
  }

  await writeJsonAtomic(out, {
    generatedAt: new Date().toISOString(),
    season,
    // What the rank list this file joined against actually covered. The page
    // prints it, because "93 ranked prospects" and "100 ranked prospects" are
    // different denominators and an index built on the smaller one should say
    // so rather than imply a full Top 100.
    prospectPool: prospects?.count ?? (prospects?.players?.length ?? 0),
    prospectSource: prospects?.source ?? null,
    prospectsGeneratedAt: prospects?.generatedAt ?? null,
    levels: LEVELS,
    orgs,
  })
  console.log(`wrote ${out} — ${Object.keys(orgs).length} organisations`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
