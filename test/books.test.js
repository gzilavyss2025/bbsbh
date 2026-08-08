// Multiple named Game Log books (src/lib/books.js) — the foundation module a
// single passport book (ADR-0036) is being widened into a shelf of several.
// A book is a COVER only; the stamps filed inside it are src/lib/stamps.js's
// business, pinned separately (see the bookId cases at the end of
// test/stamps.test.js).
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COVER_COLORS,
  COVER_MARKS,
  DEFAULT_BOOK_ID,
  MAX_BOOKS,
  MAX_BOOK_SUBTITLE_LENGTH,
  MAX_BOOK_TITLE_LENGTH,
  applyRemoteBooks,
  bookCount,
  bookFor,
  booksToPublish,
  createBook,
  genBookId,
  isBookId,
  isBookState,
  listBooks,
  normalizeBook,
  parseBooks,
  removeBook,
  sameBookRecord,
  sanitizeBookSubtitle,
  sanitizeBookTitle,
  sanitizeCoverColor,
  sanitizeCoverMark,
  serializeBooks,
  updateBookCover,
} from '../src/lib/books.js'

// ---------------------------------------------------------------------------
// Validation and sanitizing
// ---------------------------------------------------------------------------

test('isBookId takes a short slug and refuses everything else', () => {
  assert.equal(isBookId('default'), true)
  assert.equal(isBookId('b12abc-def'), true)
  assert.equal(isBookId('UPPER-ok'), true)
  assert.equal(isBookId(''), false)
  assert.equal(isBookId('a'.repeat(65)), false)
  assert.equal(isBookId('a'.repeat(64)), true)
  assert.equal(isBookId('has space'), false)
  assert.equal(isBookId('has_underscore'), false)
  assert.equal(isBookId(null), false)
  assert.equal(isBookId(42), false)
})

test('genBookId always satisfies isBookId', () => {
  for (let i = 0; i < 20; i++) {
    assert.equal(isBookId(genBookId()), true)
  }
})

test('isBookState takes on/off only', () => {
  assert.equal(isBookState('on'), true)
  assert.equal(isBookState('off'), true)
  assert.equal(isBookState('maybe'), false)
  assert.equal(isBookState(null), false)
})

test('sanitizeBookTitle flattens control characters, collapses space, and caps length', () => {
  assert.equal(sanitizeBookTitle('Dad\'s\tbook\n'), "Dad's book")
  assert.equal(sanitizeBookTitle('  spaced   out  '), 'spaced out')
  assert.equal(sanitizeBookTitle('x'.repeat(500)).length, MAX_BOOK_TITLE_LENGTH)
  assert.equal(sanitizeBookTitle(null), '')
  assert.equal(sanitizeBookTitle(42), '')
  // Empty is a valid, meaningful result — "use the default word at render
  // time" — never invented here.
  assert.equal(sanitizeBookTitle(''), '')
})

test('sanitizeBookSubtitle has its own, longer cap', () => {
  assert.equal(sanitizeBookSubtitle('x'.repeat(500)).length, MAX_BOOK_SUBTITLE_LENGTH)
  assert.equal(sanitizeBookSubtitle('  Summer   2026  '), 'Summer 2026')
  assert.equal(sanitizeBookSubtitle(undefined), '')
})

test('normalizeBook drops entries with no id or no createdAt', () => {
  assert.equal(normalizeBook(null), null)
  assert.equal(normalizeBook({ createdAt: 5 }), null)
  assert.equal(normalizeBook({ id: 'x y', createdAt: 5 }), null)
  assert.equal(normalizeBook({ id: 'ok' }), null)
  assert.equal(normalizeBook({ id: 'ok', createdAt: 0 }), null)
  assert.equal(normalizeBook({ id: 'ok', createdAt: -5 }), null)
  assert.equal(normalizeBook({ id: 'ok', createdAt: 1.5 }), null)
})

test('normalizeBook defaults state, sanitizes text, and falls updatedAt back to createdAt', () => {
  const entry = normalizeBook({ id: 'trip', createdAt: 100, state: 'nonsense', title: '  Road  Trip  ' })
  assert.equal(entry.state, 'on')
  assert.equal(entry.title, 'Road Trip')
  assert.equal(entry.subtitle, '')
  assert.equal(entry.coverTeamId, null)
  assert.equal(entry.updatedAt, 100)
})

