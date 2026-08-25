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

const ARC = `
  THE SHAPE (this is the half the old version of this note left out, and it
  is the half that makes an entry read like an article instead of a memo):

    scene -> the belief everybody holds -> the reversal -> what actually
    changed -> what it costs -> what you still cannot say -> back to the scene

  * YOUR SECTIONS MUST NOT BE IN THE ORDER OF YOUR RESEARCH QUESTIONS. That
    order is a lab notebook. Put the strongest, strangest finding early; never
    open the body on your weakest result.
  * THE LAST PARAGRAPH RETURNS TO THE PERSON YOU OPENED ON and says what the
    whole thing means, in one sentence. If you cannot write that sentence, you
    do not have an entry yet — you have results.
  * THE ENTRY NEEDS A THESIS, not a list of findings. One idea the reader
    carries out. Say it out loud somewhere.
`

const VOICE = `
bbsbh diary-voice note: you are about to write a research-diary entry.

READ THIS FIRST. DO NOT OPEN THE NEIGHBOURING ENTRIES AND MATCH THEIR VOICE.
They read like research memos. They are the thing being corrected, not the
model to copy. Imitating them is the single most common way this instruction
fails.

THE VOICE (standing instruction, applies to every entry in both diaries):
Write it the way David Halberstam or Michael Lewis would write it for a
baseball book — a reader who loves baseball, reads at a middle-school to
high-school level, and has never taken a statistics class. Someone should be
able to read the entry out loud to a twelve-year-old and have it land.
${ARC}
  1. LEAD WITH THE STORY, NOT THE METHOD. Open on a person or a moment a
     reader can picture — a Game 7, a pitcher, a club in a season. NEVER open
     a section with any of these: "We took...", "For every...", "Take the N
     players who...", "Across N seasons...", "Line up every...". The method
     gets two sentences and they come AFTER the scene, never before.
  2. NO TECHNICAL TERMS IN THE READER-FACING FIELDS. Never write p-value,
     rho, correlation, regression, partial correlation, permutation test,
     confound, significance, confidence interval, ordinal, sample size,
     baseline, model, null, controlling for, or a variable name in title /
     question / headline / prose / proseAfter / points / caveats / open. All
     of that belongs in the entry's \`technical\` list, which is folded behind
     a disclosure for the people who want it. That list should be THOROUGH —
     this rule moves the jargon, it does not delete it.
  3. EVERY NUMBER IS FOLLOWED, WITHIN ONE SENTENCE, BY WHAT IT FEELS LIKE.
     A count of pitches, a number of games, something a person in a seat could
     see. "+0.037 pitches per plate appearance" is not writing; "about three
     extra pitches in a whole ballgame" is. IF YOU CANNOT SAY WHAT IT FEELS
     LIKE, IT DOES NOT BELONG IN THE PROSE — put it in \`technical\`.
     No decimals with two or more places in reader-facing prose. No "pp", no
     "n=", no "p<", no plus-or-minus signs. Those live in tables and in
     \`technical\`.
  4. USE REAL NAMES AND REAL YEARS. A club, a season, a player. At least
     three real years and two real names across the entry. Concrete beats
     general every time, and it is what makes an entry memorable. VERIFY a
     specific game or streak against the feed before you write it down —
     never from memory.
  5. SHORT SENTENCES. Plain words. Active voice. Nothing over about 35 words.
     Say "we checked" and "it did not hold up," not "robustness was assessed."
     At most three SHOUTED words in the whole entry — if everything is
     emphasised, nothing is. Aim under 1,800 reader-facing words.
  6. BE HONEST ABOUT WHAT IS THIN. Say "only twenty-five teams have ever
     won a World Series in this window, so we cannot really tell" in those
     words. Never let a small sample hide behind a confident sentence.
     In \`caveats\`, OPEN EACH ONE WITH THE OBJECTION A READER WOULD ACTUALLY
     RAISE — "Could it just be the weather?" — not with the measurement. In
     \`open\`, start each item with a verb, so the list reads as a plan.
     The page renders \`caveats\` and \`open\` as ONE list, so keep both short.

A WORKED PAIR, because a rule loses to an example every time:

  MEMO:     "So we held both ends of the matchup at once — a hitter fifty
            points above the league meeting a pitcher who keeps the league
            forty points down should produce about ten points above the
            league — and ran it again."
  MAGAZINE: "So we stopped grading one side at a time and asked it the way a
            fan asks it before the pitch: this hitter, against this pitcher —
            what should happen?"

  MEMO:     "It shows up in seventeen of the twenty-five years, and it holds
            up when you throw any single year away."
  MAGAZINE: "We found it in seventeen of the twenty-five seasons, and no
            single year is carrying it."

The two standing rules still apply: docs/agents/contender-diary.md (or
docs/agents/research-diary.md). Entries are append-only — never edit an old
one to agree with a new one. Every entry needs a non-empty \`caveats\`.

\`npm run lint\` runs scripts/check-diary-voice.mjs, which fails the build on
banned terms and on the shape rules above. Write it in voice the first time.
`
// The short version, for a session merely READING an entry. Imitation is
// where the drift starts: a session opens the neighbouring entry to learn
// "how we do it here," finds a research memo, and writes another one.
const READ_NOTE = `
bbsbh diary-voice note: you are reading a research-diary entry.

If you are reading it to learn the house voice — DO NOT COPY IT. The existing
entries read like research memos, and that is the thing the repo owner is
trying to correct, not the target. The voice is defined in
docs/agents/contender-diary.md under "The voice: write it like a baseball
book", and this hook prints it in full the moment you write an entry file.
`


try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const toolInput = input?.tool_input ?? {}
  const path = normalize(toolInput.file_path ?? toolInput.notebook_path ?? '')
  if (!path) process.exit(0)

  const inDiary = DIARIES.some((d) => path.includes(d))
  const isPlumbing = NOT_ENTRIES.some((f) => path.endsWith(`/${f}`))
  if (!inDiary || isPlumbing) process.exit(0)

  // A READ gets the short anti-imitation note; a WRITE gets the whole voice.
  const reading = String(input?.tool_name ?? '') === 'Read'
  process.stderr.write(reading ? READ_NOTE : VOICE)
} catch {
  // A voice note must never break a tool call — swallow everything.
}
process.exit(0)
