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
| 4 | Onboarding — the two-step intro, the three contextual prompts, `bbsbh:intro`, `bbsbh:prompts` | not started |
| 5 | Integration — ADR-0039, remaining CLAUDE.md updates, full lint/test/build/e2e, one PR | not started |

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

## What phase 4 needs, precisely

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

### `FavoriteTeamModal`, as phase 4 finds it

- Still takes `{ favoriteTeamId, intro = false, onSave, onClose }`.
- Its **only caller is now `GameSelect`'s welcome flow**, always with `intro`.
  The footer's Settings button navigates to `/profile` instead, so the
  `intro={false}` branch is live code with no caller — phase 4 either grows it
  into step 2 or deletes it, deliberately.
- Its header comment already says this. Update it when the two steps land.

### Where prompt 4 (`settings-pitch`) already lives

PRD §6.2's row 4 — "the standing benefit panel on the `/profile` account
section, signed out" — **is built**. It is the `!isSignedIn` branch of
`src/components/profile/ProfileAccount.jsx`: the `DeviceHandoff` illustration,
a lede, the `SYNCED_ITEMS` claim list, `Create account or sign in`, and the
fineprint. Phase 4 should reuse its copy rather than writing a second version,
and should NOT add a one-shot prompt id for it (it is deliberately the one
panel allowed to persist).

### Two things phase 3 deliberately left for later

- **The slate's merge-receipt strip** (PRD §5.3's "if the sign-in happened
  elsewhere, a one-line strip on the slate linking to `/profile`"). The card
  itself is built and triggered on `/profile`
  (`src/components/profile/MergeReceipt.jsx`, one-shot per `(device, account)`
  via `bbsbh:mergeReceipt:{userId}`). The slate strip is a `GameSelect.jsx`
  edit, and phase 4 is already opening that file for prompt 3 — do it there or
  hand it to phase 5, but do not build a second receipt component.
- **`docs/adr/0039-my-tally-preferences-document.md` and the CLAUDE.md
  updates** are phase 5's, by PRD §8, so nothing cites an ADR that does not
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

---

## Overlap check against concurrent work

Re-run at `origin/main` @ `bda26c6`. **No open PRs** at the last check.

- **`codex/score-unlocked-card-lab` — genuinely unmerged.** Touches
  `src/App.jsx`, `src/lib/route.js`, `test/route.test.js`, `src/index.css`.
  Phase 3 has now edited **all four**. Still a **soft conflict only** — both
  sides add an independent route branch, an `App.jsx` branch, a `test/route`
  block and an `@import`. Whichever lands second resolves four small hunks.
- **`src/index.css`'s `@import` list** is touched by several branches and phase 3
  appended TWO lines to it (`52-my-tally.css`, `53-my-tally-account.css`).
  Re-check immediately before opening the PR.
- `scripts/check-dir-size.mjs`'s `src/styles` budget is now **53**. That guard
  cannot absorb a merge race (its own header says so) — **rebase onto `main` and
  re-measure before merging.**

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
  `normalizeStatus` reason, and `ClubPicker` as the one club strip.
- `docs/development.md` — state explicitly that this program adds **no new env
  vars**.
- `e2e/intro-two-step.spec.js` — phase 4's, if phase 4 does not write it.
- Re-check `src/index.css`'s `@import` ordering and the `check-dir-size` budgets
  against `main` immediately before opening the PR.

---

## Handoff block

```text
Branch: claude/my-tally-account-experience
Worktree: C:\Users\gzilavy\bbsbh-my-tally-account
PR: not opened
Based on: origin/main at bda26c6 (rebased 2026-08-06)
State: committed on the branch, NOT pushed. Three commits: phase 2, its rebase
       note, and phase 3. Phase 3 touched 41 files — 17 new (5 screens, 8
       components, localData.js, 2 CSS partials, 3 test/e2e files), the rest
       edits. Full list in PRD §12.2.
Validation: npm run lint (exit 0), npm test (exit 0), npm run build (exit 0),
       node --test test/local-data.test.js (11 pass / 0 fail), and the FULL
       Playwright suite against the production build on :4170 —
       122 passed, 1 skipped, 0 failed, across mobile/ipad/desktop.
Local example: http://localhost:4170/profile?nointro — `npm run preview:4`,
       serving the phase-3 build. Not a dev server: all five reserved dev ports
       (5169-5173) are held by other agents' worktrees. Clerk is NOT configured
       on this machine, so that URL shows the "This device." state with the
       account section correctly absent — which is the state the whole design
       rests on. Also worth opening: http://localhost:4170/?nointro (the slate
       footer's Settings button is now the way in).
Cleanup: do not remove — program in progress
```
