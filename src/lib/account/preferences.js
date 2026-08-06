// My Tally's preference document — the club you follow and how this device
// behaves. React-free and dependency-free so every rule below can be pinned by
// the unit suite (test/preferences.test.js) and reused VERBATIM by the
// serverless function (api/preferences.js), which is the point: the client and
// the server must not be able to disagree about what a valid preference is.
// Same contract src/lib/stamps.js has with api/stamps.js.
//
// WHAT THIS IS NOT, and can never become: score-bearing. A preference is
// identity (which club) and device behaviour (keep the screen awake, which
// level the slate opens on, how much motion you want). **No preference value
// may be derived from, or encode, game state.** That is the invariant that
// keeps this document on exactly the same footing as `revealedThrough` — a
// thing about the user, never a thing about a ballpark — and it is why this
// module has no idea what a gamePk is.
//
// Four fields, deliberately. The closed set below is the whole vocabulary; an
// unknown key is dropped on the way in and on the way out, in storage and on
// the wire, on both sides. Growing it is a product decision, not a convenience.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY *NOT* IN HERE
// ---------------------------------------------------------------------------
//   bbsbh:scoresUnlocked  the Scores Unlocked pass expiry. Syncing it would
//                         unseal a SECOND DEVICE THE USER NEVER CONSENTED ON,
//                         which is the single worst thing this subsystem could
//                         do. It stays device-local forever (ADR-0026). Only
//                         the per-day CONSENT record syncs, on its own key,
//                         its own shape and its own endpoint.
//   bbsbh:spoiledDays     consent, not preference. src/lib/spoiledDays.js.
//   bbsbh:reveal:*        scoring progress. ADR-0022.
//   bbsbh:stamps          the Game Log. ADR-0035.
//   bbsbh:search:recent   a browsing trail; device-local by nature.
//
// ---------------------------------------------------------------------------
// WHY PER-FIELD `updatedAt` AND NOT ONE DOCUMENT CLOCK
// ---------------------------------------------------------------------------
// Two devices editing two DIFFERENT preferences must both win. A document-level
// clock makes that a coin flip and silently drops one of the user's own taps —
// which is precisely the defect that ruled out storing this in Clerk's
// `unsafeMetadata` (a whole-object PATCH) and sent it here instead. So the unit
// of last-write-wins is the FIELD, and the record is `{ value, updatedAt }`.

export const PREFS_KEY = 'bbsbh:prefs'

// Which account's remote document was last merged into the local one. Sync
// bookkeeping, not a preference, so it lives beside the document rather than
// inside it — see `mergeStrategyFor` for the leak it exists to prevent.
export const PREFS_OWNER_KEY = 'bbsbh:prefsOwner'

// The legacy single-purpose keys this document replaces. Read once to seed a
// migration (see `seedFromLegacy`), never written again.
export const LEGACY_KEYS = Object.freeze({
  club: 'bbsbh:favoriteTeam',
  level: 'bbsbh:level',
  keepAwake: 'bbsbh:keepAwake',
})

// An `updatedAt` further into the future than this is a broken clock, not a
// choice. The server clamps rather than refuses (see `clampUpdatedAt`): a wrong
// clock should cost the user a merge-order surprise, never their setting. Same
// posture as api/reveal.js's MAX_REVEALED_THROUGH — bound the hostile input,
// don't fail the honest one.
//
// This was 48 HOURS, and 48 hours was wrong. The bound is not a tolerance for
// hostile input, it is the exact size of the window during which a device with
// a fast clock makes a field UNCHANGEABLE everywhere else: the stored value
// wins every last-write-wins comparison, so another device's tap persists
// locally, publishes nothing (it is not strictly newer than the baseline), and
// is then reverted by the next focus pull. Silently, repeatedly, with no way
// for the user to fix it. "A merge-order surprise" undersold it by two days.
//
// A few minutes covers real clock jitter between two honest devices; anything
// beyond it clamps to the server's own now, which still keeps the user's
// setting — it just stops the setting from outranking everyone else's.
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

// The slate's level toggle stores a statsapi **sportId**, which is what
// src/lib/teams.js's SPORT_IDS/LEVELS and every fetch in the app already speak.
// Restated here rather than imported for the reason src/lib/stamps.js restates
// the passport bounds: this module is bundled into a serverless function and
// has no business pulling a 1,100-line identity module in behind it. If LEVELS
// ever grows a rung, this list is the second place to change.
//
// (The PRD sketched a `'mlb' | 'aaa' | …` string vocabulary. That was wrong —
// it would have invented a second name for a thing that already has one, and
// the two would drift. Deliberate departure, recorded in the PRD.)
export const LEVEL_SPORT_IDS = Object.freeze([1, 11, 12, 13, 14])

