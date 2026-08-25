# The Contender Diary

An admin-only page at `/admin/contenders`, linked from the footer, holding
everything the team-success research finds — the sibling of the
prospect-research diary at `/admin/research` (`docs/agents/research-diary.md`),
same shape, same voice, a different question. That page asks how a prospect
develops; this one asks what the teams that go deep in October have in
common. `docs/team-success-research.md` is the framework behind it — the
outcome ladder, the factor catalog, the statistical method — read that
before adding a spike. This document is only the page's own conventions.

**Kept as its own diary, not folded into the prospect one.** Different
question, different commissioning ask, and a verdict vocabulary that may
diverge over time (this diary needed a `framework` verdict on day one, which
the prospect diary has never needed) — sharing the entry list would mean
either forcing one vocabulary onto both or growing conditional cases into a
shared module for no real benefit. The page-rendering code duplicates the
prospect diary's `ResearchDiaryPage.jsx` almost exactly on purpose, for now —
see that file's own header for why a shared renderer wasn't extracted yet.

## The two rules

Identical to the prospect diary's, because the reasoning is the same:

**1. Write it for someone who does not know what a p-value is.** The formal
statement goes in the entry's `technical` list, folded behind a disclosure.
Translate a number before it goes on the page — "the effect survived a
leave-one-season-out refit in 24 of 26 years" rather than "robust to
leave-one-out."

**2. Never edit an old entry to agree with a new one.** Entries are dated and
append-only. A later pass that overturns an earlier finding gets a
`corrected` verdict and says what it takes back; the old entry stays as it
was. Fixing a typo or a broken figure is fine — changing a conclusion is not.

Every entry needs a non-empty `caveats` list, same as the prospect diary. For
this program specifically, the ladder's thin top-rung sample (26 World
Series winners across the whole window) is a real caveat for almost any
entry that slices down that far — say the n out loud rather than letting a
reader assume a `p < 0.01` means something certain.

## An entry that measures nothing

`framework` is this diary's day-one verdict, for the entry that sets up the
outcome ladder and the factor catalog rather than reporting a finding. It
exists for the same reason the prospect diary's `agenda` verdict does — dating
what the program intends to measure, and what it found blocked outright
(payroll, as of this writing), is worth keeping a record of even before any
spike has run. It still needs `caveats`: the first one always says nothing
below it has been measured yet.

## Adding an entry

Files live in `src/lib/research/contenderDiary/`:

- `index.js` — the entry shape is documented in its header (same shape as the
  prospect diary's, entry-for-entry). `RESEARCH_DIARY` is the ordered list;
  **append at the top**.
- `standingNotes.js` — the front matter: how to read the page, and the traps
  that apply across every entry (the ladder's rung-2-is-empty-before-2012
  quirk, the era formats, the thin top-rung sample). Add a trap here when a
  spike costs someone real time re-discovering one of these.

## The hook

`.claude/hooks/contender-diary-reminder.mjs` fires on any tool call touching
this program's data or write-ups — `docs/team-success-research.md`,
anything under `.scratch/team-success/`, and any future
`docs/team-success-*.md` spike write-up or its generator script. Same
contract as the prospect diary's reminder hook: advisory, stderr only, exits
0 always, quiet when the same call already touched
`src/lib/research/contenderDiary`. Widen its `WATCHED` list when a spike adds
a new script or doc path — a path not in that list is a path nobody gets
reminded about.

## Why admin-only

Same reasoning as the prospect diary: not because any of it is sensitive —
`docs/team-success-research.md` is already public — but because a working
notebook carries retractions, and a retraction on a public page reads as a
correction notice instead of the ordinary way research moves.
