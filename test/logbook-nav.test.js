// Which address a Game Log BOOK answers to (src/lib/logbookNav.js).
//
// This module is two four-line functions, and it earns a test file of its own
// because getting it wrong does not throw, 404, or look broken in review — it
// hands back a path that resolves to a DIFFERENT screen. Folding the default
// book onto the bare `/logbook` unconditionally is exactly that mistake: with
// a second book on the shelf, `/logbook` is the SHELF, so every "Open" on the
// default book's cover navigated back to the shelf it was tapped from, the
// mint hand-off could not file a stamp into that book at all, and its "what it
// adds up to" opened the whole collection's retrospective instead of its own.
//
// So the cases below are all one question asked from both ends: does the bare
// route still mean THIS book?
import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_BOOK_ID } from '../src/lib/books.js'
import { pathForBook, statsPathFor } from '../src/lib/logbookNav.js'
import { parseRoute } from '../src/lib/route.js'

const DEFAULT_BOOK = { id: DEFAULT_BOOK_ID }
const OTHER_BOOK = { id: 'b1abcxyz' }

test('the only book on the shelf keeps the bare address it has always had', () => {
  assert.equal(pathForBook(DEFAULT_BOOK, { bookCount: 1 }), '/logbook')
  assert.equal(pathForBook(DEFAULT_BOOK, { season: 2026, bookCount: 1 }), '/logbook/2026')
  assert.equal(statsPathFor(DEFAULT_BOOK, { bookCount: 1 }), '/logbook/stats')
})

test('a shelf gives the default book its own address, because the bare one is the shelf', () => {
  assert.equal(pathForBook(DEFAULT_BOOK, { bookCount: 2 }), '/logbook/book/default')
  assert.equal(
    pathForBook(DEFAULT_BOOK, { season: 2026, bookCount: 4 }),
    '/logbook/book/default/2026',
  )
  assert.equal(statsPathFor(DEFAULT_BOOK, { bookCount: 2 }), '/logbook/book/default/stats')
  // And it round-trips to the book the caller meant, rather than to the
  // resolver that would have shown a shelf.
  assert.deepEqual(parseRoute(pathForBook(DEFAULT_BOOK, { bookCount: 2 })), {
    name: 'logbook',
    bookId: 'default',
    season: null,
    placing: null,
  })
})

test('any other book is always addressed by name, whatever the count says', () => {
  for (const bookCount of [1, 2, 20]) {
    assert.equal(pathForBook(OTHER_BOOK, { bookCount }), '/logbook/book/b1abcxyz', `${bookCount}`)
    assert.equal(
      statsPathFor(OTHER_BOOK, { bookCount }),
      '/logbook/book/b1abcxyz/stats',
      `${bookCount}`,
    )
  }
})

// The default is the SAFE answer rather than the pretty one: an explicit
// address always resolves to the book it names, while a fold that guessed
// wrong lands the visitor somewhere else entirely.
test('a caller that cannot say how many books there are gets the explicit address', () => {
  assert.equal(pathForBook(DEFAULT_BOOK), '/logbook/book/default')
  assert.equal(statsPathFor(DEFAULT_BOOK), '/logbook/book/default/stats')
})

test('no book at all is the bare route, since there is no id to name', () => {
  assert.equal(pathForBook(null), '/logbook')
  assert.equal(pathForBook(null, { season: 2026 }), '/logbook/2026')
  assert.equal(statsPathFor(null), '/logbook/stats')
})

// `?place=` is the hand-off from the box score's mint card. It has to survive
// the trip through the shelf, or choosing a book quietly drops the stamp back
// into the tray.
test('a stamp in hand rides on either address', () => {
  assert.equal(pathForBook(DEFAULT_BOOK, { placing: 823035, bookCount: 1 }), '/logbook?place=823035')
  assert.equal(
    pathForBook(DEFAULT_BOOK, { placing: 823035, bookCount: 2 }),
    '/logbook/book/default?place=823035',
  )
  assert.equal(
    pathForBook(OTHER_BOOK, { season: 2026, placing: 823035, bookCount: 3 }),
    '/logbook/book/b1abcxyz/2026?place=823035',
  )
  assert.deepEqual(parseRoute(pathForBook(OTHER_BOOK, { placing: 823035, bookCount: 3 })), {
    name: 'logbook',
    bookId: 'b1abcxyz',
    season: null,
    placing: 823035,
  })
})