// How much motion the user wants, on top of the OS `prefers-reduced-motion`
// signal. 'system' means "do what the OS says", which is today's only
// behaviour — so shipping this field changes nothing until someone touches it.
export const MOTION_MODES = Object.freeze(['system', 'reduced', 'full'])

// A statsapi team id. Deliberately a RANGE and not a membership test against
// the real club list: validating a club would mean importing teams.js into the
// serverless bundle (see above), and the cost of a well-formed-but-wrong id is
// a fallback logo, not a security hole. The picker only ever offers real MLB
// clubs; this bound exists to stop a hostile client storing an absurd value.
const MAX_TEAM_ID = 99999

// The closed field registry. `validate` is the ONLY authority on what a value
// may be; `fallback` is what a reader gets when the field is absent, and is
// never itself stored (absence means "no opinion", not "set to the default").
export const FIELDS = Object.freeze({
  club: {
    validate: (v) => Number.isInteger(v) && v > 0 && v <= MAX_TEAM_ID,
    // The Brewers — the app's own pinned club (PINNED_TEAM_ID in teams.js).
    fallback: 158,
  },
  level: {
    validate: (v) => Number.isInteger(v) && LEVEL_SPORT_IDS.includes(v),
    fallback: 1,
  },
  keepAwake: {
    validate: (v) => typeof v === 'boolean',
    // Off by default — an always-on screen for a three-hour game is a real
    // battery cost, so it stays opt-in.
    fallback: false,
  },
  motion: {
    validate: (v) => typeof v === 'string' && MOTION_MODES.includes(v),
    fallback: 'system',
  },
})

export const FIELD_NAMES = Object.freeze(Object.keys(FIELDS))

export function isFieldName(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(FIELDS, name)
}

export function isValidValue(field, value) {
  return isFieldName(field) && FIELDS[field].validate(value)
}

// The value a reader should use — the stored one, or the field's fallback. The
// single accessor every consumer goes through, so "absence means no opinion"
// is resolved in exactly one place.
export function preferenceValue(doc, field) {
  if (!isFieldName(field)) return undefined
  const entry = doc && typeof doc === 'object' ? doc[field] : null
  return entry && FIELDS[field].validate(entry.value) ? entry.value : FIELDS[field].fallback
}

// ---------------------------------------------------------------------------
// Normalizing
// ---------------------------------------------------------------------------

// One entry, or null. `updatedAt` must be a NON-NEGATIVE integer: zero is a
// legal, meaningful value — it is what a migrated legacy key carries, meaning
// "held, but with no clock", so any real value from any device outranks it.
// (The PRD said "positive"; zero is the one case that made it wrong.)
export function normalizeEntry(field, raw) {
  if (!isFieldName(field)) return null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!FIELDS[field].validate(raw.value)) return null
  const updatedAt = raw.updatedAt
  if (!Number.isInteger(updatedAt) || updatedAt < 0) return null
  return { value: raw.value, updatedAt }
}

// Valid entries only, keyed by field name. Unknown keys are dropped silently —
// garbage can LOSE a preference (harmless: the fallback resumes) but can never
// invent one, which is the same fail-quiet posture as parseSpoiledDays.
export function normalizePreferences(map) {
  const out = {}
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out
  for (const field of FIELD_NAMES) {
    const entry = normalizeEntry(field, map[field])
    if (entry) out[field] = entry
  }
  return out
}

// Parse the raw localStorage value. Never throws — malformed JSON, an array, a
// string, a number all collapse to {} ("no opinion on anything"), which leaves
// every reader on its fallback.
export function parsePreferences(raw) {
  if (raw == null) return {}
  try {
    return normalizePreferences(JSON.parse(raw))
  } catch {
    return {}
  }
}

// Normalizes on the way out too, so nothing this app writes can be unreadable
// by the parser above.
export function serializePreferences(doc) {
  return JSON.stringify(normalizePreferences(doc))
}

// Do these two documents say the same thing? Field-wise, since an entry is two
// scalars — no deep walk needed and none wanted.
export function samePreferences(a, b) {
  const left = a && typeof a === 'object' && !Array.isArray(a) ? a : {}
  const right = b && typeof b === 'object' && !Array.isArray(b) ? b : {}
  const leftFields = FIELD_NAMES.filter((f) => left[f] != null)
  const rightFields = FIELD_NAMES.filter((f) => right[f] != null)
  if (leftFields.length !== rightFields.length) return false
  for (const field of rightFields) {
    const x = left[field]
    const y = right[field]
    if (!x || x.value !== y.value || x.updatedAt !== y.updatedAt) return false
  }
  return true
}

