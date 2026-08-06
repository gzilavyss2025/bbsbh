# My Tally — program handoff

Multi-phase program. **Phases 1–3 are complete.** Phases 4–5 continue in this
same worktree, on this same branch, in one eventual PR.

Read `.scratch/account-profile-experience/PRD.md` first — it is the whole
specification. **§11 is what phase 2 built** (including §11.4, the data
interface) and **§12 is what phase 3 built** (including §12.1, the eight
departures from the spec, each with its reason). This file only carries state.

---

## Where the program stands

| Phase | Scope | Status |
|---|---|---|
| 1 | Specification — PRD + handoff | **done** |
| 2 | Sync foundation — `src/lib/account/*`, `usePreferences`, `PreferencesCloudSync`, `SyncStatusProvider`, `api/preferences.js`, `api/account.js`, reveal index, unit + request-level tests | **done** |
| 3 | The My Tally page — `/profile` route, `src/screens/profile/**`, `src/components/profile/**`, `52-my-tally.css` + `53-my-tally-account.css`, entry points, `UserButton`/`UserProfile` wiring, `EraseDataDialog`, the merge receipt, e2e | **done** |
| 4 | Onboarding — the two-step intro, the contextual prompts, `bbsbh:intro`, `bbsbh:prompts` | **done** |
| 5 | Integration — ADR-0039, CLAUDE.md updates, four adversarial audits + their fixes, full lint/test/build/e2e, one PR | **done** |

## Decisions locked (do not reopen without a reason in writing)

1. **Destination:** "My Tally" · `/profile` · subtitle *"Profile & settings."*
2. **Storage: Option B** — a local-first authenticated preferences document on
   the existing Clerk + Upstash stack, not Clerk user metadata. PRD §2.
3. **The fifth documented backend exception** (`api/preferences.js`), plus
   `api/account.js` for erase. Nine of twelve Hobby-plan functions used.
4. **Four preference fields, closed set:** `club` (teamId), `level` (statsapi
   **sportId integer**), `keepAwake`, `motion`. Per-field `{ value, updatedAt }`,
   per-field last-write-wins, absence means "no opinion" and never "erase".
5. **`bbsbh:scoresUnlocked` never syncs.** `NEVER_SYNCED` in `syncClaims.js`,
   pinned by `test/sync-claims.test.js`. `/profile` REPORTS its status and
   offers the same-day withdrawal, and offers nothing else (P3).
6. **`/profile` renders no game data at all** — and both profile directories are
   now on `check-stamp-surfaces.mjs`'s forbidden list, with a narrowed identifier
   set so a stamp COUNT stays legal and stamp ART does not. PRD §12.1 item 4.
7. **Claims are mechanical, not remembered.** `src/lib/account/syncClaims.js` is
   the single source; the sync receipt and the signed-out benefit panel both
   render FROM it. A claim naming a module that does not exist fails CI.
8. **Clerk `<UserProfile routing="virtual" />`** — path routing is off the table:
   `src/lib/route.js` has no wildcard and Clerk would need to own `/profile/*`.
9. **The shared-device owner tag** (`bbsbh:prefsOwner` + `mergeStrategyFor`).
   PRD §11.3.
10. **NEW in phase 3 — `ClubPicker` is the one club strip**, in
    `src/components/account/`, taking `teams` as a prop. Both the intro modal
    and My Tally render it. See below.

---

## What phase 4 built

Phase 4 (the two-step intro and the contextual prompts) is **done** — full
detail, exact copy, trigger conditions, and the eight deliberate departures
are in **PRD.md §13**, not repeated here. Read that section first; this file
only carries state and pointers.

