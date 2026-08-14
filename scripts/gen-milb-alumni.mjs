// Regenerates public/data/milb-alumni/{teamId}.json — for every current farm
// club, the big-league players who once played THERE, ranked by career WAR.
// This is the Overview tab's bottom card on a MiLB team page ("Made The Show").
//
// WHY CAREER WAR, AND WHERE IT COMES FROM. There is no "notability" field on a
// player, so the ranking needs a number that means "this one mattered". Career
// WAR is that number, and this repo already has it on disk: gen-war.mjs writes
// the live season (war.json) and gen-war-history.mjs writes every completed one
// (war-history/{00..99}.json, 2010→last year). Summing the two per player is the
// whole ranking input — this generator makes NO WAR request of its own, so a
// FanGraphs outage can't break it. Two consequences worth knowing: the history
// file starts at 2010, so a player who debuted before then carries only his
// 2010-on WAR (understates Verlander and Kershaw, who still rank near the top
// anyway); and FanGraphs publishes MLB WAR only, which is exactly right here —
// the card ranks players by what they did AFTER the bus leagues, not in them.
//
// WHO COUNTS AS AN ALUMNUS — the twenty-game floor. The obvious rule ("he
// appeared for this club") is wrong in a way that ruins the card. A rehab
// assignment is a MiLB stint: Christian Yelich played three games for Nashville
// in 2021, Sonny Gray one in 2017, Marcus Semien three. Rank by career WAR with
// no floor and those three cameos are the top three names on the Sounds' card,
// above Matt Chapman (67 G) and Matt Olson (210 G), who actually played there.
// In a 120-player probe, 220 of 583 stints were ten games or fewer. So a stint
// counts only at MIN_GAMES or more, summed across every season the player spent
// with that club. This deliberately keeps post-debut option stints (a real part
// of the club's story) while dropping the one-week visits.
//
// WHY THE STINTS COME FROM THE PLAYER SIDE. statsapi has a team-side
// /teams/{id}/alumni endpoint, but it demands one call per team PER SEASON
// (season= is required; comma lists, ranges and omitting it all 400), which is
// ~2,600 calls to cover the farm system back to 2005, and it returns everyone
// who suited up rather than the few who matter. Walking the pool instead —
// /people/{id}/stats?stats=yearByYear&sportId={11..16} — is bounded by
// POOL_SIZE, hands back exact team ids, and needs no name matching. Note the
// sportId param takes ONE sport: a comma list returns zero stat groups rather
// than erroring, so the fan-out below is per sport on purpose.
//
// Run by hand: node scripts/gen-milb-alumni.mjs
// Nightly: .github/workflows/update-nightly-data.yml
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, rm } from 'node:fs/promises'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { alumniByTeam, careerWarRanking, needsScan } from './lib/milb-alumni.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'public', 'data')
const outDir = join(dataDir, 'milb-alumni')
// The scan cache is NOT in public/ — it is this generator's working state, not
// something a browser ever reads. scripts/data/ already holds that kind of file.
const cachePath = join(here, 'data', 'milb-alumni-scan.json')
const season = new Date().getFullYear()

// How deep into the WAR ranking to look for alumni. At 1500 the floor is around
// 2 career WAR — roughly every established big leaguer — and in the probe 115 of
// 120 farm clubs filled their card from just the top 120 players, so this is
// comfortable headroom rather than a tight fit.
const POOL_SIZE = 1500
// Games with one club, summed over every season, before he is an alumnus. See
// the rehab-cameo note above.
const MIN_GAMES = 20
// Names per club's card.
const CARD_SIZE = 6
// The full-season farm levels plus the complex leagues (16), where the youngest
// signees actually start. NOT 17 — that is winter ball (the Arizona Fall
// League's Phoenix Desert Dogs), which is nobody's affiliate.
const SPORT_IDS = [11, 12, 13, 14, 16]
const STAT_GROUPS = ['hitting', 'pitching']
const CONCURRENCY = 8

// ---- career WAR, off the two files already on disk -------------------------

async function careerWar() {
  const live = await readJsonOr(join(dataDir, 'war.json'), null)
  if (!live) throw new Error('public/data/war.json missing — run gen-war.mjs first')
  const shards = []
  for (let i = 0; i < 100; i++) {
    const shard = await readJsonOr(join(dataDir, 'war-history', `${String(i).padStart(2, '0')}.json`), null)
    if (shard) shards.push(shard)
  }
  return careerWarRanking(live, shards, { poolSize: POOL_SIZE })
}

// ---- one player's minor-league stints ---------------------------------------

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

