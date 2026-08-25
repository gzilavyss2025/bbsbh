// "How many years he is signed for" has no historical source - Cot's in this
// repo is a 2026 snapshot only. What IS reconstructible is the clock that sets
// the contract: a man's debut date fixes his service class in any later season.
// Pull debut dates, and derive control years remaining from them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ids = JSON.parse(readFileSync('incumbent-ids.json', 'utf8'))
const OUT = 'incumbent-bio.json'
const bio = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

const todo = ids.filter((id) => !bio[String(id)])
console.log('to hydrate:', todo.length, 'of', ids.length)

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)))
    }
  }
}

for (let i = 0; i < todo.length; i += 80) {
  const batch = todo.slice(i, i + 80)
  const url = `https://statsapi.mlb.com/api/v1/people?personIds=${batch.join(',')}`
  const json = await get(url)
  for (const p of json.people || []) {
    bio[String(p.id)] = {
      name: p.fullName,
      debut: p.mlbDebutDate || null,
      birth: p.birthDate || null,
      pos: p.primaryPosition ? p.primaryPosition.abbreviation : null,
    }
  }
  writeFileSync(OUT, JSON.stringify(bio))
  console.log(`  ${Math.min(i + 80, todo.length)}/${todo.length}`)
  await new Promise((res) => setTimeout(res, 200))
}

const missing = ids.filter((id) => !bio[String(id)] || !bio[String(id)].debut)
console.log('done. no debut date for', missing.length)