Headline: `FavoriteTeamModal.jsx` is now a two-step dialog (Clerk-configured
deploys get both steps; unconfigured deploys still see step 1 only, exactly
as before). Three one-shot contextual prompts (`first-stamp`, `third-game`,
`scores-unlocked-local` — the third is new, not in the original PRD §6.2
table, added per this phase's task brief) plus the deferred merge-receipt
slate strip are all wired and tested. `bbsbh:intro` and `bbsbh:prompts` are
new pure modules (`src/lib/account/intro.js`, `src/lib/account/prompts.js`),
each with a real unit suite (`test/intro.test.js`, `test/prompts.test.js`).

**Everything gated on `isClerkEnabled` remains unverifiable on this
machine** — same gap as phases 2–3, see PRD §13.5. That includes step 2 of the
intro, the `third-game` and `scores-unlocked-local` prompts, and the
merge-receipt strip. Each was checked by code review, by
`e2e/intro-two-step.spec.js`'s seven cases against the unconfigured face, and
(for `first-stamp` specifically, since it does not need Clerk to render, only
to be REACHED — see PRD §13.2 item 3) against a throwaway local `vite` dev
server. **Watch these on the first Clerk-configured run**, in addition to the
five items phases 2–3 already flagged below:
1. Step 1's primary action becomes `Continue with the {club}` and a
   `Choose later` secondary appears; closing step 1 by any route still
   commits the current pick.
2. Step 2 renders: signed out, the pitch (club seal, device handoff, the
   illustrative progress marker, the three benefit rows, `Create my Tally` /
   `Use this device only`); signed in already (a returning visitor on a
   cleared browser), the confirmation instead — no account pitch, no email
   leading the copy.
3. `ContinueScoring`'s slot, signed out with 3+ games in progress, shows the
   `third-game` pitch; dismissing it is one-shot forever.
4. Enabling Scores Unlocked shows the `scores-unlocked-local` note once,
   right under the day-state chips; a page reload with the pass still active
   must NOT re-show it (only the actual enable action fires it).
5. Signing in elsewhere and then landing on the slate shows the
   `MergeReceiptStrip` one-liner, which links to `/profile` and dismisses the
   full `MergeReceipt` card too (they share one flag).

### The reusable favourite-team picker — import this, do not rebuild it

```jsx
import { ClubPicker } from '../../components/account/ClubPicker.jsx'
//    (path from src/components/account/FavoriteTeamModal.jsx: './ClubPicker.jsx')

<ClubPicker
  teams={teams}                 // [{ id, name }] — REQUIRED, see below
  value={selId}                 // the currently picked teamId
  onPick={(id) => …}            // fires on every tap; there is no Save step
  ariaLabel="Favorite team"     // optional, defaults to 'Favorite team'
  className=""                  // optional, appended to .vsteam__tray
/>
```

- **It fetches nothing.** The host supplies `teams`. `FavoriteTeamModal` already
  does this today with its existing `useAsync(() => fetchTeams(SPORT_IDS.MLB))`
  — phase 4 should leave that loader alone, because the intro is the one surface
  that genuinely wants the live-with-static-fallback list.
  (`/profile` uses `fetchStaticTeams()` from `src/api/teams-static.js` instead,
  so that page issues no statsapi request at all — see §12.1 item 2.)
- It owns the scroll-centring behaviour and the `.vsteam__*` styling. Nothing
  else about it needs to be understood to reuse it.
- `FavoriteTeamModal` is already refactored onto it, so **step 1 of the two-step
  intro needs no picker work at all** — only the step chrome around it.

### `FavoriteTeamModal`, as phase 4 left it

- **The settings-mode (`intro=false`) branch is gone.** Phase 4 took the
  "grow it into step 2 or delete it" fork by deleting it — its only caller had
  already moved to `/profile` in phase 3, so the branch was dead code. The
  component now takes `{ favoriteTeamId, onSave, onClose }` — no `intro` prop
  — and `onClose` is called with the step number (`1` or `2`) the visitor
  exited from, purely so `bbsbh:intro` can record it (gates nothing).
- Its only caller is still `GameSelect`'s welcome flow.

### Where prompt 4 (`settings-pitch`) already lives

PRD §6.2's row 4 — "the standing benefit panel on the `/profile` account
section, signed out" — **is built** (phase 3) and **untouched by phase 4**. It
is the `!isSignedIn` branch of `src/components/profile/ProfileAccount.jsx`:
the `DeviceHandoff` illustration, a lede, the `SYNCED_ITEMS` claim list,
`Create account or sign in`, and the fineprint. Phase 4's step 2 (a different
surface, the welcome modal rather than `/profile`) reuses the same
`SYNCED_ITEMS` ledger for its own three benefit rows, relabelled for that
warmer moment (PRD §13.2 item 8) — deliberately not the same JSX, since the
two panels serve different contexts, but the same underlying claims.

