// Fetches the real chronological first club for every SPLIT player-season in
// payroll-by-player.json -- the ground truth build-payroll-rules.mjs needs
// for its R3 rule ("first-club-only"). W1.1's stint join
// (.scratch/team-success/roster-age-cache.json) has no date field: it is
// built by iterating team ids in a fixed numeric order, not by player, so it
// cannot say which of a traded man's clubs came first in the season. A
// person-season stats call (GET /people/{id}/stats?stats=season) ALSO
// cannot answer this -- verified live against Lucas Giolito's 2023
// (White Sox -> Angels -> Guardians per build-roster-age.mjs's own header):
// that endpoint returns his three team splits ordered 108, 114, 145, which is
// ascending TEAM ID, not chronological order (his real first club, the White
// Sox, sorts last under it).
//
// THE SOURCE THAT ACTUALLY HAS A DATE: GET /people/{id}/stats?stats=gameLog
// &season=YYYY&sportId=1&group={hitting,pitching}. Each split is one game,
// carries `date` and `team.id`, confirmed live against the same Giolito
// season: his first game log row is 2023-04-01 for team 145 (White Sox) --
// matches the real trade order. Fetched for BOTH groups per player-season
// (not just the row's assigned pay `group`) because 587 of the 2,197 split
// player-seasons carry weight in both groups (a pitcher who also hit, or a
// position player who also pitched) -- see build-payroll.mjs's
// `bothGroupsAndSplit` counter -- and this script has no per-row record of
// which side of a two-way player's game log the earliest appearance sits in.
//
// Run: node .scratch/team-success/fetch-first-club.mjs
// Writes: .scratch/team-success/first-club-cache.json
// Caches raw game-log pulls in: .scratch/team-success/first-club-gamelog-cache.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..', '..')
const RAW_CACHE_PATH = join(__dirname, 'first-club-gamelog-cache.json')
const OUT_PATH = join(__dirname, 'first-club-cache.json')

const read = (p) => readFileSync(join(REPO, p), 'utf8')
const readJson = (p) => JSON.parse(read(p))

function loadRawCache() {
  if (!existsSync(RAW_CACHE_PATH)) return {}
  return JSON.parse(readFileSync(RAW_CACHE_PATH, 'utf8'))
}
function saveRawCache(cache) {
  writeFileSync(RAW_CACHE_PATH, JSON.stringify(cache))
}

async function fetchWithRetry(url, attempts = 4) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`statsapi ${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 300 * (i + 1)))
    }
  }
  throw lastErr
}

async function fetchGameLog(cache, mlbId, season, group) {
  const key = `${group}-${mlbId}-${season}`
  if (cache[key]) return cache[key]
  const url =
    `https://statsapi.mlb.com/api/v1/people/${mlbId}/stats?stats=gameLog` +
    `&season=${season}&sportId=1&group=${group}`
  const json = await fetchWithRetry(url)
  const splits = (json.stats?.[0]?.splits ?? []).map((s) => ({
    date: s.date ?? null,
    teamId: s.team?.id ?? null,
  }))
  cache[key] = splits
  return splits
}

// A small worker pool -- statsapi has no documented rate limit here, but
// build-roster-age.mjs's own header treats politeness as the working
// assumption, so this stays modest rather than firing 2,000+ requests at
// once.
async function runPool(items, worker, concurrency) {
  let cursor = 0
  let done = 0
  async function next() {
    while (cursor < items.length) {
      const i = cursor++
      await worker(items[i], i)
      done += 1
      if (done % 200 === 0) console.log(`  ${done}/${items.length}`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next))
}

async function main() {
  const payrollByPlayer = readJson('.scratch/team-success/payroll-by-player.json')
  const bySeasonPlayer = new Map()
  for (const row of payrollByPlayer.rows) {
    const key = `${row.season}|${row.mlbId}`
    if (!bySeasonPlayer.has(key)) bySeasonPlayer.set(key, [])
    bySeasonPlayer.get(key).push(row)
  }

  const splitKeys = [...bySeasonPlayer.entries()].filter(([, rows]) => rows.length > 1)
  console.log(`${splitKeys.length} split player-seasons need a real first club`)

  const rawCache = loadRawCache()
  let saveCounter = 0

  const results = {}
  const noGameLogAtAll = []
  const usedFallbackGroup = { both: 0, hittingOnly: 0, pitchingOnly: 0, neither: 0 }

  await runPool(
    splitKeys,
    async ([key, rows]) => {
      const [seasonStr, mlbIdStr] = key.split('|')
      const season = Number(seasonStr)
      const mlbId = Number(mlbIdStr)
      const [hitting, pitching] = await Promise.all([
        fetchGameLog(rawCache, mlbId, season, 'hitting'),
        fetchGameLog(rawCache, mlbId, season, 'pitching'),
      ])
      saveCounter += 1
      if (saveCounter % 100 === 0) saveRawCache(rawCache)

      const hasHitting = hitting.length > 0
      const hasPitching = pitching.length > 0
      if (hasHitting && hasPitching) usedFallbackGroup.both += 1
      else if (hasHitting) usedFallbackGroup.hittingOnly += 1
      else if (hasPitching) usedFallbackGroup.pitchingOnly += 1
      else usedFallbackGroup.neither += 1

      const all = [...hitting, ...pitching].filter((g) => g.date && g.teamId != null)
      if (all.length === 0) {
        noGameLogAtAll.push({ season, mlbId, name: rows[0].name })
        results[key] = null
        return
      }
      all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      results[key] = { teamId: all[0].teamId, date: all[0].date }
    },
    16,
  )

  saveRawCache(rawCache)

  writeFileSync(
    OUT_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          'earliest dated row across GET /people/{id}/stats?stats=gameLog&season={year}&sportId=1' +
          '&group=hitting and the same call with group=pitching, merged and sorted by date. ' +
          'This is real per-game data, not the season-total endpoint, which sorts by team id ' +
          'rather than chronologically.',
        splitPlayerSeasons: splitKeys.length,
        groupCoverage: usedFallbackGroup,
        noGameLogAtAll,
        results,
      },
      null,
      1,
    )}\n`,
  )
  console.log('group coverage', usedFallbackGroup)
  console.log(`${noGameLogAtAll.length} split player-seasons had NO game log in either group`)
  console.log(`wrote ${OUT_PATH}`)
}

main()
