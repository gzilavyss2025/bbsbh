# My Tally — a local-first preferences document, and the fifth backend exception

The app has always had settings, and it has never had a place to put them. A
favourite club, the level the slate opens on, and Keep Awake each grew their own
flat `localStorage` key on the day they shipped, and each stopped at the edge of
the device that set it. Meanwhile three separate cloud channels — reveal marks
(ADR-0022), spoiled-day consent (ADR-0026), Game Log stamps (ADR-0035) — already
crossed a signed-in user's own devices, so the user's *scoring* followed them
and their *settings* did not.

**My Tally** (`/profile`) is the page that reports on the user rather than on
baseball, and this ADR is the storage decision underneath it: a **local-first
authenticated preferences document**, `bbsbh:prefs` on the device and
`prefs:{userId}` in Redis, published one field at a time through a new
`api/preferences.js`. It is the **fifth** documented backend exception, and
`api/account.js` — the erase path — lands with it.

One sentence governs the whole surface:

> **`/profile` renders no game data at all.**

Every other screen argues about seals, reveal marks and containment guards. This
one does not have to, because it never loads a feed, never resolves a game fact,
never imports a stamp component, and never prints a number that came out of a
ballpark. Counts of the user's own things are the only numbers on it.

## The decision

### Option B — the preferences document — over Option A, Clerk user metadata

Clerk hands every deploy a free per-user key/value store (`unsafeMetadata` /
`publicMetadata`), and its one genuine advantage is decisive-sounding: **no new
backend exception**. It was rejected anyway, on four counts, in ascending order
of how much they hurt:

- **Whole-object writes.** `unsafeMetadata` is patched as one object. Two devices
  changing two *different* preferences in the same window: the later write
  clobbers the earlier one wholesale. There is no per-field clock to reconcile
  on, and adding one means hand-rolling exactly the merge Option B already has.
  This is silent data loss on the precise multi-device scenario the program
  exists to serve.
- **Offline.** `user.update()` is a network write with no local queue and no
  local read path. A club change made on the subway either fails or silently
  no-ops.
- **Validation.** `unsafeMetadata` is client-writable by design and by name. Any
  server-side bound on a value needs a backend anyway, which cancels the
  advantage.
- **The deciding argument: Option A cannot serve the signed-out state at all.**
  "Settings remain usable while signed out" is a hard product requirement — an
  account adds continuity and nothing else — so a local store has to exist
  either way. Option A therefore does not remove a storage model; it *adds* one,
  plus a bespoke bridge between two systems with different shapes, different
  failure modes and different clocks, written once and debugged forever.

Option B has one model, already written three times in this codebase, whose two
historical merge bugs are documented and regression-tested.

Option A keeps one advantage this ADR concedes without argument: **deletion.**
Deleting a Clerk user deletes its metadata, with no orphans. Option B has to
build that, and §"Erase" below is what it built.

### The schema is a CLOSED four-field registry

`src/lib/account/preferences.js` — pure, React-free, dependency-free, and
imported **verbatim** by `api/preferences.js`, exactly as `src/lib/stamps.js` is
imported by `api/stamps.js`. The client and the server must not be able to
disagree about what a valid preference is.

| Field | Type | Valid values | Legacy key it replaces |
|---|---|---|---|
| `club` | integer | a statsapi `teamId`, `1 … 99999` | `bbsbh:favoriteTeam` |
| `level` | integer | a statsapi sportId: `1` \| `11` \| `12` \| `13` \| `14` | `bbsbh:level` |
| `keepAwake` | boolean | `true` \| `false` | `bbsbh:keepAwake` |
| `motion` | string | `system` \| `reduced` \| `full` | — (new) |

A field not in this table does not exist. An unknown key on the wire or in
storage is dropped — never stored, never echoed. The registry is the
enforcement mechanism for invariant P1 below, not a convenience: the module has
no idea what a `gamePk` is, so there is nowhere for game state to enter.

Two departures from the first draft of the schema, both deliberate:

- **`level` ships as the sportId integer, not a `'mlb' | 'aaa' | …` string
  enum.** `bbsbh:level` has always stored one, and `LEVELS` / `SPORT_IDS` in
  `src/lib/teams.js` are the vocabulary every fetch already speaks. A parallel
  string set would be a second name for a thing that already has one, and the
  two would drift.