### What phase 3 deliberately left for later — now closed

- **The slate's merge-receipt strip** (PRD §5.3) is built —
  `src/components/account/MergeReceiptStrip.jsx`, sharing the full card's
  `bbsbh:mergeReceipt:{userId}` flag via the new
  `src/lib/account/mergeReceiptFlag.js` (both `MergeReceipt.jsx` and the strip
  import from there now; neither holds its own copy of the read/write logic).
- **`docs/adr/0039-my-tally-preferences-document.md` and the CLAUDE.md
  updates** are still phase 5's, by PRD §8, so nothing cites an ADR that does not
  exist yet. The checklist is under "Phase 5's docket" below.

---

## Traps worth carrying forward

- `usePreferences`'s same-tab echo reads **from inside its own state updater**.
  `useScoresUnlocked` and `useStamps` both shipped the eager-read version of this
  and both were real bugs (ADR-0026's 2026-08-05 amendment, ADR-0036's addendum).
- `applyRemotePreferences` / `setPreference` / `seedFromLegacy` return the
  **same object reference** when nothing changed. That is a contract, not an
  optimisation.
- Both new endpoints use `api/_lib/nodeHandler.js`, never the Web
  `Request`/`Response` shape (ADR-0022, 2026-07-25).
- **Verify guards by exit code, never by grepping their output.** `npm run lint`
  ends `✖ 7 problems (0 errors, 7 warnings)` and still exits 0 — the seven are
  pre-existing `react-refresh/only-export-components` warnings plus a
  `react-hooks/exhaustive-deps` one on `LogbookPage.jsx`. Phase 3 added none.
- **`Date.now()` in a render body is an eslint ERROR here**
  (`react-hooks/purity`), not a warning. `SyncReceipt.jsx` reads the clock in a
  `useState` lazy initializer for exactly this reason, and its header says why
  freezing the clock at mount is also the better answer.
- **Line endings.** This repo is LF and `core.autocrlf` is `false`. A Python
  rewrite opened with the default `newline=None` converts the whole file to CRLF
  and turns a 30-line edit into a 300-line diff. Use `newline=''` both ways.
- **A new `src/styles/*.css` partial is capped at 600 lines**
  (`check-file-size.mjs`) and the directory has a hard budget
  (`check-dir-size.mjs`, now 53). Both bite late — write the partial, then run
  lint before assuming it is done.
- **The five reserved dev ports (5169–5173) were all occupied** by other agents'
  worktrees for this whole phase, so verification ran against `npm run preview:4`
  on **4170**. `netstat -ano | grep LISTENING` is the reliable probe; a
  `/dev/tcp` check under Git Bash reports them free and `curl` happily answers
  from *another worktree's* server.
- **Playwright against a preview server:** `E2E_PORT=4170 npx playwright test`
  works because `reuseExistingServer: true` finds the already-listening preview
  and never starts vite. Without a free dev port that is the only honest way to
  run the suite against YOUR branch rather than another worktree's.
