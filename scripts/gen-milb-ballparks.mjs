// Regenerates two files from the teams.json this same workflow just wrote
// (scripts/gen-teams.mjs), rather than re-fetching statsapi for data that file
// already carries:
//
//   - src/lib/data/park-keys.json — the PINNED store key for every
//     MLB and MiLB venue id, and every name that venue has worn. APPEND-ONLY:
//     a key, once minted, never changes, so a sponsor rename cannot detach a
//     park's photo, credit, capacity or admin copy (those copy ids are Redis
//     field names). See src/lib/ballpark/parkKeys.js for the why.
//   - src/lib/data/milb-ballparks.json — the closed list of MiLB parks the copy
//     registry offers a photo/name/logo editor for (src/copy/registry.js's
//     milbParkFields()), the same gear-on-the-card framework the 30 MLB parks
//     get from src/lib/ballpark/ballparkData.js — minus the measurements half,
//     so BallparkCard hides that half of the card for them.
//
// milb-ballparks.json is keyed by the PINNED key, with `venue` the CURRENT
// name: after Coca-Cola Park became Jefferson Park (venue 3230, 2027 data) the
// entry stays `cocacolapark`, so every field an admin saved under it stays put,
// and the admin panel's heading reads the new name. One venue can host more
// than one club (Roger Dean Chevrolet Stadium, Jupiter/Palm Beach), so entries
// are deduped by key with every hosted club's name kept for that heading.
//
// A rename is logged. A name added to park-keys.json by hand (a rename known
// before the feed carries it) is kept, the same as any other.
//
// Run by hand: node scripts/gen-milb-ballparks.mjs (after gen-teams.mjs)
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { writeJsonAtomic } from './lib/io.js'
import { pinParkKeys } from '../src/lib/ballpark/parkKeys.js'

const here = dirname(fileURLToPath(import.meta.url))
const teamsPath = join(here, '..', 'public', 'data', 'teams.json')
const keysPath = join(here, '..', 'src', 'lib', 'data', 'park-keys.json')
const out = join(here, '..', 'src', 'lib', 'data', 'milb-ballparks.json')

// MiLB only for the editor list — sportId 1 (MLB) has its own hand-curated,
// measured table. Both get pinned keys, because both have stores.
const MILB_SPORT_IDS = [11, 12, 13, 14]
const KEYED_SPORT_IDS = [1, ...MILB_SPORT_IDS]

// Pure: teams.json's bySportId + the pinned table -> milb-ballparks.json.
// Exported for test/park-keys.test.js.
export function milbParks(bySportId, pinned) {
  const byKey = new Map()
  for (const sportId of MILB_SPORT_IDS) {
    for (const t of bySportId[sportId] ?? []) {
      if (!t.venueName) continue // a lean/incomplete row — degrade by skipping it
      const key = pinned[t.venueId]?.key
      if (!key) continue // no venue id, so no key that can survive a rename
      const entry = byKey.get(key)
      if (entry) entry.teams.push(t.name)
      else byKey.set(key, { venue: t.venueName, venueId: t.venueId, teams: [t.name] })
    }
  }
  return Object.fromEntries(
    [...byKey.entries()].sort(([, a], [, b]) => a.venue.localeCompare(b.venue)),
  )
}

async function main() {
  const { bySportId } = JSON.parse(await readFile(teamsPath, 'utf8'))
  const existing = JSON.parse(await readFile(keysPath, 'utf8').catch(() => '{}'))
  const rows = KEYED_SPORT_IDS.flatMap((id) => bySportId[id] ?? [])
  const pinned = pinParkKeys(existing, rows, (line) => console.log(line))
  await writeJsonAtomic(keysPath, pinned, 2)
  console.log(`wrote ${keysPath} (${Object.keys(pinned).length} venues)`)

  const parks = milbParks(bySportId, pinned)
  await writeJsonAtomic(out, parks, 2)
  console.log(`wrote ${out} (${Object.keys(parks).length} parks)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
