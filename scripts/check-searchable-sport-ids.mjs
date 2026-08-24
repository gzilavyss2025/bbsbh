#!/usr/bin/env node
// Guards the four independent copies of the searchable/full-season MiLB level
// set — MLB + AAA/AA/High-A/Single-A, `[1, 11, 12, 13, 14]` — against silently
// drifting apart (issue #852). Each copy exists because its file can't import
// the canonical one:
//
//   1. src/lib/teams.js's SEARCHABLE_SPORT_IDS — the canonical, browser-side
//      source. Every other copy below restates this value by hand.
//   2. scripts/gen-teams.mjs — a plain Node script; importing browser-facing
//      src/ into it isn't worth the coupling for one array literal.
//   3. api/_lib/cards.js — the Vercel edge function behind OG/link-preview
//      game resolution (resolveGame). Bundled separately from src/.
//   4. src/lib/account/preferences.js's LEVEL_SPORT_IDS — bundled into a
//      serverless function alongside api/preferences.js, so it restates the
//      value rather than pulling in the 1,100-line identity module. This
//      field is RETAINED, NOT READ (the slate's level moved into the URL,
//      ADR-0056) but still validates any stray value an old device's stored
//      preference document carries, so the list must still track reality.
//
// Before this guard, updating #1 without knowing about #3 (the least
// discoverable copy — neither of the other two files' "stay in sync"
// comments mention it) would silently break OG preview cards for a shared
// link to a game at a level added later, with no test or lint failure to
// catch it.
//
// Run by `npm run lint`.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// One entry per copy: where it lives, and the regex that captures its array
// literal's contents. Each pattern is anchored to the exact declaration form
// that file uses today — a copy that changes shape (renamed, restructured)
// fails this guard with a clear "couldn't find" message rather than silently
// skipping the check.
const COPIES = [
  {
    rel: 'src/lib/teams.js',
    pattern: /export const SEARCHABLE_SPORT_IDS\s*=\s*\[([^\]]*)\]/,
    canonical: true,
  },
  {
    rel: 'scripts/gen-teams.mjs',
    pattern: /const SEARCHABLE_SPORT_IDS\s*=\s*\[([^\]]*)\]/,
  },
  {
    rel: 'api/_lib/cards.js',
    pattern: /const SEARCHABLE_SPORT_IDS\s*=\s*\[([^\]]*)\]/,
  },
  {
    rel: 'src/lib/account/preferences.js',
    pattern: /export const LEVEL_SPORT_IDS\s*=\s*Object\.freeze\(\[([^\]]*)\]\)/,
  },
]

function parseIds(raw, rel) {
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
  if (ids.some((n) => !Number.isInteger(n))) {
    throw new Error(`${rel} — array literal contains a non-integer entry: [${raw}]`)
  }
  return ids
}

const problems = []
let canonical = null
let canonicalRel = null
const found = []

for (const { rel, pattern, canonical: isCanonical } of COPIES) {
  const file = join(ROOT, rel)
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    problems.push(`${rel} — named in this guard but no longer exists`)
    continue
  }
  const match = pattern.exec(src)
  if (!match) {
    problems.push(
      `${rel} — its searchable-sport-id array literal wasn't found in the shape this guard expects`,
    )
    continue
  }
  const ids = parseIds(match[1], rel)
  found.push({ rel, ids })
  if (isCanonical) {
    canonical = ids
    canonicalRel = rel
  }
}

if (canonical) {
  const canonicalSorted = [...canonical].sort((a, b) => a - b)
  for (const { rel, ids } of found) {
    if (rel === canonicalRel) continue
    const sorted = [...ids].sort((a, b) => a - b)
    if (JSON.stringify(sorted) !== JSON.stringify(canonicalSorted)) {
      problems.push(
        `${rel} — [${ids.join(', ')}] does not match ${canonicalRel}'s ` +
          `[${canonical.join(', ')}]`,
      )
    }
  }
}

if (problems.length) {
  console.error(
    '\n✗ Searchable-sport-id parity guard failed — the following searchable-level\n' +
      '  copy(ies) no longer match SEARCHABLE_SPORT_IDS in src/lib/teams.js:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Update SEARCHABLE_SPORT_IDS in src/lib/teams.js, then hand-copy the same\n' +
      '  value into scripts/gen-teams.mjs, api/_lib/cards.js, and\n' +
      '  src/lib/account/preferences.js\'s LEVEL_SPORT_IDS — see this guard\'s own\n' +
      '  header for why each is a hand copy rather than an import.\n',
  )
  process.exit(1)
}

console.log(
  `✓ All ${found.length} searchable-sport-id copies match src/lib/teams.js's SEARCHABLE_SPORT_IDS.`,
)