- **A DEV-only escape hatch (`?signedout`, `?nointro`'s sibling on `/logbook`)
  is NOT reachable against a production preview build.** `import.meta.env.DEV`
  is baked in at build time and is always false for `vite build`/`vite
  preview`. Running the full e2e suite against a preview server (the only
  option when all five dev ports are taken) therefore fails
  `logbook-landing.spec.js` and `uniform-names.spec.js` — both pre-existing,
  neither a regression — every time. Verify anything gated on `DEV` against a
  real `vite` dev server instead, even a disposable one on an unreserved port
  (e.g. `npx vite --port 5199 --strictPort`, killed after).
- **A one-shot store's "return the same reference" contract breaks the moment
  you scrub-then-compare.** `markPromptSeen`'s first draft called `scrub(map)`
  unconditionally before checking `hasSeenPrompt`, so an ALREADY-dismissed
  prompt returned a freshly-allocated (if structurally identical) object
  instead of the original — same defect class `preserve()` in `preferences.js`
  exists to prevent, caught here by the same test pattern
  (`assert.equal(next, map)`, not `assert.deepEqual`). Fixed by checking
  `hasSeenPrompt` against the RAW map first, only calling `scrub` on the path
  that actually changes something.
- **`LogbookAccountGate.jsx` blocks a signed-out+Clerk-enabled visitor from
  ever reaching `LogbookCollection`'s tray** — it renders `LogbookLanding`
  (the feature pitch) instead, unconditionally, regardless of what the local
  collection holds. A prompt whose PRD location was "inside the tray" for
  exactly that audience is unreachable by construction; see PRD §13.2 item 3
  for the `first-stamp` resolution. Worth checking before placing anything
  else inside `LogbookCollection` for a signed-out audience.

---

## Overlap check against concurrent work

Re-run at `origin/main` @ `81eb7d0` (one commit ahead of phase 2–3's
`bda26c6`, an unrelated skills-folder reorg). **No open PRs** at the last
check.

- **`codex/score-unlocked-card-lab` — still genuinely unmerged, and now
  visibly staler.** It touches `src/components/FavoriteTeamModal.jsx` and
  `src/components/ContinueScoring.jsx` at their PRE-#551 paths — i.e. it
  predates the "bucket components by feature domain" reorg that moved them to
  `src/components/account/` and `src/components/game/`, which is itself an
  ancestor of this branch's base. Whoever picks this branch back up is looking
  at a directory-structure conflict on top of the four-file soft conflict
  phase 3 already noted (`src/App.jsx`, `src/lib/route.js`, `test/route.test.js`,
  `src/index.css`) — still not a hard conflict with THIS branch (nothing here
  depends on `codex/`'s content existing), but worth flagging as a bigger job
  than a four-hunk resolve by the time either side actually merges.
- **`src/index.css`'s `@import` list** is touched by several branches. Phase 4
  appended a third new line since phase 3 (`54-my-tally-intro.css`, after
  `52-my-tally.css`/`53-my-tally-account.css`). Re-check immediately before
  opening the PR.
- `scripts/check-dir-size.mjs`'s `src/styles` budget is now **54**;
  `scripts/check-file-size.mjs`'s `src/screens/GameSelect.jsx` budget is now
  **1000**. Neither guard can absorb a merge race (their own headers say so)
  — **rebase onto `main` and re-measure both before merging.**

No hard conflicts.

---

## Open threads

- **The Clerk `user.deleted` webhook is NOT built, deliberately.** Until it
  exists, deleting a Clerk account *without erasing first* leaves keys in Redis
  addressed to a `userId` that can never be re-issued — unreachable, but not
  erased. `api/account.js`'s header says so, and **My Tally's copy now states the
  ordering plainly** on the "Erase my Tally data everywhere" row and again in the
  confirm sheet: *erase first, then delete the account.*
- **Signed-in sync still cannot be exercised locally** — no
  `VITE_CLERK_PUBLISHABLE_KEY` on this machine, so every browser check ran in the
  Clerk-unconfigured state (where the account section is correctly absent
  entirely). Same gap ADR-0026 records. On the first real sign-in, watch:
  1. the scope line flips to **"Every device you sign in on."**
  2. the sync receipt's five rows go from "On this device." to
     "Carried across your devices. Last checked …"
  3. the merge receipt appears once, with counts only, and never returns
  4. `Account & security` opens Clerk's `UserProfile` inside the page (virtual
     routing — the URL must NOT change)
  5. the `UserButton` menu shows My Tally / Game Log / Account & security / Sign out

  Curl probes (docs/development.md): `501 sync not configured` means the Redis
  credentials are not reaching the function; `401` means the store is live and
  the problem is elsewhere. `curl https://<host>/api/preferences` and
  `curl -X DELETE https://<host>/api/account` both answer that way.
- `reveal:index:{userId}` is unbounded by decision (PRD §11.1 item 7).
- The "Game log" name collision (`docs/game-log.md` §2) stays open. My Tally's
  ledger row says **Game Log** and links to `/logbook`, as required.
- **`react-refresh/only-export-components`** still warns twice on
  `SyncStatusProvider.jsx`. Pre-existing shape (matches `TeamStatsCard.jsx`), not
  worth a file split.
- **`scores-unlocked-local` cannot be exercised locally at all** (§the new
  handoff intro above) — it is gated on `isClerkEnabled`, which is false on
  this machine. Code-reviewed and structurally verified (the `ConsentModal`
  confirm handler sets the trigger state; the gate correctly renders nothing
  on this deployment), but never actually SEEN. Watch it specifically on the
  first Clerk-configured run — see the new "What phase 4 built" section above
  for the full first-sign-in watch-list.
- **`bbsbh:intro`'s `step` field is written but never read back by anything.**
  Deliberate (PRD §13.2 item 7) — it exists for a future analytics or support
  need, not a behavioural gate. If phase 5 or a later program finds no use for
  it within a release or two, simplifying `bbsbh:intro` back to a bare boolean
  is a reasonable, low-risk cleanup — not a correctness fix.

---

## Phase 5's docket (written down so it is not rediscovered)

- `docs/adr/0039-my-tally-preferences-document.md` — **new**. Must carry: PRD §2's
  Option A vs B argument, §2.1's function budget, the `routing="virtual"`
  constraint, invariants P1–P10 verbatim, the deferred `user.deleted` webhook,
  and §12.1's eight departures.
- Root `CLAUDE.md` — the architecture map's exception list (it already says five;
  confirm the wording still matches after the ADR lands). **199/200 lines
  today** — there is room for exactly one more line, so anything longer has to
  displace something.
