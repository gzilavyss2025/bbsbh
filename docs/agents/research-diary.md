# The prospect-research diary

An admin-only page at `/admin/research`, linked from the footer, holding
everything the minor-league development research has found. Nine entries at
the time of writing, newest first — eight of them one per spike, plus one
reading of the whole stack.

It exists because that research produced long technical documents in `docs/`
and no way for the person who commissioned it to read the answers. The
documents keep the method. The diary keeps the findings, in English.
Before a spike re-pulls statsapi for a panel, check
`docs/agents/research-database.md` — the panel may already exist as a
queryable view.

The first four entries ask about **clubs** — how long a stay at a level takes,
whether some organizations move men faster, whether leaning on your own players
costs you. The next four ask about the **player**: his size, his arm, the
awards he had already won, and what he did in his rookie season. The newest
asks nothing new. It reads the other eight from the commissioning side, says
which of them changes a decision, and hands back the questions it wants
measured next.

## The two rules

**1. Write it for someone who does not know what a p-value is.** This is the
whole point of the page and it is the part that will drift first, because the
person adding an entry has just spent a day inside the statistics and every
piece of jargon feels ordinary to them. It is not ordinary to the reader.

- "It held up in 30 of 30 refits" → "we ran it again thirty times, dropping a
  different club each time, and it held all thirty times."
- "p = 0.0040 on a within-org permutation test" → "we shuffled the seasons and
  ran it 500 times to see how often coincidence produces something this strong.
  Once."
- "incremental R² = 0.0043" → "knowing this improves your guess about any
  particular prospect by less than half of one percent."

The formal statement is not thrown away. It goes in the entry's `technical`
list, which the page renders folded up behind a disclosure. Both readers get
served, and the one who needs plain English gets served first.

**2. Never edit an old entry to agree with a new one.** Entries are dated and
append-only. When a later pass overturns an earlier one — and one of them here
overturns two things — the old entry stays exactly as it was, and the new one
carries a `corrected` verdict and says what it takes back. A notebook that
quietly rewrites its past cannot show anyone how a conclusion moved, which is
usually the most useful thing in it.

Fixing a typo or a broken figure in an old entry is fine. Changing what it
concluded is not.

## An entry that measures nothing

The `agenda` verdict — "Asks for more" — is for the entry that reads the others
instead of adding a number. It exists because the meeting where somebody says
what a stack of studies is worth is the half of research that normally
evaporates, and dating it makes it a record of what was believed on a day, the
same as any finding.

It buys no relief from the two rules. Such an entry still carries `caveats`,
and the first of them always says the same thing: nothing here was measured, so
every disagreement with an entry below it is a disagreement with an emphasis
and not with a number. Do not reach for this verdict to avoid doing the work.
If a claim in it can be tested, it belongs in a spike, not here.

## The voice: write it like a baseball book

Standing instruction from the repo owner (2026-08-25), applying to **both**
research diaries. An entry reads the way David Halberstam or Michael Lewis
would write it for a baseball book — plain language, middle-school to
high-school reading level, no statistics vocabulary in the reader-facing
fields. Everything formal moves into the entry's `technical` list, which the
page folds behind a disclosure; the rule relocates the jargon, it does not
delete it. If an idea cannot be avoided, teach it with a picture and a real
team, not a definition.

`.claude/hooks/diary-voice.mjs` hands a session the full voice at the moment
it writes an entry; `scripts/check-diary-voice.mjs` runs in `npm run lint` and
fails on statistics terms outside `technical`. Entries predating the
instruction are grandfathered by path, because both diaries are append-only —
that is the rule working, not an exemption to widen.

The full statement of the voice, with examples, lives once in
`docs/agents/contender-diary.md` rather than being duplicated here.

## Adding an entry

Files live in `src/lib/research/diary/`. One file per entry, plus:

- `index.js` — the entry shape is documented in its header. `RESEARCH_DIARY` is
  the ordered list; **append at the top**.
- `standingNotes.js` — the front matter: how to read the page, and the traps
  that apply to every entry. Add a trap here when a new one costs someone a day.

Every entry needs a non-empty `caveats` list. If a finding has nothing wrong
with it, the entry is not finished — go and find what is wrong with it. In most
of the entries here, the missing thing is the most likely reason the finding is
wrong.

## The hook

`.claude/hooks/research-diary-reminder.mjs` fires on any tool call that touches
the research data or its write-ups:

- `docs/level-tenure-benchmark.md`, `docs/team-movement-windows.md`,
  `docs/homegrown-dependence.md`, `docs/prospect-traits.md`
- `scripts/gen-level-tenure-benchmark.mjs`,
  `public/data/level-tenure-benchmark.json`, `src/api/levelTenure.js`
- anything under `.scratch/level-benchmarks/` or `.scratch/prospect-traits/`

It is advisory: it writes one line to stderr, always exits 0, and stays quiet
when the same call already touched `src/lib/research/diary`. It reminds rather
than blocks, because the entry cannot be written before the work that produces
it — blocking the edit would be backwards.

Not every touch needs an entry. A refactor, a rerun that changes no conclusion,
or a typo does not. A changed, added, corrected or retracted **finding** does,
in the same commit.

Widen `WATCHED` in the hook when this research grows a new surface. A path that
is not in that list is a path nobody gets reminded about.

## Why admin-only

Not because any of it is sensitive; three of the four entries are already
public in `docs/`. It is that a working notebook has retractions in it, and a
retraction on a public page reads as a correction notice rather than as the
ordinary way research moves.

The gate is the same client-side Clerk role check the copy editor makes, and
it is not a security boundary — the diary is authored content in the bundle,
with no endpoint behind it. See `src/components/account/AdminFooterLink.jsx`
for why the footer row is a deliberate exception to the shared page registry
in `src/lib/reportPages.js`.
