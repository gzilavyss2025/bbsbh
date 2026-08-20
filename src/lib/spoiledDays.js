// The set of days the user has consented to spoil — the durable half of the
// Scores Unlocked pass (ADR-0026). React-free and dependency-free so the parse
// rules can be pinned by the unit suite (test/spoiled-days.test.js).
//
// Why this exists at all: the pass used to be purely ephemeral — 8am came and
// every score sealed back up, including the ones you had spent the evening
// looking at. That was a fiction. If you flipped the switch on Tuesday because
// you were at the ballpark and wanted the out-of-town scores, Tuesday is spoiled;
// pretending on Wednesday morning that you might still hand-score those games is
// pretending. So the 8am reset no longer means "everything re-seals" — it means
// "the pass stops applying to NEW days". A day you consented to stays open.
//
// The load-bearing property: this is a set of DATES, never a reveal mark. It
// never touches `revealedThrough` (see revealProgressCore.js), so a day being
// spoiled cannot corrupt, advance, or cloud-sync the high-water mark that records
// what you actually uncovered by hand. The two live side by side: the mark says
// what you scored, this says which days you agreed to see plainly.
//
// It grows ONLY by explicit consent, and every parse failure collapses to the
// empty set — the same fail-sealed posture as parseRevealMark. A garbled value
// can lose you a day's consent (harmless — consent again) but can never invent
// one.

export const SPOILED_DAYS_KEY = 'bbsbh:spoiledDays'

// ---------------------------------------------------------------------------
// WHOSE CONSENT IS THIS? — the shared-device leak
// ---------------------------------------------------------------------------
// The day list is keyed by nothing but itself — no account — and nothing cleared
// it on sign-out. So on a family iPad: A consents to spoil a day, the list syncs
// down and stays after A signs out (local-first, by design); B signs in, and
// the slate renders that whole day of baseball PLAINLY for B, while
// `dayStatesToPublish` reports each of A's days as missing from B's account and
// publishes them there.
//
// Consent is the one thing in this app that must never be inherited. ADR-0026's
// whole argument for the pass is that it is opt-in and given by the person
// looking at the screen; a consent that arrives because someone else used this
// browser is not consent at all.
//
// Nulling the sync component's in-memory baseline on sign-out does not prevent
// it — that guards a STALE baseline, while here the baseline is perfectly good
// and belongs to the new user. So the device records which account the list was
// last held for, and `mergeStrategyFor` (src/lib/account/preferences.js) reads
// it back. Its own key, not a shared one: the channels sync independently, and a
// device that reached one endpoint but not another must not be recorded as
// holding both.
//
// `adopt` here is simply the empty list — a consent B has not given. The
// ordinary pull then merges in the days B DID consent to on another device, so
// nothing of B's own is lost by starting from nothing.
export const SPOILED_DAYS_OWNER_KEY = 'bbsbh:spoiledDaysOwner'

// A generous ceiling on how many days we keep. Each entry is ~12 bytes, so even
// the cap is a rounding error in localStorage; it exists so a runaway writer can
// never grow the value without bound. Two full seasons of daily use.
export const MAX_SPOILED_DAYS = 400

// The exact shape toApiDate (src/lib/dates.js) produces and the feed's
// `officialDate` carries — the one date vocabulary the whole app shares. Anything
// else is not a day this app can be looking at, so it is dropped rather than
// stored and later matched against nothing.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDayString(value) {
  return typeof value === 'string' && DAY_RE.test(value)
}

// Valid shapes only, deduped, newest first, capped. Newest-first is what makes
// the cap meaningful: if the list ever exceeds it, the entries dropped are the
// oldest, which are the least likely to still matter. Lexicographic sort IS
// chronological for YYYY-MM-DD — part of why the app standardized on that shape.
function normalize(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  for (const entry of list) {
    if (isDayString(entry)) seen.add(entry)
  }
  return [...seen].sort().reverse().slice(0, MAX_SPOILED_DAYS)
}

// Parse the raw localStorage value into a normalized day list. Never throws —
// malformed JSON, a non-array, a nested object, a stray number all collapse to []
// ("nothing spoiled"), which leaves every day sealed.
export function parseSpoiledDays(raw) {
  if (raw == null) return []
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return []
  }
}

// The value to hand localStorage. Normalizes on the way out too, so nothing
// unparseable by the reader above can ever be written by this app.
export function serializeSpoiledDays(days) {
  return JSON.stringify(normalize(days))
}

// Is this date one the user has agreed to see plainly? The single predicate every
// reader goes through. A malformed or absent date argument is NOT spoiled — a
// caller that can't say which day it is must not get an unsealed answer.
export function isDaySpoiled(days, dateStr) {
  if (!isDayString(dateStr)) return false
  return Array.isArray(days) && days.includes(dateStr)
}

// Record a day's consent. Returns a NEW normalized list; a day already present or
// a malformed date is a no-op, so callers can add freely without checking first.
export function addSpoiledDay(days, dateStr) {
  const current = Array.isArray(days) ? days : []
  if (!isDayString(dateStr)) return normalize(current)
  return normalize([dateStr, ...current])
}

