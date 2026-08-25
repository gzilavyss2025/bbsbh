#!/usr/bin/env node
// PreToolUse advisory hook — fires the moment a session is about to write a
// research-diary ENTRY, in either diary, and hands it the house voice before
// the prose gets written rather than after.
//
// WHY A HOOK. Standing instruction from the repo owner (2026-08-25): every
// diary entry, from here on, reads like a passage from a baseball book, not
// like a stats paper. That is a "must happen every time, without anyone
// remembering to ask" rule, which is a hook's job, not CLAUDE.md prose a long
// session drifts away from. Same reasoning as the two reminder hooks next to
// this one.
//
// WHY IT ONLY ADVISES. This hook cannot read the prose that has not been
// written yet, so it cannot judge it. The actual ENFORCEMENT is
// scripts/check-diary-voice.mjs, which runs in `npm run lint` and FAILS on
// jargon that escaped into reader-facing fields. This hook exists so the
// voice is in front of the writer at the moment of writing; that script
// exists so a miss is caught before it ships.
import { readFileSync } from 'node:fs'

// Both diaries. A path outside these is none of this hook's business.
const DIARIES = ['src/lib/research/contenderDiary', 'src/lib/research/diary']

// Files inside a diary that are plumbing, not prose — no voice note needed.
const NOT_ENTRIES = ['index.js', 'standingNotes.js']

function normalize(text) {
  return String(text ?? '').replace(/\\/g, '/')
}

const VOICE = `
bbsbh diary-voice note: you are about to write a research-diary entry.

THE VOICE (standing instruction, applies to every entry in both diaries):
Write it the way David Halberstam or Michael Lewis would write it for a
baseball book — a reader who loves baseball, reads at a middle-school to
high-school level, and has never taken a statistics class. Someone should be
able to read the entry out loud to a twelve-year-old and have it land.

  1. LEAD WITH THE STORY, NOT THE METHOD. Open on what happened, or on a
     team a reader can picture. The 2002 Angels won a World Series with
     almost nobody who had ever played in October. Start there, not with a
     sample size.
  2. NO TECHNICAL TERMS IN THE READER-FACING FIELDS. Never write p-value,
     rho, correlation, regression, partial correlation, permutation test,
     confound, significance, confidence interval, ordinal, or a variable
     name in title / question / headline / prose / proseAfter / points /
     caveats / open. All of that belongs in the entry's \`technical\` list,
     which is folded behind a disclosure for the people who want it.
  3. IF A CONCEPT CANNOT BE AVOIDED, TEACH IT WITH A PICTURE. Do not write
     "the effect did not survive controlling for prior-year rung." Write
     "once you set aside the fact that good teams tend to stay good, most of
     the edge went away." Translate every number into something physical: a
     share becomes "about two out of every three at-bats," a difference
     becomes "roughly twenty games' worth of everyday players."
  4. USE REAL NAMES AND REAL YEARS. A club, a season, a player. Concrete
     beats general every time, and it is what makes an entry memorable.
  5. SHORT SENTENCES. Plain words. Active voice. Say "we checked" and "it
     did not hold up," not "robustness was assessed."
  6. BE HONEST ABOUT WHAT IS THIN. Say "only twenty-five teams have ever
     won a World Series in this window, so we cannot really tell" in those
     words. Never let a small sample hide behind a confident sentence.

The two standing rules still apply: docs/agents/contender-diary.md (or
docs/agents/research-diary.md). Entries are append-only — never edit an old
one to agree with a new one. Every entry needs a non-empty \`caveats\`.

\`npm run lint\` runs scripts/check-diary-voice.mjs, which fails the build on
banned terms outside \`technical\`. Write it in voice the first time.
`

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const toolInput = input?.tool_input ?? {}
  const path = normalize(toolInput.file_path ?? toolInput.notebook_path ?? '')
  if (!path) process.exit(0)

  const inDiary = DIARIES.some((d) => path.includes(d))
  const isPlumbing = NOT_ENTRIES.some((f) => path.endsWith(`/${f}`))

  if (inDiary && !isPlumbing) process.stderr.write(VOICE)
} catch {
  // A voice note must never break a tool call — swallow everything.
}
process.exit(0)
