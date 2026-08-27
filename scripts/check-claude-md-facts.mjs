#!/usr/bin/env node
// Guards the root CLAUDE.md's CHECKABLE FACTS. Its sibling check-claude-md.mjs
// asks whether the file is lean; this one asks whether it is still true.
//
// WHY. CLAUDE.md loads into every session, so a wrong fact in it is repeated to
// every agent until a human happens to check. Six were found stale at once in
// August 2026, and the shape of the mistakes is what this guard is built from:
//
//   - `.claude/skills/run.md` had become `.claude/skills/run/SKILL.md`. Anyone
//     following the pointer found nothing, and nothing said so.
//   - "Eleven narrow, opt-in exceptions (api/)" was written when there were
//     eleven. Three landed in one week; the PROSE below the count was updated
//     to describe all three and the COUNT above it was not.
//   - "a five-tab hub" survived the Contracts tab's arrival.
//   - Three nested CLAUDE.md files were listed; six existed.
//
// Every one of those is a fact a machine can hold. None of them is style, and
// none needed judgement — which is exactly the kind of thing that should not be
// costing a human an audit.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It does not read the prose. A count is
// checkable; "the spoiler rule is the whole point of the app" is not, and a
// guard that tried would be a guard people learn to work around. If a claim
// here cannot be reduced to a path, a number or a list, it belongs in a human's
// review, not in this file.
//
// Run by `npm run lint` (so it gates every push).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const CLAUDE_MD = join(ROOT, 'CLAUDE.md')
const src = readFileSync(CLAUDE_MD, 'utf8')
const problems = []

// Prose carries numbers as words. Only the range the file actually uses.
const WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20,
}
const asNumber = (word) => WORDS[String(word).toLowerCase()] ?? null

// A claim of the form /pattern/ whose first capture is a number word, checked
// against a count taken from the tree.
function claims(label, re, actual, fix) {
  const m = re.exec(src)
  if (!m) {
    problems.push(`Could not find the ${label} claim in CLAUDE.md. If the sentence was reworded, update the pattern in this guard — do not delete the check.`)
    return
  }
  const said = asNumber(m[1])
  if (said == null) {
    problems.push(`The ${label} claim reads "${m[1]}", which this guard cannot read as a number. Spell it as a word, or teach WORDS about it.`)
    return
  }
  if (said !== actual) problems.push(`CLAUDE.md says ${label} is ${m[1]} (${said}); the tree says ${actual}. ${fix}`)
}

// ---------------------------------------------------------------- the counts

const apiEndpoints = readdirSync(join(ROOT, 'api')).filter((f) => f.endsWith('.js'))
claims(
  'the api/ function count',
  /\*\*(\w+) Vercel functions live in `api\//i,
  apiEndpoints.length,
  `api/*.js currently holds: ${apiEndpoints.join(', ')}.`,
)
claims(
  'the score-free endpoint count',
  /\*\*(\w+) never render or fetch a score/i,
  apiEndpoints.length - 1,
  'One endpoint (stamps.js) stores a score by design; the rest must not.',
)
claims(
  'the which-endpoint-stores-a-score ordinal',
  /\*\*The (\w+) stores a score, by design\*\*/i,
  apiEndpoints.length,
  'Stamps is described last, so its ordinal is the total.',
)

const tabBar = readFileSync(join(ROOT, 'src/screens/team/TeamTabBar.jsx'), 'utf8')
const tabs = /const TABS = \[(.*?)\]/s.exec(tabBar)
if (!tabs) problems.push('Could not find the TABS array in src/screens/team/TeamTabBar.jsx.')
else claims('the team hub tab count', /(\w+)-tab hub/i, (tabs[1].match(/key:/g) ?? []).length, 'See TABS in TeamTabBar.jsx.')

// ------------------------------------------------- the nested CLAUDE.md list

