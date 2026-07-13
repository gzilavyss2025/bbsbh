// Regenerates public/data/manager-history.json — every current MLB team's
// coaching-staff roster (Manager, Bench Coach, Pitching Coach, …), swept
// season by season and re-indexed by personId, so the manager detail page
// (.scratch/manager-detail-page/plan.md §3) can show a person's FULL
// coaching career, not just his managerial stints — e.g. Pat Murphy
// (personId 580268) was Padres bench coach (teamId 135) years before he
// became Brewers manager (teamId 158), and both should show up here.
//
// Source: GET /api/v1/teams/{teamId}/coaches?season={year} — the same
// endpoint src/api/game.js's fetchManager already calls per-game (that
// function only keeps the Manager row + name; this sweeps every job row,
// every team, every season). Returns a `roster` array of
// `{ person: {id, fullName}, jerseyNumber, job, jobId, title }`.
//
// Two modes:
//   node scripts/gen-manager-history.mjs                 — full backfill,
//     seasons 2000-present, all 30 teams (~800+ calls). Hand-run once, like
//     gen-milb-history.mjs's seed sweep. Rebuilds the WHOLE output from
//     scratch (old seasons are immutable, so a clean rebuild is safe).
//   node scripts/gen-manager-history.mjs --current-only  — only this year,
//     all 30 teams (~30 calls). Meant for a nightly cron (NOT yet wired —
//     see the comment above WOULD-GO-HERE at the bottom of this file and
//     .github/workflows/update-nightly-data.yml). Merges into the existing
//     file rather than rebuilding it, so backfilled history survives.
//
// Per-stint win-loss record: a team-season with more than one Manager/
// Interim Manager row (a mid-season managerial change) can't be split by
// date from the coaches endpoint alone — no dates, no ordering (verified
// live, see plan.md §4: 2010 Diamondbacks show both Hinch and Gibson as
// plain "Manager" for that season). scripts/manager-transitions-seed.json
// is a small, hand-verified, checked-in file of { teamId, season,
// transitionDate, outgoingManagerId, incomingManagerId } entries that
// resolves the split by tallying that team's actual schedule (W/L) before
// vs on/after transitionDate. A shared team-season with NO matching seed
// entry is NOT guessed at — it's appended to
// scripts/manager-transitions-needs-research.json for a human/agent to
// research later, and its stints are marked `sharedSeason: true` with no
// record rather than a fabricated number (same graceful-degradation
// convention as every other MiLB/umpire gap in this app). An UNSHARED
// team-season (exactly one Manager/Interim Manager that year) gets its
// record attached directly from the team's full-season schedule, no seed
// needed.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_MLB_TEAM_IDS } from '../src/lib/teams.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'manager-history.json')
const seedPath = join(here, 'manager-transitions-seed.json')
const needsResearchPath = join(here, 'manager-transitions-needs-research.json')

const API = 'https://statsapi.mlb.com/api/v1'
const START_YEAR = 2000
const currentSeason = () => new Date().getUTCFullYear()

// Same convention as fetchManager (src/api/game.js): a permanent skipper is
// 'Manager', a fill-in 'Interim Manager' — both end in "manager". The
// /coaches endpoint only returns on-field staff (never front-office titles
// like "General Manager"), so this regex doesn't need to guard against that.
const MANAGER_JOB_RE = /(^|\s)manager$/i

const CURRENT_ONLY = process.argv.includes('--current-only')

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i === tries - 1) throw new Error(`${url}: ${err.message}`)
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
}

