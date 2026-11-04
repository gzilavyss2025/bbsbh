// The key each park's stores are filed under, pinned to its Stats API venue id
// (../ballpark/parkKeys.js explains why). Split from ./parkNames.js because this
// file reads park-keys.json with an import attribute, which the edge bundler
// behind api/preview.js cannot parse, and parkNames.js must stay edge-safe.

import PINNED from './park-keys.json' with { type: 'json' }
import { venueKey } from '../ballpark/ballparkArt.js'
import { canonicalParkName } from './parkNames.js'

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
  return KEY_BY_NAME.get(raw) ?? venueKey(canonicalParkName(venueName, venueId) || venueName)
}
