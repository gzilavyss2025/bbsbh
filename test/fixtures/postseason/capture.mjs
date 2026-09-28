// Rebuilds the postseason fixtures beside this file from live statsapi, with
// the SAME URLs src/api/postseason/fetch.js sends, so a fixture can never ask
// for a field the app does not. Run by hand (it needs the network):
//
//   node test/fixtures/postseason/capture.mjs
//
// A results fixture asks for the whole season (endDate {year}-12-31): the
// tests hand the derivation every result and expect it to re-apply the cutoff.
// 2026 has no results file: on the capture date (2026-09-28) no game was played.
// A finished season does not change, so re-running it changes only 2026.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resultsUrl, skeletonUrl } from '../../../src/api/postseason/fetch.js'

const DIR = fileURLToPath(new URL('.', import.meta.url))
const BASE = 'https://statsapi.mlb.com'

async function save(name, path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  writeFileSync(`${DIR}${name}.json`, JSON.stringify(await res.json()))
  console.log(`wrote ${name}.json`)
}

for (const year of [2008, 2022, 2025, 2026]) await save(`${year}-skeleton`, skeletonUrl(year))
for (const year of [2008, 2022, 2025]) await save(`${year}-results`, resultsUrl(year, `${year + 1}-01-01`))
