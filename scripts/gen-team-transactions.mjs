// Regenerates public/data/team-transactions/{season}/{teamId}.json — the Team
// Transactions card's per-org, day-grouped, fully-shaped story feed, ONE FILE
// PER CLUB. Runs nightly (update-nightly-data.yml) but only ever rebuilds the
// CURRENT season from scratch; a completed season, once written with
// final:true, is never touched again (the guard below refuses to overwrite one
// without --force).
//
// One file per club because the card shows one club: a season's league-wide
// feed passes a megabyte by midsummer, and a team page was reading all of it
// to show ~3% of it. EVERY org gets a file each season, including an org with
// no storyworthy moves at all (`days: []`) — that is what lets the reader read
// a 404 as "no such season" and stop paging, rather than as "quiet club" and
// stop early (see loadMoreTeamTransactions).
//
// WHO OWNS THE WINTER (#1477): the NEXT season's file. A season's file runs
// from the day after the PREVIOUS season's seasonEndDate (not its own
// regularSeasonStartDate), so a January signing is a 2027 move and every date
// lands in exactly one file. The default season turns to next year the day
// after this year's seasonEndDate, so November moves have a file too. The
// freeze rule is unchanged. Rules: lib/time/transactions-window.mjs.
//
// index.json alongside them carries the season's own metadata (`final`,
// `seasonStart`, `generatedAt`). Its reader is THIS script — the freeze guard
// below — not the app.
//
// ONE league-wide /api/v1/transactions fetch per run (like gen-rehab.mjs),
// season-start-to-today — verified live that teamId= is club-scoped and
// silently misses affiliate-only rows, so this buckets to each org itself
// (bucketToOrg, src/api/teamTransactions.js) rather than looping a per-team
// query. The de-dupe/noise-filter/story-grouping/cutline logic lives in that
// same module as pure, exported shapers this script imports — the
// gen-callouts.mjs "import the app's own shaper so the two can't drift"
// convention — so this file is just the fetch + per-org loop + write.
// Full design: .scratch/team-transactions/data-layer-scope.md.
//
// Run by hand: node scripts/gen-team-transactions.mjs [season] [--force]
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson as statsapiJson } from './lib/statsapi.mjs'
import { readJsonOr, writeShards } from './lib/io.js'
import { transactionsSeason, transactionsWindow } from './lib/time/transactions-window.mjs'
import { dedupeTransactions, filterStoryworthy, groupIntoStories, bucketToOrg } from '../src/api/teamTransactions.js'

// The browser client this file used to import capped every call at 15 s; keep
// that cap on the shared client, whose own default is none.
const getJson = (path) => statsapiJson(path, { timeoutMs: 15_000 })

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'team-transactions')

const isoToday = () => new Date().toISOString().slice(0, 10)

async function fetchMlbTeamIds() {
  const data = await getJson('/api/v1/teams?sportId=1')
  return (data.teams ?? []).map((t) => t.id)
}

// Affiliate teamId -> parent org id, for every MLB org's full farm system, in
// ONE bulk request (same endpoint/shape gen-affiliates.mjs already relies on;
// verified live: each affiliate row carries its own parentOrgId). Lets a
// call-up/option row logged only against the affiliate (fromTeam/toTeam is
// the Triple-A club, not the MLB club) still bucket to the right org.
async function fetchAffiliateParentMap(orgIds, season) {
  const data = await getJson(`/api/v1/teams/affiliates?teamIds=${orgIds.join(',')}&season=${season}`)
  const map = new Map()
  for (const t of data.teams ?? []) {
    if (t.id != null && t.parentOrgId != null) map.set(t.id, t.parentOrgId)
  }
  return map
}

