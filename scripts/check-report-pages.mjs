#!/usr/bin/env node
// Guards against SiteMenu.jsx's, SiteFooter.jsx's, and ReportFooter.jsx's
// "More Baseball" page lists drifting apart again the way they did before
// src/lib/reportPages.js existed (the menu was missing Top Games; the footer
// was missing Foul Tracker and My First Scorebook). Fails if any of the three
// files stops importing the shared REPORT_PAGES array and goes back to a
// hand-rolled list.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const FILES = [
  join(ROOT, 'src/components/chrome/SiteMenu.jsx'),
  join(ROOT, 'src/components/chrome/SiteFooter.jsx'),
  join(ROOT, 'src/components/chrome/ReportFooter.jsx'),
]

// Any of the three shared exports satisfies the guard: the two footers render
// the grouped PAGE_GROUPS, SiteMenu renders MENU_GROUPS (those groups plus
// guides and tools), and REPORT_PAGES is the flat array derived from
// PAGE_GROUPS. All three live in reportPages.js and all three are built from
// the same group declarations, so a file importing any one of them cannot
// drift from the others. What must never happen — and what this still catches —
// is a file going back to a hand-rolled literal list.
const IMPORT_RE =
  /import\s*\{[^}]*\b(?:REPORT_PAGES|MENU_GROUPS|PAGE_GROUPS)\b[^}]*\}\s*from\s*['"].*lib\/reportPages\.js['"]/

const problems = []
for (const file of FILES) {
  const rel = file.slice(file.indexOf('src')).replace(/\\/g, '/')
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    // Moved, renamed, or deleted. Report it in one line rather than dying on an
    // ENOENT stack trace — and never pass quietly, which is what silently
    // dropping the entry would amount to. Same failure shape as
    // check-stamp-surfaces.mjs's named-but-missing branch.
    problems.push(`${rel} — named in this guard but no longer exists`)
    continue
  }
  if (!IMPORT_RE.test(src)) problems.push(rel)
}

if (problems.length) {
  console.error(
    '\n✗ Menu/footer page-list parity guard failed — the following file(s) no\n' +
      '  longer import PAGE_GROUPS, MENU_GROUPS or REPORT_PAGES from\n' +
      '  src/lib/reportPages.js.\n' +
      "  That's exactly\n" +
      '  how the hamburger menu and the footer\'s "More Baseball" list drifted\n' +
      '  apart before (a page added/renamed in one file but not the other):\n'
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Add or rename a report page in src/lib/reportPages.js once — both\n' +
      '  SiteMenu.jsx and SiteFooter.jsx spread that same array — rather than\n' +
      '  editing either file\'s list directly.\n'
  )
  process.exit(1)
}

// Second half of the same guard, for the second thing that can drift: the
// directory GLYPHS. DirectoryHeading.jsx draws one line mark per group and
// picks it by `group.id`, with a `default` branch so it can never crash — and
// that fallback is the hazard. A group added to reportPages.js without a mark
// of its own does not fail, it silently borrows "The site"'s scoreboard, and
// two headings then read as the same thing. This is not hypothetical: the
// broadcast strand ("Around the game") arrived on one branch while the glyphs
// arrived on another, and nothing but this check would have said so.
const GLYPH_FILE = join(ROOT, 'src/components/chrome/DirectoryHeading.jsx')
const glyphSrc = readFileSync(GLYPH_FILE, 'utf8')
const { MENU_GROUPS } = await import(
  new URL('../src/lib/reportPages.js', import.meta.url).href
)

const unmarked = MENU_GROUPS.map((group) => group.id).filter(
  (id) => !new RegExp(`case '${id}':`).test(glyphSrc)
)

if (unmarked.length) {
  console.error(
    '\n✗ Directory glyph coverage failed — the following group id(s) in\n' +
      '  src/lib/reportPages.js have no `case` of their own in\n' +
      '  src/components/chrome/DirectoryHeading.jsx, so the menu, both footers\n' +
      "  and /more all draw them with the fallback mark — the same one 'tools'\n" +
      '  uses:\n'
  )
  for (const id of unmarked) console.error(`  ${id}`)
  console.error(
    '\n  Draw the group its own line mark in DirectoryHeading.jsx. Keep it to\n' +
      '  the same few strokes as its neighbours — these render at 19px.\n'
  )
  process.exit(1)
}

console.log(
  '✓ SiteMenu.jsx, SiteFooter.jsx, and ReportFooter.jsx all build their page list from src/lib/reportPages.js.'
)
console.log(
  `✓ All ${MENU_GROUPS.length} directory groups have a glyph of their own in DirectoryHeading.jsx.`
)
