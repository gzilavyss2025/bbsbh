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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getJson } from '../src/api/statsapi.js'
import { dedupeTransactions } from '../src/api/teamTransactions.js'
import {
  SEASONS,
  groupTradeStories,
  buildEntryLine,
  buildLevelGamesLine,
  formatHittingLine,
  formatPitchingLine,
  dedupeStatSplits,
} from '../src/api/tradeDeadline.js'
import { fetchPersonStats, fetchTransactions } from '../src/api/person-fetch.js'
import { draftInfo, pitcherRole, signedFallback } from '../src/api/person.js'
import { sumHitting, sumPitching } from '../src/api/statsLevels.js'
import { MILB_LEVELS } from '../src/lib/teams.js'
import { prospectBadge } from '../src/api/prospects.js'

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
// its affiliate chain — AND those two orgs are DIFFERENT. Without that second
// check, a player reassigned between two affiliates of the SAME parent (e.g.
// "DSL Mets Blue traded RHP Jhoangel Marquez to DSL Mets Orange" — both
// affiliates resolve to org 121, the Mets) reads as a real trade when it's
// just an intra-org complex reassignment.
export function bothSidesMlb(row, orgIds, affilToOrg) {
  const orgOf = (id) => (id != null && (orgIds.has(id) ? id : affilToOrg.get(id))) ?? null
  const fromOrg = orgOf(row.fromTeam?.id)
  const toOrg = orgOf(row.toTeam?.id)
  return fromOrg != null && toOrg != null && fromOrg !== toOrg
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
// `&hydrate=draft` rides along on this same batched call (no extra request) to
// also collect each player's draft record + birth country — the two inputs
// buildEntryLine (tradeDeadline.js) needs for a MiLB player's "how he entered
// the league" line, keyed by playerId as `bio`.
async function fetchPositionsAndDebuts(personIds) {
  const list = [...new Set(personIds.filter(Boolean))]
  const positions = {}
  const debutedIds = new Set()
  const bio = {}
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100)
    if (!batch.length) continue
    const data = await getJson(`/api/v1/people?personIds=${batch.join(',')}&hydrate=draft`)
    for (const p of data.people ?? []) {
      positions[p.id] = p.primaryPosition?.abbreviation || ''
      if (p.mlbDebutDate) debutedIds.add(p.id)
      bio[p.id] = { draft: draftInfo(p), birthCountry: p.birthCountry || '' }
    }
  }
  return { positions, debutedIds, bio }
}

// The description-derived position abbreviation (extractPos in
// tradeDeadline.js) is "RHP"/"LHP" for a pitcher, while the /people fallback
// is the plain primaryPosition code "P" — covers both so the MLB-vs-MiLB stat
// lookup below fetches the right stat group.
const PITCHER_POS_RE = /^(RHP|LHP|P)$/i
function statsGroupForPos(pos) {
  return PITCHER_POS_RE.test(pos || '') ? 'pitching' : 'hitting'
}

function sumBattersFaced(splits) {
  return (splits ?? []).reduce((sum, sp) => sum + Number(sp.stat?.battersFaced ?? 0), 0)
}

function gamesInSplits(splits) {
  return (splits ?? []).reduce(
    (sum, sp) => sum + Number(sp.stat?.gamesPlayed ?? sp.stat?.gamesPitched ?? 0),
    0,
  )
}

