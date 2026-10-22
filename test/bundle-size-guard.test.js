import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LAZY_LIBRARIES,
  entryFiles,
  eagerChunks,
  lazyProblems,
  looseBudgets,
  lowered,
  overBudget,
  precacheUrls,
} from '../scripts/bundle/check-bundle-size.mjs'

// The pure half of the post-build bundle guard. Every case is a string or a Map;
// the build itself is checked in CI by `npm run check:bundle`.

test('entryFiles reads the module script and the stylesheet, not the worker register script', () => {
  const html = `
    <script type="module" crossorigin src="/assets/index-AAA.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/react-BBB.js">
    <link rel="stylesheet" crossorigin href="/assets/index-CCC.css">
    <script id="vite-plugin-pwa:register-sw" src="/registerSW.js"></script>`
  assert.deepEqual(entryFiles(html), { script: 'assets/index-AAA.js', styles: ['assets/index-CCC.css'] })
})

test('eagerChunks follows static imports and leaves dynamic ones out', () => {
  const graph = {
    'assets/index.js': 'import{a as x}from"./a.js";import"./b.js";const l=()=>import("./lazy.js");__vitePreload(()=>import("./lazy2.js"),[])',
    'assets/a.js': 'import{c}from"./c.js";export{c}',
    'assets/b.js': 'export const b=1',
    'assets/c.js': 'import{x}from"./index.js";export const c=x',
  }
  const eager = eagerChunks('assets/index.js', (f) => graph[f])
  assert.deepEqual([...eager].sort(), ['assets/a.js', 'assets/b.js', 'assets/c.js', 'assets/index.js'])
})

test('precacheUrls lists each url once and ignores a url: outside the manifest', () => {
  const sw = 'x();precacheAndRoute([{url:"a.js",revision:null},{url:"i.png",revision:"1"},{url:"i.png",revision:"1"}],{}),y({url:"not-precached"})'
  assert.deepEqual(precacheUrls(sw), ['a.js', 'i.png'])
})

const files = (obj) => new Map(Object.entries(obj))

// Made-up markers, so these cases test the rule and not the current library text.
const LIBS = { Clerk: ['clerk-a', 'clerk-b'], pdf: ['pdf-a'] }
const lazyFiles = { 'assets/dist.js': 'clerk-a clerk-b', 'assets/pdf.js': 'pdf-a' }

test('markers only in lazy chunks are clean', () => {
  const eager = new Set(['assets/index.js'])
  assert.deepEqual(lazyProblems(eager, files({ 'assets/index.js': 'app code', ...lazyFiles }), LIBS), [])
})

test('library text in the entry fails and names the library and the file', () => {
  const problems = lazyProblems(new Set(['assets/index.js']), files({ 'assets/index.js': 'x;pdf-a;y', ...lazyFiles }), LIBS)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /pdf is in the first load.*assets\/index\.js/)
})

test('library text in a chunk the entry imports statically fails too', () => {
  const eager = new Set(['assets/index.js', 'assets/shared.js'])
  const problems = lazyProblems(eager, files({ 'assets/index.js': '', 'assets/shared.js': 'clerk-b', ...lazyFiles }), LIBS)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /Clerk.*assets\/shared\.js/)
})

test('a library moved wholesale into the entry is one first-load problem, not a stale marker per marker', () => {
  const problems = lazyProblems(new Set(['assets/index.js']), files({ 'assets/index.js': 'clerk-a clerk-b', 'assets/pdf.js': 'pdf-a' }), LIBS)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /Clerk is in the first load/)
})

test('a marker no chunk holds fails by name, even when the library has another marker that is found', () => {
  const problems = lazyProblems(new Set(['assets/index.js']), files({ 'assets/index.js': '', 'assets/dist.js': 'clerk-a', 'assets/pdf.js': 'pdf-a' }), LIBS)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no chunk holds "clerk-b"/)
})

test('the app destructuring ClerkProvider in the entry is not library text', () => {
  // The real markers: every one sits in the lazy chunk, none in the entry.
  const everyMarker = Object.values(LAZY_LIBRARIES).flat().join(' ')
  const problems = lazyProblems(
    new Set(['assets/index.js']),
    files({ 'assets/index.js': 'let[{ClerkProvider:e}]=await import("./dist.js")', 'assets/dist.js': everyMarker }),
  )
  assert.deepEqual(problems, [])
})

const budget = { firstLoadJsGzipKB: 100, entryCssGzipKB: 50, precacheKiB: 1000 }

test('a size over its budget fails and a size at its budget passes', () => {
  assert.deepEqual(overBudget({ firstLoadJsGzipKB: 100, entryCssGzipKB: 50, precacheKiB: 1000 }, budget), [])
  const problems = overBudget({ firstLoadJsGzipKB: 100.1, entryCssGzipKB: 50, precacheKiB: 1000 }, budget)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /first-load JS.*100\.1 kB.*100 kB/)
})

test('a metric missing from the budget file fails', () => {
  const problems = overBudget({ firstLoadJsGzipKB: 1, entryCssGzipKB: 1, precacheKiB: 1 }, { firstLoadJsGzipKB: 100, entryCssGzipKB: 50 })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /precacheKiB/)
})

test('a budget more than 6% above the build is stale and fails; one within the band passes', () => {
  const measured = { firstLoadJsGzipKB: 100, entryCssGzipKB: 50, precacheKiB: 1000 }
  assert.deepEqual(looseBudgets(measured, { firstLoadJsGzipKB: 103, entryCssGzipKB: 53, precacheKiB: 1050 }), [])
  const problems = looseBudgets(measured, { firstLoadJsGzipKB: 115, entryCssGzipKB: 50, precacheKiB: 1000 })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /first-load JS.*100 kB.*budget of 115 kB.*--write/)
})

test('--write sets each budget 3% over today, rounded up, and never raises one', () => {
  assert.deepEqual(
    lowered({ firstLoadJsGzipKB: 80, entryCssGzipKB: 49, precacheKiB: 900 }, budget),
    { firstLoadJsGzipKB: 83, entryCssGzipKB: 50, precacheKiB: 927 },
  )
})