// Run `jobs` (thunks returning promises) with a bounded concurrency pool —
// same idiom as gen-milb-history.mjs.
async function pool(jobs, limit = 8) {
  const results = new Array(jobs.length)
  let next = 0
  async function worker() {
    while (next < jobs.length) {
      const i = next++
      results[i] = await jobs[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker))
  return results
}

// One team-season's coaching staff roster, or null on failure — a single
// bad fetch (rate limit, a season a franchise didn't exist under this id,
// etc.) must never crash the whole backfill.
async function fetchCoaches(teamId, season) {
  try {
    const data = await getJson(`${API}/teams/${teamId}/coaches?season=${season}`)
    return data.roster ?? []
  } catch (err) {
    console.warn(`  coaches ${teamId}/${season}: ${err.message}`)
    return null
  }
}

// A team-season's regular-season games, each as { date, won } (Final games
// only). Used both for a plain unshared-season record and, split at
// transitionDate, for a shared-season seed resolution.
async function fetchTeamSeasonGames(teamId, season) {
  try {
    const data = await getJson(
      `${API}/schedule?sportId=1&teamId=${teamId}&season=${season}&gameType=R&hydrate=team`,
    )
    const games = (data.dates ?? []).flatMap((d) => d.games ?? [])
    const out = []
    for (const g of games) {
      if (g.status?.abstractGameState !== 'Final') continue
      const isHome = g.teams?.home?.team?.id === teamId
      const mySide = isHome ? g.teams?.home : g.teams?.away
      if (typeof mySide?.isWinner !== 'boolean') continue
      out.push({ date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10), won: mySide.isWinner })
    }
    return out
  } catch (err) {
    console.warn(`  schedule ${teamId}/${season}: ${err.message}`)
    return null
  }
}

function tally(games) {
  const w = games.filter((g) => g.won).length
  return { w, l: games.length - w }
}

// Sweep every (teamId, season) pair's coaches roster, building:
//  - byPersonId: personId -> [{ teamId, season, job, jobId }] (unsorted)
//  - teamSeasonManagers: `${teamId}:${season}` -> Set of distinct personIds
//    whose job matched MANAGER_JOB_RE that season (for the shared/unshared
//    split below)
async function sweepCoaches(teamIds, seasons) {
  const jobs = []
  for (const teamId of teamIds) {
    for (const season of seasons) {
      jobs.push(async () => ({ teamId, season, roster: await fetchCoaches(teamId, season) }))
    }
  }
  const results = await pool(jobs, 8)

  const byPersonId = new Map()
  const teamSeasonManagers = new Map()
  let ok = 0
  let failed = 0
  for (const { teamId, season, roster } of results) {
    if (roster === null) {
      failed++
      continue
    }
    ok++
    const tsKey = `${teamId}:${season}`
    for (const r of roster) {
      const personId = r.person?.id
      const job = r.job ?? ''
      if (!personId || !job) continue
      if (!byPersonId.has(personId)) byPersonId.set(personId, [])
      byPersonId.get(personId).push({ teamId, season, job, jobId: r.jobId ?? null })
      if (MANAGER_JOB_RE.test(job)) {
        if (!teamSeasonManagers.has(tsKey)) teamSeasonManagers.set(tsKey, new Set())
        teamSeasonManagers.get(tsKey).add(personId)
      }
    }
  }
  console.log(`  coaches sweep: ${ok} team-seasons ok, ${failed} failed`)
  return { byPersonId, teamSeasonManagers }
}

