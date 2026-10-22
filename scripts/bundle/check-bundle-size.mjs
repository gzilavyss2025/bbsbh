#!/usr/bin/env node
// Post-build guard: the built app may not grow past a budget, and the two big
// libraries that load on demand may not creep into the first load.
//
// WHY. Size only drifts up, and the build stays green while it does.
// src/components/CLAUDE.md says the Clerk components must stay dynamic so ~110 KB
// gz stays out of the entry chunk, and adds that a static import "would still
// build cleanly". Until this guard, that was a hand check on the output.
//
// TWO CHECKS, both on the artifact in dist/ (so it runs after `npm run build`, in
// .github/workflows/ci.yml, not inside `npm run lint`):
//
//   1. BUDGETS (bundle-size-budget.json, beside this file). Entry JS and CSS
//      gzipped, and the service worker's precache, which is what a first install
//      downloads. Each sits a few percent above its size when it was written, so
//      ordinary drift does not break an unrelated PR. Over a budget fails;
//      `--write` only ever LOWERS one (and refuses while anything fails).
//   2. LAZY LIBRARIES. No Clerk or pdf.js text may sit in the entry or in any
//      chunk it imports statically (the first load). A library is found by strings
//      its own code carries, never by a name this app uses: the entry holds the
//      app's `{ ClerkProvider }` destructure on purpose. A marker that matches no
//      lazy chunk at all has gone stale (the library was upgraded or dropped), and
//      that fails too, so the check can never pass by finding nothing.
//
// Sizes are this script's own gzip (zlib default level). Vite prints its own, about
// 1% apart, so compare against the numbers printed here, not the build log.
// Locally: `npm run build && npm run check:bundle`. How to read a failure and how
// to lower a budget: docs/testing.md, "Bundle size".
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { ROOT } from '../lib/walk.mjs'

const DIST = path.join(ROOT, 'dist')
const BUDGET_FILE = new URL('./bundle-size-budget.json', import.meta.url)

// A budget written by `--write` sits this far above the size measured then.
const HEADROOM = 1.03

export const METRICS = [
  { key: 'entryJsGzipKB', label: 'entry JS, gzip', unit: 'kB' },
  { key: 'entryCssGzipKB', label: 'entry CSS, gzip', unit: 'kB' },
  { key: 'precacheKiB', label: 'service-worker precache', unit: 'KiB' },
]

// Literal strings the library's own code carries, so they survive minifying. Two or
// three each: one reworded by an upgrade should not retire the check. These are
// what to change when the stale-marker failure names a library.
export const LAZY_LIBRARIES = {
  'Clerk (@clerk/clerk-react)': ['Clerk: Ensure that', 'clerk-js-script', '@clerk/clerk-react'],
  'pdf.js (pdfjs-dist)': ['UnknownErrorException', 'PDFWorker.fromPort'],
}

