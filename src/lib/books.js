// Multiple named Game Log passport books (ADR-0036 gave the Logbook a single
// book; this module is the foundation for letting a user hold several). React-
// free and dependency-free, mirroring src/lib/stamps.js's own posture exactly,
// so the rules here can be pinned by the unit suite (test/books.test.js) and —
// if a later phase needs it server-side, the way stamps.js is bundled into
// api/stamps.js — reused verbatim without dragging React along.
//
// A book is a COVER, not a collection. It never holds the stamps that are
// filed in it — those live in src/lib/stamps.js's per-gamePk records, each
// carrying its own `bookId` (see the restated constant and the `bookId` field
// added to `normalizePlacement` there). This module only tracks which named
// books exist: `{ id, state, title, subtitle, coverTeamId, coverMark,
// coverColor, createdAt, updatedAt }`. Nothing score-bearing, same footing as a stamp's own record —
// a book's name and cover club are a picture, not a result.
//
// `title`/`subtitle` are allowed to be '' — that is a valid, meaningful value
// ("use the default word — 'Game Log', the favourite club — at render time"),
// never something this module invents on a record's behalf. Only the
// component that renders a book decides what an empty title displays as.

export const BOOKS_KEY = 'bbsbh:books'

// ---------------------------------------------------------------------------
// WHOSE SHELF IS THIS? — the shared-device leak
// ---------------------------------------------------------------------------
// A local-first shelf plus an account leaks on a family iPad. User A signs in,
// their books sync DOWN into `bbsbh:books`, A signs out, B signs in. The device
// still holds A's books as ordinary local state, and `booksToPublish` — which
// asks "what do I have that the server doesn't?" — finds every one of them
// missing from B's remote and pushes A's shelf UP into B's ACCOUNT. B never
// made those books and A never shared them.
//
// Nulling the in-memory baseline on sign-out does not stop it. That only
// prevents a publish against a STALE baseline; the next pull hands over a
// perfectly good baseline that happens to belong to the NEW user, while the
// shelf on disk still belongs to the old one. Only knowing WHOSE shelf this is
// stops it, so the device records the account it last merged from and
// `mergeStrategyFor` (src/lib/account/preferences.js) reads it back.
//
// Its own key, not the preferences or stamps one: the channels sync
// independently, and a device that reached one endpoint but not another must
// not be recorded as holding this user's books.
export const BOOKS_OWNER_KEY = 'bbsbh:booksOwner'

// The one book every collection starts with, before this feature existed and
// after it: the id `useBooks.js` synthesizes on first mount so a pre-existing
// single collection always lands somewhere, and `books` is never empty.
export const DEFAULT_BOOK_ID = 'default'

// Generous for a hobby this app assumes is "which games did I go to", and a
// bound on a hostile client the same way MAX_STAMPS_PER_SEASON is: a cap that
// REFUSES rather than prunes, so a book is never silently dropped to make room.
export const MAX_BOOKS = 20

// Short enough to sit on a passport cover without wrapping, generous enough for
// "Dad and me" or "2026 road trip".
export const MAX_BOOK_TITLE_LENGTH = 24
export const MAX_BOOK_SUBTITLE_LENGTH = 30

// What is stamped on a cover's crest, and — for a league mark — which of the
// house boards it is stamped on.
//
// 'team' is the only thing a cover could carry before the picker shipped, so
// it is the default for BOTH a record that predates these fields and a value
// this module refuses. That default is what makes ADR-0041's "every
// pre-existing collection lands in one book" survive: a book with neither
// field set reads back as a club crest on club colours, which is exactly what
// it already drew.
//
// `coverColor` belongs to a LEAGUE-mark cover: a club cover takes its board
// from the club (teamChipColors, PassportCover.jsx), so it leaves this null
// rather than carrying a second, ignored opinion about colour.
export const COVER_MARKS = ['team', 'mlb', 'milb']
export const COVER_COLORS = ['kraft', 'red', 'blue']

const BOOK_ID_RE = /^[a-z0-9-]+$/i

// A book id as this app mints and reads them: a short slug, never empty, never
// long enough to be someone pasting arbitrary text into a URL. Case-insensitive
// so a hand-typed id and a generated one are held to the same rule.
export function isBookId(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64 && BOOK_ID_RE.test(value)
}

