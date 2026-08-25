// The one-shot store behind the Game Log milestone shelf's single celebratory
// beat: which completed collections have already played their one-time
// completion animation. Mirrors src/lib/account/prompts.js's shape exactly —
// same reasoning, different closed set.
//
// Device-scoped on purpose, not synced: a completion is a fact about this
// browser having SEEN the moment, not a fact about the account, and the worst
// case of skipping cross-device sync is a second device replaying the
// animation once, which is harmless (same posture prompts.js documents for
// its own dismissals).
//
// Pure on purpose — the storage I/O lives in the hook
// (src/hooks/useMilestoneCelebrations.js), verified in the browser; the
// RULES here are what the unit suite pins.

export const MILESTONE_CELEBRATIONS_KEY = 'bbsbh:milestoneCelebrations'

// The closed set this module recognizes — kept in step with
// src/api/logbookMilestones.js's MILESTONE_COLLECTIONS ids. A collection
// dropped from that registry stops being writable here (scrub below), so a
// stale id left over from a removed collection can't linger forever.
//
// ONE ID PER COLLECTION *PER LEVEL*, because a collection is now a level's
// roster rather than a constant (rosterFor in that module): finishing the
// AAA clubs and finishing the MLB clubs are two different completions and
// each is owed its own single beat. `celebrationId` below builds the name.
//
// MLB KEEPS THE BARE ID — 'clubs', not 'clubs@1'. Those two strings are
// already written into real users' localStorage under this key, and a rename
// would silently un-celebrate a completed MLB shelf and replay its animation
// on the next visit. The suffix exists only for the four levels that had no
// id before.
const COLLECTION_IDS = ['clubs', 'parks']
const LEVEL_SPORT_IDS = [1, 11, 12, 13, 14]

// The storage id for one collection at one level. sportId 1 is deliberately
// the unsuffixed name — see above.
export function celebrationId(collectionId, sportId = 1) {
  return sportId === 1 ? collectionId : `${collectionId}@${sportId}`
}

export const MILESTONE_IDS = Object.freeze(
  COLLECTION_IDS.flatMap((id) => LEVEL_SPORT_IDS.map((sportId) => celebrationId(id, sportId))),
)

export function isMilestoneId(id) {
  return typeof id === 'string' && MILESTONE_IDS.includes(id)
}

function scrub(map) {
  const source = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  const out = {}
  for (const [id, at] of Object.entries(source)) {
    if (isMilestoneId(id) && Number.isInteger(at) && at >= 0) out[id] = at
  }
  return out
}

// Never throws — malformed input collapses to {} ("nothing celebrated yet"),
// the fail-OPEN direction: replaying the animation once more is a minor
// repeat, never a spoiler, so there's no reason to fail closed.
export function parseMilestoneCelebrations(raw) {
  if (raw == null) return {}
  try {
    return scrub(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function serializeMilestoneCelebrations(map) {
  return JSON.stringify(scrub(map))
}

export function hasCelebratedMilestone(map, id) {
  return Boolean(map && typeof map === 'object' && Number.isInteger(map[id]))
}

// Mark a collection's completion as celebrated. Returns the SAME reference
// when it was already marked, so a caller doesn't write or re-render on a
// no-op — same convention as markPromptSeen/addStamp.
export function markMilestoneCelebrated(map, id, now = Date.now()) {
  if (!isMilestoneId(id) || hasCelebratedMilestone(map, id)) {
    return map && typeof map === 'object' ? map : {}
  }
  return { ...scrub(map), [id]: Number.isInteger(now) && now >= 0 ? now : 0 }
}
