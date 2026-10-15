# Run plan: team page, one page in the new look (#1107, #1154)

This is the run plan for `/orchestrate` Lane 3 (`.claude/skills/orchestrate/SKILL.md`).
It has 11 rows for the orchestrator, in 7 waves, and 2 steps that Gary does himself.

**Goal.** `/team/{id}` becomes one page of seven bands (Standing, Ranks, Games, Roster,
Farm, Money, About) with a sticky jump bar, in the player-page look (ADR-0109): square
corners, stamped cards, stat tiles, fact strip, jump bar. The plan is ADR-0082 and #1107.
The September boards in `.scratch/team-one-scroll/canvas/` are NOT used: they predate the
new look. `.scratch/team-one-scroll/design.md` and `scope.md` are used only for which
element goes in which band, the data decisions and the request counts.

## How to start it

1. Open a new cloud session on this repo. Pick **Auto** in the mode menu. Child sessions
   take the parent's mode.
2. Send: `/orchestrate run the plan in .scratch/team-canvas/run-plan.md`.
3. This run is **attended**. It stops at the two gates below and waits for Gary.

## Gates (Gary's steps, not rows)

| Gate | When | What Gary does |
|---|---|---|
| **G1: pick layouts** | After row 1 is merged. Runs while rows 2 and 3 run. | Paste the prompt in "Gary's step G1" into Claude Design. Choose a layout (A, B or C) for each element. Send the choices to the orchestrator. |
| **G2: judge the pilot** | After row 5 (the Standing band) is green. | Look at the screenshots. Say "go" or say what to change. Rows 6a to 6f start only after "go". |

The orchestrator replaces `{PICKS}` in row 5 with Gary's G1 message, word for word.

## Answers (so the orchestrator does not ask)

| Question | Answer |
|---|---|
| Merge each wave? | Yes. When every PR of a wave is green, `/stack-prs` those PR numbers (standing permission). Then start the next wave from the new `origin/main`. |
| Stack a child on an unmerged PR? | No. A row starts only when every row in its "Depends on" is merged. Row 4 is the one exception: it continues row 3's open PR. |
| Cap | 3 children at once. |
| Models | As in the table. Opus 5.5 only for row 4. |
| Ledger | Comments on #1107, one per wave. No new issue. |
| PR text | Each PR says `Part of #1107 (row <n>)`. Only row 7 says `Closes #1107 and #1154`. |
| A row fails | Mark it and its dependents blocked. Run the rest. |
| Close #1107 or #1154 | Only through row 7's PR. |

## Cloud notes (apply to every row)

- There is no local link in the cloud. Where a prompt says "check", take screenshots with
  `.claude/skills/run/shot.mjs`, send them to Gary with `SendUserFile`, and name the exact
  route and `gamePk`. Add `?nointro` to every test URL.
- The new page lives at an unlisted address that row 3 creates. Rows 5 and 6 use it.
- Cold-load request counts need a production build (`npm run build`, then
  `npm run preview`). StrictMode doubles dev counts.

## Shared files

Two rows that edit the same file run in different waves. Rows 5 and 6a to 6f each edit
only their own band's files. These are **append-only** and may be shared in one wave:

- `src/index.css`: one `@import` each.
- `docs/` and `src/screens/team/CLAUDE.md`: one paragraph each.

## The table

| # | What | Model | Effort | Depends on (merged) | Wave |
|---|---|---|---|---|---|
| 1 | Audit every team-page element (read-only, writes `audit.md`) | `claude-sonnet-5-5` | high | none | 1 |
| 3 | Foundation: ADR-0082, hidden page shell, jump bar, lazy bands, redirects | `claude-sonnet-5-5` | high | 1 | 2 |
| 4 | Review and fix row 3's PR | `claude-opus-5-5` | medium | 3 green (continues row 3's PR) | 3 |
| 5 | Pilot: build the Standing band | `claude-sonnet-5-5` | high | 3, 4, and G1 | 4 |
| 6a | Ranks band | `claude-sonnet-5-5` | medium | 5, and G2 "go" | 5 |
| 6b | Games band | `claude-sonnet-5-5` | medium | 5, G2 | 5 |
| 6c | Roster band | `claude-sonnet-5-5` | medium | 5, G2 | 5 |
| 6d | Farm band | `claude-sonnet-5-5` | medium | 5, G2 | 6 |
| 6e | Money band | `claude-sonnet-5-5` | medium | 5, G2 | 6 |
| 6f | About band | `claude-sonnet-5-5` | medium | 5, G2 | 6 |
| 7 | Swap `/team/{id}` and delete the old tab code | `claude-sonnet-5-5` | medium | 6a to 6f | 7 |

