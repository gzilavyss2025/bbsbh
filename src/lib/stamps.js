// The Logbook — the per-user collection of game stamps (ADR-0035). React-free
// and dependency-free so every rule below can be pinned by the unit suite
// (test/stamps.test.js) and reused verbatim by the serverless function
// (api/stamps.js), which is the point: the client and the server must not be
// able to disagree about what a valid stamp is.
//
// A stamp is a commemorative mark for a game you watched, carrying that game's
// final score. That makes the Logbook the FIRST score-bearing thing this app
// stores — read ADR-0035 before changing anything here.
//
// This module used to export `meetsRevealGate`/`finalHalfIndex`, the predicate
// api/stamps.js ran server-side to refuse a stamp for a game the user could not
// be PROVEN to have finished revealing. Both were removed in ADR-0035's second
// amendment. What keeps the Logbook from spoiling anything is where stamp art
// may render — `scripts/check-stamp-surfaces.mjs` and its runtime half
// `e2e/invariants/logbook-stamp.spec.js` — which is untouched. The gate refused
// the ordinary flow (the mint affordance sits inside a `SealBox` that
// deliberately persists nothing, so it left no mark to prove) while defending
// only against a hostile client, which on a single-user app is the user
// spoiling a game they went out of their way to stamp.
//
// What this module deliberately does NOT hold: the score. A local stamp record
// is `{ state, mode, stampedAt, updatedAt, note, date, placement }` — no runs,
// no result, no winner. (`placement` is where the stamp sits in the passport
// book: a page number and two fractions. A picture, not an outcome.) The
// Logbook resolves the score from the game facts at render time — from Redis
// when signed in, from statsapi when not — so localStorage stays exactly as
// non-score-bearing as `bbsbh:reveal:{gamePk}` already is.

export const STAMPS_KEY = 'bbsbh:stamps'

// A full MLB season is 2,430 games. 500 is generous for any real human and
// bounds a hostile client; see `seasonIsFull` for why the cap REFUSES rather
// than prunes.
export const MAX_STAMPS_PER_SEASON = 500

// Long enough for a real memory ("Dad's first game at County Stadium"), short
// enough that the stamp art can render it and a hostile client can't use the
// Logbook as free storage.
export const MAX_NOTE_LENGTH = 140

// How you took the game in. Deliberately two, not three: "attended" was scoped
// and cut for v1 (see the PRD's open questions) because it wants its own mark on
// the stamp art, and adding an enum value later is cheap while un-shipping a
// half-drawn overprint is not. A stamp with an unknown mode normalizes to
// 'watched' rather than being dropped — the mode is flavour, the stamp is the
// keepsake.
export const STAMP_MODES = ['watched', 'followed']
export const DEFAULT_STAMP_MODE = 'watched'

export function isStampMode(value) {
  return STAMP_MODES.includes(value)
}

// 'on' | 'off' — the same state-map vocabulary as spoiledDays.js, and for the
// same reason. See `applyRemoteStamps`.
export function isStampState(value) {
  return value === 'on' || value === 'off'
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// The one date shape the whole app shares (toApiDate in dates.js, the feed's
// officialDate). Anything else is not a day this app can be looking at.
export function isDayString(value) {
  return typeof value === 'string' && DAY_RE.test(value)
}

// A gamePk as a positive integer, from either a number or the string a Redis
// hash field / URL query hands back. Null for anything else, so a caller can
// never end up keyed on 'NaN' or an empty string.
export function toGamePk(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Seasons this app could plausibly be storing. Bounds the season shard key so a
// hostile client can't spray Redis with `stamps:{user}:{anything}`.
export function isSeasonNumber(value) {
  return Number.isInteger(value) && value >= 1876 && value <= 2200
}

// Which season shard a game belongs in. Derived from the game's own date rather
// than stored separately, so the two can't drift.
export function seasonFromDate(date) {
  if (!isDayString(date)) return null
  const season = Number(date.slice(0, 4))
  return isSeasonNumber(season) ? season : null
}

// Notes are user-authored and round-trip through Redis, so they get the same
// defensive treatment as api/reveal.js's sanitizeSnapshot: strip control
// characters (including the newlines the stamp art has nowhere to put),
// collapse runs of whitespace, then cap. Never null — an unusable note becomes
// '', which is the same as not having one.
export function sanitizeNote(value) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const flat = value.replace(/[\u0000-\u001f\u007f]/g, ' ')
  return flat.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LENGTH)
}

