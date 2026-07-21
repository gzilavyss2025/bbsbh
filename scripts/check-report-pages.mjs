#!/usr/bin/env node
// Guards against SiteMenu.jsx's and SiteFooter.jsx's "More Baseball" page
// lists drifting apart again the way they did before src/lib/reportPages.js
// existed (the menu was missing Top Games; the footer was missing Foul
// Tracker and My First Scorebook). Fails if either file stops importing the
// shared REPORT_PAGES array and goes back to a hand-rolled list.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const FILES = [
  join(ROOT, 'src/components/SiteMenu.jsx'),
  join(ROOT, 'src/components/SiteFooter.jsx'),
]

const IMPORT_RE = /import\s*\{\s*REPORT_PAGES\s*\}\s*from\s*['"].*lib\/reportPages\.js['"]/

const problems = []
for (const file of FILES) {
  const src = readFileSync(file, 'utf8')
  if (!IMPORT_RE.test(src)) {
    const rel = file.slice(file.indexOf('src')).replace(/\\/g, '/')
    problems.push(rel)
  }
}

if (problems.length) {
  console.error(
    '\n✗ Menu/footer page-list parity guard failed — the following file(s) no\n' +
      "  longer import REPORT_PAGES from src/lib/reportPages.js. That's exactly\n" +
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

console.log(
  '✓ SiteMenu.jsx and SiteFooter.jsx both build their page list from src/lib/reportPages.js.'
)
