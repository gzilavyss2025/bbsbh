// Regenerates src/lib/data/milb-ballparks.json — the closed list of MiLB parks
// the copy registry offers a photo/name/logo editor for
// (src/copy/registry.js's milbParkFields()), the same gear-on-the-card
// framework the 30 MLB parks get from src/lib/ballpark/ballparkData.js — minus
// the measurements/diagram half, which needs a hand-verified schematic no
// generator can produce, so MiLB parks carry no BALLPARKS record at all and
// BallparkCard hides that half of the card for them.
//
// Reads the teams.json this same workflow just wrote (scripts/gen-teams.mjs)
// rather than re-fetching statsapi a second time for data that file already
// carries — every MiLB team's venue name, at no extra request.
//
// Keyed the same way ballparkData.js keys an MLB park — venueKey(name) — so a
// park's copy fields, once an admin fills them in, are picked up for free by
// every existing reader keyed the same way (parkBackdrop.js's MiLB fallback
// already assumes this scheme; see its header). One venue can host more than
// one club (Roger Dean Chevrolet Stadium, Jupiter/Palm Beach), so entries are
// deduped by key with every hosted club's name kept for the admin panel's
// subgroup heading.
//
// Run by hand: node scripts/gen-milb-ballparks.mjs (after gen-teams.mjs)
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { writeJsonAtomic } from './lib/io.js'
import { venueKey } from '../src/lib/ballpark/ballparkArt.js'

const here = dirname(fileURLToPath(import.meta.url))
const teamsPath = join(here, '..', 'public', 'data', 'teams.json')
const out = join(here, '..', 'src', 'lib', 'data', 'milb-ballparks.json')

// MiLB only — sportId 1 (MLB) has its own hand-curated, measured table.
const MILB_SPORT_IDS = [11, 12, 13, 14]

const { bySportId } = JSON.parse(await readFile(teamsPath, 'utf8'))

const byKey = new Map()
for (const sportId of MILB_SPORT_IDS) {
  for (const t of bySportId[sportId] ?? []) {
    if (!t.venueName) continue // a lean/incomplete row — degrade by skipping it
    const key = venueKey(t.venueName)
    const entry = byKey.get(key)
    if (entry) entry.teams.push(t.name)
    else byKey.set(key, { venue: t.venueName, teams: [t.name] })
  }
}

const parks = Object.fromEntries(
  [...byKey.entries()].sort(([, a], [, b]) => a.venue.localeCompare(b.venue)),
)

await writeJsonAtomic(out, parks, 2)
console.log(`wrote ${out} (${Object.keys(parks).length} parks)`)