// A fresh id for a new book. Time-based prefix keeps ids roughly sortable and
// collision-proof across a single device's session; the random suffix is what
// actually prevents a collision between two books created in the same
// millisecond (two taps of "new book" in a row). Always satisfies isBookId:
// Date.now()/Math.random() base-36 strings are already `[0-9a-z]+`, and the
// leading `b` guarantees the result can never be empty or all-digits-look-alike
// with a gamePk if the two ever end up in the same log line.
export function genBookId() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// 'on' | 'off' — the same state-map vocabulary as stamps.js and spoiledDays.js,
// and for the same reason: see `applyRemoteBooks` for why a book is removed by
// tombstone rather than by deleting the key.
export function isBookState(value) {
  return value === 'on' || value === 'off'
}

// Titles and subtitles are user-authored and round-trip through sync, so they
// get the same defensive treatment as stamps.js's sanitizeNote: strip control
// characters, collapse whitespace runs, trim, then cap. Never null -- an
// unusable value becomes empty, which is the same as "not set". Control
// characters are stripped by code-point comparison rather than a regex escape
// range, so this source file never has to carry a raw control byte to
// describe one.
function stripControlChars(value) {
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    out += code <= 0x1f || code === 0x7f ? ' ' : value[i]
  }
  return out
}

export function sanitizeBookTitle(value) {
  if (typeof value !== 'string') return ''
  return stripControlChars(value).replace(/\s+/g, ' ').trim().slice(0, MAX_BOOK_TITLE_LENGTH)
}

export function sanitizeBookSubtitle(value) {
  if (typeof value !== 'string') return ''
  return stripControlChars(value).replace(/\s+/g, ' ').trim().slice(0, MAX_BOOK_SUBTITLE_LENGTH)
}

// Both fail CLOSED to the default rather than to null-with-a-shrug: these two
// values are read straight into a rendered class name and a CSS custom
// property, so an unrecognised one must never survive the store.
export function sanitizeCoverMark(value) {
  return COVER_MARKS.includes(value) ? value : 'team'
}

export function sanitizeCoverColor(value) {
  return COVER_COLORS.includes(value) ? value : null
}

// One book record, validated. Returns null for anything that isn't one, so a
// hand-edited or cross-version entry is dropped rather than half-read — same
// "no timestamp, no record" posture as normalizeStamp: a book with no
// `createdAt` has no defensible position in "newest first" and is not a book
// this app minted.
export function normalizeBook(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!isBookId(raw.id)) return null
  const createdAt = Number.isInteger(raw.createdAt) && raw.createdAt > 0 ? raw.createdAt : 0
  if (!createdAt) return null
  const updatedAt = Number.isInteger(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : createdAt
  return {
    id: raw.id,
    state: isBookState(raw.state) ? raw.state : 'on',
    title: sanitizeBookTitle(raw.title),
    subtitle: sanitizeBookSubtitle(raw.subtitle),
    coverTeamId: Number.isInteger(raw.coverTeamId) && raw.coverTeamId > 0 ? raw.coverTeamId : null,
    coverMark: sanitizeCoverMark(raw.coverMark),
    coverColor: sanitizeCoverColor(raw.coverColor),
    createdAt,
    updatedAt,
  }
}

// Valid entries only, keyed by the book's OWN id — not by whatever key it sat
// under in the raw object. A record names itself (`normalizeBook` reads
// `raw.id`), so a mismatched outer key is corrected rather than trusted; that
// makes the store self-describing the way a stamp's record is not (a stamp
// leans on its gamePk key because it never repeats its own key inside itself).
function normalizeAllBooks(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {}
  const out = {}
  for (const value of Object.values(map)) {
    const entry = normalizeBook(value)
    if (!entry) continue
    out[entry.id] = entry
  }
  return out
}

// Parse the raw localStorage value. Never throws — malformed JSON, an array, a
// stray number all collapse to {} ("no books besides whatever useBooks.js
// synthesizes"), which loses nothing that can't be recreated except the books
// themselves, and can never invent a book that wasn't there.
export function parseBooks(raw) {
  if (raw == null) return {}
  try {
    return normalizeAllBooks(JSON.parse(raw))
  } catch {
    return {}
  }
}

// The value to hand localStorage. Normalizes on the way out too, so nothing
// the reader above would reject can be written by this app.
export function serializeBooks(map) {
  return JSON.stringify(normalizeAllBooks(map))
}

// Every LIVE book, newest-created first — the shelf's own reading order. Reads
// the map directly rather than re-normalizing: every mutator below already
// runs its result through normalizeAllBooks on the way out, so by the time a
// caller holds a map its entries are already valid (same posture as
// stamps.js's allStamps/seasonCounts, which trust addStamp's output the same
// way).
export function listBooks(map) {
  return Object.values(map || {})
    .filter((b) => b && b.state === 'on')
    .sort((a, b) => b.createdAt - a.createdAt)
}

