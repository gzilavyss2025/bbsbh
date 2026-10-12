// The ONE key each ballpark's stores are filed under, pinned to the park's
// Stats API venue id so a sponsor rename cannot move it.
//
// THE PROBLEM. Every per-park store is keyed by venueKey(name): the bundled
// photo and its credit (../ballparkArt.js CREDITS, public/ballparks/{key}.jpg),
// the admin copy fields (`ballpark.{key}Photo` and five siblings, which are
// REDIS FIELD NAMES — src/copy/registry.js), the MiLB park list
// (milb-ballparks.json) and the capacity lookup. A sponsor rename changes the
// name and never the id. Lehigh Valley's park, venue 3230, is "Coca-Cola Park"
// in the 2026 data and "Jefferson Park" in the 2027 data: re-keyed by name,
// every photo and note an admin saved for it would silently detach.
//
// THE CHOICE: keep the name key, freeze it, and alias by id. A venue's key is
// minted ONCE, from the name it had when first seen, and never changes again
// (../data/park-keys.json, written by scripts/gen-milb-ballparks.mjs, append-only).
// Every later name the venue wears is recorded beside it. So:
//
//   - no Redis field is renamed, so there is no migration to run and no
//     window in which the old copy is unreachable. Re-keying by venue id
//     would have meant moving every saved field (770 of them) in step with a
//     deploy; freezing means the migration is the empty set, now and at
//     every future rename.
//   - the bundled photo files and CREDITS keep their names.
//   - a caller with only a NAME (the attendance and gate generators, the
//     stamp prints, a lean feed row) still resolves, because every name a
//     venue has worn points at its one key.
//
// The cost is that a key may read like a name the park no longer has
// (`cocacolapark` for Jefferson Park). Keys are internal; the name printed on
// the card always comes from the feed or the admin's own Name field.

import PINNED from '../data/park-keys.json' with { type: 'json' }
import { venueKey } from './ballparkArt.js'
import { ballparkFor } from './ballparkData.js'

// venueKey(any name a pinned venue has worn) -> that venue's pinned key.
const KEY_BY_NAME = new Map()
for (const { key, names } of Object.values(PINNED)) {
  for (const name of names) KEY_BY_NAME.set(venueKey(name), key)
}

// The key a park's stores are filed under. The venue id wins when the caller
// has one: it finds a renamed park even before the generator has recorded the
// new name. Then any name the venue has worn. Then, for a venue on no list (a
// neutral site, a park newer than the last generator run), the same
// canonical-name key the stores have always used.
export function parkKey(venueName, venueId = null) {
  const pinned = venueId != null ? PINNED[venueId]?.key : null
  if (pinned) return pinned
  const raw = venueKey(venueName)
  if (!raw) return ''
  return KEY_BY_NAME.get(raw) ?? venueKey(ballparkFor(venueName)?.name || venueName)
}

// Every name the venue has worn, newest first, with the caller's own name in
// front. Empty for a venue on no list.
function namesOf(venueName, venueId) {
  const key = parkKey(venueName, venueId)
  const entry = Object.values(PINNED).find((e) => e.key === key)
  return [venueName, ...(entry ? [...entry.names].reverse() : [])].filter(Boolean)
}

// The measured park record (capacity, distances) for a venue, through any name
// it has worn. BALLPARKS is keyed by name, so a park renamed after its row was
// written is found through its older name.
export function parkRecord(venueName, venueId = null) {
  for (const name of namesOf(venueName, venueId)) {
    const park = ballparkFor(name)
    if (park) return park
  }
  return null
}

// ---- the generator's half (scripts/gen-milb-ballparks.mjs) ----

// Fold one teams.json run into the pinned table. APPEND-ONLY: an existing
// venue keeps its key and gains any new name; a new venue gets the
// canonical-name key, or that key plus its id in the unlikely case another
// venue already holds it. Nothing is ever removed — a venue a club has left
// keeps its key, so its copy is still there if a club returns. `log` is told
// about each rename, which is the moment a person may want to look.
export function pinParkKeys(pinned, rows, log = () => {}) {
  const out = structuredClone(pinned)
  const taken = new Set(Object.values(out).map((e) => e.key))
  for (const { venueId, venueName } of rows) {
    if (venueId == null || !venueName) continue
    const entry = out[venueId]
    if (entry) {
      if (!entry.names.includes(venueName)) {
        log(`venue ${venueId} renamed "${entry.names.at(-1)}" -> "${venueName}"; key stays ${entry.key}`)
        entry.names.push(venueName)
      }
      continue
    }
    let key = venueKey(ballparkFor(venueName)?.name || venueName)
    if (taken.has(key)) key = `${key}${venueId}`
    taken.add(key)
    out[venueId] = { key, names: [venueName] }
  }
  return out
}