// Attach a `record: {w, l}` (and `sharedSeason: true` where applicable) to
// the right manager stint(s) inside byPersonId, using teamSeasonManagers to
// tell an unshared team-season from a shared one. Mutates byPersonId's
// stint objects in place. Returns the list of newly-unresolved shared
// team-seasons (for the needs-research queue).
async function attachRecords(byPersonId, teamSeasonManagers, seed) {
  const seedByTeamSeason = new Map(seed.map((s) => [`${s.teamId}:${s.season}`, s]))
  const unresolved = []

  // One record-fetch job per team-season that needs one: every unshared
  // team-season, plus every shared one WITH a matching seed entry.
  const fetchJobs = []
  const plan = [] // { tsKey, teamId, season, kind: 'unshared' | 'shared-seed', seed? }
  for (const [tsKey, managerIds] of teamSeasonManagers) {
    const [teamIdStr, seasonStr] = tsKey.split(':')
    const teamId = Number(teamIdStr)
    const season = Number(seasonStr)
    if (managerIds.size <= 1) {
      plan.push({ tsKey, teamId, season, kind: 'unshared' })
      fetchJobs.push(async () => ({ tsKey, games: await fetchTeamSeasonGames(teamId, season) }))
    } else {
      const seedEntry = seedByTeamSeason.get(tsKey)
      if (seedEntry) {
        plan.push({ tsKey, teamId, season, kind: 'shared-seed', seed: seedEntry })
        fetchJobs.push(async () => ({ tsKey, games: await fetchTeamSeasonGames(teamId, season) }))
      } else {
        unresolved.push({ teamId, season, managerIds: [...managerIds] })
      }
    }
  }

  const fetched = await pool(fetchJobs, 8)
  const gamesByTsKey = new Map(fetched.map((f) => [f.tsKey, f.games]))

  // Index every stint by (personId, teamId, season) so a record can be
  // attached without re-scanning the whole per-person array each time.
  const stintIndex = new Map()
  for (const [personId, stints] of byPersonId) {
    for (const stint of stints) {
      stintIndex.set(`${personId}:${stint.teamId}:${stint.season}`, stint)
    }
  }

  for (const p of plan) {
    const games = gamesByTsKey.get(p.tsKey)
    if (games === null || games === undefined) continue // schedule fetch failed — leave unrecorded

    if (p.kind === 'unshared') {
      const managerId = [...teamSeasonManagers.get(p.tsKey)][0]
      const stint = stintIndex.get(`${managerId}:${p.teamId}:${p.season}`)
      if (stint) stint.record = tally(games)
    } else {
      const { outgoingManagerId, incomingManagerId, transitionDate } = p.seed
      const before = games.filter((g) => g.date < transitionDate)
      const after = games.filter((g) => g.date >= transitionDate)
      const outStint = stintIndex.get(`${outgoingManagerId}:${p.teamId}:${p.season}`)
      const inStint = stintIndex.get(`${incomingManagerId}:${p.teamId}:${p.season}`)
      if (outStint) {
        outStint.record = tally(before)
        outStint.transitionDate = transitionDate
      }
      if (inStint) {
        inStint.record = tally(after)
        inStint.transitionDate = transitionDate
      }
      // Any OTHER manager-job personId in this team-season (rare — a seed
      // only models a single two-way split) is left unresolved.
      for (const managerId of teamSeasonManagers.get(p.tsKey)) {
        if (managerId === outgoingManagerId || managerId === incomingManagerId) continue
        const stint = stintIndex.get(`${managerId}:${p.teamId}:${p.season}`)
        if (stint) stint.sharedSeason = true
      }
    }
  }

  // Mark every manager-job stint in a still-unresolved shared season, so a
  // reader knows not to show a fabricated number.
  for (const { teamId, season, managerIds } of unresolved) {
    for (const managerId of managerIds) {
      const stint = stintIndex.get(`${managerId}:${teamId}:${season}`)
      if (stint) stint.sharedSeason = true
    }
  }

  return unresolved
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function main() {
  const season = currentSeason()
  const seasons = CURRENT_ONLY ? [season] : Array.from(
    { length: season - START_YEAR + 1 },
    (_, i) => START_YEAR + i,
  )
  const teamIds = ALL_MLB_TEAM_IDS

  console.log(
    `${CURRENT_ONLY ? 'incremental (--current-only)' : 'full backfill'}: ${teamIds.length} teams x ${seasons.length} season(s) [${seasons[0]}-${seasons[seasons.length - 1]}]`,
  )

  const seed = await readJson(seedPath, [])
  const { byPersonId, teamSeasonManagers } = await sweepCoaches(teamIds, seasons)
  const unresolved = await attachRecords(byPersonId, teamSeasonManagers, seed)

  // Merge the unresolved shared seasons into the needs-research queue,
  // deduping by teamId+season (a re-run shouldn't pile up duplicates).
  // Also filter out any entries that are now resolved in the seed file.
  const seedKeys = new Set(seed.map((s) => `${s.teamId}:${s.season}`))
  const needsResearch = await readJson(needsResearchPath, [])
  const nrByKey = new Map(needsResearch.map((e) => [`${e.teamId}:${e.season}`, e]))
  // Remove any entries that are now in the seed
  for (const key of seedKeys) nrByKey.delete(key)
  // Add unresolved entries
  for (const u of unresolved) nrByKey.set(`${u.teamId}:${u.season}`, u)
  const mergedNeedsResearch = [...nrByKey.values()].sort(
    (a, b) => a.season - b.season || a.teamId - b.teamId,
  )
  await mkdir(dirname(needsResearchPath), { recursive: true })
  await writeFile(needsResearchPath, JSON.stringify(mergedNeedsResearch, null, 2) + '\n')

  // Build the final personId -> stints map, sorted chronologically.
  const freshByPersonId = {}
  for (const [personId, stints] of byPersonId) {
    freshByPersonId[personId] = stints.sort((a, b) => a.season - b.season || a.teamId - b.teamId)
  }

  let finalByPersonId = freshByPersonId
  if (CURRENT_ONLY) {
    // Merge into the existing file: drop each touched person's OLD entries
    // for `season`, keep everything else, then splice the fresh current-
    // season entries back in. A person untouched this pass keeps his full
    // prior history unchanged.
    const existing = await readJson(out, { byPersonId: {} })
    const merged = {}
    for (const [personId, stints] of Object.entries(existing.byPersonId ?? {})) {
      merged[personId] = stints.filter((s) => s.season !== season)
    }
    for (const [personId, stints] of Object.entries(freshByPersonId)) {
      merged[personId] = [...(merged[personId] ?? []), ...stints].sort(
        (a, b) => a.season - b.season || a.teamId - b.teamId,
      )
    }
    finalByPersonId = merged
  }

  const sortedOut = {}
  for (const id of Object.keys(finalByPersonId).sort((a, b) => Number(a) - Number(b))) {
    sortedOut[id] = finalByPersonId[id]
  }

  await mkdir(dirname(out), { recursive: true })
  await writeFile(
    out,
    JSON.stringify(
      {
        _hint:
          'GENERATED by scripts/gen-manager-history.mjs. Full backfill: `node scripts/gen-manager-history.mjs` ' +
          '(seasons 2000-present, all 30 teams, rebuilds from scratch). Nightly-cron-shaped incremental: ' +
          '`node scripts/gen-manager-history.mjs --current-only` (this season only, merges into the existing ' +
          'file). A mid-season managerial change\'s per-stint W/L split is resolved via scripts/manager-transitions-seed.json ' +
          '(edit the SEED, never this file); an unresolved shared team-season is queued in ' +
          'scripts/manager-transitions-needs-research.json and its stints carry `sharedSeason: true` with no `record`.',
        generatedAt: new Date().toISOString(),
        coverage: CURRENT_ONLY ? { seasons: [season, season], mode: 'current-only' } : { seasons: [START_YEAR, season], mode: 'backfill' },
        byPersonId: sortedOut,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `wrote ${out}: ${Object.keys(sortedOut).length} people, ${mergedNeedsResearch.length} team-seasons needing research`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

// WOULD-GO-HERE (not wired yet, per plan.md §3): once this script is folded
// into the nightly cron, .github/workflows/update-nightly-data.yml would gain
// a step like:
//   - name: Manager history (current season)
//     run: node scripts/gen-manager-history.mjs --current-only
// alongside its existing `node scripts/gen-umpires.mjs` etc. steps.
