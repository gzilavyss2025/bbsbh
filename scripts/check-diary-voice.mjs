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
// WHAT CHANGED IN THE SECOND VERSION, and why. The first version was a
// line-based scan for banned words. It shipped a ✓ that was not true — it
// missed `significant` and `controlling for` in a table row of a live entry,
// because it banned only the longer phrases `statistically significant` and
// `confound`, and because a line scan cannot tell a reader-facing table row
// from a code comment. More importantly, the repo owner's complaint was never
// really about vocabulary: entries kept reading like research memos while
// passing the word list clean. A memo is a SHAPE, not a word.
//
// So this version does three things the first could not:
//
//   1. IT IMPORTS THE ENTRY instead of scanning its text. Every entry file is
//      a plain ES module exporting one object, so the real fields are
//      available — which reader-facing field a hit landed in, whether it was
//      a table row or a paragraph, and how long each sentence actually is.
//      The `technical` exemption becomes "skip that key" rather than a
//      brace-matching parser.
//   2. IT CHECKS SHAPE, NOT ONLY WORDS. Opening a section on sample-inclusion
//      criteria, shouting in capitals ten times, quoting a four-decimal figure
//      at a reader, or captioning a table with its own row count are all ways
//      to write a memo in permitted vocabulary.
//   3. IT RATCHETS. Applying every shape rule to the seventeen entries written
//      before them would fail lint repo-wide and the guard would be deleted
//      within a week — the exact failure mode check-file-size.mjs warns about
//      in its own header. So the numeric rules work the way that guard's do: a
//      NEW entry must meet the target, an existing entry is pinned at a budget
//      it may not exceed, and an entry that reaches the target must give up its
//      budget line in the same commit. The table only shrinks.
//
// A BUDGET IS NOT A GRANDFATHER LIST. The rule applies to every entry; the
// budget only records how far a pre-existing entry currently sits from it, and
// that number may only go down. The WORD rules below have no budgets at all —
// they apply to everything, and the four entries that violated them were
// reworded in the commit that added this version (wording, never a
// conclusion, so the diaries' append-only rule is untouched).
import { readdirSync, existsSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const DIARY_DIRS = [
  join('src', 'lib', 'research', 'contenderDiary'),
  join('src', 'lib', 'research', 'diary'),
]

// Plumbing, not prose. `standingNotes.js` is front matter that legitimately
// describes the method, so it is exempt alongside the module index.
const NOT_ENTRIES = new Set(['index.js', 'standingNotes.js'])

// ------------------------------------------------------------------ targets
// What a NEW entry must meet. An existing entry over one of these carries a
// budget in BUDGETS below until it is rewritten down to the target.
const TARGET = {
  decimals: 0, // figures like "3.87" quoted at a reader instead of translated
  sentence: 35, // words in the longest reader-facing sentence
  shout: 3, // ALL-CAPS words used for emphasis
  // Reader-facing word count. Two-tier, because one number could not do the
  // job: the editorial review that prompted this guard recommended warning at
  // 1,800 and failing at 2,600, and it was right to separate them. 1,800 is
  // what a single-finding entry should hit; an entry answering five questions
  // and publishing two of its own retractions legitimately runs longer. A
  // limit that forces real content out is a limit that gets raised instead of
  // met, so the hard stop is 2,600 and the aspiration is counted and printed
  // rather than enforced.
  words: 2600,
}

// Printed, never failed. The count of entries over this is the number that
// should go down over time; when it reaches zero, drop TARGET.words to 1800.
const WORDS_ASPIRATION = 1800

const LIMIT_HELP = {
  decimals: 'Translate it into something a person in a seat could see, and put the figure in `technical`.',
  sentence: 'Break it in two. A sentence this long is a paragraph wearing a disguise.',
  shout: 'Shouting everywhere is shouting nowhere — let the sentence carry the emphasis.',
  words: 'Cut the method recitals and the repeated hedges; that is where the fat is.',
}

// Bands, so routine wording changes inside a budget do not fail lint. Same
// reasoning as check-file-size.mjs: a guard that fires on normal work is a
// guard that gets deleted.
const BAND = { decimals: 1, sentence: 5, shout: 2, words: 200 }

// Entries that predate the shape rules, pinned at their measured shape. These
// may only shrink. An entry that reaches TARGET on every dimension must delete
// its line here in the same commit.
const BUDGETS = {
  'src/lib/research/contenderDiary/framework.js': { decimals: 0, sentence: 70, shout: 3, words: 1800 },
  'src/lib/research/contenderDiary/homegrown.js': { decimals: 0, sentence: 60, shout: 3, words: 1800 },
  'src/lib/research/contenderDiary/postseasonExperience.js': { decimals: 2, sentence: 45, shout: 12, words: 2200 },
  'src/lib/research/contenderDiary/postseasonUsage.js': { decimals: 0, sentence: 40, shout: 6, words: 1800 },
  'src/lib/research/contenderDiary/rosterAge.js': { decimals: 0, sentence: 45, shout: 8, words: 1800 },
  'src/lib/research/contenderDiary/starDiversity.js': { decimals: 2, sentence: 45, shout: 3, words: 1800 },
  'src/lib/research/diary/blockage.js': { decimals: 0, sentence: 45, shout: 8, words: 2000 },
  'src/lib/research/diary/blockageCorrected.js': { decimals: 1, sentence: 55, shout: 6, words: 2200 },
  'src/lib/research/diary/bodyAndArm.js': { decimals: 5, sentence: 50, shout: 6, words: 1800 },
  'src/lib/research/diary/debutMonth.js': { decimals: 0, sentence: 40, shout: 3, words: 1800 },
  'src/lib/research/diary/finalFour.js': { decimals: 2, sentence: 50, shout: 6, words: 1800 },
  'src/lib/research/diary/frontOffice.js': { decimals: 0, sentence: 45, shout: 32, words: 2600 },
  'src/lib/research/diary/homegrown.js': { decimals: 0, sentence: 45, shout: 3, words: 1800 },
  'src/lib/research/diary/humpArtifact.js': { decimals: 0, sentence: 45, shout: 3, words: 1800 },
  'src/lib/research/diary/levelTenure.js': { decimals: 0, sentence: 40, shout: 3, words: 1800 },
  'src/lib/research/diary/rookieTraits.js': { decimals: 0, sentence: 40, shout: 3, words: 1800 },
  // movementWindows.js is deliberately absent: it already meets every target,
  // and is the proof that the targets are reachable rather than aspirational.
}

// -------------------------------------------------------------------- words
// Statistics vocabulary a general reader does not have. Word-boundary matched,
// case-insensitive, and applied to EVERY reader-facing field including table
// rows — that is where the first version's two live misses were hiding.
const BANNED = [
  'p-value', 'p value', 'rho', 'r-squared',
  'correlation', 'correlated', 'correlates',
  'regression', 'regressed',
  'permutation', 'confound', 'confounded', 'confounding',
  'statistically significant', 'statistical significance',
  // Bare `significant` was the gap: "−2.08, not significant" shipped in a
  // table row and the guard printed a ✓ over it.
  'significant', 'insignificant', 'significance',
  'confidence interval', 'standard deviation', 'standard error',
  'ordinal', 'ordered logit', 'partial correlation', 'null hypothesis',
  'covariate', 'quartile', 'percentile', 'variance', 'residual',
  'monotonic', 'heteroskedastic', 'multicollinearity',
  // Second-version additions. Every one of these reads as a research memo to
  // a reader who has never taken a statistics class, and none was caught.
  'sample size', 'small sample', 'subsample', 'data point', 'data points',
  'estimator', 'point estimate', 'effect size', 'base rate',
  'median', 'skew', 'outlier', 'outliers',
  'predictor', 'coefficient', 'univariate', 'multivariate',
  'out-of-sample', 'leave-one-out', 'cross-validation', 'holdout', 'overfit',
  'bootstrap', 'monte carlo', 'bayesian', 'posterior', 'logit', 'probit',
  'log5', 'log-odds', 'odds ratio', 'multinomial', 'herfindahl',
  'spearman', 'pearson', 'chi-square', 't-test', 'anova',
  'degrees of freedom', 'margin of error', 'interquartile', 'z-score',
  'normalized', 'normalised', 'demeaned', 'residualized', 'residualised',
  'endogenous', 'collinear', 'stratified', 'sensitivity analysis',
  'regression to the mean', 'false positive', 'multiple comparisons',
  'specification', 'cohort',
]

// Phrases a word list cannot catch, because the jargon is in the grammar
// rather than in any one word.
//
// DELIBERATELY NOT BANNED: `ladder`, `rung`, `spike #4`, `team-season`. Those
// are house shorthand, not statistics, and the page teaches every one of them
// in its own standing front matter before a reader reaches an entry. Banning
// them would have the guard fighting the content — the framework entry's whole
// subject IS the ladder and its rungs. What the repo owner objected to is the
// TECHNICAL REGISTER, so that is what this list polices.
const BANNED_PATTERNS = [
  [/\bcontroll?(?:s|ed|ing)?\s+for\b/i, 'controlling for'],
  [/\b(?:statistical|more|far more|greater|less|enough)\s+power\b/i, 'statistical power'],
  [/\bpower to detect\b/i, 'power to detect'],
  [/\bheld?\s+(?:fixed|constant)\b/i, 'held fixed'],
  [/\ball else equal\b/i, 'all else equal'],
]

// Analyst notation. Legitimate inside a table cell, never in a paragraph.
const NOTATION = [
  [/\bn\s*=\s*\d/i, 'n='],
  [/\bp\s*[=<>]\s*0?\./i, 'p='],
  [/±/, '±'],
  [/\b\d+(?:\.\d+)?\s*pp\b/i, 'pp'],
]

// A caption is a title, not a methods line.
const CAPTION_BAD =
  /\(\s*n\s*=|\(\s*(?:19|20)\d{2}\s*[-–]|\b[\d,]{3,}\s+(?:men|players|pitchers|teams|clubs|seasons)\b|left out|excluded/i

// House rule 1, "lead with the story, not the method," made checkable.
const LEDE_BAD = [
  /^(?:We\s|For every\b|Take the\b|Across\b|Line up\b|Start with the\b)/,
  /\b(?:sample|panel|we (?:took|ran|measured|built|compared|checked))\b/i,
]

// Initialisms a reader knows from a box score, so they do not count as
// shouting.
const CAPS_OK = new Set([
  'OPS', 'MLB', 'WAR', 'ERA', 'RBI', 'OBP', 'SLG', 'AL', 'NL', 'DH', 'IP',
  'PA', 'WS', 'LCS', 'WHIP', 'BB', 'HR', 'ALCS', 'NLCS', 'ALDS', 'NLDS',
  'MVP', 'TV', 'AA', 'AAA', 'US', 'IL', 'ADR', 'PWA',
])

// ------------------------------------------------------------------ reading
// Paragraph-like fields: everything a reader reads as prose. Table text is
// handled separately, because a table legitimately carries bare numbers.
function proseFields(entry) {
  const out = []
  const push = (value, where) => {
    if (typeof value === 'string' && value.trim()) out.push({ text: value, where })
  }
  push(entry.title, 'title')
  push(entry.question, 'question')
  push(entry.headline, 'headline')
  for (const section of entry.sections ?? []) {
    push(section.heading, `${section.id}.heading`)
    for (const p of section.prose ?? []) push(p, `${section.id}.prose`)
    for (const p of section.proseAfter ?? []) push(p, `${section.id}.proseAfter`)
    for (const p of section.points ?? []) push(p, `${section.id}.points`)
  }
  for (const c of entry.caveats ?? []) push(c, 'caveats')
  for (const o of entry.open ?? []) push(o, 'open')
  return out
}

function tableFields(entry) {
  const out = []
  for (const section of entry.sections ?? []) {
    if (!section.table) continue
    if (section.table.caption) {
      out.push({ text: section.table.caption, where: `${section.id}.caption` })
    }
    for (const col of section.table.columns ?? []) {
      out.push({ text: String(col), where: `${section.id}.column` })
    }
    for (const row of section.table.rows ?? []) {
      for (const cell of row) out.push({ text: String(cell), where: `${section.id}.row` })
    }
  }
  return out
}

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length

function measure(entry) {
  const prose = proseFields(entry)
  const joined = prose.map((f) => f.text).join(' ')
  let sentence = 0
  let decimals = 0
  for (const { text } of prose) {
    for (const s of text.split(/(?<=[.!?])\s+/)) sentence = Math.max(sentence, wordCount(s))
    decimals += (text.match(/\b\d+\.\d{2,}\b/g) ?? []).length
  }
  const shout = (joined.match(/\b[A-Z]{2,}\b/g) ?? []).filter((w) => !CAPS_OK.has(w)).length
  return { decimals, sentence, shout, words: wordCount(joined) }
}

const DIMENSIONS = ['decimals', 'sentence', 'shout', 'words']

// ------------------------------------------------------------------- checks
const problems = []
const found = []
let overAspiration = 0

for (const rel of DIARY_DIRS) {
  const dir = join(REPO_ROOT, rel)
  const relPosix = rel.split(sep).join('/')
  if (!existsSync(dir)) continue

  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.js') || NOT_ENTRIES.has(file)) continue
    const key = `${relPosix}/${file}`
    found.push(key)

    const mod = await import(pathToFileURL(join(dir, file)).href)
    const entry = Object.values(mod).find((v) => v && typeof v === 'object' && v.id)
    if (!entry) {
      problems.push(`${key}  exports no entry object — this guard cannot read it`)
      continue
    }

    // Words: every reader-facing field, table rows included.
    for (const { text, where } of [...proseFields(entry), ...tableFields(entry)]) {
      for (const term of BANNED) {
        const re = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
        if (re.test(text)) {
          problems.push(
            `${key} [${where}]  "${term}" — move it to \`technical\` and say it in plain words here`,
          )
        }
      }
      for (const [re, label] of BANNED_PATTERNS) {
        if (re.test(text)) problems.push(`${key} [${where}]  "${label}" — say it in plain words here`)
      }
    }

    // Notation: paragraphs only. A table cell may carry a bare number.
    for (const { text, where } of proseFields(entry)) {
      for (const [re, label] of NOTATION) {
        if (re.test(text)) {
          problems.push(
            `${key} [${where}]  "${label}" belongs in a table or in \`technical\`, not in a sentence`,
          )
        }
      }
    }

    // Captions are titles.
    for (const section of entry.sections ?? []) {
      if (section.table && CAPTION_BAD.test(section.table.caption ?? '')) {
        problems.push(
          `${key} [${section.id}.caption]  a caption is a title, not a methods line — ` +
            'the year range and the row count belong in `technical`',
        )
      }
    }

    // Lead with the story.
    const lede = entry.sections?.[0]?.prose?.[0] ?? ''
    if (LEDE_BAD.some((re) => re.test(lede))) {
      problems.push(
        `${key} [lede]  opens on the method — "${lede.slice(0, 60)}…". ` +
          'Open on a person, a club, or a moment; the method comes after.',
      )
    }

    // Shape budgets.
    const got = measure(entry)
    if (got.words > WORDS_ASPIRATION) overAspiration++
    const budgeted = Boolean(BUDGETS[key])
    const cap = BUDGETS[key] ?? TARGET
    for (const dim of DIMENSIONS) {
      if (got[dim] > cap[dim]) {
        problems.push(
          `${key}  ${dim} is ${got[dim]}, over its ${budgeted ? 'budget' : 'limit'} of ${cap[dim]}` +
            (budgeted ? ' — a budget may only shrink' : `. ${LIMIT_HELP[dim]}`),
        )
      }
    }
    if (!budgeted) continue
    // Ratchet: an entry that has reached every target must give up its budget.
    if (DIMENSIONS.every((dim) => got[dim] <= TARGET[dim])) {
      problems.push(
        `${key}  now meets every target — delete its BUDGETS line in this commit ` +
          'so the exception table keeps shrinking.',
      )
      continue
    }
    // Ratchet: banked progress gets recorded, a full band at a time.
    for (const dim of DIMENSIONS) {
      if (cap[dim] > TARGET[dim] && got[dim] <= cap[dim] - BAND[dim]) {
        problems.push(
          `${key}  ${dim} improved to ${got[dim]}; lower its budget from ${cap[dim]} ` +
            `to ${Math.max(TARGET[dim], got[dim])} to bank it.`,
        )
      }
    }
  }
}

// A guard whose target moves silently starts passing while checking nothing.
const MIN_ENTRIES = 12
if (found.length < MIN_ENTRIES) {
  console.error(
    `✗ check-diary-voice: only found ${found.length} diary entries, expected at least ${MIN_ENTRIES}.` +
      '\n  The diary paths probably moved — fix DIARY_DIRS rather than lowering this floor.',
  )
  process.exit(1)
}

// A budget for an entry that no longer exists is a line nobody will ever
// delete, and it makes the "shrinking table" claim untrue.
for (const key of Object.keys(BUDGETS)) {
  if (!found.includes(key)) {
    problems.push(`${key}  has a BUDGETS line but no such entry — delete the line`)
  }
}

if (problems.length) {
  console.error('✗ check-diary-voice: diary prose is drifting back toward a research memo\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Diary entries read like a baseball book, not a stats paper — plain language,' +
      '\n  middle-school reading level, every idea taught with a picture or a real team,' +
      '\n  opening on a person rather than on a method. Formal terms and exact figures' +
      "\n  belong in the entry's `technical` list, which the page folds away." +
      '\n  The full voice: .claude/hooks/diary-voice.mjs',
  )
  process.exit(1)
}

const onBudget = Object.keys(BUDGETS).length
console.log(
  `✓ check-diary-voice: all ${found.length} diary entries read in plain language ` +
    `(${found.length - onBudget} meeting the shape targets, ${onBudget} on a shrinking budget; ` +
    `${overAspiration} over the ${WORDS_ASPIRATION}-word aspiration)`,
)