// Return the ORIGINAL object when the computed result says the same thing.
//
// Not a micro-optimisation — it is the contract every caller in the hook
// depends on. `commit` skips both the localStorage write and the re-render when
// a transform returns the same reference, and the remote pull runs on EVERY
// window focus. Without this, coming back to the tab would rewrite storage and
// repaint the slate for a document that had not changed at all.
// `next` is always already normalized, so an equal key COUNT is what proves the
// original carries no junk alongside its four legal fields — without that
// check, preserving would hand a caller back a document still holding an
// unknown key it had asked to have scrubbed.
function preserve(original, next) {
  if (!original || typeof original !== 'object' || Array.isArray(original)) return next
  if (Object.keys(original).length !== Object.keys(next).length) return next
  return samePreferences(original, next) ? original : next
}

// Set one field. Returns a NEW document, or the SAME one when nothing would
// change — callers rely on referential equality to skip a write and a render.
// An invalid field or value is a no-op rather than a throw: a caller that got
// it wrong should not be able to blank a user's settings.
export function setPreference(doc, field, value, { now } = {}) {
  const current = normalizePreferences(doc)
  if (!isValidValue(field, value)) return preserve(doc, current)
  const at = Number.isInteger(now) && now >= 0 ? now : 0
  return preserve(doc, { ...current, [field]: { value, updatedAt: at } })
}

// ---------------------------------------------------------------------------
// Migration from the three legacy single-purpose keys
// ---------------------------------------------------------------------------
// One-time, lossless, non-destructive. `legacy` is the RAW string each old key
// held (localStorage hands back strings), so the coercions live here rather
// than at the call site.
//
// Every seeded entry gets `updatedAt: 0` on purpose. It means "this device
// holds a value but has no clock for it", so ANY real value from any device
// wins the merge. A pre-existing local default must never overwrite a
// deliberate choice made on the phone — which is exactly what a `Date.now()`
// seed would have done, on every fresh install, forever.
//
// A field the document already has is left alone: the document outranks the
// legacy key, always, so a second call is a no-op.
export function seedFromLegacy(doc, legacy = {}) {
  const current = normalizePreferences(doc)
  const seeded = { ...current }

  const club = Number(legacy.club)
  if (!seeded.club && isValidValue('club', club)) {
    seeded.club = { value: club, updatedAt: 0 }
  }

  const level = Number(legacy.level)
  if (!seeded.level && isValidValue('level', level)) {
    seeded.level = { value: level, updatedAt: 0 }
  }

  // The old key stored '1' / '0' and treated anything else as off.
  if (!seeded.keepAwake && (legacy.keepAwake === '1' || legacy.keepAwake === '0')) {
    seeded.keepAwake = { value: legacy.keepAwake === '1', updatedAt: 0 }
  }

  // Referential equality when nothing was seeded, so the hook can skip a write.
  return preserve(doc, seeded)
}

// ---------------------------------------------------------------------------
// Cross-device sync (ADR-0022's stack, ADR-0026's per-key state shape)
// ---------------------------------------------------------------------------
// The reveal mark syncs with a monotonic ratchet because it only moves one way.
// A preference cannot: a club change is not "more" than the club before it. So
// the two sides reconcile PER FIELD on `updatedAt`, last write wins.
//
// Safe for a reason specific to this data, and it is the same reason ADR-0026
// gives for spoiled days: the only two writers are the same person's own two
// hands. There is no third party to race, and the loser of a tie is always one
// of the user's own taps.
//
// There is deliberately NO TOMBSTONE here. A preference cannot be "removed",
// only changed to another valid value, so the explicit-'off' machinery
// spoiledDays needs has no analogue — which is most of why preferences get
// their own module instead of being squeezed into the day-state map.

// Apply a remote document to the local one. A field the remote says nothing
// about is left exactly as it is: **absence means "no opinion", never
// "erase"**, or a fresh device with an empty document would tell every other
// device to forget the user's settings.
//
// Ties go to the INCOMING remote (`>=`), matching applyRemoteStamps, so a
// round trip is idempotent rather than oscillating between two equal clocks.
export function applyRemotePreferences(local, remote) {
  const out = normalizePreferences(local)
  const incoming = normalizePreferences(remote)
  for (const field of FIELD_NAMES) {
    const next = incoming[field]
    if (!next) continue
    const existing = out[field]
    if (!existing || next.updatedAt >= existing.updatedAt) out[field] = next
  }
  // Preserved when the merge changed nothing — which is the ordinary case, since
  // a pull runs on every window focus.
  return preserve(local, out)
}

