// Pre-builds public/data/wire-facts/{date}.json — every roster move's player
// facts for one past day, so the wire and the club ledgers open their notes
// with no statsapi reads (Gary, 2026-11-03).
//
// WHY IT CAN BE BUILT ONCE. A move's facts are gated to its date
// (playerFacts.js `asOf`): his season and career lines stop the day before, his
// age is his age that day. A day that is over can never change, so its file is
// written once and never again. Each run adds the days it has not seen and
// drops the days that left the window.
//
// THE SAME QUESTION AS THE BROWSER. The moves come from the club ledgers
// (public/data/team-transactions/, gen-team-transactions.mjs), each story with
// its club filled in as the ledger page fills it; each subject's request is
// playerFacts.js `factRequest`, and the file is keyed by its `factKey`. The
// browser modules run unchanged under Node: node-site-fetch.mjs serves their
// `/data/...` reads from public/.
//
// THE WINDOW. Sixty days, not the season: a season is ~10,000 players at ~3 KB
// each, about 30 MB. Older moves read live once, then from the reader's own
// browser (playerFacts.js FACTS_STORE).
//
// Run by hand:
//   node scripts/gen-wire-facts.mjs              # days not yet built
//   node scripts/gen-wire-facts.mjs --days=10    # a narrower window
import { readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { installSiteFetch } from './lib/node-site-fetch.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')
const ledgerDir = join(publicDir, 'data', 'team-transactions')
const outDir = join(publicDir, 'data', 'wire-facts')

const daysArg = process.argv.find((a) => a.startsWith('--days='))
const WINDOW = daysArg ? Number(daysArg.split('=')[1]) : 60

installSiteFetch(publicDir)
const { factKey, factRequest, fetchPlayerFacts, withoutContract } = await import('../src/api/transactions/playerFacts.js')
const { subjectsOf } = await import('../src/api/transactions/templates.js')

const iso = (d) => d.toISOString().slice(0, 10)
const today = iso(new Date())
const first = iso(new Date(Date.now() - WINDOW * 864e5))

// Every story of every club ledger, by day, inside the window and before today.
async function storiesByDay() {
  const byDay = new Map()
  for (const season of readdirSync(ledgerDir).filter((d) => /^\d{4}$/.test(d))) {
    for (const file of readdirSync(join(ledgerDir, season)).filter((f) => /^\d+\.json$/.test(f))) {
      const ledger = await readJsonOr(join(ledgerDir, season, file), null)
      for (const day of ledger?.days ?? []) {
        if (day.date < first || day.date >= today) continue
        const list = byDay.get(day.date) ?? []
        for (const story of day.stories) list.push({ ...story, teamId: story.teamId ?? ledger.teamId })
        byDay.set(day.date, list)
      }
    }
  }
  return byDay
}

async function buildDay(date, stories) {
  const requests = new Map()
  for (const story of stories) {
    for (const subject of subjectsOf(story)) {
      const [id, opts] = factRequest(story, date, subject)
      requests.set(factKey(id, opts), [id, opts])
    }
  }
  const out = {}
  let missed = 0
  await mapConcurrent([...requests], 12, async ([key, [id, opts]]) => {
    const facts = await fetchPlayerFacts(id, opts)
    // The contract is read live in the browser, so it never goes stale here.
    if (facts) out[key] = withoutContract(facts)
    else missed += 1
  })
  return { out, missed }
}

async function main() {
  console.log(`Wire facts: ${first} to the day before ${today}`)
  const byDay = await storiesByDay()
  let built = 0
  let failed = 0
  for (const date of [...byDay.keys()].sort()) {
    const path = join(outDir, `${date}.json`)
    if ((await readJsonOr(path, null)) !== null) continue
    const { out: facts, missed } = await buildDay(date, byDay.get(date))
    // A day is written once and never again, so a day with a failed read is
    // not written at all: the next night builds it whole.
    if (missed) {
      failed += 1
      console.log(`  ${date}: ${missed} reads failed; left for the next run`)
      continue
    }
    await writeJsonAtomic(path, facts)
    built += 1
    console.log(`  ${date}: ${Object.keys(facts).length} players`)
  }
  // A day that left the window goes; the browser reads it live from then on.
  let dropped = 0
  for (const file of readdirSync(outDir, { withFileTypes: true })) {
    const date = file.name.replace('.json', '')
    if (file.isFile() && date < first) {
      rmSync(join(outDir, file.name))
      dropped += 1
    }
  }
  console.log(`Done: ${built} days built, ${failed} left for the next run, ${dropped} dropped.`)
  // Every pending day failed: statsapi is down. Say so in the nightly summary.
  if (failed && !built) process.exitCode = 1
}

await import('node:fs').then((fs) => fs.mkdirSync(outDir, { recursive: true }))
await main()