Row 2 is G1 (Gary, in Claude Design). It has no number in the table because the
orchestrator does not run it. It may start as soon as row 1 is merged, in parallel with
row 3.

## Row 1 — Sonnet 5.5, effort high

```
Goal: audit every element on the team page (/team/{id}) and give each one a verdict:
RE-SKIN (same layout, new parts), RE-DESIGN (needs new boards), MERGE/CUT, or KEEP.
Write the result and stop. Change no product code.

Background. The team page will become ONE page of seven bands (Standing, Ranks, Games,
Roster, Farm, Money, About) with a sticky jump bar. That plan is signed off: read
docs/adr/0082-the-team-page-is-one-scroll-of-named-bands.md, issue #1107, and
.scratch/team-one-scroll/design.md (sections 3, 13, 14) and scope.md (2B, 2F). Use them for
which element goes in which band, and for the data and request-count decisions. IGNORE
the September boards in .scratch/team-one-scroll/canvas/: they predate the new look.

The new look is the player-page look: ADR-0109 (docs/adr/0109-the-canvas-is-the-site-wide-look.md).
Square corners, stamped card, stat tile, fact strip, jump bar, stamp-in motion. The parts
are in src/styles/system/ (stamped/, jumpbar/, card.css, table.css, section-head.css) and
src/components/ui/. /design-lab shows them. Read docs/player-redesign.md sections 3 and 6
and src/screens/player/next/CLAUDE.md to see how the player page used them.

Do this:
1. List every card, table, chart and rail on the Overview and all six tabs. Start from
   src/screens/TeamPage.jsx, src/screens/team/*Tab.jsx, src/screens/team/modules/**,
   TeamHubShell.jsx and src/components/teamstats/.
2. One row per element: element; file; band; the shared part it maps to (or "none");
   verdict; one line of reason; any data gap. RE-SKIN needs a reason that the layout
   already works. RE-DESIGN says what the layout fails to do (hierarchy, density,
   related facts far apart).
3. Judge the top of the page: what does a reader learn about the team in the first screen
   at 390 px today? What could the header and tiles hold from data the app already fetches?
4. Propose the build order of bands. Say why the Standing band is a good pilot or not.

Write the table to .scratch/team-canvas/audit.md. Put a short summary in your final reply.

Keep: ?d= and ?s= on every link out; MiLB degradation (affiliates and winter-ball club 675
have fewer bands; a missing band does not render); ADR-0057 addresses.
Check: render /team/158?nointro at 390 and 1180 px with .claude/skills/run/shot.mjs, and
also /team/556, /team/249 and /team/675. Send the screenshots to Gary with SendUserFile.
Done means: audit.md exists, every element has a row, and nothing in src/ changed.
Stop and ask when: an element has no clear band.
```

## Gary's step G1 — Sonnet 5.5, effort medium (paste into Claude Design)

Fill in the three `<...>` parts from row 1's `audit.md` before you paste.

```
Design the STANDING band of the team page, in the "Player Detail Page - Pitcher and Batter"
canvas look (https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK). Same house colours and
faces, square corners, stamped cards with the hard offset shadow, stat tiles, fact strip,
jump bar. Do not invent a new style. The look is fixed; only the LAYOUT varies.

Elements to draw: <paste the RE-DESIGN rows for the Standing band from .scratch/team-canvas/audit.md>.
Material to use: <paste screenshots of today's elements and the real Brewers (158) numbers>.
Match the nearest player-page board for each part: <name boards, e.g. SeasonStats, Splits>.

Step 1: for EACH element, draw 3 different layouts at phone width (390). The layouts must
differ in what leads and what is secondary, not in colour or type. Label them A, B, C.
Say in one line what each one makes easy to see. STOP here. Do not draw wide boards yet.
Step 2 (after Gary picks): draw the picked layout at 390 and 1180, for the Brewers, then the
reduced band for a Single-A club (249).

The first screen must answer: "what is going on with this team right now?"
Check yourself: view your own output at 390 and zoom in on each stamped card. Compare each
to its matching player-page board. List three differences and fix them before you hand back.
```