function nestedDirs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue
    const full = join(dir, name)
    if (!statSync(full).isDirectory()) continue
    if (existsSync(join(full, 'CLAUDE.md'))) out.push(`${full.slice(ROOT.length + 1).split(sep).join('/')}/`)
    nestedDirs(full, out)
  }
  return out
}
const bullet = /- \*\*Nested `CLAUDE\.md`\*\*[^]*?(?=\n- \*\*|\n\n)/.exec(src)
if (!bullet) problems.push('Could not find the "Nested `CLAUDE.md`" bullet in CLAUDE.md.')
else {
  const listed = new Set([...bullet[0].matchAll(/`([\w./-]+\/)`/g)].map((m) => m[1]))
  const onDisk = new Set(nestedDirs(ROOT))
  for (const d of onDisk) if (!listed.has(d)) problems.push(`${d}CLAUDE.md exists but that directory is not listed in CLAUDE.md's nested-files bullet.`)
  for (const d of listed) if (!onDisk.has(d)) problems.push(`CLAUDE.md's nested-files bullet lists ${d}, which has no CLAUDE.md.`)
}

// ------------------------------------------------------- paths and ADR refs

const EXT = /\.(js|jsx|mjs|css|json|md|yml|html)$/

// Backticks in this file hold more than paths. These are the other things, and
// each is skipped for a stated reason rather than by a catch-all:
//   - a URL (`https://statsapi.mlb.com`)
//   - an app ROUTE, which starts with a slash and is not a file (`/learn`)
//   - a placeholder (`.scratch/<slug>/`, `bbsbh:reveal:{gamePk}`)
//   - a git ref (`origin/main`)
const skip = (t) =>
  t.startsWith('http') || t.startsWith('/') || t.includes('<') || t.startsWith('origin/')

// Every file in the repo, as a posix path, so a citation can be matched by
// SUFFIX. CLAUDE.md cites some files relative to the directory under discussion
// — `_lib/cards.js` inside the api/ paragraph — and those are correct prose,
// not broken paths.
function allFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) allFiles(full, out)
    else out.push(full.slice(ROOT.length + 1).split(sep).join('/'))
  }
  return out
}
const FILES = allFiles(ROOT)

const seen = new Set()
for (const [, token] of src.matchAll(/`([^`\s]+)`/g)) {
  if (seen.has(token) || token.includes('*') || token.includes('{') || skip(token)) continue
  seen.add(token)
  if (!token.includes('/') && !EXT.test(token)) continue
  if (existsSync(join(ROOT, token))) continue
  const bare = token.endsWith('/') ? token.slice(0, -1) : token

  // A citation whose FIRST SEGMENT is a real top-level directory is an absolute
  // repo path and must resolve exactly — it already failed existsSync above, so
  // it is wrong. Only a citation that cannot be absolute may match by suffix.
  //
  // This distinction is the whole check. Without it `api/statsapi.js` matches
  // the real `src/api/statsapi.js` by suffix and passes, which is exactly the
  // stale pointer this guard was written after: `api/` is the SERVERLESS
  // directory, so that citation sends a reader somewhere real and wrong.
  const head = bare.split('/')[0]
  if (bare.includes('/') && existsSync(join(ROOT, head)) && statSync(join(ROOT, head)).isDirectory()) {
    problems.push(`CLAUDE.md cites \`${token}\`, which does not exist (\`${head}/\` is a real directory, so this reads as a path from the repo root).`)
    continue
  }

  if (FILES.some((f) => f === bare || f.endsWith(`/${bare}`) || f.startsWith(`${bare}/`))) continue
  problems.push(`CLAUDE.md cites \`${token}\`, which does not exist.`)
}

for (const [, n] of src.matchAll(/ADR-(\d{4})/g)) {
  if (!readdirSync(join(ROOT, 'docs/adr')).some((f) => f.startsWith(`${n}-`))) {
    problems.push(`CLAUDE.md cites ADR-${n}, which has no file in docs/adr/.`)
  }
}

// ------------------------------------------------------------------- verdict

if (problems.length) {
  console.error('\n✗ CLAUDE.md fact check failed — this file is read by every session,\n  so a stale fact in it is repeated to every agent until someone checks:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error('\n  Fix the SENTENCE, not this guard. CLAUDE.md is pinned at its line cap,\n  so corrections are same-size swaps.\n')
  process.exit(1)
}

console.log(`✓ CLAUDE.md's checkable facts hold — ${apiEndpoints.length} api/ endpoints, ${seen.size} cited paths, ADR refs all resolve.`)