// The entry script and stylesheets, as index.html names them.
export function entryFiles(html) {
  const script = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/)?.[1]
  const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map((m) => m[1])
  return { script: script && script.replace(/^\//, ''), styles: styles.map((s) => s.replace(/^\//, '')) }
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

// Every library whose text is in the first load (offenders), and every library no
// chunk carries at all (stale markers). A library pulled into the entry takes its
// text with it, so a stale marker means NO file holds it, not "no lazy file":
// otherwise the very regression this exists for would also read as a rotted marker.
// `files` maps a path to its source.
export function lazyProblems(eager, files, libraries = LAZY_LIBRARIES) {
  const problems = []
  for (const [name, markers] of Object.entries(libraries)) {
    let found = false
    for (const [file, text] of files) {
      const hit = markers.find((m) => text.includes(m))
      if (!hit) continue
      found = true
      if (eager.has(file)) problems.push(`${name} is in the first load: ${file} holds "${hit}". A static import pulled it into the entry; make it dynamic again.`)
    }
    if (!found) problems.push(`${name}: no chunk holds any of ${markers.map((m) => `"${m}"`).join(', ')}, so this check would pass by finding nothing. Pick new marker strings from the library's built chunk in LAZY_LIBRARIES.`)
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

// A budget never rises here: each becomes HEADROOM over today, or stays if lower.
export function lowered(measured, budget) {
  return Object.fromEntries(
    METRICS.map(({ key }) => [key, Math.min(budget[key], Math.ceil(measured[key] * HEADROOM))]),
  )
}

const kB = (bytes) => Math.round(bytes / 100) / 10
const KiB = (bytes) => Math.round(bytes / 1024)
const gz = (buf) => gzipSync(buf).length

function measure() {
  const html = readFileSync(path.join(DIST, 'index.html'), 'utf8')
  const { script, styles } = entryFiles(html)
  if (!script || !styles.length) throw new Error('dist/index.html names no entry script or stylesheet.')
  const sw = readFileSync(path.join(DIST, 'sw.js'), 'utf8')
  const urls = precacheUrls(sw)
  if (!urls.length) throw new Error('dist/sw.js precaches nothing; the worker format may have changed.')
  const precacheBytes = urls.reduce((sum, u) => sum + statSync(path.join(DIST, u)).size, 0)
  const entryCss = Buffer.concat(styles.map((s) => readFileSync(path.join(DIST, s))))
  const entryJs = readFileSync(path.join(DIST, script))
  return {
    script,
    styles,
    measured: {
      entryJsGzipKB: Math.ceil(gz(entryJs) / 100) / 10,
      entryCssGzipKB: Math.ceil(gz(entryCss) / 100) / 10,
      precacheKiB: Math.ceil(precacheBytes / 1024),
    },
  }
}

function chunkTable(eager, limit = 10) {
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
    .map((r) => `  ${r.file.padEnd(w)}  ${String(kB(r.raw)).padStart(7)} kB raw  ${String(kB(r.gzip)).padStart(6)} kB gzip  ${eager.has(r.file) ? 'first load' : 'lazy'}`)
    .join('\n')
}

const HELP = `
  Find what grew: the ten biggest chunks are listed above. Fix the growth first.
  A budget goes up only as a deliberate decision, edited by hand in
  scripts/bundle/bundle-size-budget.json with the reason in the PR description,
  never as a reflex to get green. After a shrink, lower it:
    npm run check:bundle -- --write
`

function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('check-bundle-size: no dist/ — run `npm run build` first.')
    process.exit(1)
  }
  const { script, styles, measured } = measure()
  const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'))

  const assets = path.join(DIST, 'assets')
  const read = (f) => (existsSync(path.join(DIST, f)) ? readFileSync(path.join(DIST, f), 'utf8') : undefined)
  const eager = eagerChunks(script, read)
  const files = new Map(
    readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => [`assets/${f}`, readFileSync(path.join(assets, f), 'utf8')]),
  )

  const problems = [...overBudget(measured, budget), ...lazyProblems(eager, files)]

  const rows = METRICS.map(({ key, label, unit }) => {
    const room = (budget[key] / measured[key] - 1) * 100
    const verdict = room < 0 ? `${(-room).toFixed(1)}% OVER` : `${room.toFixed(1)}% headroom`
    return `  ${label.padEnd(24)} ${String(measured[key]).padStart(7)} ${unit.padEnd(3)}  budget ${String(budget[key]).padStart(5)} ${unit.padEnd(3)}  ${verdict}`
  })
  const firstLoad = new Set([...eager, ...styles])
  console.log(`check-bundle-size: ${eager.size} scripts load with the entry.\n${rows.join('\n')}\n\nTen biggest chunks:\n${chunkTable(firstLoad)}\n`)

  if (problems.length) {
    console.error(`check-bundle-size: ${problems.length} problem(s).\n${problems.map((p) => `  - ${p}`).join('\n')}\n${HELP}`)
    process.exit(1)
  }
  if (process.argv.includes('--write')) {
    writeFileSync(BUDGET_FILE, JSON.stringify(lowered(measured, budget), null, 2) + '\n')
    return console.log('check-bundle-size: bundle-size-budget.json lowered where the build shrank.')
  }
  const loose = METRICS.filter(({ key }) => budget[key] > measured[key] * HEADROOM * 1.03)
  if (loose.length) console.log(`check-bundle-size: ${loose.map((m) => m.key).join(', ')} sit well above the build. Lower with: npm run check:bundle -- --write`)
  console.log('check-bundle-size: ok.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
