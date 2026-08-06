# My Tally — program handoff

Multi-phase program. **Phases 1–2 are complete.** Phases 3–5 continue in this
same worktree, on this same branch, in one eventual PR.

Read `.scratch/account-profile-experience/PRD.md` first — it is the whole
specification, and **§11 is what phase 2 actually built**, including §11.4, the
exact interface phase 3 should consume. This file only carries state.

---

## Where the program stands

| Phase | Scope | Status |
|---|---|---|
| 1 | Specification — PRD + handoff | **done** |
| 2 | Sync foundation — `src/lib/account/*`, `usePreferences`, `PreferencesCloudSync`, `SyncStatusProvider`, `api/preferences.js`, `api/account.js`, reveal index, unit + request-level tests | **done** |
| 3 | The My Tally page — `/profile` route, `src/screens/profile/**`, `src/components/profile/**`, `52-my-tally.css`, entry points, `UserButton`/`UserProfile` wiring | not started |
| 4 | Onboarding — the two-step intro, the three contextual prompts, `bbsbh:intro`, `bbsbh:prompts` | not started |
| 5 | Integration — ADR-0039, remaining CLAUDE.md updates, e2e specs, full lint/test/build/e2e, one PR | not started |

## Decisions locked (do not reopen without a reason in writing)

1. **Destination:** "My Tally" · `/profile` · subtitle *"Profile & settings."*
2. **Storage: Option B** — a local-first authenticated preferences document on
   the existing Clerk + Upstash stack, not Clerk user metadata. PRD §2.
3. **The fifth documented backend exception** (`api/preferences.js`), plus
   `api/account.js` for erase. Nine of twelve Hobby-plan functions used — noted
   in `src/api/CLAUDE.md` as the point at which a sixth needs an argument.