// The live book with this id, or null. A tombstoned book answers null — a
// caller asking "does this book exist" should get "no" for one the user
// removed, the same way stampFor answers null for an un-stamped game.
export function bookFor(map, id) {
  if (!isBookId(id)) return null
  const entry = map?.[id]
  return entry && entry.state === 'on' ? entry : null
}

// Count of live books only — what MAX_BOOKS refusals check against. A
// tombstoned book costs nothing against the cap; removing a book is supposed
// to make room, not merely hide a book that still counts.
export function bookCount(map) {
  return Object.values(map || {}).filter((b) => b && b.state === 'on').length
}

// Create a new book. Returns a NEW map; the input is never mutated.
//
// A no-op — returning the input, normalized but otherwise untouched — for any
// of three reasons, checked without preference for one over another:
//   - the id is already taken, live OR tombstoned. Never silently overwrite an
//     existing book, and never silently resurrect a removed one: a caller that
//     wants a book back has to say so through a real "undo remove" affordance,
//     not by recreating the same id.
//   - the collection is already at MAX_BOOKS.
//   - `now` isn't a real timestamp, which would leave a book with no honest
//     position in "newest first" and nothing for `updatedAt` to sync on.
export function createBook(map, { id, title, subtitle, coverTeamId, coverMark, coverColor, now } = {}) {
  const current = normalizeAllBooks(map)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  if (!isBookId(id) || current[id] || !at || bookCount(current) >= MAX_BOOKS) return current
  return {
    ...current,
    [id]: {
      id,
      state: 'on',
      title: sanitizeBookTitle(title),
      subtitle: sanitizeBookSubtitle(subtitle),
      coverTeamId: Number.isInteger(coverTeamId) && coverTeamId > 0 ? coverTeamId : null,
      coverMark: sanitizeCoverMark(coverMark),
      coverColor: sanitizeCoverColor(coverColor),
      createdAt: at,
      updatedAt: at,
    },
  }
}

// Patch an existing LIVE book's cover — title, subtitle, cover club. Returns a
// NEW map. Only the fields actually PASSED (not `undefined`) change: a caller
// updating just the cover colour must not blank the title along the way, so
// this is a patch, not a replace. Bumps `updatedAt` on any real patch, which is
// what lets the change reach the user's other devices through the same
// last-write-wins path every other book change takes.
//
// A no-op if the book doesn't exist, is tombstoned (you cannot re-decorate a
// book you removed — bring it back first, through whatever the UI layer offers
// for that), or `now` isn't a real timestamp.
export function updateBookCover(map, id, { title, subtitle, coverTeamId, coverMark, coverColor, now } = {}) {
  const current = normalizeAllBooks(map)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  const existing = isBookId(id) ? current[id] : null
  if (!existing || existing.state !== 'on' || !at) return current
  const next = { ...existing, updatedAt: at }
  if (title !== undefined) next.title = sanitizeBookTitle(title)
  if (subtitle !== undefined) next.subtitle = sanitizeBookSubtitle(subtitle)
  if (coverTeamId !== undefined) {
    next.coverTeamId = Number.isInteger(coverTeamId) && coverTeamId > 0 ? coverTeamId : null
  }
  if (coverMark !== undefined) next.coverMark = sanitizeCoverMark(coverMark)
  if (coverColor !== undefined) next.coverColor = sanitizeCoverColor(coverColor)
  return { ...current, [id]: next }
}

// Remove a book. Returns a NEW map.
//
// TOMBSTONES (`state: 'off'`) rather than deleting the key. The reason is
// exactly stamps.js's removeStamp's reason, restated for this data: a second
// device that was offline when the removal happened must, on reconnect, learn
// that the book is gone — not have a plain union merge see its own still-live
// copy, notice the server never mentioned that id, and treat silence as "no
// opinion", quietly resurrecting a book its owner just took away on the other
// device. An explicit 'off' is the only shape that propagates a removal at
// all; deleting the key would make the removal indistinguishable from a book
// this device simply hasn't heard of yet.
//
// A no-op if the book doesn't exist, is already tombstoned, or `now` isn't a
// real timestamp.
//
// Deliberately does NOT refuse to remove the last live book, or DEFAULT_BOOK_ID
// specifically. "Never leave the user with zero books" is a UI-layer policy —
// it belongs to whatever screen offers the remove affordance, which can check
// bookCount() before it ever calls this — not to the pure store. Do not "fix"
// a zero-books UI state by adding a refusal here; that would make this module
// responsible for a product decision it has no way to know is still true.
export function removeBook(map, id, { now } = {}) {
  const current = normalizeAllBooks(map)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  const existing = isBookId(id) ? current[id] : null
  if (!existing || existing.state === 'off' || !at) return current
  return { ...current, [id]: { ...existing, state: 'off', updatedAt: at } }
}