Send the choices to the orchestrator as one message, for example "Team score: B.
Records: A. Standings: C." If an element is RE-SKIN, no choice is needed.

## Row 3 — Sonnet 5.5, effort high

```
Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Goal: build the foundation of the new team page at a hidden address and stop. Do not
build band content: each band slot mounts the existing module as it is today.

Read first: docs/adr/0082-the-team-page-is-one-scroll-of-named-bands.md, issue #1107
("What ships", "What must not break"), issue #1154, docs/adr/0109-the-canvas-is-the-site-wide-look.md,
docs/player-redesign.md, src/screens/player/next/CLAUDE.md, src/screens/team/CLAUDE.md,
.scratch/team-canvas/audit.md. For the hidden-page pattern read commits 5f65b939a and
084376666 (the player page before its swap, #1884; the hidden route itself is gone now).

Do this, test-first where a function is new:
1. ADR-0082: change status from DRAFT to Accepted, note ADR-0109 in it, and mark ADR-0034
   superseded. Do not delete ADR-0034.
2. Add an unlisted route in src/lib/route.js and src/App.jsx. Page shell: TeamHubShell, then
   seven band slots in this order: Standing, Ranks, Games, Roster, Farm, Money, About. Mount
   each band with src/hooks/scroll/useNearView.js, as the player page does, so nothing loads
   before it is near. Give each band its own folder under src/screens/team/ so later rows
   edit only their own folder.
3. Write hiddenTeamSections(team) in src/screens/team/data/shared.js (test the league?.id
   case before any sport test). A band with no data does not render and has no jump-bar
   button. Keep hiddenTeamTabs for the old routes until the swap.
4. Build the sticky jump bar from src/components/chrome/HubTabBar.jsx and
   src/styles/system/jumpbar/. It marks the band you scroll through. Keep it club-neutral
   (ADR-0030).
5. Redirect the five tab routes to anchors on the new page, behind the hidden address for now.
6. Count requests for a cold load of /team/158 in a PRODUCTION build (npm run build, then
   npm run preview). Use .scratch/team-one-scroll/count-requests.mjs. Today's Overview is
   the ceiling. Put the before and after numbers in the PR text.

Keep: ?d=/?s= on every door out (a dropped ?d= is a spoiler bug); file and directory
caps (check-file-size, check-dir-size); TeamPage.jsx must not grow.
Check: the hidden address with ?nointro at 390 and 1180 px, for 158, 556, 249 and 675.
Take screenshots with .claude/skills/run/shot.mjs and send them to Gary with SendUserFile,
with the exact route and gamePk. Look at the jump bar marker as you scroll.
Done means: npm run lint, npm test and npm run build pass, the count is at or under the
ceiling, the PR targets main from a task branch (never push to main). Last step: run
ponytail-review on the diff, apply its cuts, then run /code-review.
Stop and ask when: the count goes over the ceiling, or an old route cannot redirect.
```

## Row 4 — Opus 5.5, effort medium (continues row 3's PR)

The orchestrator uses its "row that continues an open PR" footer, with `source_revision`
and `outcome_branch` set to row 3's branch.

```
Review the foundation PR for the team page (row 3's PR). Fix only a defect you can prove
with a failing test or a command; list every other finding in a PR comment, worst first.

Check, with evidence: (1) every link out keeps ?d= and ?s=; (2) cold-load request count for
/team/158 in a production build is at or under today's Overview, and the PR text shows both
numbers; (3) a band with no data does not render and has no jump-bar button, for 556, 249
and 675; (4) the five old tab routes land on the right anchor; (5) ADR-0082 is Accepted and
ADR-0034 is marked superseded, not deleted; (6) file and directory caps hold and
TeamPage.jsx did not grow; (7) no gate was added to the team page (it is an open page;
ADR-0034 "The cutoff is opt-in now"); (8) each band has its own folder, so rows 5 and 6
can edit one band each.
```

## Row 5 — Sonnet 5.5, effort high

The orchestrator replaces `{PICKS}` with Gary's G1 message.