test('normalizeBook takes coverTeamId only as a positive integer', () => {
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverTeamId: 158 }).coverTeamId, 158)
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverTeamId: '158' }).coverTeamId, null)
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverTeamId: 0 }).coverTeamId, null)
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverTeamId: -1 }).coverTeamId, null)
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverTeamId: 1.5 }).coverTeamId, null)
})

test('normalizeBook takes a valid updatedAt over the createdAt fallback', () => {
  assert.equal(normalizeBook({ id: 'x', createdAt: 100, updatedAt: 200 }).updatedAt, 200)
  assert.equal(normalizeBook({ id: 'x', createdAt: 100, updatedAt: -1 }).updatedAt, 100)
  assert.equal(normalizeBook({ id: 'x', createdAt: 100, updatedAt: 'later' }).updatedAt, 100)
})

test('parseBooks fails empty rather than inventing a shelf', () => {
  assert.deepEqual(parseBooks(null), {})
  assert.deepEqual(parseBooks('not json'), {})
  assert.deepEqual(parseBooks('[1,2,3]'), {})
  assert.deepEqual(parseBooks('7'), {})
})

test('parseBooks round-trips a serialized collection', () => {
  const map = createBook({}, { id: 'trip', title: 'Road trip', now: 1000 })
  assert.deepEqual(parseBooks(serializeBooks(map)), map)
})

test('normalizeAllBooks (via parseBooks) keys a record by its OWN id, not the outer key', () => {
  const raw = JSON.stringify({ wrongkey: { id: 'trip', createdAt: 5 } })
  const parsed = parseBooks(raw)
  assert.deepEqual(Object.keys(parsed), ['trip'])
  assert.equal(parsed.trip.id, 'trip')
})

// ---------------------------------------------------------------------------
// Creating, patching, removing
// ---------------------------------------------------------------------------

test('createBook records a book and does not mutate the input', () => {
  const before = {}
  const after = createBook(before, { id: 'trip', title: 'Road trip', coverTeamId: 158, now: 1000 })
  assert.deepEqual(before, {})
  assert.equal(bookFor(after, 'trip').title, 'Road trip')
  assert.equal(bookFor(after, 'trip').coverTeamId, 158)
  assert.equal(bookFor(after, 'trip').createdAt, 1000)
  assert.equal(bookFor(after, 'trip').updatedAt, 1000)
})

test('createBook refuses a malformed call rather than storing a broken record', () => {
  assert.deepEqual(createBook({}, { id: 'bad id', now: 1 }), {})
  assert.deepEqual(createBook({}, { id: 'ok', now: 0 }), {})
  assert.deepEqual(createBook({}, { id: 'ok' }), {})
})

test('createBook is a no-op on a live-duplicate id — never silently overwrites', () => {
  const first = createBook({}, { id: 'trip', title: 'first', now: 1000 })
  const again = createBook(first, { id: 'trip', title: 'second', now: 2000 })
  assert.equal(bookFor(again, 'trip').title, 'first')
  assert.equal(bookFor(again, 'trip').updatedAt, 1000)
})

test('createBook is a no-op on a tombstoned-duplicate id — never silently resurrects', () => {
  const removed = removeBook(createBook({}, { id: 'trip', title: 'first', now: 1000 }), 'trip', { now: 2000 })
  const again = createBook(removed, { id: 'trip', title: 'reborn', now: 3000 })
  assert.equal(again.trip.state, 'off')
  assert.equal(again.trip.title, 'first')
})

test('MAX_BOOKS refuses a new book instead of pruning an old one', () => {
  let map = {}
  for (let i = 1; i <= MAX_BOOKS; i++) {
    map = createBook(map, { id: `book${i}`, now: i })
  }
  assert.equal(bookCount(map), MAX_BOOKS)
  const refused = createBook(map, { id: 'onemore', now: 9999 })
  assert.equal(bookFor(refused, 'onemore'), null)
  assert.equal(bookCount(refused), MAX_BOOKS)
  // The oldest book is still there — nothing was silently dropped for it.
  assert.notEqual(bookFor(refused, 'book1'), null)
})

