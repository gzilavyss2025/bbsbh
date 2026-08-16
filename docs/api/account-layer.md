# The account layer (`src/lib/account/`, not `src/api/`)

Not a statsapi topic — the per-user state that crosses a signed-in user's own
devices. It lives in `src/lib/account/` rather than `src/api/` because it fetches
nothing from MLB, but it belongs in that directory's mental model: it is the other
half of the four `api/` functions that authenticate a real end user.

This is tier-3 reference (root `CLAUDE.md`'s doc tiers) — it loads when you are
pointed at it, not on every session. See **ADR-0039** (the preference document, its
invariants P1–P10) and **ADR-0026** (spoiled-days consent) for the *why*.

Siblings: `docs/api/live-game.md`, `docs/api/static-data.md`.

## The modules

- **`preferences.js`** — the My Tally preference document (`bbsbh:prefs`), the
  **fifth** backend exception (**ADR-0039**, which also carries invariants
  P1–P10, the Option A/B argument and the deferred `user.deleted` webhook). A
  **closed** four-field registry: `club`
  (teamId), `level` (a statsapi sportId, the same vocabulary `teams.js`
  speaks — not a second string name for it), `keepAwake`, `motion`. Pure,
  React-free, and imported **verbatim** by `api/preferences.js`, the same
  contract `src/lib/stamps.js` has with `api/stamps.js`, so the client and the
  server cannot disagree about what a valid preference is.
  - **Never score-bearing, and never derived from game state.** That is the
    invariant that keeps it on the same footing as `revealedThrough`. The module
    has no idea what a gamePk is; the field registry is the enforcement.
  - **Last-write-wins per FIELD**, on a per-field `updatedAt`, not per document.
    Two devices changing two different preferences must both win — a whole-object
    write silently drops one of the user's own taps, which is exactly why this
    is not stored in Clerk's `unsafeMetadata`.
  - **Absence means "no opinion", never "erase"** (same rule as
    `spoiled-days.js`), and there is deliberately no tombstone: a preference
    cannot be removed, only changed. `updatedAt: 0` is legal and meaningful — it
    is what a value migrated from a legacy key carries, so it loses to any real
    choice from any device.
  - `preferencesToPublish(local, known)` is a **comparison against the remote**,
    never a change log. Read its header before "simplifying" it: a change log
    cannot describe state that predates sign-in, which is the backfill gap
    ADR-0026's 2026-08-06 amendment and PR #545 both had to fix after shipping.
  - `mergeStrategyFor(owner, userId)` is the **shared-device guard**. `backfill`
    when the local document is this user's or nobody's; `adopt` when it belongs
    to a different account, so user A's club can never be published into user
    B's. The owner tag (`bbsbh:prefsOwner`) is what makes that answerable.
- **`preferencesStorage.js`** — every localStorage access, each individually
  guarded, so **private mode is a tested path** (`test/preferences-storage.test.js`)
  rather than an assumed one. Reading `window.localStorage` at all can throw, not
  just calling it. Failure always degrades to in-session memory, never a crash
  and never a wrong answer.
- **`syncStatus.js`** — the pure reducer behind the sync receipt. Four channels
  (`reveal`, `spoiledDays`, `stamps`, `prefs`), and the distinction worth
  protecting is `unavailable` (a 501 — a deploy with no store, a **supported**
  state) versus `error` (a real fault). Collapsing them would either cry wolf on
  a correct deployment or hide a broken one — the four-outcomes-into-one
  flattening `api/_lib/auth.js` exists to undo. The React seam is
  `components/sync/SyncStatusProvider.jsx`, an external store so a sync report
  re-renders only what reads it.
- **`syncClaims.js`** — the closed ledger of what account copy may CLAIM syncs.
  `test/sync-claims.test.js` fails when a claim names a module that does not
  exist, so a promise cannot outrun the implementation. `scoresUnlocked` is on
  the `NEVER_SYNCED` list with its reason: mirroring the pass expiry would
  unseal a device the user never consented on (ADR-0026).
- **`localData.js`** — `tallyKeysIn` / `countGamesInProgress` /
  `clearTallyDataIn` / `buildGameLogExport`. The **local** half of erase and
  export: `api/account.js` only ever clears the server, so the confirm sheet
  has to clear this device itself. It takes a storage object as an argument
  rather than reaching for `window`, which is the only reason it is testable.
- **`intro.js`, `prompts.js`, `mergeReceiptFlag.js`** — the onboarding
  one-shots (`bbsbh:intro`, `bbsbh:prompts`, `bbsbh:mergeReceipt:{userId}`).
  **None of them sync, deliberately**: a dismissal is a fact about this browser,
  not about the account, and syncing one would let a second device suppress a
  note the user there has never seen. Each returns the **same object reference**
  when it changes nothing — a contract the tests assert with `assert.equal`, not
  `assert.deepEqual`, because a freshly-allocated identical map still re-renders
  React. `markPromptSeen`'s first draft scrubbed before it compared and broke
  exactly that; check the raw map first.

`api/account.js` is the erase counterpart — it deletes every per-user key from
the verified `sub`, resolving the reveal family through `reveal:index:{userId}`
(a set of gamePks `api/reveal.js` maintains alongside each ratchet, so the erase
is complete rather than best-effort). That family is **two keys per game** since
**ADR-0049**: `reveal:{u}:{gamePk}`, the half-index mark, and
`revealbox:{u}:{gamePk}`, the one bit saying the reader opened that game's box
score. Both come off the same gamePk set, so the bit cannot be the one thing an
erase forgets — leaving it behind would re-open a box score on the next visit to
a device the user had just wiped. It never deletes `game:final:{gamePk}`,
which is a shared, immutable cache of public facts belonging to no user.

**`api/` now holds nine functions of the Hobby plan's twelve.** That is not a
crisis and it is the last time one should be added casually — the next feature
that wants an endpoint should first ask whether it can ride an existing
handler's query string.