// Every club this player appeared for below the majors, as
// { [teamId]: { g, first, last } }, games summed across seasons and across the
// hitting/pitching split (a pitcher's yearByYear carries both when he has hit).
async function scanPlayer(personId) {
  const stints = {}
  for (const sportId of SPORT_IDS) {
    for (const group of STAT_GROUPS) {
      const url =
        `https://statsapi.mlb.com/api/v1/people/${personId}/stats` +
        `?stats=yearByYear&group=${group}&sportId=${sportId}`
      let json
      try {
        json = await fetchJson(url)
      } catch {
        continue // a level he never played is a 200 with no splits; this is a real failure, skipped
      }
      for (const block of json.stats ?? []) {
        for (const split of block.splits ?? []) {
          const teamId = split.team?.id
          if (!teamId) continue
          const year = Number(split.season)
          const games = split.stat?.gamesPlayed ?? split.stat?.games ?? 0
          const cur = (stints[teamId] ??= { g: 0, first: year, last: year })
          cur.g += games
          if (year < cur.first) cur.first = year
          if (year > cur.last) cur.last = year
        }
      }
    }
  }
  return stints
}

// Run `work` over `items` with a fixed number of workers.
async function pool(items, work) {
  const queue = [...items]
  let done = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        await work(queue.shift())
        if (++done % 100 === 0) console.log(`  scanned ${done}/${items.length}`)
      }
    }),
  )
}

// ---- the current farm system --------------------------------------------------

async function currentAffiliates() {
  const aff = await readJsonOr(join(dataDir, 'affiliates.json'), null)
  if (!aff) throw new Error('public/data/affiliates.json missing — run gen-affiliates.mjs first')
  const byTeamId = new Map()
  for (const list of Object.values(aff.byOrgId ?? {})) {
    for (const t of list) byTeamId.set(String(t.id), t)
  }
  return byTeamId
}

// ---- who a name belongs to ----------------------------------------------------

// One batched /people call per 100 ids, for the four things the card shows
// beside the portrait: name, number, position, current club. A player between
// clubs has no currentTeam — the card drops that line rather than inventing one.
//
// `hydrate=currentTeam` is NOT optional and its absence is silent: /people
// answers 200 with name, number and position filled in and currentTeam simply
// missing, so the first run of this generator wrote 118 correct-looking files
// in which every player's club was ''.
async function fetchPeople(ids) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const json = await fetchJson(
      `https://statsapi.mlb.com/api/v1/people?personIds=${batch.join(',')}&hydrate=currentTeam`,
    )
    for (const p of json.people ?? []) {
      out.set(String(p.id), {
        name: p.fullName ?? '',
        num: p.primaryNumber ?? '',
        pos: p.primaryPosition?.abbreviation ?? '',
        teamId: p.currentTeam?.id ?? null,
        teamName: p.currentTeam?.name ?? '',
      })
    }
  }
  return out
}

// ---- run ------------------------------------------------------------------------

const affiliates = await currentAffiliates()
const ranked = await careerWar()
console.log(`pool: ${ranked.length} active players, WAR ${ranked[0].war} → ${ranked[ranked.length - 1].war}`)

const cache = await readJsonOr(cachePath, {})
const stale = ranked.filter((p) => needsScan(cache[p.id], season))
console.log(`scanning ${stale.length} of ${ranked.length} players (${ranked.length - stale.length} cached)`)
await pool(stale, async (p) => {
  cache[p.id] = { stints: await scanPlayer(p.id), scanned: season }
})
// Drop cache rows for players who have fallen out of the pool, so the file
// tracks the pool rather than growing forever.
const inPool = new Set(ranked.map((p) => p.id))
for (const id of Object.keys(cache)) if (!inPool.has(id)) delete cache[id]
await writeJsonAtomic(cachePath, cache)

// Invert player → clubs into club → players. The games floor and the card cap
// both live in scripts/lib/milb-alumni.mjs, with the rehab-cameo reasoning.
const byTeamId = alumniByTeam(ranked, cache, new Set(affiliates.keys()), {
  minGames: MIN_GAMES,
  cardSize: CARD_SIZE,
})

const people = await fetchPeople([...new Set(Object.values(byTeamId).flat().map((p) => p.id))])

// No generatedAt in a shard, deliberately. These are 120 committed files on a
// nightly cron; a timestamp inside each one would rewrite all 120 every night
// whether or not a single name changed, and bury the real diffs. A shard changes
// when its club's alumni change, and never otherwise.
for (const [teamId, list] of Object.entries(byTeamId)) {
  const players = list.map((p) => ({ ...p, ...(people.get(p.id) ?? { name: '', num: '', pos: '' }) }))
  await writeJsonAtomic(join(outDir, `${teamId}.json`), { minGames: MIN_GAMES, players })
}
// A club that leaves the farm system (the offseason PDC shuffle) leaves a shard
// behind that nothing routes to; drop it rather than serving a stale card.
for (const file of await readdir(outDir).catch(() => [])) {
  const teamId = file.replace(/\.json$/, '')
  if (!byTeamId[teamId]) await rm(join(outDir, file), { force: true })
}
console.log(`wrote ${Object.keys(byTeamId).length} of ${affiliates.size} affiliate files to ${outDir}`)
