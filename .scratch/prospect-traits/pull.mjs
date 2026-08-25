// Research spike: prospect traits. Pulls the four things the existing
// level-benchmark caches do NOT already carry, for the same 3,061-player cohort
// (.scratch/level-benchmarks/raw.json — MLB debuts 2005–2023, past the app's
// own 130 AB / 50 IP rookie threshold).
//
// WHAT IS ALREADY ON HAND, and therefore not re-pulled here:
//   raw.json                 per-player MiLB yearByYear at sportIds 11–14
//   milb-cohort-cache.json   every MiLB team-season at sportIds 11–16 (no stats)
//   dates.json               wire-resolved level durations, post-debut rows dropped
//   homegrown-cohort.json    first professional org + entry level
//   perf-pool.json           level-season peer pools for relative performance
//   orgmap-ext.json          season-scoped team -> parent org
//   public/data/war-history  per-season MLB WAR, 2010–2025
//
// WHAT THIS ADDS:
//   bio.json      height, weight, bat side, throwing hand, position, birth date
//   awards.json   every award a cohort player ever won, MiLB ones included
//   mlb.json      MLB yearByYear, for locating and grading the rookie season
//   league.json   league-wide MLB rate lines per season, the "average" to beat
//   arsenal.json  MLB pitch mix + velocity in the rookie season (pitchers only)
//
// Every step is a read-through cache, so a rerun after an edit costs nothing
// and the caches are the record of what was actually pulled.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bench = join(here, '..', 'level-benchmarks')

async function cached(name, build) {
  const path = join(here, name)
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    const built = await build()
    await writeFile(path, JSON.stringify(built))
    return built
  }
}

const raw = JSON.parse(await readFile(join(bench, 'raw.json'), 'utf8'))
const cohort = Object.entries(raw.players).map(([id, p]) => ({ id: Number(id), ...p }))
console.log(`cohort: ${cohort.length}`)

// --- 1. bio -----------------------------------------------------------------
// height comes back as a display string ("6' 2\"") and is parsed at analysis
// time, not here — the cache keeps what the API said.
const bio = await cached('bio.json', async () => {
  const out = {}
  const ids = cohort.map((p) => p.id)
  const chunks = []
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100))
  console.log(`bio: ${chunks.length} batched calls`)
  for (const chunk of chunks) {
    const data = await getJson(
      `/api/v1/people?personIds=${chunk.join(',')}` +
        `&fields=people,id,fullName,height,weight,birthDate,birthCountry,` +
        `primaryPosition,abbreviation,code,batSide,pitchHand,draftYear,mlbDebutDate`,
    )
    for (const p of data.people ?? []) {
      out[p.id] = {
        name: p.fullName,
        height: p.height ?? null,
        weight: p.weight ?? null,
        birthDate: p.birthDate ?? null,
        birthCountry: p.birthCountry ?? null,
        pos: p.primaryPosition?.abbreviation ?? null,
        posCode: p.primaryPosition?.code ?? null,
        bats: p.batSide?.code ?? null,
        throws: p.pitchHand?.code ?? null,
        debutDate: p.mlbDebutDate ?? null,
      }
    }
  }
  console.log(`bio: ${Object.keys(out).length} resolved`)
  return out
})
console.log(`bio: ${Object.keys(bio).length} players`)

// --- 2. awards --------------------------------------------------------------
// One call per player. The player-scoped endpoint is used rather than sweeping
// awards/{id}/recipients by season because the join we want is player -> award,
// and the award catalog has 682 entries across seven sportIds.
const awards = await cached('awards.json', async () => {
  const out = {}
  let done = 0
  await mapConcurrent(cohort, 10, async (p) => {
    try {
      const data = await getJson(`/api/v1/people/${p.id}/awards`)
      out[p.id] = (data.awards ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        season: a.season ? Number(a.season) : null,
        date: a.date ?? null,
        teamId: a.team?.id ?? null,
      }))
    } catch {
      out[p.id] = null // distinguishable from "no awards" ([])
    }
    if (++done % 250 === 0) console.log(`  awards ${done}/${cohort.length}`)
  })
  return out
})
console.log(`awards: ${Object.keys(awards).length} players`)

