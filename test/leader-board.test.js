// The shared leader board (components/teamstats/TeamLeaders.jsx), rebuilt on LeaderList and
// LeaderRow (ADR-0112). Node cannot import a .jsx file, so the behaviour lives in two plain
// modules and this file pins them, then pins the markup and the styles by reading the source.
//
//   1. THE RANKS: "1224" ranking, a tie reads T1.
//   2. THE CATEGORIES: an empty one is hidden; a precomputed board is cut to the limit.
//   3. THE ROW'S LOOK: rank 1 leads, the favorite club is "mine", the filter dims the rest.
//   4. THE ONE-SHOT: the scope tap arms the fade-in, the board spends it on its first render.
//   5. THE MARKUP AND THE STYLES.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ruleBody, stripComments } from './helpers/css.js'
import { displayRanks, rankedCategories, rowLook } from '../src/components/teamstats/leaderBoard.js'
import { armBoardIn, disarmBoardIn, takeBoardIn } from '../src/lib/motion/boardIn.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles', rel)))
const rule = ruleBody

// ---- 1. the ranks ----

test('ranks run 1224, and a shared value reads T', () => {
  const ranks = displayRanks([{ value: 40 }, { value: 38 }, { value: 38 }, { value: 36 }])
  assert.deepEqual(ranks.map((r) => r.text), ['1', 'T2', 'T2', '4'])
})

test('a ten-way tie at the top is T1 down the list, and the next player is 11th place', () => {
  const ranks = displayRanks([{ value: 9 }, { value: 9 }, { value: 8 }])
  assert.deepEqual(ranks.map((r) => r.text), ['T1', 'T1', '3'])
})

// ---- 2. the categories ----

const CAT_A = { key: 'a', label: 'A' }
const CAT_B = { key: 'b', label: 'B' }
const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, value: 100 - i }))

test('a category with no rows is hidden, not drawn empty', () => {
  const out = rankedCategories({ pool: [], categories: [CAT_A, CAT_B], limit: 10, precomputed: { a: rows(3) } })
  assert.deepEqual(out.map((r) => r.category.key), ['a'])
})

test('a precomputed board is cut to the limit and never ranks the pool', () => {
  const out = rankedCategories({ pool: null, categories: [CAT_A], limit: 2, precomputed: { a: rows(5) } })
  assert.equal(out[0].entries.length, 2)
})

// ---- 3. the row's look ----

test('rank 1 leads; the others have no state', () => {
  assert.equal(rowLook({ index: 0 }).state, 'lead')
  assert.equal(rowLook({ index: 1 }).state, undefined)
})

test("the reader's own club is mine, and wins over lead on rank 1", () => {
  assert.equal(rowLook({ index: 3, isFavorite: true }).state, 'mine')
  assert.equal(rowLook({ index: 0, isFavorite: true }).state, 'mine')
})

test('the team filter dims every row that is not the picked club, by a caller class', () => {
  assert.match(rowLook({ index: 2, filtering: true }).className, /\btlead__row--dim\b/)
  assert.match(rowLook({ index: 0, filtering: true }).className, /\btlead__row--dim\b/)
  assert.doesNotMatch(rowLook({ index: 2, filtering: true, isFavorite: true }).className, /dim/)
  assert.doesNotMatch(rowLook({ index: 2, filtering: false }).className, /dim/)
})

test('the rank column is as wide as the mark, so a tie like T10 fits its pill', () => {
  const row = rule(css('leaders/board.css'), '.tlead__row')
  assert.match(row, /grid-template-columns:\s*var\(--mark-lg\) var\(--mark-lg\)/)
})

// ---- 4. the one-shot ----

test('the scope tap arms the fade-in once; the board spends it, and a second render does not play', () => {
  assert.equal(takeBoardIn(), false, 'a cold load plays nothing')
  armBoardIn()
  assert.equal(takeBoardIn(), true)
  assert.equal(takeBoardIn(), false, 'a poll, a Back, a force-reveal render after the first')
})