// One batched /people pass covering two needs: the position fallback for
// players whose position can't be parsed out of their own transaction
// description (see teamTransactions.js's extractPosFromDescription), and
// which personIds have ever appeared in an MLB game (`mlbDebutDate` — rides
// along on the same response, no extra fetch) — the signal
// filterStoryworthy's undebuted-signing suppression uses (see its own
// comment for why that's scoped to signings only), and the one groupIntoStories
// stamps on each rail slot as `isMlb` for the headshot fallback chain.
async function fetchPositionsAndDebuts(personIds) {
  const list = [...new Set(personIds.filter(Boolean))]
  const positions = {}
  const debutedIds = new Set()
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100)
    if (!batch.length) continue
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}`)
    for (const p of data.people ?? []) {
      positions[p.id] = p.primaryPosition?.abbreviation || ''
      if (p.mlbDebutDate) debutedIds.add(p.id)
    }
  }
  return { positions, debutedIds }
}

const arg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const force = process.argv.includes('--force')
const seasonRow = async (year) =>
  (await getJson(`/api/v1/seasons/${year}?sportId=1`)).seasons?.[0] ?? null

// Not the calendar year: from the day after this year's seasonEndDate the NEXT
// season's file already owns today (#1477), so a November move has a file.
const inPlay = arg
  ? Number(arg)
  : transactionsSeason(isoToday(), await seasonRow(new Date().getUTCFullYear()))

async function build(season, lastSeason) {
  const outSeasonDir = join(outDir, String(season))

  // A completed season is frozen once written — refuse to silently re-run over
  // it (see the `final` note in data-layer-scope.md §1). readJsonOr rethrows a
  // corrupt index rather than reading it as "no season yet", so a damaged file
  // stops the run instead of quietly unfreezing a finished season.
  const existing = await readJsonOr(join(outSeasonDir, 'index.json'), null)
  // A default run also closes last season: the day after its seasonEndDate the
  // season in play is already next year, so nothing else would set its final flag
  // or take its last days. Only a season already on disk is closed; never a backfill.
  if (!existing && lastSeason) return
  if (existing?.final && !force) {
    console.log(`${outSeasonDir} is already final — skipping (pass --force to override)`)
    return
  }

  // seasonStart is the day after the PREVIOUS season's end: this file owns the winter.
  const row = (await seasonRow(season)) ?? {}
  const { start: seasonStart, final } = transactionsWindow(row, await seasonRow(season - 1), isoToday())
  // Stop at this season's own end: a forced rebuild of a final season must not
  // pull in the next winter, which the next season's file owns.
  const seasonEnd = final ? row.seasonEndDate : isoToday()

  if (!seasonStart) return console.log(`${season}: no start date on statsapi yet — skipping`)

  const orgIds = await fetchMlbTeamIds()
  // An unstarted season has no affiliate rows yet: ask for this year's at most.
  const affilToOrg = await fetchAffiliateParentMap(orgIds, Math.min(season, Number(isoToday().slice(0, 4))))

  const raw = (
    await getJson(`/api/v1/transactions?startDate=${seasonStart}&endDate=${seasonEnd}`)
  ).transactions ?? []

  const { positions, debutedIds } = await fetchPositionsAndDebuts(raw.map((t) => t.person?.id))

  const meta = {
    version: 1,
    season,
    generatedAt: new Date().toISOString(),
    seasonStart,
    final,
  }

  // One shard per org, written even when the org has no storyworthy day — an
  // empty file and a missing file mean different things to the reader.
  const shards = orgIds.map((orgId) => {
    const bucketed = bucketToOrg(raw, orgId, affilToOrg)
    const deduped = dedupeTransactions(bucketed)
    const kept = filterStoryworthy(deduped, { orgId, debutedIds })
    const days = groupIntoStories(kept, { positions, orgId, debutedIds })
    return [String(orgId), { ...meta, teamId: orgId, days }]
  })

  // A full rebuild of this season, so writeShards' sweep is right: a club that
  // no longer belongs to the league loses its file rather than outliving it.
  const { written } = await writeShards(outSeasonDir, [
    ...shards,
    ['index', { ...meta, teamIds: orgIds }],
  ])
  const withMoves = shards.filter(([, s]) => s.days.length).length
  console.log(
    `wrote ${outSeasonDir} (${written - 1} orgs, ${withMoves} with moves, final=${final})`,
  )
}

await build(inPlay, false)
if (!arg) await build(inPlay - 1, true)
