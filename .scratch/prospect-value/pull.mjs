// Debut and bio facts for every player who ever appeared on a Top Prospects
// list, 2009-2024 (.scratch/top-prospects-history/rows.json).
//
// WHY THIS EXISTS. The debut cohort (.scratch/prospect-traits/bio.json, 3,061
// players) holds only men who debuted 2005-2023 AND cleared the app's rookie
// threshold. A ranked player who is absent from it is absent for four
// different reasons -- he never debuted, he debuted in 2024 or later, he
// debuted before 2005, or he debuted and never cleared the threshold. Those
// are four different answers to "how many ranked prospects never earn", so
// the panel must tell them apart instead of pooling them.
//
// One /api/v1/people call per 100 ids. Caches to bios.json; --refetch to
// rebuild. statsapi is unreachable under the Bash sandbox.
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'bios.json')
const refetch = process.argv.includes('--refetch')

if (existsSync(out) && !refetch) {
  const have = JSON.parse(await readFile(out, 'utf8'))
  console.log(`bios.json already holds ${Object.keys(have).length} players. Pass --refetch to rebuild.`)
  process.exit(0)
}

const rows = JSON.parse(await readFile(join(here, '..', 'top-prospects-history', 'rows.json'), 'utf8'))
const ids = [...new Set(rows.map((r) => r.mlbId))].sort((a, b) => a - b)
console.log(`${ids.length} distinct ranked players to look up`)

async function getJson(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === 1) throw err
      console.warn(`  retry after ${err.message}`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

const bios = {}
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100)
  const url = `https://statsapi.mlb.com/api/v1/people?personIds=${chunk.join(',')}`
  const data = await getJson(url)
  for (const p of data.people ?? []) {
    bios[p.id] = {
      id: p.id,
      name: p.lastFirstName ?? p.fullName ?? null,
      birthDate: p.birthDate ?? null,
      mlbDebutDate: p.mlbDebutDate ?? null,
      primaryPosition: p.primaryPosition?.abbreviation ?? null,
      positionType: p.primaryPosition?.type ?? null,
      active: p.active ?? null,
      lastPlayedDate: p.lastPlayedDate ?? null,
    }
  }
  console.log(`  ${Object.keys(bios).length}/${ids.length}`)
}

const missing = ids.filter((id) => !bios[id])
if (missing.length) console.warn(`WARNING: ${missing.length} ids returned no person record: ${missing.join(',')}`)

await writeFile(out, JSON.stringify(bios, null, 1))
console.log(`wrote ${Object.keys(bios).length} bios, ${missing.length} missing`)
