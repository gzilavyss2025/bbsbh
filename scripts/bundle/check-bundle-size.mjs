#!/usr/bin/env node
// Post-build guard: the built app may not grow past a budget, and the two big
// libraries that load on demand may not creep into the first load.
//
// WHY. Size only drifts up, and the build stays green while it does.
// src/components/CLAUDE.md says the Clerk components must stay dynamic so ~110 KB
// raw (31 KB gz) stays out of the entry chunk, and adds that a static import "would
// still build cleanly". Until this guard, that was a hand check on the output.
//
// TWO CHECKS, both on the artifact in dist/ (so it runs after `npm run build`, in
// .github/workflows/ci.yml, not inside `npm run lint`):
//
//   1. BUDGETS (bundle-size-budget.json, beside this file). The JS of the whole
//      first load (the entry plus every chunk it imports statically), the entry
//      CSS, both gzipped, and the service worker's precache, which is what a first
//      install downloads. Each sits 3% above its size when it was written, so
//      ordinary drift does not break an unrelated PR. A ratchet with a band: over
//      a budget fails, and so does a budget more than 6% above the build, until
//      `--write` tightens it. `--write` only ever LOWERS a budget, and refuses
//      while anything else fails.
//   2. LAZY LIBRARIES. No Clerk or pdf.js text may sit in the first load. A library
//      is found by strings its own code carries, never by a name this app uses:
//      the entry holds the app's `{ ClerkProvider }` destructure on purpose. Every
//      marker must be found in SOME chunk; one that is not has gone stale (the
//      library was upgraded or dropped) and fails, so a check can never pass by
//      finding nothing.
//
// Sizes are this script's own gzip (zlib default level). Vite prints its own, about
// 1% apart, so compare against the numbers printed here, not the build log.
// Locally: `npm run build && npm run check:bundle`. How to read a failure and how
// to lower a budget: docs/testing.md, "Bundle size".
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { ROOT } from '../lib/walk.mjs'

const DIST = path.join(ROOT, 'dist')
const BUDGET_FILE = new URL('./bundle-size-budget.json', import.meta.url)

// A budget written by `--write` sits this far above the size measured then. One
// further headroom on top of it is the band: past that a budget is stale.
const HEADROOM = 1.03
const LOOSE = 1 + 2 * (HEADROOM - 1)

const METRICS = [
  { key: 'firstLoadJsGzipKB', label: 'first-load JS, gzip', unit: 'kB' },
  { key: 'entryCssGzipKB', label: 'entry CSS, gzip', unit: 'kB' },
  { key: 'precacheKiB', label: 'service-worker precache', unit: 'KiB' },
]

// Literal strings the library's own code carries, so they survive minifying. Every
// run checks each one is still in the build (a marker found in no chunk fails), so
// grep dist/assets for a new one before you add it.
export const LAZY_LIBRARIES = {
  'Clerk (@clerk/clerk-react)': ['Clerk: Ensure that', 'clerk-js-script', '@clerk/clerk-react'],
  'pdf.js (pdfjs-dist)': ['UnknownErrorException', 'PDFWorker'],
}

// The entry script and stylesheets, as index.html names them.
export function entryFiles(html) {
  const script = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="\/?([^"]+)"/)?.[1]
  const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="\/?([^"]+)"/g)].map((m) => m[1])
  return { script, styles }
}

// The entry plus every chunk it imports statically, which is the first load. A
// dynamic `import("./x.js")` has a paren, so it is not followed. `read(file)`
// returns a chunk's source, or undefined.
export function eagerChunks(entry, read) {
  const seen = new Set()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const src = read(file) ?? ''
    for (const m of src.matchAll(/(?:\bfrom|\bimport)\s*"(\.{1,2}\/[^"]+\.js)"/g)) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])))
    }
  }
  return seen
}