// ---------------------------------------------------------------------------
// Placement — where a stamp sits in the passport book
// ---------------------------------------------------------------------------
// `{ page, x, y, tilt }`, with x/y as FRACTIONS of the page box (the stamp's
// centre) and tilt in degrees. Fractions rather than pixels is the whole
// reason a book arranged on a phone reads correctly on a laptop — and the
// reason a placement is worth syncing at all.
//
// Note what this adds to the per-user record: a page number and two fractions.
// Nothing score-bearing, so the record stays on exactly the same footing as
// `revealedThrough` (ADR-0035's central claim), and a hostile client that
// forges one has moved a picture, not minted a score.
//
// The geometry itself — capacity, margins, tilt range — lives in
// src/lib/passportLayout.js. Only the BOUNDS are restated here, because this
// module is bundled into the serverless function and has no business pulling
// the layout module in behind it (same reasoning as `halfIndexOf` above).
export const MAX_PLACEMENT_PAGE = 60
export const MAX_PLACEMENT_TILT = 7

export function normalizePlacement(raw) {
  if (!raw || typeof raw !== 'object') return null
  const page = Number(raw.page)
  if (!Number.isInteger(page) || page < 1 || page > MAX_PLACEMENT_PAGE) return null
  const x = Number(raw.x)
  const y = Number(raw.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const rawTilt = Number(raw.tilt)
  const tilt = Number.isFinite(rawTilt)
    ? Math.max(-MAX_PLACEMENT_TILT, Math.min(MAX_PLACEMENT_TILT, rawTilt))
    : 0
  const clamp01 = (n) => Math.max(0, Math.min(1, n))
  // Rounded so a placement round-tripping through JSON and two devices can't
  // drift by a float epsilon and read as a change worth republishing.
  const round = (n) => Math.round(n * 10000) / 10000
  return { page, x: round(clamp01(x)), y: round(clamp01(y)), tilt: Math.round(tilt * 100) / 100 }
}

// Whether two placements are the same spot — used by the sync diff, which must
// not republish a stamp whose placement merely round-tripped.
export function samePlacement(a, b) {
  if (!a || !b) return !a && !b
  return a.page === b.page && a.x === b.x && a.y === b.y && a.tilt === b.tilt
}

// ---------------------------------------------------------------------------
// The local store
// ---------------------------------------------------------------------------

// One stamp record, validated. Returns null for anything that isn't one, so a
// hand-edited or cross-version entry is dropped rather than half-read.
//
// `stampedAt` and `updatedAt` are deliberately two clocks. `stampedAt` is the
// keepsake's own date — when you first stamped the game — and re-stamping to
// change a note must not move it. `updatedAt` is the sync clock that decides
// last-write-wins in `applyRemoteStamps`, and it moves on every change
// INCLUDING an un-stamp; a single field could not do both, because an un-stamp
// would either lose the keepsake's date or fail to propagate.
export function normalizeStamp(raw) {
  if (!raw || typeof raw !== 'object') return null
  const state = isStampState(raw.state) ? raw.state : 'on'
  const date = isDayString(raw.date) ? raw.date : ''
  const stampedAt = Number.isInteger(raw.stampedAt) && raw.stampedAt > 0 ? raw.stampedAt : 0
  const updatedAt =
    Number.isInteger(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : stampedAt
  if (!stampedAt) return null
  return {
    state,
    mode: isStampMode(raw.mode) ? raw.mode : DEFAULT_STAMP_MODE,
    stampedAt,
    updatedAt,
    note: sanitizeNote(raw.note),
    date,
    // Where this stamp sits in the passport book, or null for "not placed
    // yet" — an unplaced stamp waits in the book's tray. An unreadable
    // placement degrades to null (back to the tray) rather than invalidating
    // the record: the keepsake outranks its position on a page.
    placement: normalizePlacement(raw.placement),
  }
}

// Valid entries only, keyed by gamePk. Over-cap seasons keep the newest
// `MAX_STAMPS_PER_SEASON` — that path is unreachable through `addStamp`, which
// refuses at the cap rather than pruning (a keepsake must never vanish on its
// own); it exists only so a hand-written oversized value is still bounded.
function normalizeAll(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {}
  const bySeason = new Map()
  for (const [key, value] of Object.entries(map)) {
    const gamePk = toGamePk(key)
    if (gamePk == null) continue
    const entry = normalizeStamp(value)
    if (!entry) continue
    const season = seasonFromDate(entry.date) ?? 0
    if (!bySeason.has(season)) bySeason.set(season, [])
    bySeason.get(season).push([gamePk, entry])
  }
  const out = {}
  for (const entries of bySeason.values()) {
    entries
      .sort((a, b) => b[1].stampedAt - a[1].stampedAt)
      .slice(0, MAX_STAMPS_PER_SEASON)
      .forEach(([gamePk, entry]) => {
        out[gamePk] = entry
      })
  }
  return out
}

// Parse the raw localStorage value. Never throws — malformed JSON, an array, a
// stray number all collapse to {} ("no stamps"), which loses a collection but
// can never invent one. Same fail-empty posture as parseSpoiledDays.
export function parseStamps(raw) {
  if (raw == null) return {}
  try {
    return normalizeAll(JSON.parse(raw))
  } catch {
    return {}
  }
}

// The value to hand localStorage. Normalizes on the way out too, so nothing the
// reader above would reject can be written by this app.
export function serializeStamps(map) {
  return JSON.stringify(normalizeAll(map))
}

// The live stamp for a game, or null. Tombstoned ('off') entries answer null —
// callers ask "is this stamped", and a tombstone means it is not.
export function stampFor(map, gamePk) {
  const pk = toGamePk(gamePk)
  if (pk == null) return null
  const entry = map?.[pk]
  return entry && entry.state === 'on' ? entry : null
}

export function isStamped(map, gamePk) {
  return stampFor(map, gamePk) != null
}

// Every live stamp in a season, newest game first.
export function stampsForSeason(map, season) {
  return Object.entries(map || {})
    .map(([pk, entry]) => [toGamePk(pk), entry])
    .filter(([pk, entry]) => pk != null && entry?.state === 'on' && seasonFromDate(entry.date) === season)
    .sort((a, b) => (b[1].date > a[1].date ? 1 : b[1].date < a[1].date ? -1 : b[1].stampedAt - a[1].stampedAt))
    .map(([gamePk, entry]) => ({ gamePk, ...entry }))
}

// Every live stamp, across every season, OLDEST game first — the order a
// passport book fills in, which is why it is the opposite of
// `stampsForSeason`'s newest-first grid order. Doubleheaders and same-day
// stamps settle on `stampedAt` so the order is total and stable.
export function allStamps(map) {
  return Object.entries(map || {})
    .map(([pk, entry]) => [toGamePk(pk), entry])
    .filter(([pk, entry]) => pk != null && entry?.state === 'on')
    .sort((a, b) =>
      a[1].date < b[1].date ? -1 : a[1].date > b[1].date ? 1 : a[1].stampedAt - b[1].stampedAt,
    )
    .map(([gamePk, entry]) => ({ gamePk, ...entry }))
}

// { season: count } over live stamps only — the Logbook's season nav.
export function seasonCounts(map) {
  const out = {}
  for (const entry of Object.values(map || {})) {
    if (entry?.state !== 'on') continue
    const season = seasonFromDate(entry.date)
    if (season == null) continue
    out[season] = (out[season] ?? 0) + 1
  }
  return out
}

// At the cap, `addStamp` is a no-op — so a caller has to be able to say WHY
// rather than showing a button that silently does nothing.
export function seasonIsFull(map, season) {
  return (seasonCounts(map)[season] ?? 0) >= MAX_STAMPS_PER_SEASON
}

// Stamp a game. Returns a NEW map; the input is never mutated.
//
// Idempotent by design: re-stamping a game already in the collection updates
// its mode and note and bumps `updatedAt`, but keeps the original `stampedAt`.
// Re-stamping a tombstoned game revives it with a FRESH `stampedAt` — you
// un-stamped it, so the old date is not the date of this keepsake.
//
// This function checks no permission of any kind, and never did. Reaching a
// caller at all means the user tapped the mint affordance inside a revealed box
// score; the only server-side refusal left is "that game isn't Final yet"
// (`mintRefusal`, api/stamps.js).
export function addStamp(map, gamePk, { mode, note, date, now, placement } = {}) {
  const current = normalizeAll(map)
  const pk = toGamePk(gamePk)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  if (pk == null || !isDayString(date) || !at) return current
  const season = seasonFromDate(date)
  const existing = current[pk]
  const reviving = !existing || existing.state === 'off'
  if (reviving && season != null && seasonIsFull(current, season)) return current
  const asked = normalizePlacement(placement)
  return {
    ...current,
    [pk]: {
      state: 'on',
      mode: isStampMode(mode) ? mode : DEFAULT_STAMP_MODE,
      stampedAt: reviving ? at : existing.stampedAt,
      updatedAt: at,
      note: sanitizeNote(note),
      date,
      // Editing a note must not knock the stamp off the page it was placed
      // on, so an existing placement is kept unless the caller names a new
      // one. Reviving a tombstone starts unplaced — you un-stamped it, so
      // where it used to sit is not where this keepsake belongs.
      placement: asked ?? (reviving ? null : existing.placement),
    },
  }
}

// Place a stamp in the book (or move one already placed). A no-op for a game
// that isn't live-stamped — you cannot place a keepsake you don't hold.
//
// Bumps `updatedAt`, so a placement propagates to the user's other devices by
// exactly the same last-write-wins path every other change takes. Deliberately
// NOT a separate sync channel: the book is part of the collection.
export function placeStamp(map, gamePk, placement, { now } = {}) {
  const current = normalizeAll(map)
  const pk = toGamePk(gamePk)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  const existing = pk == null ? null : current[pk]
  if (!existing || existing.state !== 'on' || !at) return current
  const next = normalizePlacement(placement)
  if (!next) return current
  if (samePlacement(existing.placement, next)) return current
  return { ...current, [pk]: { ...existing, placement: next, updatedAt: at } }
}

// Take a placed stamp back off the page — the "re-stamp the page" half of the
// placement flow. The stamp itself survives; it returns to the tray.
export function unplaceStamp(map, gamePk, { now } = {}) {
  const current = normalizeAll(map)
  const pk = toGamePk(gamePk)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  const existing = pk == null ? null : current[pk]
  if (!existing || existing.state !== 'on' || !at || !existing.placement) return current
  return { ...current, [pk]: { ...existing, placement: null, updatedAt: at } }
}

// Apply a whole batch of placements at once — the book's "place them all for
// me" control, and what an upgrading collection needs so nobody is made to
// place forty keepsakes by hand. Takes the `[{ gamePk, placement }]` shape
// `autoLayout` (src/lib/passportLayout.js) returns.
export function placeStamps(map, placements, { now } = {}) {
  let out = normalizeAll(map)
  for (const { gamePk, placement } of placements ?? []) {
    out = placeStamp(out, gamePk, placement, { now })
  }
  return out
}

// Un-stamp. Writes an explicit 'off' tombstone rather than deleting the key —
// see `applyRemoteStamps` for why deletion would resurrect the stamp on the
// next sync. A game that was never stamped stays absent (nothing to take back).
export function removeStamp(map, gamePk, { now } = {}) {
  const current = normalizeAll(map)
  const pk = toGamePk(gamePk)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  const existing = pk == null ? null : current[pk]
  if (!existing || !at) return current
  return { ...current, [pk]: { ...existing, state: 'off', updatedAt: at } }
}

// ---------------------------------------------------------------------------
// Cross-device sync (ADR-0022's stack, ADR-0026's shape)
// ---------------------------------------------------------------------------
// The reveal mark syncs with a monotonic ratchet because it only moves one way.
// A stamp collection cannot: a stamp is REMOVABLE, and that is deliberate —
// it's a keepsake, not a spoiler mark, so there is no ratchet here (the one
// place the Logbook differs in character from revealedThrough).
//
// A plain union merge would therefore be wrong in the same specific way it is
// wrong for spoiled days: stamp on the phone, sync, un-stamp on the phone, and
// the next fetch unions the server's stale 'on' straight back in, silently
// undoing the removal. So a removal is published as an explicit 'off' and the
// two sides reconcile per gamePk on `updatedAt`, last write wins.
//
// Safe for a reason specific to this data: a stamp only ever changes by a
// deliberate tap on one of THIS user's own devices. There is no third party to
// race, and the loser of a tie is always one of the user's own two taps.
export function applyRemoteStamps(local, remote) {
  const out = normalizeAll(local)
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return out
  for (const [key, value] of Object.entries(remote)) {
    const pk = toGamePk(key)
    if (pk == null) continue
    const incoming = normalizeStamp(value)
    if (!incoming) continue
    const existing = out[pk]
    if (!existing || incoming.updatedAt >= existing.updatedAt) out[pk] = incoming
  }
  return normalizeAll(out)
}

// Are these the same record? Every field a device can change, compared. Used by
// the sync diff below so a record that merely round-tripped through JSON isn't
// republished.
export function sameStampRecord(a, b) {
  if (!a || !b) return !a && !b
  return (
    a.state === b.state &&
    a.mode === b.mode &&
    a.note === b.note &&
    a.stampedAt === b.stampedAt &&
    a.updatedAt === b.updatedAt &&
    samePlacement(a.placement, b.placement)
  )
}

// Which of this device's stamps the OTHER side doesn't have, or has an older
// version of — the list StampsCloudSync publishes.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A COMPARISON AND NOT A CHANGE LOG — the backfill gap
// ---------------------------------------------------------------------------
// The sync used to publish "whatever changed since the last thing I observed",
// with the first observation establishing a silent baseline. That is correct for
// every change made from then on, and wrong for the collection that already
// existed: a phone holding forty stamps signs in, sets its baseline, sees no
// change, and publishes nothing — forever. Its owner's laptop then signs into
// the same account and finds an empty Logbook, because nothing was ever
// uploaded. Stamping something new on the laptop doesn't help either: that
// publishes fine, but the phone's forty are still only on the phone.
//
// (The reveal mark never had this problem — RevealCloudSync posts whenever the
// local mark is at all advanced, so a pre-existing mark backfills on its own.
// A collection is not one integer, so it needs the comparison below.)
//
// So the question a device asks is not "what did I just change?" but "what do I
// have that the server doesn't?" — which is answerable from the two collections
// alone, needs no history, and is self-healing: a publish lost to a dead network
// is simply found again by the next comparison.
//
// The three ways a local record earns a publish:
//   - the remote has never heard of it (an un-backfilled collection, or a stamp
//     minted while offline),
//   - the remote's copy is older (this device edited it last),
//   - the two claim the same `updatedAt` but disagree on content (two changes
//     inside one millisecond — vanishingly rare, and cheaper to publish than to
//     reason about).
// A remote record that is NEWER is deliberately absent: `applyRemoteStamps` has
// already taken it, and re-publishing it would just echo the server to itself.
export function stampsToPublish(local, remote) {
  const mine = normalizeAll(local)
  const theirs = normalizeAll(remote)
  const out = []
  for (const [key, entry] of Object.entries(mine)) {
    const before = theirs[key]
    if (before && before.updatedAt > entry.updatedAt) continue
    if (sameStampRecord(before, entry)) continue
    out.push(Number(key))
  }
  return out.sort((a, b) => a - b)
}
