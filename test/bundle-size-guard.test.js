import assert from 'node:assert/strict'
import test from 'node:test'
import {
  entryFiles,
  eagerChunks,
  lazyProblems,
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

test('library text in the entry fails and names the library and the file', () => {
  const problems = lazyProblems(
    new Set(['assets/index.js']),
    files({ 'assets/index.js': 'x;"clerk-js-script";y', 'assets/dist.js': 'Clerk: Ensure that', 'assets/pdf.js': 'UnknownErrorException' }),
  )
  assert.equal(problems.length, 1)
  assert.match(problems[0], /Clerk.*first load.*assets\/index\.js/)
})

test('library text in a chunk the entry imports statically fails too', () => {
  const problems = lazyProblems(
    new Set(['assets/index.js', 'assets/shared.js']),
    files({ 'assets/index.js': '', 'assets/shared.js': 'UnknownErrorException', 'assets/dist.js': 'Clerk: Ensure that', 'assets/pdf.js': 'PDFWorker.fromPort' }),
  )
  assert.equal(problems.length, 1)
  assert.match(problems[0], /pdf\.js.*assets\/shared\.js/)
})

test('the app destructuring ClerkProvider in the entry is not library text', () => {
  const problems = lazyProblems(
    new Set(['assets/index.js']),
    files({
      'assets/index.js': 'let[{ClerkProvider:e}]=await import("./dist.js")',
      'assets/dist.js': 'Clerk: Ensure that ClerkProvider',
      'assets/pdf.js': 'PDFWorker.fromPort',
    }),
  )
  assert.deepEqual(problems, [])
})

test('a library with no marker in any chunk fails, so the check cannot pass by finding nothing', () => {
  const problems = lazyProblems(new Set(['assets/index.js']), files({ 'assets/index.js': '', 'assets/pdf.js': 'PDFWorker.fromPort' }))
  assert.equal(problems.length, 1)
  assert.match(problems[0], /Clerk.*finding nothing/)
})

test('a library moved wholesale into the entry reports the first load only, not a stale marker', () => {
  const problems = lazyProblems(
    new Set(['assets/index.js']),
    files({ 'assets/index.js': 'Clerk: Ensure that', 'assets/pdf.js': 'PDFWorker.fromPort' }),
  )
  assert.equal(problems.length, 1)
  assert.match(problems[0], /Clerk.*first load/)
})

const budget = { entryJsGzipKB: 100, entryCssGzipKB: 50, precacheKiB: 1000 }

test('a size over its budget fails and a size at its budget passes', () => {
  assert.deepEqual(overBudget({ entryJsGzipKB: 100, entryCssGzipKB: 50, precacheKiB: 1000 }, budget), [])
  const problems = overBudget({ entryJsGzipKB: 100.1, entryCssGzipKB: 50, precacheKiB: 1000 }, budget)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /entry JS.*100\.1 kB.*100 kB/)
})

test('a metric missing from the budget file fails', () => {
  const problems = overBudget({ entryJsGzipKB: 1, entryCssGzipKB: 1, precacheKiB: 1 }, { entryJsGzipKB: 100, entryCssGzipKB: 50 })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /precacheKiB/)
})

test('--write sets each budget 3% over today, rounded up, and never raises one', () => {
  assert.deepEqual(
    lowered({ entryJsGzipKB: 80, entryCssGzipKB: 49, precacheKiB: 900 }, budget),
    { entryJsGzipKB: 83, entryCssGzipKB: 50, precacheKiB: 927 },
  )
})
