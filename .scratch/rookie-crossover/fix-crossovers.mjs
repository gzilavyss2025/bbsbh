// One-time correction for public/data/rookies.json: recompute rookieUntil for
// every player whose current record has rookieUntil BEFORE debutDate — a
// logical impossibility caused by the Negro-League-crossover bug fixed in
// scripts/lib/rookie-crossing.mjs (see that file's header). Not a generator,
// not on any cron — a scoped repair for the known-bad rows only, run once.
//
// Run by hand: node .scratch/rookie-crossover/fix-crossovers.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { writeJsonAtomic } from '../../scripts/lib/io.js'
import { writeRookieShards } from '../../scripts/lib/rookie-shards.mjs'
import { findCrossingSeason, crossingDateFromGameLog } from '../../scripts/lib/rookie-crossing.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', '..', 'public', 'data')
const masterPath = join(dataDir, 'rookies.json')

function groupsFor(position) {
  const abbr = position?.abbreviation
  if (abbr === 'TWP') return ['hitting', 'pitching']
  return [abbr === 'P' ? 'pitching' : 'hitting']
}

async function findCrossingDate(personId, group, season, priorTotal) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}`,
  )
  const games = (data.stats?.[0]?.splits ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  return crossingDateFromGameLog(games, group, priorTotal)
}

async function recompute(personId, mlbDebutDate) {
  const person = (await getJson(`/api/v1/people/${personId}`)).people?.[0]
  const groups = groupsFor(person?.primaryPosition)
  const perGroup = await Promise.all(
    groups.map(async (group) => {
      const splits = await getJson(`/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}`)
      const yearSplits = splits.stats?.[0]?.splits ?? []
      const crossing = findCrossingSeason(yearSplits, group)
      return crossing ? { group, ...crossing } : null
    }),
  )
  const crossings = perGroup.filter(Boolean)
  if (!crossings.length) return { debutDate: mlbDebutDate, rookieUntil: null }
  const dates = (
    await Promise.all(crossings.map((c) => findCrossingDate(personId, c.group, c.crossingSeason, c.priorTotal)))
  ).filter(Boolean)
  dates.sort()
  return { debutDate: mlbDebutDate, rookieUntil: dates[0] ?? null }
}

async function main() {
  const master = JSON.parse(await readFile(masterPath, 'utf8'))
  const affected = Object.entries(master.players).filter(
    ([, rec]) => rec.rookieUntil && rec.debutDate && rec.rookieUntil < rec.debutDate,
  )
  console.log(`found ${affected.length} players with rookieUntil before debutDate`)

  let fixed = 0
  for (const [id, rec] of affected) {
    const corrected = await recompute(id, rec.debutDate)
    console.log(`  ${id}: ${rec.rookieUntil} -> ${corrected.rookieUntil ?? '(open)'}`)
    master.players[id] = corrected
    fixed++
  }

  const stillBad = Object.entries(master.players).filter(
    ([, rec]) => rec.rookieUntil && rec.debutDate && rec.rookieUntil < rec.debutDate,
  )
  if (stillBad.length) {
    throw new Error(`${stillBad.length} rows still have rookieUntil before debutDate after the fix — aborting write`)
  }

  master.generatedAt = new Date().toISOString()
  await writeJsonAtomic(masterPath, master)
  const { players, shards } = await writeRookieShards(dataDir, master)
  console.log(`fixed ${fixed} players; wrote master + ${shards} shards (${players} players total)`)
}

main().catch((err) => {
  console.error('fix-crossovers failed:', err.message)
  process.exit(1)
})