test('a tombstoned book does not count against MAX_BOOKS', () => {
  let map = {}
  for (let i = 1; i <= MAX_BOOKS; i++) {
    map = createBook(map, { id: `book${i}`, now: i })
  }
  map = removeBook(map, 'book1', { now: 9000 })
  assert.equal(bookCount(map), MAX_BOOKS - 1)
  const created = createBook(map, { id: 'fresh', now: 9001 })
  assert.notEqual(bookFor(created, 'fresh'), null)
})

test('updateBookCover patches only the fields actually passed', () => {
  const made = createBook({}, { id: 'trip', title: 'Road trip', subtitle: 'v1', coverTeamId: 158, now: 1000 })
  const titled = updateBookCover(made, 'trip', { title: 'Renamed', now: 2000 })
  assert.equal(bookFor(titled, 'trip').title, 'Renamed')
  // Subtitle and cover club survive an update that didn't mention them.
  assert.equal(bookFor(titled, 'trip').subtitle, 'v1')
  assert.equal(bookFor(titled, 'trip').coverTeamId, 158)
  assert.equal(bookFor(titled, 'trip').updatedAt, 2000)

  const recolored = updateBookCover(titled, 'trip', { coverTeamId: 121, now: 3000 })
  assert.equal(bookFor(recolored, 'trip').title, 'Renamed')
  assert.equal(bookFor(recolored, 'trip').coverTeamId, 121)

  const cleared = updateBookCover(recolored, 'trip', { coverTeamId: null, now: 4000 })
  assert.equal(bookFor(cleared, 'trip').coverTeamId, null)
})

test('updateBookCover is a no-op on a missing, tombstoned, or badly-timed patch', () => {
  const made = createBook({}, { id: 'trip', title: 'Road trip', now: 1000 })
  assert.deepEqual(updateBookCover(made, 'nope', { title: 'x', now: 2000 }), made)
  assert.deepEqual(updateBookCover(made, 'trip', { title: 'x', now: 0 }), made)
  const removed = removeBook(made, 'trip', { now: 2000 })
  assert.deepEqual(updateBookCover(removed, 'trip', { title: 'x', now: 3000 }), removed)
})

test('removeBook tombstones rather than deleting', () => {
  const made = createBook({}, { id: 'trip', title: 'Road trip', now: 1000 })
  const removed = removeBook(made, 'trip', { now: 2000 })
  assert.equal(bookFor(removed, 'trip'), null)
  // The key survives — this is what makes the removal syncable.
  assert.equal(removed.trip.state, 'off')
  assert.equal(removed.trip.updatedAt, 2000)
  assert.equal(removed.trip.title, 'Road trip')
})

test('removeBook is a no-op on a missing book, an already-tombstoned one, or bad timing', () => {
  assert.deepEqual(removeBook({}, 'nope', { now: 1000 }), {})
  const made = createBook({}, { id: 'trip', now: 1000 })
  const removed = removeBook(made, 'trip', { now: 2000 })
  assert.deepEqual(removeBook(removed, 'trip', { now: 3000 }), removed)
  assert.deepEqual(removeBook(made, 'trip', { now: 0 }), made)
})

test('removeBook does not refuse the last live book or DEFAULT_BOOK_ID — that policy lives in the UI layer', () => {
  const made = createBook({}, { id: DEFAULT_BOOK_ID, now: 1000 })
  const removed = removeBook(made, DEFAULT_BOOK_ID, { now: 2000 })
  assert.equal(bookFor(removed, DEFAULT_BOOK_ID), null)
  assert.equal(bookCount(removed), 0)
})

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

test('listBooks sorts newest-created first and drops tombstoned books', () => {
  let map = createBook({}, { id: 'a', now: 10 })
  map = createBook(map, { id: 'b', now: 30 })
  map = createBook(map, { id: 'c', now: 20 })
  map = removeBook(map, 'b', { now: 40 })
  assert.deepEqual(
    listBooks(map).map((b) => b.id),
    ['c', 'a'],
  )
})

// ---------------------------------------------------------------------------
// Sync merge
// ---------------------------------------------------------------------------

test('a remote book this device has never seen is adopted', () => {
  const merged = applyRemoteBooks({}, {
    trip: { id: 'trip', state: 'on', title: 'Road trip', createdAt: 5, updatedAt: 5 },
  })
  assert.notEqual(bookFor(merged, 'trip'), null)
})

