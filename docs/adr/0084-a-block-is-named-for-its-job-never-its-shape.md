# A block is named for its job, never its shape

**Status:** Accepted
**Date:** 2026-09-22
**Issue:** #1129, in the Design system milestone. Evidence: finding 10 of
`.scratch/design-system/fable-critique.md` (PR #1124) and the census in
`.scratch/design-system/inventory.md`.

## Context

Four collapse issues follow this one. #1130 builds `Button` and `Door`, #1131
builds `Pill`, #1113 builds `SectionHead` and `Card`, #1132 builds `Table`,
`EmptyState` and `Notice`. Each of them renames classes. Without a written rule,
each rename is a taste, and four agents working four issues will apply four
different tastes to one system.

The system already gropes toward a grammar. `.rv` is a namespace with seven
elements under it and no shape word in its name. `.thub-card` draws a box and
says so.
`.is-themed` marks a state. The grammar is there; it is simply not written down,
so it is followed where somebody remembered it and broken where nobody did.

Measured on `main` at `ba07d2c93`:

| | |
| --- | --- |
| blocks whose NAME carries a shape word | **74** |
| of those, blocks that own NO base rule (a namespace) | 9 |
| `__chip` elements | 23 |
| of those, measurably tappable | **12** |
| classes on the reject list of clause 3 | 59 |
| classes this ADR's ledger renames or holds | **143** |

## Decision

Six clauses. A class that breaks one is recorded in
`docs/design-system-naming.md`, with the collapse issue that carries it.

**1. A block is named for its job, never its shape.** `standings`, `roster`,
`contract`, `runvalue`, `wire`. The shape words are `card`, `pill`, `chip`,
`tag`, `btn`, `door`, `sheet` and `notice`. A shape word belongs only to the
block that **owns the base rule for that shape**. `.thub-card` keeps `card`
because it draws the box. `.chalcard` may not, because it draws nothing.

*What it rejects:* a name that tells the reader what the thing looks like
instead of what it is for. There are 31 card blocks and 13 of them draw the
same four declarations, so "card" in a name says almost nothing. "Contract"
says everything.

*Why a block that draws no box may not carry a shape word.* This is the half of
clause 1 that matters most, and it is the one the census proves. `.chalcard`,
`.rvcard`, `.ballparkcard`, `.horizoncard`, `.advcard` and `.foulcard` own no
base rule at all — every rule they have is a `__element`. They are BEM
prefixes, and four of them already sit as a co-class on a `.thub-card` that
draws the real box. So the word `card` in their name describes a box **another
class draws**. The next agent who greps for cards finds them, counts them as
cards, and writes the 32nd card to match. That is not hypothetical: it is
exactly how the census reached 32 before #1127 corrected it to 31, and the same
prose-reading error invented a `.pin-card` that has never existed in this repo
at any commit. A name that lies about what a class draws is how the duplication
got here.

**2. A namespace carries no shape word.** `.chal`, `.rv`, `.ballpark`,
`.horizon`, `.adv`, `.foul`. Only `.rv` exists today; the other five are the
ledger's targets for `.chalcard`, `.ballparkcard`, `.horizoncard`, `.advcard`
and `.foulcard`, and their elements are written `.chal__board`, `.rv__rank`.

*What it rejects:* the special case of clause 1 that cannot ever be argued.
A namespace owns no base rule by definition, so it can never be the block that
owns the base rule for a shape, so it can never carry one of the eight words.

**3. The head, the body and the door have fixed names**: `__head` (holding
`__title`, `__note` and `__action`), `__body`, `__door`.

*What it rejects:* `__kicker`, `__eyebrow`, `__hd`, `__heading`, `__sub`,
`__lede` and `__more`. The head's second line has **five spellings across 77
classes** — `__note` (33), `__eyebrow` (15), `__sub` (13), `__lede` (11) and
`__kicker` (5). A reader cannot tell a `__lede` from a `__sub` from a `__note`,
because there is nothing to tell: they are the same line.

**4. A variant is `--word`; a state is `.is-word`.** `--ledger`, `--band`;
`.is-active`, `.is-empty`, `.is-themed`.

*What it rejects:* a state written as a modifier. A state is a condition the
element enters and leaves while it is on screen; a variant is the kind the
element is when it is made. The test is the call site: `.daystate__chip--live-on`
is applied as `${scoresUnlocked ? ' daystate__chip--live-on' : ''}`, so it is a
state, and it must be `.is-on`. `.penboard__tag--fresh` is passed once for what
a reliever IS, so it is a variant and it stays.

*A state is never written alone.* It is always compound with the block or the
element it marks — `.awaketoggle.is-on`, `.leaguepicker__chip.is-active` — which
is what every one of the app's state classes does today. `src/index.css` imports
all partials into one global sheet, so a bare `.is-on { … }` rule written in one
file reaches every `.is-on` element in the app. The ledger's target column writes
the pair for that reason, and a renamed allowlist entry in
`scripts/check-seal-scope.mjs` takes the pair, never the bare state.

**5. A control's name says it is a control**: `__btn`, `__toggle`, `__tab`,
`__door`. A `__chip` or `__tag` is never tappable — if it is, it is a `__btn`
wearing the pill skin.

*What it rejects:* a control that hides as a label. On the team hub one screen
holds the tab bar, two buttons, the club rail's arrows and a toggle, and they
are all the same drawn object. Twelve of the app's 23 `__chip` elements are
measurably tappable — they declare `cursor: pointer`, `:active` or `:disabled`,
or they render as a `<button>`, an `<a>` or an element with `onClick`. Eleven
are not. Nothing in the name separates the two, so a thumb has to find out by
pressing.

**6. The guard counts shapes, not words** (#1114). A capsule is
`border-radius: var(--radius-pill)`; a sheet is the four-token recipe; a band
is `--bar-fill`. The guard fails when a block outside the allowlist declares
one.

*What it rejects:* a guard that greps for `card`. Such a guard would pass
`.rankchip`, which is the pill recipe declaration for declaration and was never
counted because its name says chip, and it would fail `.scorecard`, which is
thirteen custom properties and no box at all. It must also blank `/* … */`
before it matches anything, or it counts sentences — that error inflated
`.gamecard` by 66 hits in the first census (#1127).

A guard that reads names at all must read a **word**, not a substring. `tag`
sits inside `postagestamp` and `flipstage`; `pill` sits inside `pillars` and
`pillar-key`. None of the four is a shape. A shape word counts when it is the
whole name, a suffix, or a hyphen-delimited segment — which is every real case
in this repo: `chalcard`, `rankchip`, `dirtag`, `xldoor`, `reg-pill`,
`tstats-card`. The writing of this ADR's own self-check tripped on exactly this
and reported `.flipstage` as carrying a shape word.

## One clause is corrected against the real classes

**Clause 3 reaches the head, the body and the door — not every use of the
word.** #1129 states the reject list flatly, and two of the thirteen `__sub`
classes are not head parts at all:

- `.bs__sub` is applied as `className={b.isSub ? 'bs__sub' : ''}` on a box-score
  `<tr>`. It names a **subtotal row**.
- `.ledger__sub` is a `<td>` class, selected as `tr.reg-subtotal .ledger__sub`.
  It names a **subtotal cell**.

Neither sits in a head, so clause 3 does not reach either. Both are held in the
ledger with that reason. Their abbreviation does collide with the head's second
line, and renaming them to say "subtotal" is worth doing — but it belongs to
#1132's `Table` work as a clarity fix, not here as a grammar break. A ledger
that renamed them under clause 3 would be stating a rule the rule does not make.

## What the clauses deliberately do not reach

**An element that names a shape.** Clause 1 binds a BLOCK name. `.bs__abscard`,
`.bs__defensecard`, `.last10__card--home` and the four `__notice` elements name
a shape one level down, and the same argument applies to them. They are not
widened into clause 1 here, because clause 5 **requires** four shape words in
element names — `__btn`, `__toggle`, `__tab`, `__door` — so a blanket "no shape
word in an element" would contradict clause 5 on its first line. The gap is real
and it is handed to #1114: a guard that counts shapes rather than words catches
an element that draws a box it does not own, without needing a word rule at all.

**A name with no shape word in it.** `__empty`, `hint`, `tablewrap` and
`index-group__badge` are not renamed by any clause, because `empty`, `hint`,
`table` and `badge` are not among the eight. #1132 still collapses them into
`EmptyState`, `Notice` and `Table`. Collapsing and renaming are different jobs,
and this ADR only governs the second.

## Consequences

- **The renames ride along.** This ADR renames nothing. The ledger in
  `docs/design-system-naming.md` assigns every row to the collapse PR that
  already touches that family, so no PR is a pure rename sweep. A rename sweep
  is the change that is hardest to review and easiest to get wrong, because
  nothing on screen moves and a missed call site fails silently.
- **Eight rows are held, and each says why.** `.scorecard` is 86 files and the
  app's reason to exist. `.stampcard` is held on ADR-0035, and the discovery
  that makes the hold necessary is that `scripts/check-stamp-surfaces.mjs`
  tracks the JS identifiers `GameStamp`, `StampGameButton` and `useStamps` — not
  the CSS class — so renaming `.stampcard` would pass `npm run lint` in silence.
  A guard that does not cover a thing is not a reason to treat the thing as
  covered.
- **A rename can break a guard.** `scripts/check-seal-scope.mjs` allowlists 61
  (file, selector) pairs by name and asserts that every one is still reached
  (ADR-0083), so a renamed selector fails lint rather than rotting. Six ledger
  rows name that file in their file column for exactly this reason. That is the
  guard working as designed.
- **Two files are easy to miss.** `src/screens/designlab/catalog.js` names
  classes as data, and `scripts/check-seal-scope.mjs` matches on them. Neither
  is a stylesheet and neither is a component, so a rename that greps only
  `src/styles/` and `*.jsx` misses both. The ledger's file column is measured
  over `src/`, `e2e/`, `test/`, `scripts/` and `api/` for that reason.
- **A class can have no call site to grep for.** Two of the 143 rows are
  invisible to a text rename. `.pitcherhandoff__chip--open` is built at runtime
  as `` `pitcherhandoff__chip--${bookOpen ? "open" : "closed"}` ``, so the
  literal string is in no file; rename the rule and it silently stops applying.
  `.cover__sub` is the other direction — commit `05ba45bdf` (2026-07-06) removed
  its only `<span>` and left the rule behind, so it has been dead for two and a
  half months. **Its ledger row says delete, not rename.** It is still on
  `check-seal-scope.mjs`'s allowlist, which is the limit of that guard's reach
  assertion: it checks that an allowlisted SELECTOR is still in the stylesheet,
  not that anything renders it, so an orphan passes. That is a narrower promise
  than ADR-0083's prose suggests, and worth knowing before the next allowlist.
- **The count is the argument.** 143 classes break at least one clause. That is
  not a tidiness backlog; it is the measure of how far a system drifts in the
  absence of a written rule, which is the case for writing one down now rather
  than after four more collapse PRs each pick a taste.