// Take a day's consent back. This is what makes an accidental tap recoverable:
// turning the pass off the same day removes that day again, so a misfire on the
// consent button costs nothing. Only reachable while the day in question is still
// "today" — once the pass expires at 8am no caller passes yesterday's date here,
// which is exactly how a day becomes permanent.
export function removeSpoiledDay(days, dateStr) {
  const current = Array.isArray(days) ? days : []
  return normalize(current.filter((d) => d !== dateStr))
}

// ---------------------------------------------------------------------------
// Cross-device sync (ADR-0022's companion; see SpoiledDaysCloudSync.jsx)
// ---------------------------------------------------------------------------
// The reveal mark syncs with a monotonic ratchet — max(local, remote) — because
// it can only ever move one way. A day SET cannot use that shape. A plain union
// would be monotonic too, but it would resurrect a day the user just took back:
// consent on the phone, sync, undo on the phone, and the next fetch unions the
// server's stale "on" straight back in, silently reversing the undo. That is the
// one thing the same-day undo exists to prevent.
//
// So the wire format is a per-day STATE map — { 'YYYY-MM-DD': 'on' | 'off' } —
// not a set. An explicit 'off' propagates a withdrawal the way an explicit 'on'
// propagates a consent, and last write wins per day. That is safe here for a
// reason specific to this data: a day is only ever mutable while it is "today"
// on some device, so the only rows that can disagree are today's, and any
// disagreement self-heals the next time the user touches the switch. Every past
// day is frozen — no client writes it again — so those rows converge and stay.
//
// Note the direction of the risk: an 'on' can only ever originate from a real
// consent tap on some device of this user's, and an 'off' only ever re-seals.
// Neither state can unseal a day the user never agreed to.
export function isDayState(value) {
  return value === 'on' || value === 'off'
}

// Apply a remote state map to the local day list. Unknown days, malformed keys
// and malformed states are ignored, so a garbled server response degrades to
// "no change" rather than to a wrong answer. A day the server says nothing about
// is left exactly as it is locally.
export function applyRemoteStates(days, remote) {
  let out = Array.isArray(days) ? [...days] : []
  if (!remote || typeof remote !== 'object') return normalize(out)
  for (const [day, state] of Object.entries(remote)) {
    if (!isDayString(day) || !isDayState(state)) continue
    if (state === 'on') out.push(day)
    else out = out.filter((d) => d !== day)
  }
  return normalize(out)
}

// The state map this device would publish for the days it knows about. Only days
// present locally are reported as 'on'; a withdrawal is posted as its own
// explicit 'off' at the moment it happens (see the hook), not inferred from
// absence — absence has to keep meaning "no opinion", or a fresh device with an
// empty list would tell the server to erase every day the user ever consented to.
export function statesFromDays(days) {
  const out = {}
  for (const day of normalize(days)) out[day] = 'on'
  return out
}

// ---------------------------------------------------------------------------
// WHY THIS IS A COMPARISON AND NOT A CHANGE LOG — the backfill gap
// ---------------------------------------------------------------------------
// SpoiledDaysCloudSync used to publish "whatever changed since the last list I
// observed", with the first observation establishing a silent baseline. That is
// correct for every change made from then on, and wrong for the consent that
// already existed: a phone holding a month of spoiled days signs in, sets its
// baseline, sees no change, and publishes nothing — forever. Its owner's laptop
// then signs into the same account and finds an empty map. Consenting to a NEW
// day doesn't help either: that one day publishes fine, and the month behind it
// is still only on the phone.
//
// (The reveal mark never had this problem — RevealCloudSync posts whenever the
// local mark is at all advanced, so a pre-existing mark backfills on its own. A
// day list is not one integer, so it needs the comparison below. `stampsToPublish`
// in src/lib/stamps.js is the same fix for the same defect; read its header.)
//
// So the question a device asks is not "what did I just change?" but "what do I
// have that the server doesn't?" — answerable from the two maps alone, needing no
// history, and self-healing: a publish lost to a dead network is simply found
// again by the next comparison.
//
// `previous` — this device's list as of the last time it looked — is the ONE
// thing the comparison can't supply, and it buys exactly one row type: the
// explicit 'off'. A withdrawal cannot be inferred from absence, because absence
// on the wire has to keep meaning "no opinion" (see `statesFromDays`); a day this
// device is merely ignorant of and a day it deliberately took back look
// identical from the local list alone. So an 'off' is published only where BOTH
// are true — this device held the day and no longer does, AND the server still
// says 'on' — which is precisely the stale row a withdrawal exists to reverse.
// A day dropped by the merge (the server itself said 'off') is therefore not
// echoed back, and a caller with no `previous` publishes no removals at all.
//
// Returns the `{ day, state }` rows api/spoiled-days.js takes, one per POST,
// ordered oldest first so a publish reads chronologically in a network log.
export function dayStatesToPublish(days, remote, previous = null) {
  const mine = normalize(days)
  const theirs = remote && typeof remote === 'object' && !Array.isArray(remote) ? remote : {}
  const out = []
  for (const day of mine) {
    if (theirs[day] !== 'on') out.push({ day, state: 'on' })
  }
  if (previous != null) {
    const held = new Set(mine)
    for (const day of normalize(previous)) {
      if (!held.has(day) && theirs[day] === 'on') out.push({ day, state: 'off' })
    }
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}