4. **Four preference fields, closed set:** `club` (teamId), `level` (statsapi
   **sportId integer** — a departure from the draft's string enum, PRD §11.1),
   `keepAwake`, `motion`. Per-field `{ value, updatedAt }`, per-field
   last-write-wins, absence means "no opinion" and never "erase", no tombstones.
5. **`bbsbh:scoresUnlocked` never syncs.** Enforced by `NEVER_SYNCED` in
   `syncClaims.js` and pinned by `test/sync-claims.test.js`.
6. **`/profile` renders no game data at all**, and both profile directories go on
   `check-stamp-surfaces.mjs`'s *forbidden* list — **phase 3's job, not yet done.**
7. **Claims are mechanical, not remembered.** `src/lib/account/syncClaims.js` is
   the single source; a claim naming a module that does not exist fails CI.
   Preferences are now legitimately claimable, because phase 2 shipped the wire.
8. **Clerk `<UserProfile routing="virtual" />`** — path routing is off the table:
   `src/lib/route.js` has no wildcard and Clerk would need to own `/profile/*`.
9. **NEW in phase 2 — the shared-device owner tag** (`bbsbh:prefsOwner` +
   `mergeStrategyFor`). Closes a leak the phase-1 draft did not name. PRD §11.3.

## What phase 3 should pick up

- **Start from PRD §11.4.** Every hook, selector and constant the page needs
  already exists and is tested. Phase 3 should add no new data plumbing.
- **Two things phase 2 deliberately left without a caller:**
  `DELETE /api/account` (the endpoint and its tests exist; `EraseDataDialog.jsx`
  is phase 3's, and it must also clear this device's local keys) and the
  merge-receipt trigger (PRD §5.3).
- **Delete the `useSyncStatusState` entry from `scripts/check-dead-exports.mjs`**
  the moment `SyncReceipt.jsx` lands. It is allowlisted only because the reading
  half of the sync seam shipped one phase ahead of its consumer.
- **`src/hooks` is now budgeted at 19, `src/screens` at 38, `src/lib` at 51.**
  Do not loosen any of them — that is why the page's parts go in
  `src/screens/profile/` and `src/components/profile/`.

## Traps worth carrying forward

- `usePreferences`'s same-tab echo reads **from inside its own state updater**.
  `useScoresUnlocked` and `useStamps` both shipped the eager-read version of this
  and both were real bugs (ADR-0026's 2026-08-05 amendment, ADR-0036's addendum).
- `applyRemotePreferences` / `setPreference` / `seedFromLegacy` return the
  **same object reference** when nothing changed. That is a contract, not an
  optimisation: `commit` skips the write and the render on referential equality,
  and the remote pull runs on every window focus. Two of my own first-draft
  implementations broke it and the unit tests caught both.
- Both new endpoints use `api/_lib/nodeHandler.js`, never the Web
  `Request`/`Response` shape. That mistake 500'd three endpoints in production for
  weeks (ADR-0022, 2026-07-25).
- **Verify guards by exit code, never by grepping their output.** `npm run lint`
  ends `✖ 7 problems (0 errors, 7 warnings)` and still exits 0 — the seven are
  pre-existing `react-refresh/only-export-components` warnings plus two new ones
  of the same kind on `SyncStatusProvider.jsx`, matching `TeamStatsCard.jsx`.
- The five reserved **dev** ports (5169–5173) were all occupied by other agents'
  worktrees, so verification ran against `npm run preview:2` on **4172**. A naive
  `/dev/tcp` probe under Git Bash reported them free and `curl` happily answered
  from *another worktree's* server — use `netstat -ano | grep LISTENING`.

## Overlap check against concurrent work

Re-run at `origin/main` @ `70de897`. **No open PRs** (`gh pr list --state open`
→ `[]`). Most branches ahead of `main` are squash-merge leftovers whose content
is verified present in `main`.

- **`codex/score-unlocked-card-lab` — genuinely unmerged.** Touches
  `src/App.jsx`, `src/lib/route.js`, `test/route.test.js`, `src/index.css`.
  Phase 2 has now edited `src/App.jsx`; phase 3 will edit the other three.
  Still a **soft conflict only** — both sides add an independent route, an
  `App.jsx` branch and an `@import`. Not a blocker.
- **`src/index.css`'s `@import` list** is touched by six branches. Re-check
  immediately before opening the PR (phase 3 adds `52-my-tally.css`).

No hard conflicts.

## Open threads

- **The Clerk `user.deleted` webhook is NOT built, deliberately.** It needs a
  signing secret, a public unauthenticated endpoint and dashboard configuration.
  Until it exists, deleting a Clerk account *without erasing first* leaves keys
  in Redis addressed to a `userId` that can never be re-issued — unreachable, but
  not erased. `api/account.js`'s header says so, and phase 3's copy must state
  the ordering plainly: **erase first, then delete the account.**
- **Signed-in sync cannot be exercised without a Clerk-configured deploy.** Same
  gap ADR-0026 records for `SpoiledDaysCloudSync`. Watch the first real sign-in,
  and use the curl probe from `docs/development.md`: `501 sync not configured`
  means the Redis credentials are not reaching the function, `401` means the
  store is live and the problem is elsewhere. `curl https://<host>/api/preferences`
  and `curl -X DELETE https://<host>/api/account` both answer that way.
- `reveal:index:{userId}` is unbounded by decision (PRD §11.1 item 7) — a cap
  would make the erase silently incomplete, which defeats its only purpose.
- The "Game log" name collision (`docs/game-log.md` §2) is untouched and stays
  open. My Tally's ledger row must say **Game Log** and link to `/logbook`.

---

## Handoff block

```text
Branch: claude/my-tally-account-experience
Worktree: C:\Users\gzilavy\bbsbh-my-tally-account
PR: not opened
Based on: origin/main at 70de897
State: committed on the branch, NOT pushed. Phase 2 touched 34 files — 13 new
       (api/preferences.js, api/account.js, src/lib/account/{preferences,
       preferencesStorage,syncStatus,syncClaims}.js, src/hooks/preferences/*,
       src/components/sync/{SyncStatusProvider,PreferencesCloudSync}.jsx, five
       test files), 2 deleted (the two moved hooks), the rest edits. Full list
       in PRD §11.2.
Validation: npm run lint (exit 0), npm test (exit 0), npm run build (exit 0),
       node --test on the five new files (92 pass / 0 fail), plus a Playwright
       smoke run against the production build confirming legacy-key migration
       at updatedAt: 0, the level toggle writing a real clock, persistence
       across reload, and first-visit detection intact.
Local example: http://localhost:4172/?nointro — `npm run preview:2`, serving the
       phase-2 build. Not a dev server: all five reserved dev ports (5169-5173)
       are held by other agents' worktrees. There is no /profile route yet — it
       lands in phase 3 — so the slate IS the surface phase 2 changed (its level
       toggle now reads and writes the preference document).
Cleanup: do not remove — program in progress
```