// --- 3. MLB season lines ----------------------------------------------------
// group follows the player's stat group in raw.json, the same call that file's
// pull made for the minor-league side, so the two are directly comparable.
const mlb = await cached('mlb.json', async () => {
  const out = {}
  let done = 0
  const withGroup = cohort.filter((p) => p.group === 'hitting' || p.group === 'pitching')
  await mapConcurrent(withGroup, 10, async (p) => {
    try {
      const data = await getJson(
        `/api/v1/people/${p.id}/stats?stats=yearByYear&group=${p.group}&sportId=1`,
      )
      const rows = []
      for (const block of data.stats ?? []) {
        for (const split of block.splits ?? []) {
          rows.push({
            season: Number(split.season),
            teamId: split.team?.id ?? null,
            stat: split.stat ?? {},
          })
        }
      }
      out[p.id] = rows
    } catch {
      out[p.id] = null
    }
    if (++done % 250 === 0) console.log(`  mlb ${done}/${withGroup.length}`)
  })
  return out
})
console.log(`mlb: ${Object.keys(mlb).length} players`)

// --- 4. league context ------------------------------------------------------
// League-wide MLB rate lines per season, so "above average rookie season" is
// measured against the league the man actually played in rather than against
// the other rookies in the cohort.
const league = await cached('league.json', async () => {
  const out = {}
  for (let season = 2005; season <= 2024; season++) {
    for (const group of ['hitting', 'pitching']) {
      try {
        const data = await getJson(
          `/api/v1/teams/stats?season=${season}&sportIds=1&group=${group}&stats=season`,
        )
        // teams/stats returns one split per club; sum the raw counting stats.
        const splits = data.stats?.[0]?.splits ?? []
        const agg = {}
        for (const s of splits) {
          for (const [k, v] of Object.entries(s.stat ?? {})) {
            if (typeof v === 'number') agg[k] = (agg[k] ?? 0) + v
          }
        }
        out[`${season}:${group}`] = { teams: splits.length, agg }
      } catch (err) {
        out[`${season}:${group}`] = { error: String(err) }
      }
    }
  }
  return out
})
console.log(`league: ${Object.keys(league).length} season-groups`)

// --- 5. pitch arsenal -------------------------------------------------------
// MLB-level only, and that limit is a finding rather than a shortcut: AA and
// below carry no pitch-type data at all, and Triple-A tracking only arrives
// with Hawk-Eye in the 2020s (scripts/gen-pitch-arsenal.mjs's header). So the
// mix and velocity here are what a man threw AFTER he was promoted, never
// before — which is exactly the caveat the analysis has to carry.
const rookieSeasonOf = (p) => {
  const until = p.rookieUntil ? Number(p.rookieUntil.slice(0, 4)) : null
  return until ?? Number(p.debutDate.slice(0, 4))
}
const arsenal = await cached('arsenal.json', async () => {
  const out = {}
  const pitchers = cohort.filter((p) => p.group === 'pitching')
  let done = 0
  await mapConcurrent(pitchers, 10, async (p) => {
    const season = rookieSeasonOf(p)
    try {
      const data = await getJson(
        `/api/v1/people/${p.id}/stats?stats=pitchArsenal&season=${season}&group=pitching`,
      )
      const splits = data.stats?.[0]?.splits ?? []
      out[p.id] = {
        season,
        pitches: splits.map((s) => ({
          code: s.stat?.type?.code ?? null,
          desc: s.stat?.type?.description ?? null,
          count: s.stat?.count ?? 0,
          share: s.stat?.percentage ?? null,
          velo: s.stat?.averageSpeed ?? null,
        })),
      }
    } catch {
      out[p.id] = null
    }
    if (++done % 200 === 0) console.log(`  arsenal ${done}/${pitchers.length}`)
  })
  return out
})
console.log(`arsenal: ${Object.keys(arsenal).length} pitchers`)

console.log('done')