test('a stale remote "on" cannot resurrect a book the user just removed', () => {
  const local = removeBook(createBook({}, { id: 'trip', now: 1000 }), 'trip', { now: 2000 })
  const merged = applyRemoteBooks(local, {
    trip: { id: 'trip', state: 'on', createdAt: 1000, updatedAt: 1000 },
  })
  assert.equal(bookFor(merged, 'trip'), null)
})

test('a newer remote removal propagates over a local book', () => {
  const local = createBook({}, { id: 'trip', now: 1000 })
  const merged = applyRemoteBooks(local, {
    trip: { id: 'trip', state: 'off', createdAt: 1000, updatedAt: 5000 },
  })
  assert.equal(bookFor(merged, 'trip'), null)
})

test('a garbled remote payload degrades to no change', () => {
  const local = createBook({}, { id: 'trip', now: 1000 })
  assert.deepEqual(applyRemoteBooks(local, null), local)
  assert.deepEqual(applyRemoteBooks(local, 'nope'), local)
  assert.deepEqual(applyRemoteBooks(local, { junk: { bad: true } }), local)
})

test('sameBookRecord compares every field a device can change', () => {
  const a = { id: 'x', state: 'on', title: 't', subtitle: 's', coverTeamId: 1, createdAt: 1, updatedAt: 2 }
  assert.equal(sameBookRecord(a, { ...a }), true)
  assert.equal(sameBookRecord(a, { ...a, title: 'other' }), false)
  assert.equal(sameBookRecord(a, { ...a, coverTeamId: 2 }), false)
  assert.equal(sameBookRecord(null, null), true)
  assert.equal(sameBookRecord(a, null), false)
})

// ---------------------------------------------------------------------------
// The backfill: what this device has that the server doesn't
// ---------------------------------------------------------------------------

const REC = (updatedAt, extra = {}) => ({
  id: 'b',
  state: 'on',
  title: '',
  subtitle: '',
  coverTeamId: null,
  createdAt: 1_000,
  updatedAt,
  ...extra,
})

test('a shelf that predates sign-in publishes in full', () => {
  const local = { a: REC(5, { id: 'a' }), b: REC(6, { id: 'b' }) }
  assert.deepEqual(booksToPublish(local, {}), ['a', 'b'])
})

test('a record the server already has identically is not republished', () => {
  const local = { b: REC(5) }
  assert.deepEqual(booksToPublish(local, { b: REC(5) }), [])
})

test('this device publishes when it holds the newer version', () => {
  const local = { b: REC(9, { title: 'edited here' }) }
  assert.deepEqual(booksToPublish(local, { b: REC(5) }), ['b'])
})

test('a NEWER remote record is left alone — the merge already took it', () => {
  const local = { b: REC(5) }
  assert.deepEqual(booksToPublish(local, { b: REC(9) }), [])
})

test('two changes inside one millisecond still publish', () => {
  const local = { b: REC(5, { title: 'moved' }) }
  assert.deepEqual(booksToPublish(local, { b: REC(5) }), ['b'])
})

test('a removal travels as a tombstone the server lacks', () => {
  const local = { b: REC(9, { state: 'off' }) }
  assert.deepEqual(booksToPublish(local, { b: REC(5) }), ['b'])
  assert.deepEqual(booksToPublish(local, { b: REC(9, { state: 'off' }) }), [])
})

test('a record only the server has is never treated as a local removal', () => {
  assert.deepEqual(booksToPublish({}, { b: REC(5) }), [])
})

test('the full round trip: two devices, neither empty, converge', () => {
  const phone = { a: REC(5, { id: 'a' }), b: REC(6, { id: 'b' }) }
  const laptop = { c: REC(7, { id: 'c' }) }

  assert.deepEqual(booksToPublish(phone, {}), ['a', 'b'])
  const server = { ...phone }

  const laptopMerged = applyRemoteBooks(laptop, server)
  assert.deepEqual(booksToPublish(laptopMerged, server), ['c'])
  const server2 = { ...server, c: REC(7, { id: 'c' }) }

  const phoneMerged = applyRemoteBooks(phone, server2)
  assert.deepEqual(Object.keys(phoneMerged).sort(), ['a', 'b', 'c'])
  assert.deepEqual(booksToPublish(phoneMerged, server2), [])
})