```
Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Goal: build the STANDING band of the new team page as the PILOT, in the player-page look.
Gary reviews it before any other band starts.

Gary's layout choices from the design step: {PICKS}

Read: .scratch/team-canvas/audit.md (the Standing rows), ADR-0082, issue #1107, issue #1154.
Copy the structure of src/screens/player/next/modules/ and use the parts in
src/styles/system/ and src/components/ui/. The foundation (hidden page, jump bar, band
slots) already exists on main.

Do this: follow each element's audit verdict. RE-SKIN: move the card onto the stamped-card
parts and tokens; keep the layout. RE-DESIGN: build Gary's picked layout. MERGE/CUT: as the
audit says. Reuse the existing module and loader; do not write a parallel component.
Square corners. Tokens only, no raw hex. Rank reads "78 of 89" on its own line.
Rank emphasis uses --marker, never --seal. No title= tooltips.

Keep: ?d=/?s= on every link; MiLB fallbacks; the band does not render when empty; the
request count of /team/158 stays at or under the ceiling.
Check: the hidden address with ?nointro at 390 and 1180 px, for 158 and 249. Take
screenshots with .claude/skills/run/shot.mjs, zoom on each card, compare to the matching
player-page card, list three differences and fix them. Send the final screenshots to Gary
with SendUserFile, with the exact route and gamePk, and say what to look at.
Done means: lint, npm test, build pass; PR into main from a task branch; never push to
main. Last step: ponytail-review on the diff, apply its cuts, then /code-review.
Stop and ask when: a card needs a number the app does not fetch.
```

## Rows 6a to 6f — Sonnet 5.5, effort medium

One row per band. The orchestrator replaces `{BAND}` with Ranks, Games, Roster, Farm,
Money or About (rows 6a to 6f), and `{PICKS}` with Gary's layout choices for that band, if
any.

```
Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Goal: build the {BAND} band of the new team page at the hidden address, in the same way as
the merged Standing pilot.

Gary's layout choices for this band (may be empty): {PICKS}

Read: the Standing pilot PR and files (copy its structure), .scratch/team-canvas/audit.md
(rows for {BAND}), ADR-0082, #1107. Follow each element's audit verdict (RE-SKIN,
RE-DESIGN, MERGE/CUT) exactly as in the pilot. Where an element is RE-DESIGN and Gary
gave no choice, take the layout nearest the pilot's and log a [DECISION: ...] line in the
PR text. Reuse the module and its loader. Tokens only. Square corners. Edit only {BAND}'s
folder, plus one @import line in src/index.css if you add a partial.

Keep: ?d=/?s= on every link; MiLB fallbacks; request count at or under the ceiling.
Check: the hidden address with ?nointro at 390 and 1180 px for 158 and one affiliate that
has this band. Take screenshots with .claude/skills/run/shot.mjs; compare to the pilot and
the player page; list three differences; fix them. Send the final screenshots to Gary with
SendUserFile, with the exact route and gamePk.
Done means: lint, npm test, build pass; PR into main from a task branch; never push to
main. Last step: ponytail-review, apply cuts, then /code-review.
Stop and ask when: a card needs a number the app does not fetch.
```

## Row 7 — Sonnet 5.5, effort medium

```
Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Goal: the swap PR. /team/{id} serves the new page; delete the old tab code.

Do this: route /team/{id} to the new page; keep the five old tab routes as redirects to
anchors; remove the hidden address; delete the old Tab components and loaders that nothing
uses (src/screens/TeamPage.jsx old body, *Tab.jsx, load*.js) and hiddenTeamTabs if nothing
uses it; update src/screens/team/CLAUDE.md and src/CLAUDE.md. Put "Closes #1107 and #1154"
in the PR text.
Check before you open the PR: screenshots at 390 px of an MLB club (158), Triple-A (556),
Single-A (249) and winter ball (675), sent to Gary with SendUserFile. Run the cold-load
request count again (production build) and put both numbers in the PR.
Done means: lint, npm test, build pass; PR into main; never push to main. Last step:
ponytail-review, apply cuts, then /code-review.
```

## Why it is shaped this way

- Row 5 is a pilot because Gary judges the look on one band before six more are built.
- Rows 2 (design) and 3 (foundation) run in parallel: the foundation does not need the boards.
- Row 4 is Opus 5.5 because a fresh reader finds `?d=` and request-count faults the author misses.
- Rows 6a to 6f run at medium because they copy the pilot's pattern.
- Design effort does not improve taste or variety. Variety comes from G1's "3 layouts" step.
