// Research spike: pull raw data for the level-tenure benchmark.
// Cohort: players with an MLB debut in 2019-2023 whose career crossed the real
// rookie threshold (public/data/rookies.json's rookieUntil — 130 AB or 50 IP
// cumulative MLB), i.e. NOT a cup-of-coffee call-up. Reuses that file's
// definition of "graduated to MLB" rather than reinventing one.
//
// For each cohort player: batched /people?hydrate=draft for position + draft
// pedigree, then per-player yearByYear hitting/pitching across the four
// full-season MiLB sportIds (11 AAA, 12 AA, 13 High-A, 14 A — rookie/complex
// (16) excluded, same scope Farm Index / gen-milb-history use).
//
// Writes raw.json. Re-run is resumable: players already present are skipped.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const rookiesPath = join(here, '..', '..', 'public', 'data', 'rookies.json')
const outPath = join(here, 'raw.json')

const MILB_SPORT_IDS = [11, 12, 13, 14]
const DEBUT_YEAR_MIN = 2019
const DEBUT_YEAR_MAX = 2023

async function loadCohort() {
  const rookies = JSON.parse(await readFile(rookiesPath, 'utf8'))
  const out = []
  for (const [id, p] of Object.entries(rookies.players)) {
    const y = Number((p.debutDate || '').slice(0, 4))
    if (y >= DEBUT_YEAR_MIN && y <= DEBUT_YEAR_MAX && p.rookieUntil) {
      out.push({ id: Number(id), debutDate: p.debutDate, rookieUntil: p.rookieUntil })
    }
  }
  return out
}

async function fetchPedigree(ids) {
  const byId = new Map()
  const chunks = []
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100))
  for (const chunk of chunks) {
    const data = await getJson(`/api/v1/people?personIds=${chunk.join(',')}&hydrate=draft`)
    for (const p of data.people ?? []) {
      const draft = p.drafts?.[0] ?? null
      byId.set(p.id, {
        name: p.fullName,
        posAbbr: p.primaryPosition?.abbreviation ?? null,
        birthCountry: p.birthCountry ?? null,
        birthDate: p.birthDate ?? null,
        draftYear: p.draftYear ?? null,
        draftRound: draft?.pickRound ?? null,
        draftSchool: draft?.school?.name ?? null,
      })
    }
  }
  return byId
}

function groupFor(posAbbr) {
  if (!posAbbr) return null
  if (posAbbr === 'TWP') return 'both'
  return posAbbr === 'P' ? 'pitching' : 'hitting'
}

async function fetchYearByYear(personId, group) {
  const rows = []
  for (const sportId of MILB_SPORT_IDS) {
    try {
      const data = await getJson(
        `/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}&sportId=${sportId}`,
      )
      for (const block of data.stats ?? []) {
        for (const split of block.splits ?? []) {
          if (!split.team?.id) continue
          rows.push({
            season: Number(split.season),
            sportId,
            teamId: split.team.id,
            teamName: split.team.name ?? '',
            stat: split.stat ?? {},
          })
        }
      }
    } catch {
      // level never played — statsapi 400s/empties for it, not a real failure
    }
  }
  return rows
}

async function main() {
  await mkdir(here, { recursive: true })
  let existing = { players: {} }
  try {
    existing = JSON.parse(await readFile(outPath, 'utf8'))
  } catch {
    /* first run */
  }

  const cohort = await loadCohort()
  console.log(`cohort: ${cohort.length} players (debut ${DEBUT_YEAR_MIN}-${DEBUT_YEAR_MAX}, real graduation)`)

  const toFetch = cohort.filter((p) => !existing.players[p.id])
  console.log(`already have ${cohort.length - toFetch.length}, fetching ${toFetch.length}`)

  if (toFetch.length) {
    const pedigree = await fetchPedigree(toFetch.map((p) => p.id))
    console.log(`pedigree resolved for ${pedigree.size}/${toFetch.length}`)

    let done = 0
    await mapConcurrent(toFetch, 10, async (p) => {
      const ped = pedigree.get(p.id)
      const group = groupFor(ped?.posAbbr)
      if (!group || group === 'both') {
        existing.players[p.id] = { ...p, ped, skipped: group === 'both' ? 'two-way' : 'no-position' }
      } else {
        const milb = await fetchYearByYear(p.id, group)
        existing.players[p.id] = { ...p, ped, group, milb }
      }
      done++
      if (done % 100 === 0) console.log(`  ${done}/${toFetch.length}`)
    })
  }

  await writeFile(outPath, JSON.stringify(existing))
  console.log(`wrote ${outPath}: ${Object.keys(existing.players).length} players total`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
