// The dev-only era editor's server half (scripts/lib/dev-season-marks.mjs,
// ADR-0029): the lab owns the per-season table, so these pin the promises it
// makes — an era never overlaps a sibling, an edit keeps the fields the form
// does not show, and a request cannot reach the filesystem with a name it chose.
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyEraDelete, applyEraSave, resolveEraFile } from '../scripts/lib/eras/dev-season-marks.mjs'

const era = (from, to, extra = {}) => ({ from, to, name: 'Brooklyn Dodgers', abbr: 'BRO', file: null, ...extra })
const store = () => ({ _hint: 'h', clubs: { 119: [era(1901, 1909), era(1910, 1913, { file: '119-1910-1913.png', source: 'x' })] } })

test('a new era lands in its club, sorted by first season, and leaves the hint alone', () => {
  const out = applyEraSave(store(), { teamId: 119, era: era(1914, 1933) })
  assert.equal(out.problem, undefined)
  assert.deepEqual(out.store.clubs[119].map((e) => e.from), [1901, 1910, 1914])
  assert.equal(out.store._hint, 'h')
})

test('a club that is not in the table yet gets an entry', () => {
  const out = applyEraSave(store(), { teamId: 116, era: era(1960, 1993, { name: 'Detroit Tigers', abbr: 'DET' }) })
  assert.equal(out.store.clubs[116].length, 1)
})

test('an era that overlaps a sibling is refused, because seasonMark takes the first match', () => {
  const out = applyEraSave(store(), { teamId: 119, era: era(1909, 1911) })
  assert.match(out.problem, /overlaps 1901-1909/)
})

test('editing an era (replaceFrom) keeps its art and source, and may keep its own years', () => {
  const out = applyEraSave(store(), { teamId: 119, replaceFrom: 1910, era: era(1910, 1913, { name: 'Brooklyn Superbas' }) })
  const saved = out.store.clubs[119].find((e) => e.from === 1910)
  assert.equal(saved.name, 'Brooklyn Superbas')
  assert.equal(saved.file, '119-1910-1913.png')
  assert.equal(saved.source, 'x')
})

test('editing an era that is not there is a 404, not a quiet add', () => {
  const out = applyEraSave(store(), { teamId: 119, replaceFrom: 1925, era: era(1925, 1926) })
  assert.equal(out.status, 404)
})

test('years, name and abbreviation are checked', () => {
  const bad = (e) => applyEraSave(store(), { teamId: 119, era: { ...era(1914, 1933), ...e } }).problem
  assert.match(bad({ from: 1950, to: 1940 }), /before/)
  assert.match(bad({ from: 1.5 }), /whole/)
  assert.match(bad({ from: 1700 }), /1876/)
  assert.match(bad({ name: '' }), /name/)
  assert.match(bad({ abbr: 'b' }), /abbreviation/)
  assert.match(applyEraSave(store(), { teamId: 0, era: era(1914, 1933) }).problem, /teamId/)
})

test('a delete drops the era and the club key when it was the last one', () => {
  const one = { clubs: { 119: [era(1901, 1909, { file: '119-1901-1909.svg' })] } }
  const out = applyEraDelete(one, { teamId: 119, from: 1901 })
  assert.equal(out.store.clubs[119], undefined)
  assert.equal(out.file, '119-1901-1909.svg')
  assert.equal(applyEraDelete(one, { teamId: 119, from: 1950 }).status, 404)
})

test('the art destination is rebuilt from the file name, and refuses anything else', () => {
  const resolved = resolveEraFile('119-1945-1957.svg').split('\\').join('/')
  assert.match(resolved, /\/public\/logos\/historical\/119-1945-1957\.svg$/)
  assert.throws(() => resolveEraFile('../../evil.svg'), /not writable/)
  assert.throws(() => resolveEraFile('119-1945-1957.exe'), /not writable/)
  assert.throws(() => resolveEraFile('a/119-1945-1957.svg'), /not writable/)
})