// The urls the generated worker precaches, relative to dist/. Each once: the
// manifest lists five icons twice, and an install fetches a url one time, which is
// why the total here matches the PWA plugin's figure rather than a sum of entries.
export function precacheUrls(swSource) {
  const array = swSource.match(/precacheAndRoute\(\[(.*?)\],\{/s)?.[1] ?? ''
  return [...new Set([...array.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))]
}

// Every library whose text is in the first load, and every marker no chunk holds at
// all (stale). A library pulled into the entry takes its text with it, so stale
// means NO file holds the marker, not "no lazy file": otherwise the very regression
// this exists for would also read as a rotted marker. `files` maps a path to its
// source (a string or a Buffer).
export function lazyProblems(eager, files, libraries = LAZY_LIBRARIES) {
  const problems = []
  for (const [name, markers] of Object.entries(libraries)) {
    const early = new Map() // first-load file -> the first marker it holds
    for (const marker of markers) {
      const holders = [...files].filter(([, text]) => text.includes(marker)).map(([file]) => file)
      if (!holders.length) problems.push(`${name}: no chunk holds "${marker}", so this marker checks nothing. Replace it in LAZY_LIBRARIES with a string from the library's built chunk.`)
      for (const file of holders) if (eager.has(file) && !early.has(file)) early.set(file, marker)
    }
    for (const [file, marker] of early) problems.push(`${name} is in the first load: ${file} holds "${marker}". A static import pulled it into the entry; make it dynamic again.`)
  }
  return problems
}

export function overBudget(measured, budget) {
  return METRICS.filter(({ key }) => !(key in budget) || measured[key] > budget[key]).map(({ key, label, unit }) =>
    key in budget
      ? `${label} is ${measured[key]} ${unit}, over its budget of ${budget[key]} ${unit}.`
      : `${key} has no entry in bundle-size-budget.json.`,
  )
}

// A budget well above the build is stale: the shrink that opened the gap tightens it
// in the same PR, as every other ratchet here does.
export function looseBudgets(measured, budget) {
  return METRICS.filter(({ key }) => key in budget && budget[key] > measured[key] * LOOSE).map(
    ({ key, label, unit }) => `${label} is ${measured[key]} ${unit}, more than 6% under its budget of ${budget[key]} ${unit}. Tighten it with: npm run check:bundle -- --write`,
  )
}

// A budget never rises here: each becomes HEADROOM over today, or stays if lower.
export function lowered(measured, budget) {
  return Object.fromEntries(
    METRICS.map(({ key }) => [key, Math.min(budget[key], Math.ceil(measured[key] * HEADROOM))]),
  )
}

const kB = (bytes) => Math.round(bytes / 100) / 10
const gz = (buf) => gzipSync(buf).length

// `files` maps dist/assets paths to Buffers; the first load is gzipped chunk by
// chunk, which is how a browser receives it.
function measure(files, eager, styles) {
  const urls = precacheUrls(readFileSync(path.join(DIST, 'sw.js'), 'utf8'))
  if (!urls.length) throw new Error('dist/sw.js precaches nothing; the worker format may have changed.')
  const precacheBytes = urls.reduce((sum, u) => sum + statSync(path.join(DIST, u)).size, 0)
  const firstLoadJs = [...eager].reduce((sum, f) => sum + (files.has(f) ? gz(files.get(f)) : 0), 0)
  const entryCss = Buffer.concat(styles.map((s) => readFileSync(path.join(DIST, s))))
  return {
    firstLoadJsGzipKB: Math.ceil(firstLoadJs / 100) / 10,
    entryCssGzipKB: Math.ceil(gz(entryCss) / 100) / 10,
    precacheKiB: Math.ceil(precacheBytes / 1024),
  }
}

function chunkTable(firstLoad, limit = 10) {
  const dir = path.join(DIST, 'assets')
  const rows = readdirSync(dir)
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => {
      const buf = readFileSync(path.join(dir, f))
      return { file: `assets/${f}`, raw: buf.length, gzip: gz(buf) }
    })
    .sort((a, b) => b.gzip - a.gzip)
  const w = Math.max(...rows.slice(0, limit).map((r) => r.file.length))
  return rows
    .slice(0, limit)
    .map((r) => `  ${r.file.padEnd(w)}  ${String(kB(r.raw)).padStart(7)} kB raw  ${String(kB(r.gzip)).padStart(6)} kB gzip  ${firstLoad.has(r.file) ? 'first load' : 'lazy'}`)
    .join('\n')
}

const HELP = `
  Find what grew: the ten biggest chunks are listed above. Fix the growth first.
  A budget goes up only as a deliberate decision, edited by hand in
  scripts/bundle/bundle-size-budget.json with the reason in the PR description,
  never as a reflex to get green. After a shrink, lower it:
    npm run check:bundle -- --write
`

const list = (items) => items.map((p) => `  - ${p}`).join('\n')

function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('check-bundle-size: no dist/ — run `npm run build` first.')
    process.exit(1)
  }
  const { script, styles } = entryFiles(readFileSync(path.join(DIST, 'index.html'), 'utf8'))
  if (!script || !styles.length) throw new Error('dist/index.html names no entry script or stylesheet.')

  const assets = path.join(DIST, 'assets')
  const files = new Map(readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => [`assets/${f}`, readFileSync(path.join(assets, f))]))
  const eager = eagerChunks(script, (f) => files.get(f)?.toString())
  const measured = measure(files, eager, styles)
  const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'))

  const rows = METRICS.map(({ key, label, unit }) => {
    const room = (budget[key] / measured[key] - 1) * 100
    const verdict = room < 0 ? `${(-room).toFixed(1)}% OVER` : `${room.toFixed(1)}% headroom`
    return `  ${label.padEnd(24)} ${String(measured[key]).padStart(7)} ${unit.padEnd(3)}  budget ${String(budget[key]).padStart(5)} ${unit.padEnd(3)}  ${verdict}`
  })
  console.log(`check-bundle-size: ${eager.size} scripts load with the entry.\n${rows.join('\n')}\n\nTen biggest chunks:\n${chunkTable(new Set([...eager, ...styles]))}\n`)

  const budgetProblems = overBudget(measured, budget)
  const problems = [...budgetProblems, ...lazyProblems(eager, files)]
  if (problems.length) {
    console.error(`check-bundle-size: ${problems.length} problem(s).\n${list(problems)}\n${budgetProblems.length ? HELP : ''}`)
    process.exit(1)
  }
  if (process.argv.includes('--write')) {
    writeFileSync(BUDGET_FILE, JSON.stringify(lowered(measured, budget), null, 2) + '\n')
    return console.log('check-bundle-size: bundle-size-budget.json lowered where the build shrank.')
  }
  const loose = looseBudgets(measured, budget)
  if (loose.length) {
    console.error(`check-bundle-size: ${loose.length} budget(s) out of date.\n${list(loose)}\n`)
    process.exit(1)
  }
  console.log('check-bundle-size: ok.')
}

// Compare real paths: `import.meta.url` is the real path, `process.argv[1]` is the
// path as typed, so a symlinked checkout would otherwise run nothing and exit 0.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main()
