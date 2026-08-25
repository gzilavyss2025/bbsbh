// The Contender Diary — every finding from the team-success research, newest
// first. Sibling of src/lib/research/diary/index.js (the prospect-research
// diary); same entry shape, same rules, a different question. See that
// module's header for the shape documentation this one shares verbatim, and
// docs/agents/contender-diary.md for why this stays a separate module rather
// than importing/extending the prospect diary's.
//
// THE ENTRY SHAPE (identical to src/lib/research/diary/index.js):
//
//   id, date, source, doc, title, verdict, question, headline,
//   sections: [{ id, heading, prose[], table?, proseAfter[], points[] }],
//   caveats, open, technical
//
// ADDING AN ENTRY: docs/agents/contender-diary.md. The hook at
// .claude/hooks/contender-diary-reminder.mjs is what remembers to ask.
import { rosterAgeEntry } from './rosterAge.js'
import { frameworkEntry } from './framework.js'

export { HOW_TO_READ, TRAPS } from './standingNotes.js'

// The badge each entry wears. Mostly the same vocabulary the prospect diary
// uses; 'framework' is this diary's own addition, for the entry that sets up
// the notebook rather than reporting a finding.
export const VERDICTS = {
  framework: {
    label: 'Sets up the notebook',
    blurb: 'No finding here — this entry defines how team success is measured and what is still to check.',
  },
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
  corrected: {
    label: 'Takes something back',
    blurb: 'This entry overturns part of an earlier one. Read it before them.',
  },
}

// Newest first. This order is the diary's spine — append at the TOP, and do
// not reorder what is already here.
export const RESEARCH_DIARY = [rosterAgeEntry, frameworkEntry]