// ---------------------------------------------------------------------------
// Cross-device sync
// ---------------------------------------------------------------------------
// A book is removable exactly like a stamp is, and for the same reason it is
// not a spoiler mark that only ever moves one way — it's a shelf the user
// arranges, so there is no ratchet here. A plain union merge would be wrong in
// the same specific shape it is wrong for stamps.js: create a book, sync,
// remove it, and the next fetch unions the server's stale 'on' straight back
// in, silently undoing the removal. So a removal publishes as an explicit
// 'off' and the two sides reconcile per id on `updatedAt`, last write wins.
//
// Safe for the same reason it's safe for stamps: a book only ever changes by a
// deliberate action on one of THIS user's own devices. There is no third party
// to race, and the loser of a tie is always one of the user's own two taps.
// Take the remote shelf WHOLESALE, discarding whatever this device held. The
// 'adopt' half of the shared-device guard (BOOKS_OWNER_KEY): when the local
// books belong to a different account, none of them are this user's to keep or
// to publish, so there is nothing to merge — B gets B's shelf, and A's books
// neither travel to B's account nor sit on B's shelf.
//
// Contrast `applyRemoteBooks`, which is the ordinary same-owner path.
//
// Note what this does NOT do: guarantee a live `default` book. That invariant
// belongs to the store that owns it (`useBooks.js`'s migration), and an adopt
// of an empty remote goes straight back through it — this module has no
// business inventing a book, here or anywhere.
export function adoptRemoteBooks(remote) {
  return normalizeAllBooks(remote && typeof remote === 'object' && !Array.isArray(remote) ? remote : {})
}

export function applyRemoteBooks(local, remote) {
  const out = normalizeAllBooks(local)
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return out
  for (const value of Object.values(remote)) {
    const incoming = normalizeBook(value)
    if (!incoming) continue
    const existing = out[incoming.id]
    if (!existing || incoming.updatedAt >= existing.updatedAt) out[incoming.id] = incoming
  }
  return normalizeAllBooks(out)
}

// Are these the same record? Every field a device can change, compared. Used
// by the sync diff below so a record that merely round-tripped through JSON
// isn't republished.
export function sameBookRecord(a, b) {
  if (!a || !b) return !a && !b
  return (
    a.state === b.state &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.coverTeamId === b.coverTeamId &&
    a.coverMark === b.coverMark &&
    a.coverColor === b.coverColor &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
  )
}

// Which of this device's books the OTHER side doesn't have, or has an older
// version of.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A COMPARISON AND NOT A CHANGE LOG — the backfill gap
// ---------------------------------------------------------------------------
// This is the same fix, for the same defect, as stampsToPublish in
// src/lib/stamps.js — read its header for the full argument; the short version
// adapted to books: publishing "whatever changed since the last thing I
// observed" is correct for every change made from then on, and wrong for the
// collection that already existed. A phone holding three named books signs in,
// sets a silent baseline, sees no change, and publishes nothing — forever. Its
// owner's laptop then signs into the same account and finds only the one
// default book, because nothing was ever uploaded. Creating a fourth book on
// the laptop doesn't help either: that publishes fine, and the phone's three
// are still only on the phone.
//
// So the question a device asks is not "what did I just change?" but "what do
// I have that the server doesn't?" — answerable from the two collections
// alone, needing no history, and self-healing: a publish lost to a dead
// network is simply found again by the next comparison.
//
// The three ways a local record earns a publish:
//   - the remote has never heard of it (an un-backfilled collection, or a book
//     created while offline),
//   - the remote's copy is older (this device edited it last),
//   - the two claim the same `updatedAt` but disagree on content (two changes
//     inside one millisecond — vanishingly rare, and cheaper to publish than to
//     reason about).
// A remote record that is NEWER is deliberately absent: `applyRemoteBooks` has
// already taken it, and re-publishing it would just echo the server to itself.
export function booksToPublish(local, remote) {
  const mine = normalizeAllBooks(local)
  const theirs = normalizeAllBooks(remote)
  const out = []
  for (const [id, entry] of Object.entries(mine)) {
    const before = theirs[id]
    if (before && before.updatedAt > entry.updatedAt) continue
    if (sameBookRecord(before, entry)) continue
    out.push(id)
  }
  return out.sort()
}
