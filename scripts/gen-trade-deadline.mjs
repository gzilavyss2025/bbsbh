// Regenerates public/data/trade-deadline/{year}.json — every completed trade
// within ~4 weeks of that season's trade deadline, deduped and grouped into
// one story per real trade (however many teams/players are involved), plus
// public/data/trade-deadline/index.json (a season-count manifest so the
// index page needs one fetch instead of six).
//
// A season's window is fixed and its results are immutable once the window
// has closed, so — like gen-postseason-history.mjs / gen-awards-history.mjs —
// this is a HAND-RUN regenerate, NOT a cron. A season file already written
// with final:true is never silently rewritten (pass --force to override).
//
// ONE league-wide /api/v1/transactions fetch per season (no sportId/teamId —
// verified live in gen-team-transactions.mjs that teamId= is club-scoped and
// silently misses affiliate-only rows; irrelevant here anyway since a real
// MLB trade always names two MLB clubs). The de-dupe logic is imported
// straight from teamTransactions.js and the trade-grouping logic from
// tradeDeadline.js — both pure, exported shapers this script imports rather
// than re-deriving (the gen-callouts.mjs "import the app's own shaper so the
// two can't drift" convention).
//
// Run by hand: node scripts/gen-trade-deadline.mjs [year] [--force]
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../src/api/statsapi.js'
import { dedupeTransactions } from '../src/api/teamTransactions.js'
import { SEASONS, groupTradeStories } from '../src/api/tradeDeadline.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'trade-deadline')

const isoToday = () => new Date().toISOString().slice(0, 10)

async function fetchMlbTeamIds() {
  const data = await getJson('/api/v1/teams?sportId=1')
  return new Set((data.teams ?? []).map((t) => t.id))
}

// Affiliate teamId -> parent org id, for every MLB org's full farm system
// (same endpoint/shape gen-team-transactions.mjs already relies on). Lets a
// trade logged only against an affiliate (fromTeam/toTeam is the Triple-A
// club, not the MLB club) still resolve to a real MLB organization.
async function fetchAffiliateParentMap(orgIds, season) {
  const data = await getJson(`/api/v1/teams/affiliates?teamIds=${[...orgIds].join(',')}&season=${season}`)
  const map = new Map()
  for (const t of data.teams ?? []) {
    if (t.id != null && t.parentOrgId != null) map.set(t.id, t.parentOrgId)
  }
  return map
}

// The league-wide /api/v1/transactions feed is NOT scoped to MLB — verified
// live against the 2022 window, it also carries independent-league moves
// (e.g. "Long Island Ducks traded RHP Anderson DeLeon to Gateway
// Grizzlies") that share no relationship with any MLB club at all. A real
// MLB trade deadline deal always involves two actual MLB organizations (even
// when the players moved are the two orgs' own low-minors prospects), so a
// row only counts when BOTH sides resolve to an MLB org, directly or via
// its affiliate chain.
function bothSidesMlb(row, orgIds, affilToOrg) {
  const orgOf = (id) => (id != null && (orgIds.has(id) ? id : affilToOrg.get(id))) ?? null
  return orgOf(row.fromTeam?.id) != null && orgOf(row.toTeam?.id) != null
}

// One batched /people pass covering two needs: the position fallback for
// players whose position can't be parsed out of their own transaction
// description (see tradeDeadline.js's extractPos), and which personIds have
// ever appeared in an MLB game (`mlbDebutDate` — rides along on the same
// response, no extra fetch). The debut flag decides the Headshot fallback
// chain per player (silo-only for a confirmed MLB player vs. silo-then-milb
// for a prospect) — a card's teamId is always the MLB parent org (see
// resolveOrgId in tradeDeadline.js), so without this every player would
// read as "confirmed MLB" and skip the milb rung entirely, same shape as
// gen-team-transactions.mjs's fetchPositionsAndDebuts.
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

async function readExisting(outFile) {
  try {
    return JSON.parse(await readFile(outFile, 'utf8'))
  } catch {
    return null
  }
}

async function buildSeason(season, force) {
  const outFile = join(outDir, `${season.year}.json`)
  const existing = await readExisting(outFile)
  if (existing?.final && !force) {
    console.log(`${outFile} is already final — skipping (pass --force to override)`)
    return existing
  }

  const orgIds = await fetchMlbTeamIds()
  const affilToOrg = await fetchAffiliateParentMap(orgIds, season.year)

  const raw = (
    await getJson(`/api/v1/transactions?startDate=${season.windowStart}&endDate=${season.windowEnd}`)
  ).transactions ?? []
  const trRows = raw.filter((t) => t.typeCode === 'TR' && bothSidesMlb(t, orgIds, affilToOrg))
  const deduped = dedupeTransactions(trRows)

  const { positions, debutedIds } = await fetchPositionsAndDebuts(deduped.map((t) => t.person?.id))
  const trades = groupTradeStories(deduped, { positions, affilToOrg, debutedIds })

  const final = isoToday() >= season.windowEnd
  const out = {
    version: 1,
    season: season.year,
    generatedAt: new Date().toISOString(),
    deadlineDate: season.deadlineDate,
    windowStart: season.windowStart,
    windowEnd: season.windowEnd,
    final,
    trades,
  }

  await mkdir(outDir, { recursive: true })
  await writeFile(outFile, JSON.stringify(out))
  console.log(`wrote ${outFile} (${trades.length} trades, final=${final})`)
  return out
}

async function rebuildIndex() {
  const years = []
  for (const season of SEASONS) {
    const outFile = join(outDir, `${season.year}.json`)
    const file = await readExisting(outFile)
    if (!file) continue
    years.push({
      year: season.year,
      deadlineDate: season.deadlineDate,
      tradeCount: file.trades?.length ?? 0,
      final: Boolean(file.final),
    })
  }
  years.sort((a, b) => b.year - a.year)
  const indexFile = join(outDir, 'index.json')
  await mkdir(outDir, { recursive: true })
  await writeFile(indexFile, JSON.stringify({ generatedAt: new Date().toISOString(), years }))
  console.log(`wrote ${indexFile} (${years.length} seasons)`)
}

const arg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
const force = process.argv.includes('--force')

const targets = arg ? SEASONS.filter((s) => s.year === Number(arg)) : SEASONS
if (arg && targets.length === 0) {
  console.error(`No configured trade-deadline season for ${arg} — see SEASONS in src/api/tradeDeadline.js`)
  process.exit(1)
}

for (const season of targets) {
  await buildSeason(season, force)
}
await rebuildIndex()
