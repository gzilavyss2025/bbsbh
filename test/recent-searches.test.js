// Unit coverage for src/lib/recentSearches.js — the site search's recents
// shelf. Two things these pin. First the ordinary contract: recording a visit
// is a move-to-front, not an append, and the list stays capped. Second, and the
// reason this list is safe to persist at all, the SHAPE gate — an entry is a
// kind, an id, a name and a subtitle, and anything carrying more than that (a
// score, a game, a date) is dropped on the way in AND on the way out, so a
// hand-edited localStorage value can never put a spoiler on the search screen.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  addRecentSearch,
  parseRecentSearches,
  recentSearchKey,
  removeRecentSearch,
  serializeRecentSearches,
} from '../src/lib/recentSearches.js'

const judge = { kind: 'player', id: 592450, name: 'Aaron Judge', sub: 'RF · New York Yankees' }
const brewers = { kind: 'team', id: 158, name: 'Milwaukee Brewers', sub: 'MLB' }

// --------------------------------------------------------------------------
// Shape validation — only the identity fields api/search.js produces
// --------------------------------------------------------------------------
test('parse keeps a well-formed entry and drops everything else', () => {
  const parsed = parseRecentSearches(
    JSON.stringify([
      judge,
      { kind: 'umpire', id: 1, name: 'Angel Hernandez' }, // unknown kind
      { kind: 'player', id: 'abc', name: 'Not An Id' },
      { kind: 'player', id: 0, name: 'Zero' },
      { kind: 'player', id: 12, name: '   ' }, // nothing to label the row with
      { kind: 'team', id: 158 }, // no name
      'brewers',
      null,
      42,
    ]),
  )
  assert.deepEqual(parsed, [judge])
})

test('a stored entry carrying extra fields is reduced to the four known ones', () => {
  // The gate that matters: whatever else is in the value, only kind/id/name/sub
  // survive to the render path, so a stray score field cannot be shown.
  const parsed = parseRecentSearches(
    JSON.stringify([{ ...judge, finalScore: '7-3', gamePk: 776543, revealedThrough: 12 }]),
  )
  assert.deepEqual(parsed, [judge])
  assert.equal(Object.keys(parsed[0]).length, 4)
})

test('serialize normalizes on the way out too, so a bad write is impossible', () => {
  const written = serializeRecentSearches([judge, { kind: 'nope', id: 1, name: 'x' }, null])
  assert.deepEqual(JSON.parse(written), [judge])
})

test('a garbled stored value collapses to no recents rather than throwing', () => {
  for (const raw of [null, undefined, '', '{oops', '"a string"', '{"kind":"player"}', '7']) {
    assert.deepEqual(parseRecentSearches(raw), [], `${JSON.stringify(raw)} must parse as empty`)
  }
})

test('an over-long name is truncated rather than stored unbounded', () => {
  const long = { ...judge, name: 'x'.repeat(500), sub: 'y'.repeat(500) }
  const [entry] = addRecentSearch([], long)
  assert.equal(entry.name.length, 80)
  assert.equal(entry.sub.length, 80)
})

// --------------------------------------------------------------------------
// Ordering — newest first, and revisiting moves rather than duplicates
// --------------------------------------------------------------------------
test('add puts the newest entry at the front', () => {
  const list = addRecentSearch(addRecentSearch([], judge), brewers)
  assert.deepEqual(list.map((e) => e.name), ['Milwaukee Brewers', 'Aaron Judge'])
})

test('revisiting an entry moves it to the front instead of duplicating it', () => {
  let list = addRecentSearch([], judge)
  list = addRecentSearch(list, brewers)
  list = addRecentSearch(list, judge)
  assert.equal(list.length, 2)
  assert.deepEqual(list.map((e) => e.name), ['Aaron Judge', 'Milwaukee Brewers'])
})

test('a revisit refreshes the stored subtitle (a player can change clubs)', () => {
  const traded = { ...judge, sub: 'RF · San Francisco Giants' }
  const list = addRecentSearch(addRecentSearch([], judge), traded)
  assert.deepEqual(list, [traded])
})

test('a person and a club sharing an id are different entries', () => {
  const person = { kind: 'player', id: 158, name: 'Somebody', sub: '' }
  const list = addRecentSearch(addRecentSearch([], brewers), person)
  assert.equal(list.length, 2)
  assert.notEqual(recentSearchKey(brewers), recentSearchKey(person))
})

test('an unusable entry is a no-op, so callers need not pre-check', () => {
  const list = addRecentSearch([judge], { kind: 'player', id: null, name: 'Ghost' })
  assert.deepEqual(list, [judge])
})

// --------------------------------------------------------------------------
// The cap — the oldest rows are the ones that fall off
// --------------------------------------------------------------------------
test('the list is capped, dropping the oldest entries', () => {
  let list = []
  for (let i = 1; i <= MAX_RECENT_SEARCHES + 4; i += 1) {
    list = addRecentSearch(list, { kind: 'player', id: i, name: `Player ${i}`, sub: '' })
  }
  assert.equal(list.length, MAX_RECENT_SEARCHES)
  // Newest first, so the head is the last one added and the first four are gone.
  assert.equal(list[0].id, MAX_RECENT_SEARCHES + 4)
  assert.equal(list.at(-1).id, 5)
})

test('parse applies the cap to an over-long stored value', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({
    kind: 'team',
    id: i + 1,
    name: `Club ${i + 1}`,
    sub: 'MLB',
  }))
  assert.equal(parseRecentSearches(JSON.stringify(many)).length, MAX_RECENT_SEARCHES)
})

// --------------------------------------------------------------------------
// Removal
// --------------------------------------------------------------------------
test('remove drops exactly one row and leaves the rest in order', () => {
  const list = addRecentSearch(addRecentSearch([], judge), brewers)
  assert.deepEqual(removeRecentSearch(list, 'team', 158), [judge])
  assert.deepEqual(removeRecentSearch(list, 'player', 592450), [brewers])
  // A kind/id pair that isn't in the list changes nothing.
  assert.deepEqual(removeRecentSearch(list, 'player', 158), list)
})

test('the storage key is namespaced with the app prefix', () => {
  assert.ok(RECENT_SEARCHES_KEY.startsWith('bbsbh:'))
})