// ---------------------------------------------------------------------------
// The cover's mark and board colour (the six league-mark presets)
// ---------------------------------------------------------------------------
// `coverMark` says WHAT is stamped on the board — the club's own crest
// ('team', the only thing a cover could carry before this shipped) or one of
// the two league marks. `coverColor` is the board a LEAGUE-mark cover is
// printed on; a club cover takes its board from the club, so it leaves this
// null. Both must fail closed: an unknown value is the default, never stored.

test('sanitizeCoverMark takes the three known marks and defaults everything else to team', () => {
  for (const mark of COVER_MARKS) assert.equal(sanitizeCoverMark(mark), mark)
  assert.deepEqual(COVER_MARKS, ['team', 'mlb', 'milb'])
  assert.equal(sanitizeCoverMark(undefined), 'team')
  assert.equal(sanitizeCoverMark(null), 'team')
  assert.equal(sanitizeCoverMark('MLB'), 'team')
  assert.equal(sanitizeCoverMark('<script>'), 'team')
  assert.equal(sanitizeCoverMark(7), 'team')
})

test('sanitizeCoverColor takes the three board colours and defaults everything else to null', () => {
  for (const color of COVER_COLORS) assert.equal(sanitizeCoverColor(color), color)
  assert.deepEqual(COVER_COLORS, ['kraft', 'red', 'blue'])
  assert.equal(sanitizeCoverColor(undefined), null)
  assert.equal(sanitizeCoverColor('#ff0000'), null)
  assert.equal(sanitizeCoverColor('green'), null)
  assert.equal(sanitizeCoverColor(0), null)
})

test('a legacy record carrying NEITHER field reads exactly as it renders today', () => {
  // The ADR-0041 guarantee: every book that existed before this picker shipped
  // keeps its club-coloured cover, and a book with no cover pick keeps falling
  // back to the favourite club. Both are what `coverMark: 'team'` +
  // `coverColor: null` mean at render time.
  const legacy = normalizeBook({ id: 'default', createdAt: 1000, updatedAt: 1000 })
  assert.deepEqual(legacy, {
    id: 'default',
    state: 'on',
    title: '',
    subtitle: '',
    coverTeamId: null,
    coverMark: 'team',
    coverColor: null,
    createdAt: 1000,
    updatedAt: 1000,
  })

  const legacyWithClub = normalizeBook({ id: 'trip', createdAt: 1, coverTeamId: 158 })
  assert.equal(legacyWithClub.coverTeamId, 158)
  assert.equal(legacyWithClub.coverMark, 'team')
  assert.equal(legacyWithClub.coverColor, null)
})

test('normalizeBook rejects a hostile coverMark/coverColor to the default rather than storing it', () => {
  const hostile = normalizeBook({
    id: 'x',
    createdAt: 1,
    coverMark: { toString: () => 'mlb' },
    coverColor: 'javascript:alert(1)',
  })
  assert.equal(hostile.coverMark, 'team')
  assert.equal(hostile.coverColor, null)
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverMark: 'milb' }).coverMark, 'milb')
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverColor: 'kraft' }).coverColor, 'kraft')
})

test('coverTeamId accepts a MiLB club id — the picker is no longer MLB-only', () => {
  // 5015 is Nashville (AAA) in the MLB Stats API; the store never held an
  // opinion about level, and must not grow one now that the rail offers them.
  assert.equal(normalizeBook({ id: 'x', createdAt: 1, coverTeamId: 5015 }).coverTeamId, 5015)
  const made = createBook({}, { id: 'nash', coverTeamId: 5015, now: 1000 })
  assert.equal(bookFor(made, 'nash').coverTeamId, 5015)
})

test('createBook stores a league-mark cover and defaults an unnamed one to the club crest', () => {
  const preset = createBook({}, { id: 'p', coverMark: 'milb', coverColor: 'blue', now: 1000 })
  assert.equal(bookFor(preset, 'p').coverMark, 'milb')
  assert.equal(bookFor(preset, 'p').coverColor, 'blue')

  const plain = createBook({}, { id: 'q', now: 1000 })
  assert.equal(bookFor(plain, 'q').coverMark, 'team')
  assert.equal(bookFor(plain, 'q').coverColor, null)

  const junk = createBook({}, { id: 'r', coverMark: 'nfl', coverColor: 'chartreuse', now: 1000 })
  assert.equal(bookFor(junk, 'r').coverMark, 'team')
  assert.equal(bookFor(junk, 'r').coverColor, null)
})