test('ScopeNav arms the flag on a tap to another scope, and the board spends it on first render', () => {
  const page = src('screens/LeadersPage.jsx')
  assert.match(page, /armBoardIn\(\)/)
  const tap = page.slice(page.indexOf('onClick'), page.indexOf("onClick") + 400)
  assert.match(tap, /scope !== s\.key/, 'the same scope tapped again remounts nothing, so it must not arm the flag')
  const board = src('components/teamstats/TeamLeaders.jsx')
  assert.match(board, /useState\(takeBoardIn\)/)
  assert.match(board, /tlead--in/)
})

test('a scope tap that ends with no board (an empty scope, a load error) disarms the flag', () => {
  armBoardIn()
  disarmBoardIn()
  assert.equal(takeBoardIn(), false, 'the next board, on any page, must not play the fade')
  const page = src('screens/LeadersPage.jsx')
  assert.match(page, /disarmBoardIn\(\)/, 'LeadersPage disarms once it settles with no board')
})

// ---- 5. the markup and the styles ----

test('the board is a Grid of LeaderLists of LeaderRows, with no native tooltip', () => {
  const board = src('components/teamstats/TeamLeaders.jsx')
  assert.match(board, /<Grid[^>]*min="20rem"/)
  assert.match(board, /<LeaderList[^>]*count="Top 10"/)
  assert.match(board, /<LeaderRow/)
  assert.match(board, /<Headshot/)
  assert.doesNotMatch(board, /\btitle=\{|\btitle="/, 'no native title= tooltip')
})

test('the dim is opacity 0.55 on the row, no lower, with no transition', () => {
  const dim = rule(css('leaders/board.css'), '.tlead__row--dim')
  assert.ok(dim, '.tlead__row--dim exists')
  assert.equal(/opacity:\s*([\d.]+)/.exec(dim)[1], '0.55')
  assert.doesNotMatch(dim, /transition|animation/)
})

test('the favorite row paints no club accent', () => {
  const sheet = css('leaders/board.css')
  assert.doesNotMatch(sheet, /--fav-accent/)
  assert.doesNotMatch(src('components/teamstats/TeamLeaders.jsx'), /favoriteAccentColor|--fav-accent/)
})

test('the fade-in is transform and opacity only, 180ms on the ease-out token, off under reduced motion', () => {
  const sheet = css('motion/board-in.css')
  const frames = /@keyframes\s+tlead-board-in\s*\{([\s\S]*?\})\s*\}/.exec(sheet)?.[1] ?? ''
  assert.match(frames, /translateY\(6px\)/)
  assert.equal([...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).sort().filter((p, i, a) => a.indexOf(p) === i).join(), 'opacity,transform')
  assert.match(rule(sheet, '.tlead--in'), /animation:\s*tlead-board-in var\(--dur-board-in\) var\(--ease-out\)/)
  assert.match(sheet, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.tlead--in\s*\{\s*animation:\s*none/)
  assert.match(src('tokens/effects.css'), /--dur-board-in:\s*180ms/)
})

test('the board partial loads where the old rules did, and the fade-in with the motion sheets', () => {
  const index = src('index.css')
  const imports = [...index.matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1])
  assert.ok(imports.includes('leaders/board.css'))
  assert.equal(imports.indexOf('leaders/board.css'), imports.indexOf('23-box-score-detail.css') - 1)
  assert.ok(imports.indexOf('motion/board-in.css') > imports.indexOf('motion/arrival.css'))
  assert.ok(imports.indexOf('motion/board-in.css') < imports.findIndex((p) => p.startsWith('focus/')))
})

test('23-box-score-detail.css keeps no .tlead rule', () => {
  assert.doesNotMatch(css('23-box-score-detail.css'), /\.tlead[\w-]*/)
})
