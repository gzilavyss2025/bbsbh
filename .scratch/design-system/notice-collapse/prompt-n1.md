# Notice — the N1 prompt (#1132)

Written 2026-10-06, after the N0 plan merged (#1498, inside the stack PR #1518).
This is the first code slice of the third #1132 family. Paste the block under
"The prompt" into a fresh session. It asks Gary the five decisions of
`decisions.md` with `AskUserQuestion`, one at a time, and then builds `Notice`
to match his answers. The prompts for N2 to N8 are not here: the N1 session
writes down what it learned, and a later session writes them (`slices.md`,
"Handoff").

## What changed since N0 (read this before you paste)

I measured these on `origin/main` at `9d01ade71`. N0 measured `1be24feeb`.

1. **The census drifted by six rows.** The stack landed the Matchup Scout
   restructure (#1490), which moved and added files. Running the census prints
   `unreviewed 4` and two STALE keys:
   - `screens/scout/HeadToHead.jsx#1` is STALE. The file is gone. Its
     `AsyncStatus` now sits in `screens/scout/meetings/MeetingsPanel.jsx#1`
     (UNREVIEWED).
   - `screens/scout/MapParts.jsx#1` is STALE. It is now
     `screens/scout/zones/MapParts.jsx#1` (UNREVIEWED), the same `.scout__readout`
     row: other, n/a.
   - `.scout__callout` is a new selector (`styles/scout/panels.css:330`): a 3px
     `--award-line` left rule on `--surface-card`, no tint. Its site is
     `screens/scout/zones/ZonesPanel.jsx#1`. It is a sentence the Zones panel
     builds about the map: job `callout`, n/a. It is a second app-facing 3px rule
     that the issue did not name.
2. **N0 counted three `AsyncStatus` callers as error rows that can never show an
   error.** `ScoutPage.jsx`, `MeetingsPanel.jsx` and `designlab/scout/ScoutLab.jsx`
   pass only `loading hasData={false}`: they reach the loader, not the error
   branch. Their rows say `error`, MIGRATE, N4. They are `loading`, HOLD. So the
   callers that can show the error line are **36, not 39**, and the N4 count of 45
   becomes 42.
3. **One pilot line moved.** `.posterstudio__warn` is at `screens/GamePreview.jsx:169`
   (the spec says 167). The CSS is still `styles/62-game-preview.css:138`.
4. **Three existing tests pin the CSS import order around `empty-state.css`.**
   `notice.css` goes between `empty-state.css` and `06-loader-and-cards.css`, so
   all three must change with it (they assert adjacency; change the expected list,
   never the strength of the check):
   - `test/empty-state-cascade.test.js:47-54` (06 must sit right after
     `empty-state.css`),
   - `test/card-cascade.test.js:256-264` (only `table.css` and `empty-state.css`
     sit between `card.css` and 06),
   - `test/table-cascade.test.js:60-70` (only `empty-state.css` sits between
     `table.css` and 06).
5. **The file count is 12 (13 with a raw-value budget), not 10.** The 3 pins above are the extra files. This is
   the same thing E1 did. The docs (`decisions.md`, `overrides.tsv`, `slices.md`,
   `spec.md`) do not count toward the target.
6. **Skills now in the repo:** `steward` (drive a PR to mergeable), `stack-prs`
   (batch-merge open PRs), `improve-prompt`, `design-brief`, `design-retry`,
   `ponytail*`. The prompt uses `ponytail`, `ponytail-review` and `/code-review`.
7. **CI had an outage on 2026-10-05** (a `lint-and-build` job cancelled after about
   15 minutes with no runner and no steps, on `main` too). If it happens again, it
   is not the PR. The prompt covers it.

---

## N1 — ask the five decisions, build `Notice`, move the pilot

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), high. It is a new component, a
CSS file, a helper, a lab entry and tests, copied from a shape that already exists
(EmptyState), plus one judgment: bending the build to Gary's five answers. There is
no spoiler-rule change (the pilot is on the poster studio, not a scoring surface),
so rung 4 is enough. If the first result is shallow, raise the effort before you
change the model.

### The prompt

```text
Use the ponytail skill at level full. Reuse what the repo already has before you
write anything new. (Ponytail never overrides the spoiler rule, test-first or
check-dir-size.)

Task: build slice N1 of the Notice collapse for GitHub issue #1132
(gzilavyss2025/bbsbh). First ask Gary the five design decisions with the
AskUserQuestion tool, one question at a time. Then build the Notice component, its
CSS, its class helper, its lab entry and its tests, to match his answers, and move
ONE pilot site onto it. This is the first code slice of the third family
(Table and EmptyState are done). #1132 stays open: eight more Notice slices come,
then the dashed-rule fix. The PR says "Part of #1132", never "Closes #1132".

Context
- The plan is on main in .scratch/design-system/notice-collapse/ (merged in #1498):
  spec.md (the proposed API), decisions.md (the five questions), slices.md (N1 and
  the order), census.mjs, overrides.tsv, census.md. Its numbers were measured on
  main at 1be24feeb. Main has moved (stack PR #1518). prompt-n1.md, the file you
  were pasted from, lists what changed: read its "What changed since N0".
- What N0 found: of the six things the issue names, only .delaycard draws "a 3px
  left rule on a tinted inset". So the shared look is a CHOICE (question 1), not a
  copy. Four tones are in use: info, event, caution, error. No tone may read
  --seal* (ADR-0083). Notice has no club colour (ADR-0030 addendum).
- EmptyState is the model. Copy its shape: src/components/ui/state/EmptyState.jsx,
  src/lib/design/emptyStateClass.js (it exports SIZES and emptyStateParts(), and an
  unknown size throws), src/styles/system/empty-state.css,
  test/empty-state-cascade.test.js (five sections: the slot, the look, the helper,
  no imports and no reveal, the pilot), and EmptyStateDemo in
  src/screens/designlab/components.jsx.
- Spoiler scope. Notice fetches, computes and gates nothing and has no reveal prop.
  It imports no src/api/ module and no stamp module (ADR-0035). Inside the scope
  its copy says what is missing or what state the page is in, never what happened
  in the game. The pilot (screens/GamePreview.jsx, the poster studio) is not one of
  the four scoring surfaces, and its copy names no result. The test that decides
  WHEN the line shows (`overflows`) stays byte for byte.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, src/CLAUDE.md, src/components/ui/CLAUDE.md,
   src/styles/CLAUDE.md, docs/agents/writing-style.md, ADR-0083, ADR-0084, and in
   .scratch/design-system/notice-collapse/: prompt-n1.md ("What changed since N0"),
   spec.md (sections 3 to 6, 8, 10, 14 and 15), slices.md (N1 and "If Gary answers
   otherwise") and decisions.md. Then read the EmptyState files named above.
2. Fetch origin. List open PRs and worktrees. Work on the branch your session was
   given. If it was not given one, make `claude/notice-n1` from current origin/main
   (the earlier N0 branch was merged and deleted). Run `git merge-base --is-ancestor
   origin/main HEAD`: if it fails, merge origin/main first. Check status and diffs
   before you edit. Other agents may work at once: never reset, stash or reformat their work.
3. Run `node .scratch/design-system/notice-collapse/census.mjs --dump` ALWAYS WITH
   --dump while you read it (without it the script rewrites census.md and
   census.json).

Step 1 — fix the census drift (before you ask anything)
Fix overrides.tsv by READING each row's code, never by the grep alone:
- DELETE the two STALE keys screens/scout/HeadToHead.jsx#1 and
  screens/scout/MapParts.jsx#1 (do not mark them DONE).
- ADD screens/scout/meetings/MeetingsPanel.jsx#1: it passes only
  `loading hasData={false}`: job loading, HOLD. CHANGE the same way
  screens/scout/ScoutPage.jsx#1 and screens/designlab/scout/ScoutLab.jsx#1: they
  also pass no error prop. Read each one first and say so in the reason.
- ADD screens/scout/zones/MapParts.jsx#1 (the .scout__readout row: other, n/a, as
  before), the selector .scout__callout and screens/scout/zones/ZonesPanel.jsx#1
  (callout, n/a; the reason names the 3px --award-line rule and that it is a
  generated sentence about the map).
- Re-run the census (no --dump) until it ends `unreviewed 0` with no STALE line.
  Do NOT commit census.md or census.json (the EmptyState slices did not); commit
  overrides.tsv only.
- Add a short "Corrections after N0" section at the end of spec.md: the three
  loader-only AsyncStatus callers (36 error callers, not 39), the moved pilot line
  (169), and the three tests that pin the import order.

Step 2 — ask Gary the five decisions (AskUserQuestion, ONE question per call)
Gary's standing rule: ask one question at a time and use AskUserQuestion. Ask in
this order. Put the recommended option first and end its label with
"(Recommended)". The `preview` text is a plain-text mock. Wait for each answer
before you ask the next. If an answer is "Other", read the note and ask a
follow-up if it is not clear; never guess. If the AskUserQuestion tool is not
available in this session, STOP and say so: do not answer for Gary.

Q1  header "Look"
    question: "What does a Notice look like? The issue says a 3px bar on the left;
    only the delay card has one today."
    options:
    - "Wash (Recommended)": "A thin edge all round and a pale tint inside, the same
      for every tone. Matches the pitcher cards (33 sites). The delay card loses
      its bar and its shadow."
      preview:
        ┌─────────────────────────────┐
        │ ⛈ RAIN DELAY                │
        │   Play stopped for 42 min   │
        └─────────────────────────────┘
        thin edge all round, pale tint
    - "Rail": "A 3px bar on the left edge only, on a tint. Matches the delay card
      and the lab pages. The pitcher cards lose their box, and ADR-0017 chose
      against a rail on purpose."
      preview:
        ┃ ⛈ RAIN DELAY
        ┃   Play stopped for 42 min
        3px bar on the left, no other edge
    - "Per tone": "A bar for info and error, a wash for event and caution. Two looks
      inside one component."
Q2  header "Errors"
    question: "Does a one-line error get a box, or stay coloured text? About 42
    screens change, the slate among them."
    options:
    - "A box (Recommended)": "Every error becomes a Notice with tone error: pale clay
      fill, clay edge, dark-clay words. A smaller box inside a card. Screen readers
      hear it at once."
      preview:
        ┌──────────────────────────────────────┐
        │ Couldn't load games. Check your      │
        │ connection and try again.  [Retry]   │
        └──────────────────────────────────────┘
    - "Text stays": "Errors stay clay words. Notice then serves only the 40 sites
      that already have a box. Slices N2 and N4 are dropped."
      preview:
        Couldn't load games. Check your connection and try again.  [Retry]
Q3  header "Pitcher card"
    question: "Is the pitcher card's outer frame part of Notice? (The card is 28
    files; its inside layout is not touched either way.)"
    options:
    - "Frame only (Recommended)": "The cards take their frame from a shared class.
      Three slices on the innings viewer (N6, N7, N8). One definition of the yellow
      wash."
    - "Held out": "The card keeps its own frame. Only the rename (N8) happens. The
      event tone then has one user, the postponed strip."
Q4  header "Tones"
    question: "Which tones? Each is a role, not a colour."
    options:
    - "Four (Recommended)": "info, event, caution, error. caution and error share a
      colour family; they differ in ink and in what a screen reader says."
    - "Three": "info, event, error. caution is merged into error: the photos notice
      would use the error ink and announce as an alert."
    (Gary can type other names with "Other".)
Q5  header "Hold list"
    question: "Leave these as they are? They are 71 sites: 7 tape banners, the
    as-of banner, the live-edge chip, the sync strip, the Express Lane lines, the
    pregame board tags, and the lab and admin pages."
    options:
    - "Leave all (Recommended)": "None of them becomes a Notice. Each reason is in
      spec.md section 9."
    - "Also move the as-of banner": "It needs a variant with two actions. Adds one
      slice after N5."
    - "Also move the tape banners": "They need a fifth, filled look, and stop looking
      like tape. Adds one slice."

Step 3 — record the answers
- In decisions.md, fill the answers table (Q1 to Q5) with Gary's words and today's
  date, in the style of ../empty-state-collapse/decisions.md.
- If ANY answer differs from the recommendation, change slices.md as its "If Gary
  answers otherwise" table says, and say which slices appear or vanish. Do not
  start N2 to N8.

Step 4 — build (only what a user of N1 needs, nothing more)
How each answer bends the build:
- Q1 wash: the CSS in spec.md section 6. Rail: the base draws
  `border-left: 3px solid var(--notice-edge)` and no other edge. Per tone: info and
  error draw the rail, event and caution the wash; pin both.
- Q2 text stays: do not build tone error. The pilot becomes .gamephotos__notice on
  screens/GamePhotosPage.jsx and screens/team/TeamPhotosPage.jsx (2 sites, label
  "Unsealed", tone caution; keep its dashed edge in the namespace rule in
  styles/14-strike-zone.css so nothing changes on screen), instead of
  .posterstudio__warn.
- Q3 held out: do not build the frame-only helper noticeClass(); build the
  component and noticeParts() only. Frame only: build both; noticeClass({ tone,
  size, className }) returns the frame class string for a caller that owns its root
  (the pitcher cards and one <button>, from N6). Its test pins it.
- Q4 three: no tone caution (the pilot uses error). If Q2 is also "text stays",
  there is no error tone either: STOP and ask Gary which tone the pilot takes.
  Other names: use Gary's names in
  the class names, the props, the lab, the tests and the docs.
Files (target 10; 12 here, 13 if the pilot lowers a check-raw-values.mjs budget; see
"What changed since N0"):
1. src/components/ui/state/Notice.jsx — `<Notice tone label icon action size
   className {...rest}>text</Notice>`; root `div.notice.notice--{tone}.notice--{size}`
   with `__icon`, `__body` (`__label`, `__text`) and `__action`, each rendered only
   when given; tone error defaults to role="alert"; any role the caller passes wins.
   Copy EmptyState's header comment style: what it owns, what it does not, no reveal
   prop, no api/ import.
2. src/styles/system/notice.css — tokens only (no raw value), no margin, no shadow, a
   solid edge (never dashed: a namespace may keep a dashed edge until the dashed-rule
   PR). Tones set --notice-edge, --notice-wash and --notice-ink. The error ink is
   var(--clay-deep): --clay on --clay-soft is 4.28:1 and fails AA (spec.md section
   14). No rule reads --seal.
3. src/lib/design/noticeClass.js — SIZES, TONES, noticeParts(); an unknown tone or
   size throws; "not given" is null, undefined, false or ''.
4. src/index.css — `@import './styles/system/notice.css';` right after
   system/empty-state.css and before 06-loader-and-cards.css, with a comment like the
   EmptyState one.
5. test/notice-cascade.test.js — the five sections of the EmptyState test: the slot;
   the look (tokens only, no ground that is not a tone's, no --seal); the helper
   (class order, throw, optional parts); no api/ and no stamp import and no reveal
   prop; the pilot.
6 to 8. test/empty-state-cascade.test.js, test/card-cascade.test.js and
   test/table-cascade.test.js — the three import-order pins (change the expected
   list; keep each check as strict as it was).
9. src/screens/designlab/components.jsx — a NoticeDemo and an Entry for Notice:
   one Notice per tone that exists, a label + action one, a compact one. The copy is
   invented and says what is missing or what state the page is in, never what
   happened. (catalog.js needs no change: it is the card and pill table.)
10. src/components/ui/CLAUDE.md — replace the last sentence of the `state/` line
    ("A loading, error or footnote line is still a `.hint` until `Notice` joins it
    when its census lands.") with what Notice is: the tones, label, icon and one
    action, owns no margin, no reveal prop. Keep the file under its cap
    (npm run lint checks).
11 and 12. The pilot (Step 5).
Directory budget: src/styles/system/ goes from 11 to 12, the cap. Say so in the PR
body. The next file there needs the system/state/ subfolder (spec.md section 5).
Do NOT add a budget entry.

Step 5 — the pilot (1 site; see Q2 for the alternative)
.posterstudio__warn on screens/GamePreview.jsx (about line 169) becomes
`<Notice tone="caution" role="status">` with the same sentence. It appears after the
reader toggles a section, so it is a live region. The `overflows` test stays. Read
the parent's layout: if the line needs a gap, put it in a namespace rule or in a
Stack; if the .posterstudio__warn rule has nothing left, delete the rule and the
class; otherwise it keeps only a margin. Delete the declarations the Notice now
draws (colour, font) from styles/62-game-preview.css and, if that deletes a raw
value, lower the matching scripts/check-raw-values.mjs budget (#1178).

Tests first, for the whole slice. Write test/notice-cascade.test.js (all five
sections, the pilot's pins included) and the three moved import-order pins BEFORE
Notice.jsx, notice.css, noticeClass.js and the index.css line. Watch them FAIL, then
build until they pass. Never delete, skip or loosen an assertion to make a
check pass.

Step 6 — verify
- `npm run lint; echo "exit=$?"` in the foreground (it also runs the CLAUDE.md,
  dir-size, file-size, contrast, raw-value and seal-scope guards), `npm test`,
  `npm run build`. All green. If a CI job is cancelled with no runner and no steps,
  that is the Actions outage of 2026-10-05, not the PR: re-run it once, and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5).
  `ss` is not installed: probe each port with
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT/design-lab?nointro`.
  Load, at 390px and 900px, ALWAYS with ?nointro: /design-lab?nointro (the Notice
  entry) and /07072026/milstl-2/preview?nointro (the pilot; turn on three full
  sections so the line shows; say "not seen" if it does not). Headless Chromium
  cannot reach statsapi.mlb.com through the proxy: relay those calls through Node
  with page.route, and launch with executablePath '/opt/pw-browsers/chromium'
  (cloud session; on a local machine use its own Chromium and plain probes). Use
  your own subfolder of the scratchpad. Keep the dev server running and put the
  clickable local URL in the handoff.
- Do not run npm run e2e or npm run visual unless Gary asks.

Step 7 — review, commit, PR
- Use the ponytail skill while you build. When the code is done, run ponytail-review
  and /code-review (medium) on your diff, and fix what they find.
- Re-run the census (no --dump): it must end `unreviewed 0`, no STALE. That run
  rewrites census.md and census.json: restore them with
  `git checkout -- .scratch/design-system/notice-collapse/census.md
  .scratch/design-system/notice-collapse/census.json` before you commit. Mark the
  moved pilot row "DONE in N1" in overrides.tsv, or delete it if the site dropped
  out of the census (read the STALE list; never delete it blind).
- Commit to your assigned branch and push. Open a DRAFT PR whose body says
  "Part of #1132", mirrors .github/pull_request_template.md, lists the routes for
  #1177's screenshot suite, says what you could not see, and states the five
  answers. Subscribe to its activity. Do not push to main and do not merge: Gary
  merges. Wait for the `lint-and-build` check (about 5 to 15 minutes). If it fails,
  follow the steward skill.

Handoff
1. Append a "N1 as built" section to slices.md: the API as built (the exact
   exports and prop names, as E1's "What E1 taught" did), the three pins you moved,
   the namespace and margin lessons from the pilot, and the corrected slice list if
   an answer changed it. Do NOT write the prompts for N2 to N8.
2. Final message: Gary's five answers; the PR link; the local URL; what changed on
   screen (one line per member that moved); what you did not see; and which slices
   can start next (N2, N3, N4, N5 and N6 share no file).

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Notice reads no --seal*, no club colour, and owns no margin. It decides nothing
  about WHEN it shows.
- If a command fails twice for the same reason, stop and report it. Do not widen the
  PR: eight more slices come.
```