// Replace the local document with a remote one outright. The `adopt` half of
// `mergeStrategyFor` — used when the local document belongs to a DIFFERENT
// account, where merging would publish one user's club to another's account.
export function adoptRemotePreferences(remote) {
  return normalizePreferences(remote)
}

// ---------------------------------------------------------------------------
// WHY THIS IS A COMPARISON AND NOT A CHANGE LOG — the backfill gap
// ---------------------------------------------------------------------------
// Verbatim the lesson ADR-0026's 2026-08-06 amendment records, and the reason
// `stampsToPublish` exists (src/lib/stamps.js, PR #545). A sync that publishes
// "whatever changed since the last state I saw" establishes a silent baseline on
// its first observation — so state that existed BEFORE sign-in registers as no
// change, publishes nothing, and never will. The owner's second device signs in
// to an empty account and the settings sit on one device forever.
//
// So the question a device asks is not "what did I just change?" but **"what do
// I have that the server doesn't?"** — answerable from the two documents alone,
// needing no history, and self-healing, since a publish lost to a dead network
// is simply found again by the next comparison.
//
// Do NOT "simplify" this back into a diff against the previous local value.
//
// `known` is what the SERVER said on the last pull. Strictly-newer, so a field
// that merely round-tripped is not republished on every render. A field seeded
// at `updatedAt: 0` still publishes when the server has nothing — which IS the
// guest-to-account backfill — and correctly loses to any value the server does
// have.
export function preferencesToPublish(local, known) {
  const mine = normalizePreferences(local)
  const theirs = normalizePreferences(known)
  const out = []
  for (const field of FIELD_NAMES) {
    const entry = mine[field]
    if (!entry) continue
    const remote = theirs[field]
    if (!remote || entry.updatedAt > remote.updatedAt) {
      out.push({ field, value: entry.value, updatedAt: entry.updatedAt })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// WHOSE DOCUMENT IS THIS? — the shared-device leak
// ---------------------------------------------------------------------------
// A local-first store plus an account is a leak waiting to happen on a shared
// device. User A signs in; their club syncs DOWN into localStorage with a real
// `updatedAt`. A signs out. B signs in — and the device now holds A's club as
// ordinary local state, which `preferencesToPublish` would happily push UP into
// B's account. B never chose it and A never shared it.
//
// So the device records WHICH ACCOUNT the local document was last merged from
// (PREFS_OWNER_KEY), and the strategy on sign-in follows from comparing it:
//
//   'backfill' — the document is this user's, or nobody's (a guest's own
//                settings, never synced). Merge remote in, then publish what
//                the server lacks. This is the ordinary path, and the one that
//                carries a guest's choices up to their new account.
//   'adopt'    — the document belongs to a DIFFERENT account. Take the remote
//                wholesale and publish nothing. B gets B's settings, or the
//                fallbacks, and A's club goes nowhere.
//   'none'     — not signed in. No remote to reconcile against.
//
// Note what `adopt` deliberately does NOT do: clear the document on sign-OUT.
// Local-first means the device keeps working with what it has, and a signed-out
// user is still a user. The owner tag is what protects the next account, not an
// erase.
export function mergeStrategyFor(owner, userId) {
  if (typeof userId !== 'string' || !userId) return 'none'
  if (typeof owner !== 'string' || !owner) return 'backfill'
  return owner === userId ? 'backfill' : 'adopt'
}

// ---------------------------------------------------------------------------
// Server-side only
// ---------------------------------------------------------------------------

// Bound a client-supplied clock. A value in the past is taken as-is (an old
// device catching up is legitimate); one further ahead than MAX_CLOCK_SKEW_MS
// is clamped to the server's own now rather than refused, so a user with a
// wrong system clock still keeps their setting. Anything not an integer, or
// negative, is clamped to now as well — a write with no usable clock is still
// a write the user made.
export function clampUpdatedAt(updatedAt, now) {
  const at = Number.isInteger(now) && now > 0 ? now : 0
  if (!Number.isInteger(updatedAt) || updatedAt < 0) return at
  return updatedAt > at + MAX_CLOCK_SKEW_MS ? at : updatedAt
}
