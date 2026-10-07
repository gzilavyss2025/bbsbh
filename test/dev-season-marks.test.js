// The dev-only era editor's server half (scripts/lib/dev-season-marks.mjs,
// ADR-0029): the lab owns the per-season table, so these pin the promises it
// makes — an era never overlaps a sibling, an edit keeps the fields the form
// does not show, and a request cannot reach the filesystem with a name it chose.
import assert from 'node:assert/strict'
import test from 'node:test'
import { applyEraDelete, applyEraSave, describeEraArt, resolveEraFile } from '../scripts/lib/eras/dev-season-marks.mjs'

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

// Era colours (#1591, PR 2): the same triad a club header carries. The bar is
// real chrome on a real page, so onBar has to clear WCAG AA against it.
test('an era may carry a bar, accent and onBar, normalised to upper case', () => {
  const out = applyEraSave(store(), { teamId: 119, era: era(1914, 1933, { bar: '#005a9c', accent: '#ef3e42', onBar: '#ffffff' }) })
  const saved = out.store.clubs[119].find((e) => e.from === 1914)
  assert.equal(saved.bar, '#005A9C')
  assert.equal(saved.accent, '#EF3E42')
  assert.equal(saved.onBar, '#FFFFFF')
})

test('an onBar that fails AA against the bar is refused, with the ratio', () => {
  const out = applyEraSave(store(), { teamId: 119, era: era(1914, 1933, { bar: '#005A9C', onBar: '#333333' }) })
  assert.match(out.problem, /4\.5:1/)
  assert.equal(out.status, 400)
})

test('a bar needs an onBar, and an accent or onBar needs a bar', () => {
  assert.match(applyEraSave(store(), { teamId: 119, era: era(1914, 1933, { bar: '#005A9C' }) }).problem, /onBar/)
  assert.match(applyEraSave(store(), { teamId: 119, era: era(1914, 1933, { onBar: '#FFFFFF' }) }).problem, /bar/)
  assert.match(applyEraSave(store(), { teamId: 119, era: era(1914, 1933, { bar: 'blue', onBar: '#FFFFFF' }) }).problem, /#RRGGBB/)
})

test('empty colour strings clear the fields instead of storing ""', () => {
  const had = applyEraSave(store(), { teamId: 119, era: era(1914, 1933, { bar: '#005A9C', onBar: '#FFFFFF' }) }).store
  const out = applyEraSave(had, { teamId: 119, replaceFrom: 1914, era: era(1914, 1933, { bar: '', accent: '', onBar: '' }) })
  const saved = out.store.clubs[119].find((e) => e.from === 1914)
  assert.equal('bar' in saved, false)
  assert.equal('onBar' in saved, false)
})

// Era art may be an SVG or a PNG (the PNG for a logo that only exists as one).
test('era art is told apart by its bytes: a PNG by its signature, an SVG by its markup', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
  assert.equal(describeEraArt(png).ext, 'png')
  assert.equal(describeEraArt(Buffer.from('<svg viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>')).ext, 'svg')
  assert.match(describeEraArt(Buffer.from('GIF89a....')).problem, /not an SVG/)
  assert.match(describeEraArt(Buffer.from('<svg><script>x()</script></svg>')).problem, /script/)
  assert.match(describeEraArt(Buffer.alloc(2 * 1024 * 1024, 1)).problem, /too large/)
})
