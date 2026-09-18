#!/usr/bin/env node
// Regenerates the raw input to inventory.md (issue #1112): every CSS block
// under src/styles/ whose name ends in `card` or `pill`, with the partial that
// owns its base rule, the partials that hold any of its rules, and every module
// under src/ that consumes it.
//
// It prints FACTS, not verdicts. The verdicts in inventory.md are judgment and
// live only in that file.
//
// NOT \b. A word boundary does not exist between "card" and "__element",
// because underscore is a word character, so a \b-anchored regex silently drops
// every block that only ever appears as .block__element. That hid four blocks
// on the first pass — .ballparkcard, .chalcard, .rvcard, .radarpill — which are
// the exact group the inventory turned out to care about most. Use a negative
// lookahead instead.
//
// Run from the repo root:  node .scratch/design-system/inventory.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve('.')
const STYLES = join(ROOT, 'src/styles')
const SRC = join(ROOT, 'src')

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
const rel = (f) => relative(ROOT, f).split('\\').join('/')

const blockRe = /\.([a-z0-9-]*(?:card|pill))(?![a-z0-9-])/gi

const cssFiles = walk(STYLES).filter((f) => f.endsWith('.css'))
const jsFiles = walk(SRC).filter((f) => /\.(jsx?|mjs)$/.test(f))

// COMMENTS ARE NOT SELECTORS. Blanked (newline-preserving, so the line-anchored
// base-rule scan below still sees the same lines) before anything is matched.
// Without this the census counts a class name that only ever appears in prose:
// `.pin-card` was reported as a block with one selector hit and zero consumers,
// and the inventory filed it as dead code to delete. It was a comment in
// 12-sealbox.css citing an example that has never existed in this repo (#1127).
const decomment = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const blocks = new Map()
for (const f of cssFiles) {
  const text = decomment(readFileSync(f, 'utf8'))
  const r = rel(f)
  for (const m of text.matchAll(blockRe)) {
    const cls = m[1]
    if (!blocks.has(cls)) blocks.set(cls, { defs: new Map(), baseIn: new Set() })
    const rec = blocks.get(cls)
    rec.defs.set(r, (rec.defs.get(r) || 0) + 1)
  }
  // A BASE rule is a selector that is the bare block, with no element,
  // modifier, descendant or combinator — ".foo" or ".foo:hover".
  for (const m of text.matchAll(/^[ \t]*([^{}\n]+)\{/gm)) {
    for (const part of m[1].split(',')) {
      const bm = /^\.([a-z0-9-]*(?:card|pill))(?::[a-z-]+)?$/i.exec(part.trim())
      if (bm && blocks.has(bm[1])) blocks.get(bm[1]).baseIn.add(r)
    }
  }
}

const rows = []
for (const [cls, rec] of [...blocks].sort((a, b) => a[0].localeCompare(b[0]))) {
  const re = new RegExp("['\"`\\s]" + cls + "(?:__|--|['\"`\\s])")
  const consumers = jsFiles.filter((f) => re.test(readFileSync(f, 'utf8'))).map(rel)
  rows.push({
    cls,
    base: [...rec.baseIn],
    hits: [...rec.defs.values()].reduce((a, b) => a + b, 0),
    partials: [...rec.defs.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}(${n})`),
    consumers,
  })
}

for (const r of rows) {
  console.log(`\n### .${r.cls} — ${r.hits} selector hits`)
  console.log(`  base rule in: ${r.base.join(', ') || '(none — namespace only)'}`)
  console.log(`  partials: ${r.partials.join(' ')}`)
  console.log(`  consumers (${r.consumers.length}): ${r.consumers.join(' ') || '(none)'}`)
}

const cards = rows.filter((r) => /card$/i.test(r.cls))
const pills = rows.filter((r) => /pill$/i.test(r.cls))
console.log(`\n\n${rows.length} blocks — ${cards.length} card, ${pills.length} pill`)
console.log(`namespace-only (no base rule): ${rows.filter((r) => !r.base.length).length}`)
console.log(`zero consumers: ${rows.filter((r) => !r.consumers.length).map((r) => '.' + r.cls).join(' ') || '(none)'}`)
