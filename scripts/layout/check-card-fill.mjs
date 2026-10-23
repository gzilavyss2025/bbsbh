#!/usr/bin/env node
// A rule that sizes a card, or any child, to 100% of its parent's height is rejected.
//
// A named stamped card clears its own name tab with a 14px top margin (`.card--named`,
// src/styles/system/card.css). Percent heights ignore that margin: `height: 100%` plus 14px of
// margin runs the card 14px past its parent, into the gap and the tab of the card below. That is how
// Platoon, Roster and Tale of the tape ended up rubbed against the card above them
// (.ww-scout__card > * { height: 100% }, fixed 2026-10-23). A parent that wants "the card fills
// the cell" makes itself a flex column and gives the child `flex: 1`, which counts the margin.
//
// Flagged: `height`, `min-height`, `block-size` or `min-block-size` set to `100%` or `calc(100% ...)`
// in a rule whose selector ends in `> *` (any child) or in a `.card` / `.card--*` class. A rule for a
// named part (an image, a bar, an overlay) is not a card slot and is not read. A real exception
// takes `card-fill-exempt: <reason>` in a comment on the line before the rule. The reason is
// required. The rendered check for the same bug is e2e/tab-clearance.spec.js.
//
// Scans src/styles/, src/tokens/ and src/index.css. Run by `npm run lint`.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import postcss from 'postcss'
import { ROOT, toPosix, walk } from '../lib/walk.mjs'
import { markedBefore } from './check-layout-ratchet.mjs'

const EXEMPT = /card-fill-exempt\s*:\s*\S/
const SIZE_PROPS = /^(?:min-)?(?:height|block-size)$/i
const FILL = /^(?:100%|calc\(\s*100%[^)]*\))$/i
// A trailing state on the last compound: `:hover`, `:not(.x)`, `::before`.
const STATE = String.raw`(?::{1,2}[\w-]+(?:\([^)]*\))?)*`
const ANY_CHILD = new RegExp(String.raw`>\s*\*${STATE}\s*$`)
const CARD_CLASS = new RegExp(String.raw`\.card(?:--[\w-]+)?(?![\w-])${STATE}\s*$`)

const isKeyframes = (rule) => {
  for (let p = rule.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true
  return false
}

// -> [{ line, selector, decl }] for every unexempt rule in `css` that fills a card slot.
export function findCardFill(css) {
  const found = []
  postcss.parse(css).walkRules((rule) => {
    if (isKeyframes(rule) || markedBefore(rule, EXEMPT)) return
    const hit = rule.selectors.find((sel) => ANY_CHILD.test(sel) || CARD_CLASS.test(sel))
    if (!hit) return
    rule.each((d) => {
      if (d.type === 'decl' && SIZE_PROPS.test(d.prop) && FILL.test(d.value.trim())) {
        found.push({ line: d.source.start.line, selector: hit.replace(/\s+/g, ' ').trim(), decl: `${d.prop}: ${d.value}` })
      }
    })
  })
  return found
}

export function styleFiles() {
  return [
    ...walk(`${ROOT}/src/styles`, { exts: ['.css'] }),
    ...walk(`${ROOT}/src/tokens`, { exts: ['.css'] }),
    `${ROOT}/src/index.css`,
  ]
}

const HELP = `
  A named card carries a top margin for its name tab, and a percent height ignores it, so the
  card runs past its parent into the next card. Fill the parent with flex instead:
    .parent { display: flex; flex-direction: column; }
    .parent > * { flex: 1; }
  For a real exception, put \`/* card-fill-exempt: <reason> */\` on the line before the rule.
`

function main() {
  const problems = []
  for (const file of styleFiles()) {
    for (const f of findCardFill(readFileSync(file, 'utf8'))) {
      problems.push(`${toPosix(relative(ROOT, file))}:${f.line}  ${f.selector} { ${f.decl} }`)
    }
  }
  if (problems.length) {
    console.error(`\n✗ Card fill: ${problems.length} rule(s) size a card to 100% of its parent.\n`)
    for (const p of problems) console.error(`  ${p}`)
    console.error(HELP)
    process.exit(1)
  }
  console.log('✓ Card fill: no rule sizes a card to 100% of its parent.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
