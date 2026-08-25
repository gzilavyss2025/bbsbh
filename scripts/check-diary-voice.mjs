#!/usr/bin/env node
// Guard: research-diary entries stay readable.
//
// Standing instruction from the repo owner (2026-08-25): every diary entry,
// in BOTH diaries, reads like a passage from a baseball book — plain
// language, middle-school-to-high-school reading level, no statistics
// vocabulary. Anything formal belongs in the entry's `technical` list, which
// the page folds behind a disclosure for readers who want it.
//
// .claude/hooks/diary-voice.mjs puts that voice in front of a session at the
// moment it writes an entry. This script is the half that actually enforces
// it, so a miss is caught by `npm run lint` rather than by a reader.
//
// WHAT IT CHECKS. Banned terms anywhere in an entry file EXCEPT inside the
// `technical:` array, where they are not merely allowed but expected. The
// check is deliberately dumb — a word list, not a readability model — because
// a guard that a contributor cannot predict is a guard that gets worked
// around instead of followed.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const DIARY_DIRS = [
  join('src', 'lib', 'research', 'contenderDiary'),
  join('src', 'lib', 'research', 'diary'),
]

// Plumbing, not prose. `standingNotes.js` is front matter that legitimately
// describes the method, so it is exempt alongside the module index.
const NOT_ENTRIES = new Set(['index.js', 'standingNotes.js'])

// No grandfather list. Every entry in both diaries was rewritten into plain
// language in the same commit that added this guard (repo owner's call: the
// standing instruction was extended backwards to the entries that predated
// it). That was a WORDING pass — every verdict, number, caveat and conclusion
// was preserved, and the formal vocabulary moved into each entry's `technical`
// list rather than being deleted — so it does not violate the diaries'
// append-only rule, which protects conclusions, not phrasing.
//
// If you are tempted to add a skip list here, don't: a failing entry is an
// entry that needs rewriting, and the whole point of this guard is that the
// rule applies to every entry a reader can open.

// Statistics vocabulary a general reader does not have. Word-boundary
// matched, case-insensitive.
const BANNED = [
  'p-value',
  'p value',
  'rho',
  'r-squared',
  'correlation',
  'correlated',
  'correlates',
  'regression',
  'regressed',
  'permutation',
  'confound',
  'confounded',
  'confounding',
  'statistically significant',
  'statistical significance',
  'significance',
  'confidence interval',
  'standard deviation',
  'ordinal',
  'ordered logit',
  'partial correlation',
  'null hypothesis',
  'covariate',
  'quartile',
  'percentile',
  'variance',
  'residual',
  'monotonic',
  'heteroskedastic',
  'multicollinearity',
]

function stripExemptField(source) {
  // Blank out `technical: [ ... ]` so banned terms inside it are invisible to
  // the scan. Newlines are preserved so reported line numbers stay true.
  const match = source.match(/\btechnical\s*:\s*[[{]/)
  if (!match) return source
  const open = match.index + match[0].length - 1 // the [ or { itself
  let depth = 0
  let inStr = null
  let end = open
  for (; end < source.length; end++) {
    const ch = source[end]
    if (inStr) {
      if (ch === '\\') end++ // skip the escaped character
      else if (ch === inStr) inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 0) {
        end++
        break
      }
    }
  }
  return (
    source.slice(0, open) + source.slice(open, end).replace(/[^\n]/g, ' ') + source.slice(end)
  )
}

const problems = []
// Every entry file DISCOVERED, counted before the grandfather skip — this is
// the "did the diary paths move" signal, and it has to stay true whatever the
// grandfather list happens to hold.
const found = []

for (const rel of DIARY_DIRS) {
  const dir = join(REPO_ROOT, rel)
  const relPosix = rel.split(sep).join('/')
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.js') || NOT_ENTRIES.has(file)) continue
    found.push(`${relPosix}/${file}`)
    const full = join(dir, file)
    const source = readFileSync(full, 'utf8')
    const stripped = stripExemptField(source)
    const lines = stripped.split('\n')
    lines.forEach((line, idx) => {
      // Code comments are for maintainers, not readers — skip them.
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
      for (const term of BANNED) {
        const re = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
        if (re.test(line)) {
          problems.push(
            `${relPosix}/${file}:${idx + 1}  "${term}" — move this to the entry's \`technical\` list and say it in plain words here`,
          )
          break
        }
      }
    })
  }
}

// A guard whose target moves silently starts passing while checking nothing,
// and the ✓ still prints. Both diaries have carried entries since well before
// this guard existed, so a scan that finds almost nothing means the paths
// moved, not that the diaries emptied.
const MIN_ENTRIES = 12
if (found.length < MIN_ENTRIES) {
  console.error(
    `✗ check-diary-voice: only found ${found.length} diary entries, expected at least ${MIN_ENTRIES}.` +
      '\n  The diary paths probably moved — fix DIARY_DIRS rather than lowering this floor.',
  )
  process.exit(1)
}

if (problems.length) {
  console.error('✗ check-diary-voice: statistics vocabulary found in reader-facing diary prose\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Diary entries read like a baseball book, not a stats paper — plain language, ' +
      '\n  middle-school reading level, every idea taught with a picture or a real team. ' +
      '\n  Formal terms belong in the entry\'s `technical` list, which the page folds away.' +
      '\n  The full voice: .claude/hooks/diary-voice.mjs',
  )
  process.exit(1)
}

console.log(`✓ check-diary-voice: all ${found.length} diary entries read in plain language`)
