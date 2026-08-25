// The prospect-research diary — every finding from the minor-league
// development spikes, in one place, newest first.
//
// WHY THIS IS AUTHORED DATA AND NOT A LIVE READ. Everything on this page could
// in principle be recomputed. It deliberately is not. The shipped level-tenure
// generator slides its own five-year cohort forward from statsapi, so a live
// read would rewrite the diary's own history every night, and the whole value
// of a diary is that a past entry says what it said. When today's numbers drift
// far enough from an entry to matter, that is a NEW entry.
//
// THE ENTRY SHAPE.
//
//   id         stable slug, used as the anchor and as the test's key
//   date       ISO. Entries are ordered newest first and never reordered.
//   source     where it landed, for anyone tracing it back
//   doc        the long-form write-up in docs/, which keeps the full method
//   title      a sentence a reader can understand cold
//   verdict    one of VERDICTS below
//   question   what was actually asked, in the reader's words
//   headline   the answer, in two or three sentences
//   sections   [{ id, heading, prose[], table?, proseAfter[], points[] }]
//   caveats    what is missing or unsound. Never empty.
//   open       what is still unanswered
//   technical  the formal statement, for the reader who wants it. The page
//              renders this behind a disclosure, because the prose above it
//              has to work for somebody who has never seen a p-value.
//
// A table is { caption, columns[], rows[][], note? }. Rows are pre-formatted
// strings, not numbers — these are quoted findings, not a computation, and
// formatting them here keeps the renderer free of a units-and-rounding layer
// it would only ever use once.
//
// ADDING AN ENTRY: docs/agents/research-diary.md. The hook at
// .claude/hooks/research-diary-reminder.mjs is what remembers to ask.
import { blockageCorrectedEntry } from './blockageCorrected.js'
import { blockageEntry } from './blockage.js'
import { frontOfficeEntry } from './frontOffice.js'
import { finalFourEntry } from './finalFour.js'
import { debutMonthEntry } from './debutMonth.js'
import { bodyAndArmEntry } from './bodyAndArm.js'
import { rookieTraitsEntry } from './rookieTraits.js'
import { homegrownEntry } from './homegrown.js'
import { humpArtifactEntry } from './humpArtifact.js'
import { movementWindowsEntry } from './movementWindows.js'
import { levelTenureEntry } from './levelTenure.js'

export { HOW_TO_READ, TRAPS } from './standingNotes.js'

// The badge each entry wears. `label` is what a reader sees; `blurb` is the
// one-line gloss under it, because "corrected" and "no-ship" are house words
// and nobody should have to guess what they mean here.
export const VERDICTS = {
  shipped: {
    label: 'Shipped',
    blurb: 'This one became a feature you can see in the app.',
  },
  holds: {
    label: 'Holds up',
    blurb: 'A real finding that survived every check, but nothing to build yet.',
  },
  'no-ship': {
    label: 'Not shippable',
    blurb: 'Asked and answered. The answer was no, and that is worth keeping.',
  },
  agenda: {
    label: 'Asks for more',
    blurb: 'No new numbers in this one. It reads the others and says what to measure next.',
  },
  corrected: {
    label: 'Takes something back',
    blurb: 'This entry overturns part of an earlier one. Read it before them.',
  },
}

// Newest first. This order is the diary's spine — append at the TOP, and do
// not reorder what is already here.
export const RESEARCH_DIARY = [
  blockageCorrectedEntry,
  blockageEntry,
  frontOfficeEntry,
  finalFourEntry,
  debutMonthEntry,
  bodyAndArmEntry,
  rookieTraitsEntry,
  homegrownEntry,
  humpArtifactEntry,
  movementWindowsEntry,
  levelTenureEntry,
]
