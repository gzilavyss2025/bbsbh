#!/usr/bin/env node
// Guards the STRIKE-THROUGH invariant: a rule that crosses a name out must also
// cross out the name LINK inside it.
//
// Player and team names are `PlayerLink`/`TeamLink`, which render a <button
// class="plink">. Two things stop an ancestor's pencil line from reaching that
// button: `text-decoration-line` does not propagate into an atomic inline-level
// box, and `.plink` sets `text-decoration: none` outright. So a rule like
//
//     .defdiamond__name--out { text-decoration: line-through; }
//
// draws nothing at all when its whole content is a linked surname — which is
// exactly what happened to the defense diamond's replaced fielders: the line
// showed only over the un-linked " (6th)" inning tag beside the name, so the
// strike looked like it "worked on some of them".
//
// The fix is always the same shape, and two rules already had it:
//
//     .pbp__replaced,
//     .pbp__replaced .plink { text-decoration: line-through; }
//
// So: every rule declaring a `line-through` must name `.plink` somewhere in its
// selector list. A rule whose struck text can never hold a link (a pill, a
// superseded count) opts out with a `strike-link-exempt` comment anywhere in
// that rule or the comment above it — the same marker convention
// check-focus-ring/check-name-casing use, widened to the rule so the exemption
// has room to say WHY.
//
// Run by `npm run lint`. Zero deps, scans src/styles/*.css.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Read the DIRECTORY TREE rather than a fixed list, like check-focus-ring.mjs,
// so a new partial is covered the moment it exists — subdirectories included,
// since `scorecard/footer.css` carries one of the four strike sites and
// `motion/strike.css` now carries the bar that draws them.
const stylesDir = resolve('src/styles')
const listSheets = (dir, prefix) =>
  readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return listSheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css')
      ? [{ rel: `src/styles/${prefix}${f}`, raw: readFileSync(abs, 'utf8') }]
      : []
  })
const sheets = listSheets(stylesDir, '').sort((a, b) => a.rel.localeCompare(b.rel))

// Same vacuous-pass hazard as its siblings: if the stylesheets move, this check
// must be repointed rather than left printing ✓ over nothing. There must also
// be at least one line-through rule left — if the last one is deleted, this
// guard is guarding an invariant nothing exercises any more.
const strikeCount = sheets.reduce(
  (n, s) =>
    n + (s.raw.replace(/\/\*[\s\S]*?\*\//g, '').match(/line-through/g) || []).length,
  0,
)
if (!sheets.length || strikeCount === 0) {
  console.error(
    '\n✗ Strike-through guard has nothing to check — found ' +
      sheets.length +
      ' sheet(s) in src/styles/ and ' +
      strikeCount +
      ' line-through rule(s).\n' +
      '  If the stylesheets moved, repoint this script IN THE SAME COMMIT as the\n' +
      '  move. Do not delete this assertion — a vacuous pass still prints ✓.\n',
  )
  process.exit(1)
}

const errors = []

// Innermost CSS rules: a selector list, then a body with no nested braces. Picks
// leaf rules out of @media blocks too (the outer `@media {` body has braces, so
// it never matches).
const ruleRe = /([^{}]*)\{([^{}]*)\}/g
const strikeRe = /text-decoration(?:-line)?\s*:\s*([^;}]*line-through[^;}]*)[;}]?/g

for (const { rel, raw } of sheets) {
  // Blank out comments while preserving every newline and each line's length,
  // so char offsets and line numbers stay exact.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const lineAt = (index) => css.slice(0, index).split('\n').length
  ruleRe.lastIndex = 0

  let rule
  while ((rule = ruleRe.exec(css))) {
    const [, selector, body] = rule
    const bodyStart = rule.index + selector.length + 1 // '{' consumed
    // Comments are blanked in `css` but keep their length, so the same offsets
    // read the ORIGINAL text back out — including the doc comment above the
    // rule, which `([^{}]*)` swept into the selector capture.
    const source = raw.slice(rule.index, rule.index + rule[0].length)

    strikeRe.lastIndex = 0
    let decl
    while ((decl = strikeRe.exec(body))) {
      const line = lineAt(bodyStart + decl.index)
      if (/strike-link-exempt/i.test(source)) continue
      // Either the rule targets .plink itself (a name link carrying the struck
      // class directly, e.g. `.roster__row.is-entered .roster__name`) or it
      // names .plink in a companion selector. Only the second is checkable from
      // the stylesheet alone, so that is what this asks for.
      if (selector.includes('.plink')) continue
      errors.push(
        `${rel}:${line}: ${selector.trim().replace(/\s*\n\s*/g, ' ')} — ` +
          'line-through never reaches a <button class="plink"> name link inside it. ' +
          'Add a `<selector> .plink` companion to the selector list ' +
          '(or mark text that can hold no link with a /* strike-link-exempt */ comment).',
      )
    }
  }
}

if (errors.length) {
  console.error(
    '\n✗ STRIKE-THROUGH invariant violated — a crossed-out name must cross out its link too.\n',
  )
  for (const error of errors) console.error(`  ${error}`)
  console.error('')
  process.exit(1)
}

console.log('✓ STRIKE-THROUGH invariant holds — every line-through rule covers its .plink names.')