- **`club` is validated as a bounded integer, not as membership of the real club
  list.** Checking membership would drag the 1,100-line `teams.js` into the
  serverless bundle — the same reason `src/lib/stamps.js` restates the passport
  bounds rather than importing `passportLayout.js`. The cost of a
  well-formed-but-wrong id is a fallback logo, not a security hole.

### Per-field `updatedAt`, and absence that means "no opinion"

The record is `{ field: { value, updatedAt } }`, identically shaped in
`localStorage`, on the wire, and in the Redis hash.

- **Last-write-wins per FIELD, not per document.** Two devices changing two
  different preferences must both win; a document-level clock makes that a coin
  flip, which is precisely Option A's defect. Two devices changing the *same*
  field converge on the later tap — safe for the reason ADR-0026 gives, that the
  only two writers are the same person's own two hands. Ties go to the incoming
  remote (matching `applyRemoteStamps`'s `>=`), so a round trip is idempotent
  rather than oscillating.
- **Absence means "no opinion", never "reset to default"** — the rule
  `api/spoiled-days.js` states in its own header, and for the same reason: a
  fresh device with an empty document must not tell the server to erase the
  user's settings. POST therefore publishes **one field at a time**; a
  whole-document POST from a fresh device would erase the account.
- **There is deliberately no tombstone.** A preference cannot be "removed", only
  changed to another valid value, so the withdrawal machinery `spoiledDays`
  needs has no analogue here. That simplification is the reason preferences got
  their own module instead of being squeezed into the day-state map.
- **`updatedAt: 0` is legal and load-bearing.** It is what a value migrated from
  a legacy key carries — "held, but with no clock" — so a pre-existing local
  default always loses to a deliberate choice made on the phone. (The draft said
  `updatedAt` must be *positive*; zero is the one legal value that made that
  wrong.)
- **`preferencesToPublish(local, known)` compares against the remote baseline,
  never a change log.** `known` is what the server said on the last pull. Read
  that module header before "simplifying" it: a change log cannot describe state
  that predates sign-in, which is the guest-to-account backfill gap ADR-0026's
  2026-08-06 amendment and PR #545 both had to fix *after* shipping.
- **Clock skew is bounded, not fatal.** The server clamps an `updatedAt` more
  than 48 hours in the future to server `Date.now()` rather than refusing the
  write — same posture as `api/reveal.js`'s `MAX_REVEALED_THROUGH`. A wrong
  clock should cost the user a merge-order surprise, never their setting.

### Migration is one-time, lossless, and non-destructive

On first read, for each of `club` / `level` / `keepAwake`, if `bbsbh:prefs` has
no entry and the legacy key holds a valid value, the entry is seeded with that
value at `updatedAt: 0`. **The legacy keys are left in place for one release** —
a rollback must not cost a user their club.

One coupling did not survive: `bbsbh:favoriteTeam`'s mere presence used to double
as "has this visitor seen the welcome modal". First visit gets its own explicit
flag (`bbsbh:intro`), because the two-step intro needs to know which *step* was
reached and a single key cannot express that.

### The shared-device owner tag

`bbsbh:prefsOwner` records which account's remote document was last merged into
the local one, and `mergeStrategyFor(owner, userId)` reads it:

| Owner tag | Signing in as | Strategy | Effect |
|---|---|---|---|
| absent (a guest's own settings) | `user_a` | `backfill` | merge remote in, publish what the server lacks — **the guest-to-account merge** |
| `user_a` | `user_a` | `backfill` | ordinary resume |
| `user_a` | `user_b` | **`adopt`** | take the remote wholesale, publish **nothing** |
| anything | signed out | `none` | no remote to reconcile against |

This closes a leak the draft did not name: A signs in on a shared device, their
club syncs down with a real clock, A signs out, B signs in — and without the tag
`preferencesToPublish` would push A's club into B's account.

Two things it deliberately does **not** do. **Sign-out does not clear the
document** — local-first means the device keeps working with what it has, and a
signed-out user is still a user; the owner tag is what protects the next account,
not an erase. And **an unreadable owner tag falls back to `backfill`**, the safe
direction: backfill only ever publishes what this device already holds, whereas
guessing `adopt` would silently discard a guest's own settings on every sign-in.
The in-memory `known` baseline is dropped on sign-out too, so the next sign-in
can never publish against the previous account's baseline.

### Erase — `api/account.js`, and the webhook that is deliberately deferred

`DELETE /api/account` deletes, for the verified `sub` only: `prefs:{userId}`,
`spoiled:{userId}`, `scorebook:{userId}`, `stamps:{userId}:{season}` for every
season in `stamps:{userId}:seasons`, and `reveal:{userId}:{gamePk}` for every
gamePk in `reveal:index:{userId}`.

The reveal family had no index, so `api/reveal.js` gained one: a Redis set
`SADD`ed alongside each ratchet. It holds gamePks — an identity, never a mark and
never a score — and it exists so "erase my data" can be *complete* rather than
best-effort. **It is deliberately unbounded**, against the draft's suggestion to
cap and prune: a cap would make the erase silently incomplete for whatever fell
off it, which defeats the only reason the index exists. It is a set of integers
bounded by how many games a human actually opens.

`game:final:{gamePk}` is **never** deleted. It is a shared, immutable cache of
public facts keyed by gamePk, it belongs to no user, and deleting it would
degrade every other user's Logbook.

**A Clerk `user.deleted` webhook is the robust path and is deliberately deferred.**
It needs a signing secret, a public unauthenticated endpoint, and dashboard
configuration — three new pieces of infrastructure for a solo project. Shipping
the in-app button first is the honest 90%, and the residue is stated in copy
rather than hidden: deleting the Clerk account *without erasing first* leaves
keys in Redis addressed to a `userId` that can never be re-issued — unreachable,
but not erased. My Tally's copy says the ordering plainly, on the erase row and
again in the confirm sheet: **erase first, then delete the account.** This is the
one open thread this ADR ships with.

### `routing="virtual"` for Clerk's `<UserProfile>` is a constraint, not a taste

`src/lib/route.js` is a hand-rolled `parseRoute` with no wildcard support, and
Clerk's `routing="path"` requires ownership of `/profile/*` for its own
sub-navigation. Virtual routing keeps every Clerk sub-screen inside the component
and leaves the router untouched. There is deliberately **no `/profile/{sub}`** at
all — one address, sections on it. A later "let's use path routing, it's cleaner"
refactor breaks the router; this paragraph exists to stop it.

### Claims are mechanical, not remembered

Account copy is only allowed to promise what is actually wired.
`src/lib/account/syncClaims.js` exports `SYNCED_ITEMS` — one entry per claim,
each naming its sync module — and `NEVER_SYNCED`. Every account panel, the sync
receipt, and the intro's benefit rows all render **from** it;
`test/sync-claims.test.js` fails CI when a claim names a module that does not
exist. Same posture as `check-report-pages.mjs`: two lists that must agree get
one list. The voice rules of `docs/game-log.md` §3 apply with extra force —
**never promise a backup**; sync is a convenience, so "carried across your
devices", never "backed up", "safe", or "never lose".

## Invariants

Numbered so they can be cited. **(guarded)** means a mechanical check fails CI.

- **P1.** No preference value may be derived from, or encode, game state. The
  document holds identity and device behaviour. A field whose value depends on
  what happened in a ballpark does not belong in it and never will.
- **P2.** `bbsbh:scoresUnlocked` never syncs. The pass is an ephemeral,
  device-local render override (ADR-0026); mirroring the expiry would unseal a
  second device on which the user never consented — the single worst thing this
  program could do. Only the per-day **consent record** syncs, on its own
  endpoint, unchanged. Pinned by `NEVER_SYNCED` + `test/sync-claims.test.js`.
- **P3.** Scores Unlocked stays explicit, day-specific consent. `/profile` may
  list the days already consented to (a date is not a score) and may offer the
  same-day withdrawal the switch already offers. It may **not** offer a
  persistent "always show scores" setting, a default-on preference, or anything
  that pre-consents a future day. Forbidden by name.
- **P4. (guarded)** No My Tally surface imports `GameStamp.jsx` or
  `StampGameButton.jsx`. `src/screens/profile/` and `src/components/profile/` are
  on `scripts/check-stamp-surfaces.mjs`'s **forbidden** list — the same treatment
  the slate and game cards get. ADR-0035's containment argument is the whole
  spoiler argument for the Logbook and this program must not widen it.
- **P5.** No marketing visual states or implies a score. The onboarding
  illustrations are hand-drawn art with no game as input: the device handoff
  shows kraft-amber seal bars *where numbers would be*, and the intro's progress
  marker is explicitly illustrative ("say, through top 7"), never a result.
- **P6. (guarded)** `/profile` renders no game data. No feed fetch, no
  `src/api/*` game-module import, no linescore, no stamp facts.
  `e2e/invariants/profile-no-scores.spec.js` asserts the rendered DOM carries no
  score-shaped token and that the page issues **zero** requests to
  `statsapi.mlb.com` for its whole lifetime — which is why the page reads the
  same-origin static club file (`src/api/teams-static.js`) rather than statsapi.
- **P7.** Private by construction. No public profile route, no user-data OG card.
  `/profile` gets **no** entry in `api/_lib/cards.js`, so a shared link falls
  through to the static default card exactly as ADR-0012 specifies. A display
  name, email, club or count never leaves an authenticated response.
- **P8.** `api/preferences.js` and `api/account.js` reply
  `cache-control: private, no-store`, always. Per-user auth-gated data must never
  reach a shared cache.
- **P9.** A user id in a Redis key is only ever the **verified `sub` claim**,
  never a client-supplied id. `DELETE /api/account` deletes only that user's keys
  and never `game:final:{gamePk}`.
- **P10.** The merge receipt reports counts of the user's own things. Never a
  matchup, never a date's outcome, never a number that came from a game. If a
  channel is `unavailable` its line is **omitted** rather than shown as zero — a
  zero is a claim, an omission is not.

## Consequences

- **`api/` now holds nine of the Hobby plan's twelve functions** (`og`, `preview`,
  `reveal`, `spoiled-days`, `stamps`, `copy`, `game-story`, `preferences`,
  `account`). That is fine, and it is also the last time a new endpoint should be
  added casually — the next feature that wants one should first ask whether it
  can ride an existing handler's query string.
- **No new environment variables.** The program rides the existing
  `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` and Upstash pair. Both
  endpoints check the store **before** they authenticate, so the curl diagnosis
  in `docs/development.md` keeps working: `501 sync not configured` means the
  Redis credentials are not reaching the function, `401` means the store is live
  and the problem is elsewhere.
- **Both endpoints use `api/_lib/nodeHandler.js`**, never the Web
  `Request`/`Response` shape — the bug that made three endpoints 500 on every
  production request for weeks (ADR-0022's 2026-07-25 amendment).
- **No Lua for the server-side write.** `api/reveal.js` closes its
  read-modify-write race with a Lua ratchet; this endpoint does the
  last-write-wins compare in JS and accepts a millisecond-wide race, because it
  **self-heals** — the POST answers with the stored document, the client merges
  it, and any device still holding a newer value republishes on its next
  comparison. A cjson round trip to close a gap that closes itself is not worth
  the untestable surface.
- **The sync receipt exists because a graceful degrade can hide a hard failure
  indefinitely** — ADR-0022's total production failure hid for weeks behind four
  bare `catch {}` blocks. `src/lib/account/syncStatus.js` gives each channel a
  state and the page reports the **worst** one, so it can never say "synced"
  while a channel is failing. The distinction between `unavailable` (a 501, a
  supported deploy state) and `error` (a real fault) is the part worth
  protecting; collapsing them would either cry wolf on a correct deployment or
  hide a broken one.
- **Signed-in paths remain unverified locally.** No `VITE_CLERK_PUBLISHABLE_KEY`
  on the maintainer's machine, the same gap ADR-0026 records for
  `SpoiledDaysCloudSync`. The known-gap list and what to watch on the first real
  sign-in live in `.scratch/account-profile-experience/HANDOFF.md`.
- **A one-shot store's "same reference when nothing changed" is a contract, not
  an optimisation.** `applyRemotePreferences`, `setPreference`, `seedFromLegacy`
  and `markPromptSeen` all return the identical object when they change nothing,
  and the tests assert `assert.equal`, not `assert.deepEqual`. React's render
  loop is downstream of every one of them.

## References

`.scratch/account-profile-experience/PRD.md` is the full specification — the
state matrix, the copy, and three lists of deliberate departures (§11.1 for the
sync foundation, §12.1 for the page, §13.2 for onboarding), each with its reason.
ADR-0012 (OG cards), ADR-0022 (reveal sync, the Node handler shape),
ADR-0025 (the copy store), ADR-0026 (Scores Unlocked; the backfill amendment),
ADR-0031 (mono knockout marks), ADR-0035 (stamp containment), ADR-0036 (the
passport book), ADR-0038 (structural limits). `docs/game-log.md` §3 is the voice.