test('updateBookCover patches the mark and board colour only when they are passed', () => {
  const made = createBook({}, { id: 'trip', title: 'Road trip', coverTeamId: 158, now: 1000 })
  const marked = updateBookCover(made, 'trip', { coverMark: 'mlb', coverColor: 'red', now: 2000 })
  assert.equal(bookFor(marked, 'trip').coverMark, 'mlb')
  assert.equal(bookFor(marked, 'trip').coverColor, 'red')
  // The club id survives a re-cover that never mentioned it: switching back to
  // a club crest must not have to re-pick the club.
  assert.equal(bookFor(marked, 'trip').coverTeamId, 158)

  const renamed = updateBookCover(marked, 'trip', { title: 'Renamed', now: 3000 })
  assert.equal(bookFor(renamed, 'trip').coverMark, 'mlb')
  assert.equal(bookFor(renamed, 'trip').coverColor, 'red')

  const backToClub = updateBookCover(renamed, 'trip', { coverMark: 'team', coverColor: null, now: 4000 })
  assert.equal(bookFor(backToClub, 'trip').coverMark, 'team')
  assert.equal(bookFor(backToClub, 'trip').coverColor, null)

  const junked = updateBookCover(backToClub, 'trip', { coverMark: 'nhl', now: 5000 })
  assert.equal(bookFor(junked, 'trip').coverMark, 'team')
})

test('sameBookRecord notices a changed mark or board colour', () => {
  const a = {
    id: 'x',
    state: 'on',
    title: 't',
    subtitle: 's',
    coverTeamId: 1,
    coverMark: 'team',
    coverColor: null,
    createdAt: 1,
    updatedAt: 2,
  }
  assert.equal(sameBookRecord(a, { ...a }), true)
  assert.equal(sameBookRecord(a, { ...a, coverMark: 'mlb' }), false)
  assert.equal(sameBookRecord(a, { ...a, coverColor: 'kraft' }), false)
})

test('a legacy server record and a defaulted local one are the SAME record — no publish storm', () => {
  // The upgrade path: a device that already synced its shelf holds records
  // with neither field. Reading one back must not look like a local edit, or
  // every book on every device would republish itself on first load.
  const legacyRemote = { b: { id: 'b', state: 'on', title: '', subtitle: '', coverTeamId: null, createdAt: 1, updatedAt: 2 } }
  const localAfterUpgrade = { b: { ...legacyRemote.b, coverMark: 'team', coverColor: null } }
  assert.deepEqual(booksToPublish(localAfterUpgrade, legacyRemote), [])

  // A real re-cover still publishes.
  const recovered = { b: { ...localAfterUpgrade.b, coverMark: 'mlb', coverColor: 'kraft', updatedAt: 9 } }
  assert.deepEqual(booksToPublish(recovered, legacyRemote), ['b'])
})

test('a remote re-cover merges, and a tombstone still outranks it on updatedAt', () => {
  const local = createBook({}, { id: 'trip', coverMark: 'mlb', coverColor: 'red', now: 1000 })
  const merged = applyRemoteBooks(local, {
    trip: { id: 'trip', state: 'on', coverMark: 'milb', coverColor: 'blue', createdAt: 1000, updatedAt: 5000 },
  })
  assert.equal(bookFor(merged, 'trip').coverMark, 'milb')
  assert.equal(bookFor(merged, 'trip').coverColor, 'blue')

  const tombstoned = applyRemoteBooks(merged, {
    trip: { id: 'trip', state: 'off', coverMark: 'milb', createdAt: 1000, updatedAt: 6000 },
  })
  assert.equal(bookFor(tombstoned, 'trip'), null)

  // A revive that names the fields again brings them back intact.
  const revived = applyRemoteBooks(tombstoned, {
    trip: { id: 'trip', state: 'on', coverMark: 'mlb', coverColor: 'kraft', createdAt: 7000, updatedAt: 7000 },
  })
  assert.equal(bookFor(revived, 'trip').coverMark, 'mlb')
  assert.equal(bookFor(revived, 'trip').coverColor, 'kraft')
})

test('serializeBooks round-trips the mark and board colour', () => {
  const map = createBook({}, { id: 'p', coverMark: 'milb', coverColor: 'kraft', now: 1000 })
  assert.deepEqual(parseBooks(serializeBooks(map)), map)
})