// One traded player's stats-to-date line, cut off at the trade's own date
// (season start = Jan 1). MLB vs. MiLB is decided by whether he has any MLB
// (sportId 1) games in that window — independent of ctx.debutedIds (a career
// "has ever debuted" flag used only for Headshot's fallback chain). An MLB
// player gets one role-gated line (formatHittingLine, or formatPitchingLine
// with pitcherRole()'s SP/RP/CL); a MiLB player gets the three-part
// entry/level-games/stat-line block described in tradeDeadline.js's
// buildEntryLine/buildLevelGamesLine. Returns null when there's nothing to
// show at all (no draft/signing record AND zero games).
async function fetchPlayerStatsAsOf(personId, pos, year, tradeDate, bioEntry) {
  const group = statsGroupForPos(pos)
  const startDate = `${year}-01-01`

  const mlbSplits = dedupeStatSplits(
    await fetchPersonStats(personId, {
      type: 'byDateRange', group, season: year, startDate, endDate: tradeDate, sportId: 1,
    }),
  )

  if (group === 'hitting') {
    const totals = sumHitting(mlbSplits)
    if (totals.plateAppearances > 0) {
      return { kind: 'mlb', role: null, line: formatHittingLine(totals) }
    }
  } else {
    const totals = sumPitching(mlbSplits)
    const battersFaced = sumBattersFaced(mlbSplits)
    if (battersFaced > 0 || totals.outs > 0) {
      const role = pitcherRole({
        gamesPitched: totals.gamesPitched, gamesStarted: totals.gamesStarted, saves: totals.saves,
      }) ?? 'RP'
      return { kind: 'mlb', role, line: formatPitchingLine(role, { ...totals, battersFaced }) }
    }
  }

  // No MLB games this season as of the trade date — MiLB path. Fetches one
  // byDateRange call per level directly (rather than person-fetch.js's own
  // fetchMilbByDateRange, which flattens every level's splits together with
  // no level tag) since the per-level games count is exactly what the
  // "games by level" line needs.
  const levelResults = await Promise.all(
    MILB_LEVELS.map(async (lvl) => ({
      label: lvl.label,
      splits: dedupeStatSplits(
        await fetchPersonStats(personId, {
          type: 'byDateRange', group, season: year, startDate, endDate: tradeDate, sportId: lvl.sportId,
        }),
      ),
    })),
  )
  const levelGames = levelResults.map((r) => ({ label: r.label, games: gamesInSplits(r.splits) }))
  const totalGames = levelGames.reduce((sum, l) => sum + l.games, 0)

  const signedYear = bioEntry?.draft?.year
    ? null
    : signedFallback(await fetchTransactions(personId))
  const entry = buildEntryLine({
    draft: bioEntry?.draft, signedYear, birthCountry: bioEntry?.birthCountry,
  })

  if (!totalGames) {
    return entry ? { kind: 'milb', entry, levelGamesLine: null, line: null } : null
  }

  const allSplits = levelResults.flatMap((r) => r.splits)
  const levelGamesLine = buildLevelGamesLine(levelGames)
  const line =
    group === 'hitting'
      ? formatHittingLine(sumHitting(allSplits))
      : // MiLB pitchers get one uniform line shape (always the record, never a
        // save count) rather than an SP/RP/CL split — save/start ratios are too
        // noisy at the minors' usage patterns to classify reliably (see the
        // implementation plan).
        formatPitchingLine('SP', { ...sumPitching(allSplits), battersFaced: sumBattersFaced(allSplits) })

  return { kind: 'milb', entry, levelGamesLine, line }
}

const EMPTY_PROSPECT_SNAPSHOT = { players: [], orgProspects: [] }

// top-prospects.json is a single CURRENT snapshot (no historical rankings —
// see docs/top-prospects.md), so it only makes sense to badge players on the
// newest season: applying it to an older season's trades would badge a 2024
// deal using a player's rank as of TODAY, reading as "he was a top prospect
// when traded" when that may not have been true then (or may no longer be
// true now). Gating on the newest entry in SEASONS means this stays correct
// automatically as a future season gets appended.
async function loadTopProspectsSnapshot(season) {
  const isCurrentSeason = season.year === Math.max(...SEASONS.map((s) => s.year))
  if (!isCurrentSeason) return EMPTY_PROSPECT_SNAPSHOT
  try {
    return JSON.parse(await readFile(join(here, '..', 'public', 'data', 'top-prospects.json'), 'utf8'))
  } catch {
    return EMPTY_PROSPECT_SNAPSHOT
  }
}

// Decorates every trade's ACQUIRED player entries (side.receives — the only
// ones TradeCard.jsx renders; side.sends is unrendered data already present
// for other consumers) with `.stats` and `.prospect`. A modest concurrency
// cap keeps this from hammering the API across a season's worth of players
// while still running faster than one-at-a-time.
async function decoratePlayerStats(trades, year, bio, prospectSnapshot) {
  const jobs = []
  for (const trade of trades) {
    for (const side of trade.teams) {
      for (const p of side.receives) jobs.push({ p, date: trade.date })
    }
  }
  const CONCURRENCY = 5
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(
      jobs.slice(i, i + CONCURRENCY).map(async ({ p, date }) => {
        p.stats = await fetchPlayerStatsAsOf(p.playerId, p.pos, year, date, bio[p.playerId])
        p.prospect = prospectBadge(prospectSnapshot, p.playerId)
      }),
    )
  }
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

  const { positions, debutedIds, bio } = await fetchPositionsAndDebuts(deduped.map((t) => t.person?.id))
  const trades = groupTradeStories(deduped, { positions, affilToOrg, debutedIds })

  const prospectSnapshot = await loadTopProspectsSnapshot(season)
  await decoratePlayerStats(trades, season.year, bio, prospectSnapshot)

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

// Only sweep when run as a script — keeps the pure helpers importable for tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
}