- `src/CLAUDE.md` — a short section for the profile screen and the sync-status
  context: `/profile` renders no game data, the two forbidden directories, the
  `normalizeStatus` reason, and `ClubPicker` as the one club strip. Consider
  whether it also needs a line on `src/lib/account/prompts.js`/`intro.js` as
  the onboarding half of the same subsystem — phase 4 kept both pure-module
  headers self-contained rather than presuming a CLAUDE.md slot, so this is a
  judgment call, not a known gap.
- `docs/development.md` — state explicitly that this program adds **no new env
  vars**.
- ~~`e2e/intro-two-step.spec.js` — phase 4's, if phase 4 does not write it.~~
  **Done** — 7 cases × 3 viewports, all passing against the unconfigured face
  of the flow. See PRD §13.6 for the signed-in gap this still carries.
- Re-check `src/index.css`'s `@import` ordering and the `check-dir-size` /
  `check-file-size` budgets against `main` immediately before opening the PR.

---

## Phase 5's audits — what was found, fixed, and deliberately NOT fixed

Four read-only audits ran in parallel (spoiler/auth/privacy · UX/copy/a11y ·
tests/errors/races · perf/bundling). **Audit 4's headline came back clean:** an
unconfigured-Clerk build never loads Clerk's SDK — verified empirically against
`dist/`, not just inferred.

**Fixed** (each with a test that fails without the fix, where the layer allows
one): the slate merge strip was gated on the RAW rollup and therefore dead by
construction (`normalizeSilentChannels` now lives in `syncStatus.js` and both
readers share it); the merge receipt's `games` line was ungated, so a store-less
deploy got "Your book is on this account now" and burned the one-shot flag;
`components/account/` was on NEITHER stamp-guard list; `reveal:index` was
forward-only, so an existing user's reveal marks survived "erase everywhere" and
were then re-synced back onto the wiped device; a partial erase answered `ok`
*and* deleted the index that was the only way to retry; `StampsCloudSync` never
checked `res.ok` and reported `synced` unconditionally; a failed preference push
left the baseline claiming success, dropping that change for the session; the
48-hour clock-skew window let one fast device freeze a field for two days; the
Motion control stored a string and did nothing; erasing the device re-opened the
welcome modal, which committed the DEFAULT club over the user's real one on every
device; `ClubPicker` was a fake tablist with 30 tab stops and title-only names.

