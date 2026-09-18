#!/usr/bin/env node
// --fs-caption may only ever SHRINK.
//
// THE PROBLEM THIS EXISTS TO CLOSE. Before #1128, `font-size: var(--fs-caption)`
// appeared 793 times across three type faces. One 11px role did every small-text
// job in the app: the uppercase section label, the mono figure in a table cell,
// and the running paragraph a phone reader squints at. A role used everywhere
// says nothing, and — worse — it cannot be changed, because any value that suits
// a table figure is wrong for a paragraph and vice versa.
//
// #1128 split it by the job each rule does: --fs-label (12px, the display-face
// label), --fs-cell (11px, the mono figure), --fs-small (13px, running copy).
// 669 of the 793 moved. The 124 left are ONE job — body-face text too short to
// be a sentence — plus the rules whose face could not be shown, because they
// never rendered on any route the sweep walked and a rule that might sit inside
// a mono table was not going to be moved on a guess.
//
// Left alone, that residue grows back. A new rule reaches for the name it has
// seen most, and in a year --fs-caption is the universal small size again and
// the split was a weekend. So the count is a RATCHET: it may fall, it may not
// rise. Lower BUDGET whenever it falls, in the same commit that makes it fall.
//
// Reclassifying a rule is the intended way to spend this budget down: render
// the surface, see which face it is really in, and move it to the role that
// names it. .scratch/design-system/prB/ has the sweep and the evidence.
//
// Zero deps. Run by `npm run lint`.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// The number of `font-size: var(--fs-caption)` declarations under src/styles/.
// DOWNWARD ONLY. See the header before you touch it.
const BUDGET = 124

const stylesDir = resolve('src/styles')
const sheets = []
;(function walk(dir, prefix) {
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) walk(abs, `${prefix}${f}/`)
    else if (f.endsWith('.css')) sheets.push({ rel: `src/styles/${prefix}${f}`, css: readFileSync(abs, 'utf8') })
  }
})(stylesDir, '')

// A guard that stops guarding still prints its tick, which reads as coverage.
// If the partials ever move, repoint this script IN THE SAME COMMIT.
if (sheets.length < 50) {
  console.error(
    `\n✗ Caption budget guard has nothing to check — found ${sheets.length} sheet(s) under src/styles/.\n` +
      '  If the stylesheets moved, repoint this script in the same commit as the move.\n',
  )
  process.exit(1)
}

const DECL = /font-size\s*:\s*var\(\s*--fs-caption\s*\)/g
const hits = []
for (const { rel, css } of sheets) {
  // Comments first, so a note that mentions the token is never counted as one.
  const masked = css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  for (const m of masked.matchAll(DECL)) {
    hits.push(`${rel}:${masked.slice(0, m.index).split('\n').length}`)
  }
}

if (hits.length > BUDGET) {
  console.error(
    `\n✗ --fs-caption is growing back: ${hits.length} declarations against a budget of ${BUDGET}.\n\n` +
      '  This role was split by job in #1128 precisely because one 11px name doing\n' +
      '  every small-text job cannot be changed. Send the new rule to the role that\n' +
      '  names what it renders:\n\n' +
      '    --fs-label  12px  a label, a pill, a table head — the display face\n' +
      '    --fs-cell   11px  a figure in a cell — the mono face\n' +
      '    --fs-small  13px  a sentence — running copy, in the body or read face\n\n' +
      '  --fs-caption is body-face text too short to be a sentence, and nothing else.\n' +
      `  The ${hits.length - BUDGET} newest of these are the ones to look at:\n` +
      hits.slice(-(hits.length - BUDGET)).map((h) => `    ${h}`).join('\n') + '\n',
  )
  process.exit(1)
}

if (hits.length < BUDGET) {
  console.error(
    `\n✗ --fs-caption is down to ${hits.length} declarations, under its budget of ${BUDGET}.\n` +
      '  That is the good direction — now bank it: set BUDGET to ' + hits.length + ' in\n' +
      '  scripts/check-caption-budget.mjs, in this same commit. A ratchet that is not\n' +
      '  tightened is a ceiling nobody is under.\n',
  )
  process.exit(1)
}

console.log(`✓ --fs-caption holds at ${hits.length}/${BUDGET} declarations — the split has not grown back.`)