**Found and deliberately NOT fixed** — recorded rather than silently overridden:

1. **The owner-tag guard covers `prefs` only.** `StampsCloudSync`,
   `SpoiledDaysCloudSync` and `RevealCloudSync` publish whatever is in local
   storage after a sign-in, so on a SHARED device user A's spoiled days and
   reveal marks can reach user B's account — the same leak `bbsbh:prefsOwner`
   was built to close, one channel over. **This is pre-existing** (all three
   predate this program) and the spoiled-days half is genuinely spoiler-relevant,
   so it deserves its own PR. Not fixed here because it means touching three
   components whose signed-in path **cannot be exercised on this machine**, and
   a wrong fix silently drops a user's own data. Highest-priority follow-up.
2. **"Erase everywhere" is not durable while another device is signed in** —
   that device's next publish re-uploads what it still holds locally. The copy
   already states the erase-then-delete ordering; it does not mention this.
3. **`usePreferences`'s unconditional echo repaints every consumer on every
   window focus.** Real, and it is ALSO load-bearing: the guest-to-account
   backfill currently depends on that redundant re-render. The two must move
   together (the baseline wants to become state; a bare counter trips
   `react-hooks/refs` and the setState-in-effect rule). Rather than split them
   blind, the coupling is now written down at length in `usePreferences.js`.
4. `GameSelect` mounts two independent `usePreferences` stores; `ClubSeal` is
   hoisted into the main chunk; `bbsbh:intro`'s `step` is still written and never
   read. All nits, all recorded here rather than churned.

**One incidental change worth knowing about:** `api/reveal.js` was the only file
in `api/` committed with CRLF endings. Editing it produced `git diff --check`
trailing-whitespace failures, so the file is normalized to LF in this PR — the
repo convention (`core.autocrlf false`, LF). That is why its diff looks like a
whole-file rewrite; it is 15 real added lines plus line endings.

## Handoff block

```text
Branch: claude/my-tally-account-experience
Worktree: C:\Users\gzilavy\bbsbh-my-tally-account
PR: opened by phase 5 (see the PR body for the full change list)
Based on: origin/main at 81eb7d0, rebased cleanly 2026-08-06 with no conflicts
       — src/index.css's @import list absorbed main's 51-similar-players.css
       without a fight, and check-dir-size (src/styles 54) / check-file-size
       still hold as measured.
State: committed and pushed. Five commits: phase 2, its rebase note, phase 3,
       phase 4, and phase 5 (docs + the audit fixes).
Validation: npm run lint (exit 0), npm test (exit 0), npm run build (exit 0),
       git diff --check (exit 0), and the FULL Playwright suite against a real
       DEV SERVER on :5172 — not a preview build, so phase 4's DEV-only false
       positives are gone. 168 passed / 1 skipped / 0 failed at the start of
       this phase; after the fixes, the only repeatable failures are the five
       pre-existing inning-modal-stacking cases, CONFIRMED pre-existing by
       stashing this phase's work and re-running them against the clean tree
       (identical five). innings-page-turn / asof-opt-in / extra-innings-gating
       flake under parallel load and pass on a targeted re-run.
Clerk: still NOT configured on this machine, so every signed-in path remains
       code-reviewed only — unchanged from phases 2-4. Production curl confirms
       the store is live there (`/api/stamps` answers 401, not 501), and the two
       new endpoints correctly 404 in production because this branch is not
       deployed. Do not deploy it to check.
Cleanup: do NOT remove — the PR is open. Safe to remove once it merges.
```
