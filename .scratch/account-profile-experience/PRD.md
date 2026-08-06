# My Tally — the private account & profile experience

**Status:** phase 3 of 5 complete (spec + preference/sync foundation + the My Tally page) · **Slug:** `my-tally` · **Route:** `/profile`
**Branch:** `claude/my-tally-account-experience` · **Based on:** `origin/main` @ `bda26c6` (rebased)

The user-facing destination is **My Tally**. Subtitle: **"Profile & settings."**
The URL is `/profile` and it never changes (same reasoning as `/logbook` —
docs/game-log.md §2 — a shared link and its cached OG card outlive any redirect
we would maintain).

This document is the whole specification: state matrix, preference schema and
merge rules, route/component/API plan, the Clerk integration, sync status and the
post-sign-in merge receipt, onboarding triggers, invariants, testing, and the
ordered build. Read `docs/adr/0022`, `0025`, `0026`, `0035`, `0038` and
`docs/game-log.md` before implementing any of it.

---

## 0. What this is, and the one sentence that governs it

My Tally is the page that reports on **you** rather than on baseball: which club
you follow, how this device behaves, what is carried across your devices, and
what you have consented to see. It is the settings surface the footer button has
always wanted to be, plus an honest account ledger.

> **`/profile` renders no game data at all.**

That is the rule the whole design rests on. Every other screen in this app has to
argue about seals, reveal marks and containment guards. This one does not need
to, because it never loads a feed, never resolves a game fact, never imports a
stamp component, and never prints a number that came out of a ballpark. Counts of
your own things are the only numbers it shows. Keep it that way and the page
stays cheap to reason about forever; break it once and it joins the list of
surfaces that need a guard.

### Non-goals, stated so they are never re-litigated

- **No public profile.** No `/u/{id}`, no shareable profile URL, no display name
  surfaced to anyone, no OG card that names user data.
- **No social feed, no leaderboard, no comparison, no sharing.** The Game Log
  already committed to this (docs/game-log.md §1) and My Tally inherits it.
- **No "always show scores" setting.** See §7, invariant P3. Scores Unlocked
  stays a day-specific consent, forever.
- **No account requirement.** Settings work signed out. Signing in adds
  continuity and nothing else.

---

## 1. Signed-out and signed-in state matrix

Three axes, not two: whether the deploy configures Clerk at all
(`VITE_CLERK_PUBLISHABLE_KEY`), whether the user is signed in, and whether the
Redis store is reachable. The app has always degraded on all three (ADR-0022);
My Tally must too.

### 1.1 The page, by state

| | Clerk unconfigured | Clerk configured, signed out | Clerk configured, signed in |
|---|---|---|---|
| Page header | `My Tally` / *Profile & settings.* | same | same |
| Scope line | **"This device."** | **"This device."** | **"Every device you sign in on."** |
| Club section | full, editable | full, editable | full, editable |
| Device section (Keep Awake, level, motion) | full, editable | full, editable | full, editable |
| Game Log summary | count of stamps on this device, link to `/logbook` | same | count from merged collection, link |
| Reveal ledger | count of games in progress on this device | same | count across devices |
| Spoiled-day ledger | list of dates consented on this device | same | merged list |
| Account section | **absent entirely** | the benefit panel + `Create account or sign in` | identity line, sync receipt, `Manage account`, `Erase my Tally data`, `Sign out` |
| Sync receipt (§5) | absent | absent | one row per channel |
| Merge receipt (§5.3) | never | never | once per (device, account), on first successful merge |

**"This device" is the exact phrase.** Not "local", not "offline", not "not
synced". It is the true, plain, un-alarming statement of where the user's things
live, and it is the sentence the whole signed-out experience is built on. It is
never framed as a deficiency; §6.2's copy rules enforce that.

### 1.2 Behaviour, by state

| Capability | Signed out | Signed in |
|---|---|---|
| Change club | works, instant, persists | works, instant, publishes |
| Keep Awake / level / motion | works, instant, persists | works, instant, publishes |
| Reveal a half-inning | persists to `bbsbh:reveal:{gamePk}` | same, plus ratcheted to `/api/reveal` (ADR-0022) |
| Consent to a day (Scores Unlocked) | persists to `bbsbh:spoiledDays` | same, plus published to `/api/spoiled-days` (ADR-0026) |
| Mint / note / place a stamp | persists to `bbsbh:stamps` | same, plus published to `/api/stamps` (ADR-0035) |
| Pick up your pencil (recent-game continuation) | **absent** — needs the cloud scorebook index | present (`/api/reveal?recent=1`) |
| Game Log | opens the local book on an unconfigured deploy; on a configured deploy the signed-out visitor gets the feature pitch (`LogbookAccountGate`) | opens the merged book |
| Erase my Tally data | clears this device's keys only, with a confirm | clears this device **and** the account's server-side keys (§4.5) |

### 1.3 Store-unreachable (Redis 501) while signed in

Every endpoint checks the store **before** it authenticates, so a
`501 sync not configured` is distinguishable from a `401` by curl alone
(docs/development.md). The page must say something true and unalarming:

> **"Signed in. Sync is not available on this deployment — everything is still
> saved on this device."**

Not an error state, not red. It is the documented, supported degrade, and the
sync receipt renders each channel as `unavailable` rather than `error`.

---

## 2. The storage decision — evaluated, decided

Two options were on the table for the **preferences** document specifically (the
club, the level, Keep Awake, motion). Reveal marks, spoiled days and stamps are
already decided and are not reopened.

### Option A — Clerk user metadata (`unsafeMetadata` / `publicMetadata`)

- **Size / rate.** Clerk caps all metadata at ~8 KB per user, which is ample for
  ~10 fields. Writes go through Clerk's Frontend API and are rate-limited per
  user; there is no batching primitive.
- **Offline.** Fatal. `user.update()` is a network write with no local queue and
  no local read path. A club change made on the subway either fails or silently
  no-ops.
- **Guest-to-account merge.** There is no metadata before there is a user, so a
  signed-out visitor's preferences must live somewhere else anyway — meaning
  Option A is not one storage model, it is **two models plus a bespoke bridge**
  between them, written once and debugged forever.
- **Simultaneous device updates.** `unsafeMetadata` is patched as a whole object.
  Two devices changing two different fields in the same window: the later write
  clobbers the earlier one wholesale. There is no per-field clock to reconcile on,
  and adding one means hand-rolling exactly the merge Option B already has.
- **Deletion.** Best in class — deleting the Clerk user deletes the metadata with
  it, no orphans.
- **Backend exception.** None. This is Option A's only real advantage: no fifth
  `api/` function, no fifth entry in the root `CLAUDE.md` exceptions list.
- **Validation.** `unsafeMetadata` is client-writable by design and by name. Any
  server-side bound on a value needs a backend anyway, which cancels the
  advantage above.

### Option B — a local-first authenticated preferences document on the existing Upstash stack

- **Size / rate.** One Redis hash per user, `prefs:{userId}`, one field per
  preference, every value bounded and re-validated server-side. A pull is one
  `HGETALL`; a publish is one `HSET` per changed field. A heavy user changes a
  preference a few dozen times a year. Against Upstash's free tier this is
  rounding error next to the reveal ratchet, which writes on every half-inning.
- **Offline.** Native. `localStorage` stays the instant source of truth and the
  sync is a background merge on top — the identical contract `RevealCloudSync`,
  `SpoiledDaysCloudSync` and `StampsCloudSync` already run.
- **Guest-to-account merge.** Solved, and solved by a shape this repo has already
  debugged twice: the baseline is **what the server said on the last pull**, and
  the publish asks *"what do I have that it doesn't?"* (`stampsToPublish`,
  `dayStatesToPublish`; ADR-0026's 2026-08-06 amendment records exactly why a
  change-log baseline could never backfill pre-sign-in state). Preferences set
  before an account existed backfill on the first pull.
- **Simultaneous device updates.** Per-**field** last-write-wins on a per-field
  `updatedAt`. Two devices changing two different fields both land. Two devices
  changing the *same* field converge on the later tap, which is the only sane
  answer and is safe for the reason ADR-0026 gives: the only two writers are the
  same person's own two hands.
- **Deletion.** Needs an explicit path — Clerk account deletion does not cascade
  into Redis. That is **already true today** for `reveal:`, `spoiled:`,
  `scorebook:` and `stamps:` and is currently unaddressed. §4.5 closes it for all
  five families at once rather than adding a sixth orphan.
- **Sync status.** Falls out for free: the same component that pulls and
  publishes reports its state to the shared status context (§5).
- **Backend exception.** Yes — a fifth `api/` function and a fifth documented
  exception. It is the *same* exception in kind: never a score, opt-in, inert
  when unconfigured, `private, no-store`, authenticated by the verified Clerk
  `sub`.

### Decision: **Option B.**

The deciding argument is not offline and not the merge, it is this: **Option A
cannot serve the signed-out state at all.** "Settings remain usable while signed
out" is a hard product requirement, so a local store has to exist either way.
Option A therefore does not remove a storage model, it *adds* one — plus a
bridge between two systems with different shapes, different failure modes and
different clocks. Option B has one model, already written three times in this
codebase, with a merge rule whose two historical bugs are documented and
regression-tested.

Option A's one advantage — no new backend exception — is bought at the price of
the whole-object clobber, which is a real, silent data-loss bug on the exact
multi-device scenario this program exists to serve.

**This becomes a documented backend exception**, the fifth, recorded in a new
`docs/adr/0039-my-tally-preferences-document.md` and in the root `CLAUDE.md`'s
architecture map. It joins the *three that never store a score* (link previews,
reveal sync, spoiled days, admin copy) rather than the one that does (stamps).
The ADR must state plainly: a preference is identity and device behaviour, and
**no preference value may be derived from game state** (§7, P1).

### 2.1 Vercel function budget — a real constraint, named

`api/` holds seven functions today (`og`, `preview`, `reveal`, `spoiled-days`,
`stamps`, `copy`, `game-story`). This program adds **two**: `preferences.js` and
`account.js`. Nine of the Hobby plan's twelve. That is fine and it is also the
last time a new endpoint should be added casually — the next feature that wants
one should first ask whether it can ride an existing handler's query string.
Record this in the ADR.

---

## 3. The preference schema, exactly

### 3.1 What is in it

`src/lib/account/preferences.js` — pure, React-free, dependency-free, imported
verbatim by `api/preferences.js`, exactly as `src/lib/stamps.js` is imported by
`api/stamps.js`. The client and the server must not be able to disagree about
what a valid preference is.

**Why a `src/lib/account/` subdirectory rather than four more flat files.**
`src/lib` sits at its 51-file budget (`scripts/check-dir-size.mjs`), and this
program adds four modules — `preferences.js`, `syncStatus.js`, `syncClaims.js`,
`prompts.js`. Raising the budget to 55 for a set of files that are obviously one
subsystem is precisely what ADR-0038's "flat directories don't stay flat" rule
exists to prevent. They go in `src/lib/account/`, `src/lib` stays at 51, and the
guard needs no edit at all.

The **closed** field registry. A field not in this table does not exist; an
unknown key on the wire or in storage is dropped, never stored, never echoed.

| Field | Type | Valid values | Default | Legacy key it replaces |
|---|---|---|---|---|
| `club` | integer | a statsapi `teamId`, `1 … 99999` | `158` (the pinned Brewers) | `bbsbh:favoriteTeam` |
| `level` | integer | a statsapi sportId: `1` \| `11` \| `12` \| `13` \| `14` | `1` (MLB) | `bbsbh:level` |
| `keepAwake` | boolean | `true` \| `false` | `false` | `bbsbh:keepAwake` |
| `motion` | string | `system` \| `reduced` \| `full` | `system` | — (new) |

> **Departure from the first draft (§11.1).** `level` was scoped here as a
> `'mlb' | 'aaa' | …` string. It ships as the **sportId integer** the app already
> speaks — `bbsbh:level` has always stored one, and `LEVELS`/`SPORT_IDS` in
> `teams.js` are the vocabulary every fetch uses. A string set would have been a
> second name for a thing that already has one, and the two would drift.
>
> `club` is validated as a **bounded integer**, not as membership of the real
> club list. Checking membership would mean importing the 1,100-line
> `teams.js` into the serverless bundle — the same reason `src/lib/stamps.js`
> restates the passport bounds rather than importing `passportLayout.js`. The
> cost of a well-formed-but-wrong id is a fallback logo, not a security hole.

Four fields. Deliberately small. `motion` is a user-level override on top of the
OS `prefers-reduced-motion` signal — `system` means "do what the OS says", which
is today's only behaviour, so shipping it changes nothing until a user touches it.

**Explicitly NOT in the preferences document, each for a stated reason:**

| Key | Why not |
|---|---|
| `bbsbh:scoresUnlocked` | The pass expiry. Syncing it would unseal a **second device the user never consented on**. Hard invariant, §7 P2. Stays device-local, forever. |
| `bbsbh:spoiledDays` | Consent, not preference. Already has its own key, shape and endpoint (ADR-0026). Do not fold it in. |
| `bbsbh:reveal:*`, `bbsbh:reveal-atbat:*` | Scoring progress. Own endpoint (ADR-0022). |
| `bbsbh:stamps` | The Game Log. Own endpoint (ADR-0035). |
| `bbsbh:search:recent` | A browsing trail. Device-local by nature and a needless privacy surface to move off-device. |
| `bbsbh:copyOverrides` | An admin cache of `/api/copy`. Not a user preference. |
| `bbsbh:identity-lab:*` | Dev-only lab state. |
| `bbsbh:reloaded-after-preload-error` | A one-load recovery flag. |

### 3.2 The record shape

Local, under **one** key `bbsbh:prefs`:

```jsonc
{
  "club":      { "value": 158,   "updatedAt": 1754500000000 },
  "keepAwake": { "value": true,  "updatedAt": 1754500100000 },
  "level":     { "value": "aaa", "updatedAt": 1754500200000 }
  // a field never set is simply absent — absence means "no opinion", never "default"
}
```

Wire and Redis: the identical shape, one hash field per preference,
`prefs:{userId}`, value `{ value, updatedAt }`.

**Why per-field `updatedAt` and not one document clock.** Two devices editing two
different preferences must both win. A document-level clock makes that a coin
flip, which is precisely Option A's defect. `stampedAt`/`updatedAt` in
`src/lib/stamps.js` splits for a related reason and its header is the precedent.

**Absence means "no opinion", never "reset to default".** This is the same rule
`api/spoiled-days.js` states in its header and for the same reason: a fresh
device with an empty document must not tell the server to erase the user's
settings. There is deliberately **no tombstone** for a preference — a preference
cannot be "removed", only changed to another valid value, so the withdrawal
machinery `spoiledDays` needs has no analogue here. That is a simplification, and
it is the reason preferences get their own module rather than being squeezed into
the day-state map.

### 3.3 Merge rules

`applyRemotePreferences(local, remote)` — pure, unit-tested:

1. Normalize both sides. An entry whose `value` fails its field's validator, or
   whose `updatedAt` is not a **non-negative** integer, is **dropped** — not
   defaulted. Garbage can lose a preference (harmless, the default resumes) but
   can never invent one. (Draft said "positive"; zero is the one legal value
   that made it wrong — it is what a migrated legacy key carries.)
2. For each field in the union of both sides: take the side with the greater
   `updatedAt`. **Ties go to the incoming remote** (matching
   `applyRemoteStamps`'s `incoming.updatedAt >= existing.updatedAt`), so a
   round-trip is idempotent rather than oscillating.
3. A field present locally and absent remotely is **kept** (no opinion ≠ erase).
4. A field present remotely and absent locally is **taken** — this is the
   second-device case and the whole point.
5. Unknown keys on either side are dropped silently.

`preferencesToPublish(local, known)` — pure, unit-tested. Returns the list of
`{ field, value, updatedAt }` this device holds that the server does not, or
holds a strictly newer version of. `known` is **what the server said on the last
pull**, never a change log. This is the shape that makes guest-to-account
backfill work at all; ADR-0026's 2026-08-06 amendment is the argument, and it
must be quoted in the module header so nobody "simplifies" it back into a diff
against the previous local value.

**Clock skew.** `updatedAt` is `Date.now()` on whichever device made the change.
A device with a badly wrong clock can pin a preference. Accepted, and bounded:
the server rejects an `updatedAt` more than 48 hours in the future
(`MAX_CLOCK_SKEW_MS`), clamping it to server `Date.now()` instead of refusing the
write — a wrong clock should cost the user a merge-order surprise, never their
setting. Same posture as `api/reveal.js`'s `MAX_REVEALED_THROUGH`: bound the
hostile input, don't fail the honest one.

### 3.4 Migration from the three legacy keys

One-time, lossless, and non-destructive:

- On first read, for each of `club`/`level`/`keepAwake`, if `bbsbh:prefs` has no
  entry and the legacy key has a valid value, seed the entry with that value and
  `updatedAt: 0`.
- `updatedAt: 0` is deliberate — it means "held, but with no clock", so **any**
  real value from another device wins the merge. A pre-existing local default
  must never overwrite a deliberate choice made on the phone.
- The legacy keys are **left in place**, not deleted, for one release. A rollback
  must not cost a user their club.
- `bbsbh:favoriteTeam`'s presence currently doubles as the "has this visitor seen
  the welcome modal" flag (`useFavoriteTeam.js`). That coupling does not survive:
  §6.1 gives first-visit its own explicit flag, because the two-step intro needs
  to know which *step* was reached, which a single key cannot express.

---

## 4. Route, component, and API plan

### 4.1 Route

`/profile` → `{ name: 'profile' }`, a single-segment route in
`src/lib/route.js`'s ordered `parseRoute`. It must sit with the other
single-segment named routes, **after** the bare-8-digit-date branch (every named
route is non-numeric, so that ordering already holds) and it collides with
nothing: `photos`, `postseason-history`, `postseason-leaders`, `prospects` are
the neighbours and no prefix relation exists.

There is deliberately **no `/profile/{sub}`**. Sub-pages would force
`src/lib/route.js` to grow a wildcard it has never needed and would force Clerk's
`<UserProfile>` into path routing (§4.4). One address, sections on it.

`vercel.json`'s existing catch-all rewrite already resolves it on a cold load.

### 4.2 Screens and components

```
src/screens/profile/
  ProfilePage.jsx          the page shell, sections, document title
  sections/
    ClubSection.jsx        the club seal + the team strip
    DeviceSection.jsx      Keep Awake, level, motion
    LedgerSection.jsx      progress ledger: reveals, days, stamps
    AccountSection.jsx     Clerk-gated: identity, sync receipt, manage, erase
src/components/profile/
  ScopeBadge.jsx           "This device." / "Every device you sign in on."
  ClubSeal.jsx             the club-seal mark (identity art, no game state)
  DeviceHandoff.jsx        the score-free handoff illustration
  SyncReceipt.jsx          one row per channel (§5)
  MergeReceipt.jsx         the one-shot post-sign-in receipt (§5.3)
  EraseDataDialog.jsx      the confirm sheet for §4.5
```

`src/screens` is **at its 38-file budget** and `src/hooks` is at 21
(`scripts/check-dir-size.mjs`), so a new flat file in either fails lint by
design (ADR-0038). Hence the two subdirectories above, and hence §8's hook moves.

`AccountSection.jsx` and everything under it touches `@clerk/clerk-react` at its
top level, so it follows the established pattern exactly: **dynamically imported,
only when `isClerkEnabled`** (`AccountPitch`, `RevealCloudSync`,
`SpoiledDaysCloudSync`, `StampsCloudSync`, `LogbookAccountGate` are all this
shape). Never a conditionally-called hook — Clerk's hooks throw with no
`ClerkProvider` ancestor.

### 4.3 Entry points

| Surface | Change |
|---|---|
| `src/lib/reportPages.js` | add `{ label: 'My Tally', path: '/profile' }` as the **first** of the three personal entries (before Game Log), matching that file's documented ordering comment — it flows to `SiteMenu`, `SiteFooter` and `ReportFooter` automatically, and `scripts/check-report-pages.mjs` keeps them from drifting |
| `SiteFooter.jsx` | the **Settings** action button now navigates to `/profile` instead of opening `FavoriteTeamModal`. The modal survives for the first-visit intro only (§6.1) |
| `AccountButton.jsx` | signed in, the `UserButton` menu gains a `My Tally` item pointing at `/profile` (§4.4) |
| `FavoriteTeamModal.jsx` | the settings-mode entry point goes away; intro mode stays and becomes two steps |

The favourite-team **strip** itself moves into `ClubSection.jsx` and is shared
with the intro's step 1 — one component, two hosts, no parallel copy. Same rule
`src/CLAUDE.md` states for the team hub's preview modules.

### 4.4 Clerk `UserProfile` / `UserButton` integration

**`UserButton`** — add menu items via Clerk v5's composition API:

```jsx
<UserButton afterSignOutUrl="/" appearance={…}>
  <UserButton.MenuItems>
    <UserButton.Link label="My Tally" labelIcon={…} href="/profile" />
    {/* Clerk's own "Manage account" and "Sign out" keep their default slots */}
  </UserButton.MenuItems>
</UserButton>
```

The favourite-club logo overlay stays exactly as it is (`accountbtn__teamlogo`,
`pointer-events: none`) — it is a visual overlay, nothing is uploaded to Clerk,
and a club change shows up immediately. Do not regress that.

**`UserProfile`** — mounted **inside** `AccountSection.jsx` with
`routing="virtual"`, behind a `Manage account` disclosure that is collapsed by
default.

`routing="virtual"` is not a style preference, it is a hard constraint:
`src/lib/route.js` is a hand-rolled `parseRoute` with no wildcard support, and
Clerk's `routing="path"` requires ownership of `/profile/*` for its own
sub-navigation. Virtual routing keeps every Clerk sub-screen inside the component
and leaves our router untouched. Record that in the ADR — it is exactly the sort
of thing a later "let's use path routing, it's cleaner" refactor would break.

Theming rides `src/lib/clerkAppearance.js` unchanged (`variables` = concrete hex
mirroring `src/tokens/colors.css`; `elements` = our class names). `UserProfile`
introduces new element slots (`profileSectionTitle`, `navbar`, …) — extend the
`elements` map there, not with a new appearance object, so the sign-in modal, the
`UserButton` popover and the profile card stay one visual system.

**Clerk's own delete-account action** lives in `UserProfile` → Security. It
deletes the Clerk user; it does **not** touch our Redis keys. §4.5 is the answer,
and §6.3's copy states the ordering plainly.

### 4.5 API

#### `api/preferences.js` — new, Node runtime, the fifth exception

```
GET    /api/preferences   -> { prefs: { field: { value, updatedAt } } }
POST   /api/preferences   { field, value, updatedAt }  -> { prefs: { … } }
```

Modelled field-for-field on `api/spoiled-days.js`:

- `export const config = { runtime: 'nodejs' }` — `@clerk/backend`'s
  `verifyToken` pulls in internals Vercel's edge sandbox rejects (ADR-0022).
- Built on `api/_lib/nodeHandler.js` (`jsonResponse`, `readJsonBody`,
  `requestUrl`). **Not** the Web `Request`/`Response` shape — that is the bug
  that made three endpoints 500 on every production request for weeks
  (ADR-0022's 2026-07-25 amendment). `test/api-handlers.test.js` drives the real
  Node shape and the new handler joins it.
- `getRedis()` first → `501 sync not configured`; then `authenticateUser(req)` →
  `501 auth not configured` / `401 no token` / `401 invalid token`. Store before
  auth, so the curl diagnosis in docs/development.md keeps working.
- `cache-control: private, no-store` on every reply.
- Re-validate on the way **out** as well as in (`sanitizeStored`), so a
  hand-edited or cross-version hash can only ever yield known fields.
- POST publishes **one field at a time**, for the same reason
  `api/spoiled-days.js` does: absence has to keep meaning "no opinion", and a
  whole-document POST from a fresh device would erase the account.
- Server-side validation is the same pure module the client uses. A body naming
  an unknown field, an out-of-range value, or a hostile `updatedAt` is rejected
  or clamped (§3.3) — never stored.

#### `api/account.js` — new, the erase path

```
DELETE /api/account   -> { ok: true, erased: { prefs, spoiled, scorebook, reveal, stamps } }
```

Deletes, for the verified `sub` only:

- `prefs:{userId}`
- `spoiled:{userId}`
- `scorebook:{userId}`
- `stamps:{userId}:{season}` for each season in `stamps:{userId}:seasons`, then
  the seasons set
- `reveal:{userId}:{gamePk}` for each gamePk in **`reveal:index:{userId}`**

The reveal family is the only one with no index today, so `api/reveal.js` gains
one: a Redis SET `reveal:index:{userId}`, `SADD`ed alongside each ratchet. It is
a set of gamePks — an identity, never a mark and never a score — and it exists so
"erase my data" can be *complete* rather than best-effort. Bound it with the same
posture as `SCOREBOOK_MAX`: it is unbounded in principle, so cap it and prune the
oldest on overflow, or accept a documented cap. `game:final:{gamePk}` is
deliberately **not** deleted — it is a shared, immutable cache of public facts
keyed by gamePk, belongs to no user, and deleting it would degrade every other
user's Logbook.

**A Clerk `user.deleted` webhook is the robust path and is deliberately deferred.**
It needs a signing secret, a public unauthenticated endpoint, and dashboard
configuration — three new pieces of infrastructure for a solo project. Shipping
the in-app button first is the honest 90%, and the residue must be stated in copy
rather than hidden: deleting the Clerk account without erasing first leaves keys
in Redis addressed to a `userId` that can never be re-issued — unreachable, but
not erased. §6.3 has the wording. Record the webhook as an open thread in the ADR.

---

## 5. Sync status and the merge receipt

### 5.1 The problem

Four independent headless components (`RevealCloudSync`, `SpoiledDaysCloudSync`,
`StampsCloudSync`, and the new `PreferencesCloudSync`) each swallow their own
errors and each leave `localStorage` authoritative. That is correct, and it is
also exactly how ADR-0022's total production failure hid for weeks: *"a graceful
degrade can mask a hard failure indefinitely."* The user has never had any way to
see whether sync is working.

### 5.2 The design

- **`src/lib/account/syncStatus.js`** — pure, unit-tested. A reducer over
  `{ channel, phase, at, reason }` events producing a per-channel state:
  `off` (Clerk unconfigured) · `local` (signed out) · `pulling` · `synced` ·
  `unavailable` (501 — the supported degrade, §1.3) · `error` (401/network).
  Plus a rollup: the page-level word is the *worst* channel's state, so the page
  never says "synced" while one channel is failing.
- **`src/components/sync/SyncStatusProvider.jsx`** — a tiny context with a
  `report(channel, phase, meta)` callback. Mounted in `App.jsx` **unconditionally**
  (it touches no Clerk API), so `/profile` can read it whether or not Clerk is
  configured. The four sync components call `report(...)` in the places they
  currently have bare `catch {}` blocks — the catches stay, they just stop being
  silent.
- **`SyncReceipt.jsx`** — one row per channel on `/profile`, in the app's voice,
  each naming *the thing* rather than the mechanism:

| Channel | Row label | Synced state | Local state |
|---|---|---|---|
| `reveal` | Reveal progress | *"Carried across your devices. Last checked {relative}."* | *"On this device."* |
| `spoiledDays` | Days you unsealed | same | same |
| `stamps` | Game Log | same | same |
| `prefs` | Club & settings | same | same |

Relative times only (`just now`, `2 min ago`, `earlier today`) — an absolute
timestamp invites the user to diagnose, and there is nothing for them to fix.

**Nothing in the receipt is a score, a game, or a club's result.** It is four
words and a clock.

### 5.3 The post-sign-in merge receipt

The moment that needs an explanation is the first successful sign-in on a device
that already had local state: the user's things silently become an account's
things. Today that is invisible, and invisible is how the spoiled-day backfill
bug went unnoticed on the owner's own second device (ADR-0026, 2026-08-06).

**Trigger.** All of: `isSignedIn` · every configured channel has completed its
first successful pull this session · `bbsbh:mergeReceipt:{userId}` is unset on
this device. Shown as a dismissible card at the top of `/profile`, and — if the
sign-in happened elsewhere — as a one-line strip on the slate linking to
`/profile`. Never a modal, never blocking, never a notification.

**Content.** Counts of the user's own things after the merge, and nothing else:

> **Your book is on this account now.**
> 12 stamps · 8 games in progress · 3 days you'd already unsealed · Brewers
> *Nothing you'd revealed changed. Everything here was already yours.*

**Rules.**
- Counts only. Never a game, never a matchup, never a date's result, never a
  score. The club name is identity, which the header already shows.
- It **never renders stamp art** — no import of `GameStamp.jsx`, and the profile
  directories go on `check-stamp-surfaces.mjs`'s *forbidden* list (§7, P4).
- Dismissal is one-shot per `(device, account)`. Signing out and back in on the
  same device does not re-show it; a different account on the same device does.
- If a channel is `unavailable`, its line is omitted rather than shown as zero. A
  zero is a claim; an omission is not.

---

## 6. Onboarding and contextual prompts

### 6.1 The intro becomes two steps

`FavoriteTeamModal` in `intro` mode splits. It stays one dialog with two panels
and a step indicator; it is never two separate modals.

**Step 1 — Choose a club.**
- The existing club strip, unchanged in behaviour: tapping applies immediately,
  no separate Save.
- The existing welcome paragraph (lineups, umpires, rosters, *"every run, hit,
  and out stays sealed until you tap to reveal it"*) stays here. It is the
  spoiler promise and it belongs on the first screen.
- Primary action: `Next`. Closing by **any** route from step 1 — backdrop, ✕,
  Escape — commits the current pick and skips step 2 entirely. A dismissal is an
  answer.

**Step 2 — See the account benefit.**
- Rendered **only when `isClerkEnabled`**. On an unconfigured deploy step 1's
  primary action is `Get started` and there is no step 2, no indicator, and no
  dead "1 of 2".
- The visual: the club seal the user just picked, and the score-free device
  handoff (§6.4).
- Actions, deliberately equal in weight: `Create account or sign in` and
  `Not now`. Not-now is a plain button, not a whispered text link. Both close the
  modal and both commit the club.
- It is never shown again by the intro. Later opportunities are §6.2's prompts.

**First-visit flag.** `bbsbh:favoriteTeam`'s presence currently doubles as
"has been through the welcome modal" (`useFavoriteTeam.js`). Replace it with an
explicit `bbsbh:intro` = `{ seen: true, at }`, seeded true for anyone who already
has a club (so no existing user gets the modal again). `?nointro` suppresses the
whole thing for one load, unchanged, and `e2e/fixtures.js` keeps supplying it.

### 6.2 Contextual prompts — the exact, complete list

Every one: one-shot, dismissible, non-blocking, never on a sealed surface, never
interrupting a reveal, and recorded in `bbsbh:prompts` (a bounded `{id: at}` map,
never re-shown once dismissed). Only rendered when `isClerkEnabled && !isSignedIn`.

| # | Id | Exact trigger | Where it renders | Copy direction |
|---|---|---|---|---|
| 1 | `intro-account` | step 2 of the first-visit intro (§6.1) | the intro modal | the benefit, once, warmly |
| 2 | `first-stamp` | the user's stamp count on this device goes from 0 → 1 | inline in the `/logbook` tray, under the "waiting for a page" line — **not** on the box score, which is a sealed surface | *"This book lives on this device. An account carries it to the others."* |
| 3 | `third-game` | the count of distinct `bbsbh:reveal:*` keys reaches 3 | the slate, in the slot `ContinueScoring` occupies when signed in — so the signed-out user sees what the strip *would* be | *"Three games in your pencil. Sign in and they'll be waiting on your other devices too."* |
| 4 | `settings-pitch` | always, not one-shot | the `/profile` account section, signed out | the standing benefit panel — this is the one that is allowed to persist, because it lives on the page you went to on purpose |

**Nothing fires on the box score, the innings viewer, a lineup page, or a
`SealBox`.** Prompt 2's natural home is the mint card, and it is deliberately
moved one screen away for exactly that reason.

**No notifications of any kind.** No push, no web-push, no badge, no title-bar
count. Beyond the score-safety rule, a notification about baseball is a spoiler
vector by construction.

### 6.3 Copy — the claims ledger

Marketing copy may claim **only** these, because only these are true:

1. **Reveal progress** — how far you've revealed each game (ADR-0022).
2. **Spoiled-day consent** — which days you agreed to see (ADR-0026).
3. **Game Log** — stamps, their notes, and where they sit on the page (ADR-0035).
4. **Recent-game continuation** — "Pick up your pencil" (`/api/reveal?recent=1`).

Copy may **not** claim favourite team, preferred level, Keep Awake, or
accessibility preferences sync **until the implementation makes that true**.
Phase 2 of this program makes it true; phase 5 is the only phase permitted to
update the claim, and it must do so in the same PR as the code.

**Enforce it, don't remember it.** `src/lib/account/syncClaims.js` exports a
`SYNCED_ITEMS` array — the single source of truth — with one entry per claim
naming its sync module. The account panels render from it, and
`test/sync-claims.test.js` asserts that every claimed item names a module that
exists and is imported by `App.jsx`'s sync mount (or `InningViewer`'s, for
reveal). A claim without a wire fails CI. This is the same posture as
`check-report-pages.mjs`: two lists that must agree get one list.

**Voice.** Borrow docs/game-log.md §3 wholesale — second person, warm and never
cute, no exclamation marks, no congratulation, no scarcity, no FOMO, short
sentences with the second beat on an em dash. Two rules apply with extra force
here:

- **Never promise a backup.** Sync is a convenience, not a guarantee
  (docs/game-log.md §3.3 rule 4). "Carried across your devices", never "backed
  up", "safe", or "never lose".
- **Say what erasing does, and in what order.** *"Erase your Tally data first,
  then delete your account — deleting the account on its own leaves this data
  unreachable but not erased."* Plain, unfrightening, true.

### 6.4 The visual language

Five elements, and all five are score-free by construction:

1. **The club seal** — a wax/rubber-stamp roundel around the user's chosen club
   mark. Identity only. Uses the existing `TeamLogo` `mono` knockout variant
   (ADR-0031) — **never** `filter: brightness(0) invert(1)`.
2. **The score-free device handoff** — a phone and a tablet, each showing a
   *sealed* slate: kraft-amber seal bars where numbers would be. The whole point
   of the illustration is that the numbers are not there.
3. **The progress ledger** — a ruled scorebook column of counts, mono tabular
   figures, in the app's paper-and-graphite palette.
4. **The Game Log passport stamp** — a hand-drawn SVG roundel, following
   `LogbookLanding.jsx`'s existing `PreviewStamp` precedent exactly: concentric
   circles and diamonds, a month-and-day legend, **no clubs, no score, no
   `GameStamp.jsx`**.
5. **The sync receipt** — a carbon-copy/duplicate-slip motif: four ruled rows,
   each a thing and a checkmark.

Palette and type from the tokens only (`--surface-card`, `--seal-cover`,
`--text-caption`, the mono tabular numerals). New rules go in a new ordered
partial `src/styles/52-my-tally.css`, appended to `src/index.css`'s `@import`
list **at the position its rules belong in** — after the logbook/passport
partials, since it references their motifs.

---

## 7. Spoiler and privacy invariants

Numbered so they can be cited. These go in the ADR verbatim and the ones marked
**(guarded)** get a mechanical check.

- **P1. No preference value may be derived from, or encode, game state.** The
  preferences document holds identity and device behaviour. A field whose value
  depends on what happened in a ballpark does not belong in it and never will.
- **P2. `bbsbh:scoresUnlocked` never syncs.** The pass is an ephemeral,
  device-local render override (ADR-0026). Mirroring the expiry would unseal a
  second device on which the user never consented — the single worst thing this
  program could do. Only the per-day **consent record** syncs, on its own
  endpoint, unchanged.
- **P3. Scores Unlocked stays explicit, day-specific consent.** `/profile` may
  list the days already consented to (a date is not a score) and may offer the
  same-day withdrawal the switch already offers. It may **not** offer a
  persistent "always show scores" setting, a default-on preference, or anything
  that pre-consents a future day. Forbidden by name.
- **P4. (guarded)** No My Tally surface imports `GameStamp.jsx` or
  `StampGameButton.jsx`. `src/screens/profile/` and `src/components/profile/` are
  added to `scripts/check-stamp-surfaces.mjs`'s **forbidden** list, not its
  allowlist — the same treatment the slate and game cards get. ADR-0035's
  containment argument is the whole spoiler argument for the Logbook and this
  program must not widen it.
- **P5. No marketing visual states or implies a score.** §6.4 element 4 is the
  sharp edge; it is hand-drawn art with no game as input.
- **P6. (guarded)** `/profile` renders no game data. No feed fetch, no
  `src/api/*` game module import, no linescore, no stamp facts. An e2e invariant
  spec asserts the rendered DOM carries no score-shaped token.
- **P7. Private by construction.** No public profile route, no user-data OG card.
  `/profile` gets **no** entry in `api/_lib/cards.js` — it falls through to the
  static default card, exactly as ADR-0012 specifies for anything without a
  dynamic card. A user's display name, email, club, or counts never leave an
  authenticated response.
- **P8.** `api/preferences.js` and `api/account.js` reply
  `cache-control: private, no-store`, always. Per-user auth-gated data must never
  reach a shared cache.
- **P9.** A user id in a Redis key is only ever the **verified `sub` claim**,
  never a client-supplied id. `DELETE /api/account` deletes only that user's keys
  and never `game:final:{gamePk}`, which belongs to nobody.
- **P10.** The merge receipt reports counts of the user's own things. Never a
  matchup, never a date's outcome, never a number that came from a game.

---

## 8. Implementation phases

One PR, one eventual `main` deployment (root `CLAUDE.md`: batch related changes,
reduce deployment-triggering merges ruthlessly). The phases below are commits on
`claude/my-tally-account-experience`, not separate PRs.

### Phase 1 — specification (this document)

`.scratch/account-profile-experience/PRD.md`, `HANDOFF.md`. No product code.

### Phase 2 — sync foundation

| File | Action |
|---|---|
| `src/lib/account/preferences.js` | **new** — the pure registry, validators, `applyRemotePreferences`, `preferencesToPublish` |
| `src/lib/account/syncStatus.js` | **new** — the pure status reducer |
| `src/lib/account/syncClaims.js` | **new** — `SYNCED_ITEMS`, the claims ledger |
| `src/hooks/preferences/usePreferences.js` | **new** — the React store; cross-tab `storage` listener **and** a same-tab echo that reads *from inside its own updater* (the ADR-0026/ADR-0036 defect — do not write it the other way) |
| `src/hooks/useFavoriteTeam.js` | **move** → `src/hooks/preferences/useFavoriteTeam.js`, rewritten as a thin wrapper over `usePreferences` |
| `src/hooks/useKeepAwakePreference.js` | **move** → `src/hooks/preferences/useKeepAwakePreference.js`, same |
| `src/components/sync/PreferencesCloudSync.jsx` | **new** — modelled on `SpoiledDaysCloudSync`; remote baseline, publish-what-the-server-lacks |
| `src/components/sync/SyncStatusProvider.jsx` | **new** |
| `src/components/sync/{Reveal,SpoiledDays,Stamps}CloudSync.jsx` | **edit** — report into the status context from the existing `catch` blocks; no behaviour change |
| `api/preferences.js` | **new** |
| `api/account.js` | **new** |
| `api/reveal.js` | **edit** — `SADD reveal:index:{userId}` alongside the ratchet |
| `scripts/check-dir-size.mjs` | **edit** — `src/hooks` 21 → 19 (downward, as the guard asks). `src/lib` needs **no** edit: the four new modules go in `src/lib/account/`. `src/styles` 51 → 52 lands in phase 3 with the new partial |
| `test/preferences.test.js`, `test/sync-status.test.js`, `test/sync-claims.test.js` | **new** |
| `test/api-handlers.test.js` | **edit** — the two new handlers, driven with the real Node shape |

**Test-first, per root `CLAUDE.md`:** the merge-rule tests are written and watched
to fail before `applyRemotePreferences` exists.

### Phase 3 — the My Tally page

`src/lib/route.js` · `test/route.test.js` · `src/App.jsx` ·
`src/screens/profile/**` · `src/components/profile/**` ·
`src/styles/52-my-tally.css` · `src/index.css` · `src/lib/reportPages.js` ·
`src/components/chrome/SiteFooter.jsx` ·
`src/components/account/AccountButton.jsx` ·
`scripts/check-stamp-surfaces.mjs` (forbidden-list entries).

### Phase 4 — onboarding and prompts

`src/components/account/FavoriteTeamModal.jsx` (two steps) ·
`src/components/account/AccountPitch.jsx` (restated against the claims ledger) ·
`src/lib/account/prompts.js` + its test (**new**, the one-shot store) ·
`src/screens/GameSelect.jsx` (prompt 3 slot, `bbsbh:intro`) ·
`src/screens/LogbookPage.jsx` (prompt 2 in the tray).

### Phase 5 — integration, docs, verification, PR

`docs/adr/0039-my-tally-preferences-document.md` (**new**) · root `CLAUDE.md`
(architecture map: the fifth exception, one line) · `src/CLAUDE.md` (the profile
screen + the sync-status context) · `src/api/CLAUDE.md` (only if a reader module
lands there) · `docs/development.md` (no new env vars — say so explicitly) ·
`e2e/my-tally.spec.js`, `e2e/intro-two-step.spec.js`,
`e2e/invariants/profile-no-scores.spec.js` (**new**) · full `npm run lint`,
`npm test`, `npm run build`, `npm run e2e` · dev server + the clickable
`/profile?nointro` URL · one PR.

### 8.1 Likely overlap with concurrent work

Checked against every local branch as of `origin/main` @ `70de897`. Most branches
are squash-merged leftovers whose content is already in `main`
(`codex/game-log-logged-out`, `claude/split-components`,
`claude/home-header-restyle`, `claude/spoiled-days-backfill`,
`claude/relax-stamp-gate` all verified present in `main`). No PRs are open.

| Branch | Files also touched | Assessment |
|---|---|---|
| `codex/score-unlocked-card-lab` (**genuinely unmerged** — `src/screens/GameCardLab.jsx` is absent from `main`) | `src/App.jsx`, `src/lib/route.js`, `test/route.test.js`, `src/index.css` | **Soft conflict.** Both add a single-segment route + an `App.jsx` branch + an `index.css` `@import`. Textually adjacent, semantically independent; whichever lands second resolves three small hunks. Proceed. |
| `claude/asof-opt-in` | `src/lib/route.js`, `test/route.test.js` | Content appears present in `main` (ADR-0034's "cutoff is opt-in now" is documented there). Same soft conflict shape if not. |
| `claude/similar-players-layout`, `codex/logo-lockup-lab`, `codex/team-score-grade-copy-font`, `claude/team-transactions-design`, `jerseydeck-fill-width`, `game-notes-ari-calibration` | `src/index.css` | The `@import` list only. One-line conflicts at most. |

Nothing is a hard conflict. The one file to re-check immediately before opening
the PR is `src/index.css`'s `@import` ordering.

---

## 9. Testing and visual verification

### 9.1 Unit (`npm test` — CI-gated, the honest half)

| Spec | Pins |
|---|---|
| `test/preferences.test.js` | field registry is closed; every validator's accept/reject set; per-field LWW incl. the `>=` tie rule; absence ≠ erase; unknown keys dropped both directions; `updatedAt: 0` migration seed always loses; clock-skew clamp; `preferencesToPublish` backfills a pre-sign-in document against a remote baseline |
| `test/sync-status.test.js` | the reducer; the rollup is the worst channel; `unavailable` (501) is not `error` |
| `test/sync-claims.test.js` | every `SYNCED_ITEMS` entry names a real module; the four non-claimable items are absent while their flag is false |
| `test/route.test.js` | `/profile` parses; no collision with `/photos`/`/postseason-*`/`/prospects`; unknown `/profile/x` degrades rather than throwing |
| `test/api-handlers.test.js` | `preferences` GET/POST and `account` DELETE against the **Node** `(req, res)` shape; 501-before-401 ordering; `private, no-store`; a body naming an unknown field stores nothing; a POST cannot write another user's key; `DELETE /api/account` never touches `game:final:*` |
| `test/prompts.test.js` | one-shot semantics; the bounded map; a dismissal never re-fires |

### 9.2 Guards (`npm run lint`)

- `check-stamp-surfaces.mjs` — the two profile directories on the **forbidden**
  list. Verify by exit code, never by grepping output (guards fail with `✗`,
  eslint with `✖` — the mistake that reported green through three red commits).
- `check-dir-size.mjs` / `check-file-size.mjs` — budgets edited downward where the
  moves allow, upward only with the justification recorded in §8 and the PR body.
- `check-report-pages.mjs`, `check-caps.mjs`, `check-name-casing.mjs`,
  `check-typography.mjs`, `check-focus-ring.mjs`, `check-contrast.mjs`,
  `check-claude-md.mjs` — all apply unchanged to the new partial and components.

### 9.3 Browser (`npm run e2e` — not CI-gated, still required by root `CLAUDE.md`)

| Spec | Asserts |
|---|---|
| `e2e/my-tally.spec.js` | `/profile?nointro` renders signed out; the scope line reads **"This device."**; changing the club persists across reload and repaints the header avatar; the account section is absent when Clerk is unconfigured |
| `e2e/intro-two-step.spec.js` | cleared storage → step 1 → `Next` → step 2 → `Not now` closes and the club is persisted; dismissing at step 1 also persists; `?nointro` suppresses both |
| `e2e/invariants/profile-no-scores.spec.js` | **P4/P6.** `/profile` DOM contains no `.gamestamp`, no stamp SVG from `GameStamp`, and no score-shaped token; no request to `statsapi.mlb.com` is issued while the page is open |

Signed-in paths cannot be exercised without a Clerk-configured deploy — the same
gap ADR-0026 records for `SpoiledDaysCloudSync`. Record it as a known gap in the
ADR, and hand the maintainer an explicit "watch the first real sign-in" note plus
the curl probes (`501` vs `401`) in the handoff rather than pretending coverage.

### 9.4 Visual verification

Start the first free reserved dev port (`npm run dev`, else `dev:2`…`dev:5`),
keep it running, and verify:

- `http://localhost:PORT/profile?nointro` — the page, both scope states
- `http://localhost:PORT/?nointro` — the slate entry points unchanged
- `http://localhost:PORT/` with `localStorage` cleared — the two-step intro
- `http://localhost:PORT/logbook?nointro` — prompt 2's tray placement

Per the maintainer's standing preference, hand over the clickable link and what
to look at rather than self-verifying by screenshot. For the seal art and the
handoff illustration specifically, an enlarged frame strip is the technique that
catches geometry bugs invisible at phone size.

---

## 10. Open threads (recorded, not deferred silently)

1. **The Clerk `user.deleted` webhook** (§4.5). Until it exists, deleting a Clerk
   account without erasing first leaves unreachable-but-unerased keys. The copy
   states the ordering; the ADR records the gap.
2. **`reveal:index:{userId}` growth.** A heavy user across many seasons. Cap and
   prune, or accept a documented bound — decide in phase 2 with the number in
   front of you.
3. **The "Game log" name collision** (docs/game-log.md §2) is untouched by this
   program and stays open. My Tally must not make it worse: the profile's ledger
   row says **Game Log** and links to `/logbook`, never "your game log" as a
   generic phrase.
4. **A per-channel "sync now" action** was considered and cut. Every channel
   re-pulls on focus already; a button that usually does nothing teaches the user
   that the feature is unreliable.

---

## 11. Phase 2, as built

Phase 2 (the preference and sync foundation) is complete: `npm run lint`,
`npm test` and `npm run build` all pass, and the migration/persistence path is
verified in a real browser against the production build (§11.5).

### 11.1 Deliberate departures from §§2–5

Recorded rather than silently absorbed, the way `.scratch/game-stamps/PRD.md`
keeps its own list.

1. **`level` is a sportId integer, not a string enum.** See the note under §3.1.
2. **`club` is bounds-validated, not membership-validated.** Same note. The
   server has no business knowing the club roster.
3. **`updatedAt` is non-negative, not positive.** Zero is the migration seed and
   carries meaning ("held, with no clock").
4. **A fifth module landed: `src/lib/account/preferencesStorage.js`.** The draft
   put localStorage I/O inside the hook. It moved out so **private mode is a
   tested path rather than an assumed one** — reading `window.localStorage` at
   all can throw, not just calling it, and a hook's try/catch is unreachable
   from `node:test`. Twelve cases now pin it.
5. **The shared-device owner tag (`bbsbh:prefsOwner`) is new**, and it closes a
   leak the draft did not name: user A signs in on a shared device, their club
   syncs down into localStorage with a real clock, A signs out, B signs in — and
   `preferencesToPublish` would push A's club into B's account. See §11.3.
6. **No Lua for the server-side write.** `api/reveal.js` closes its
   read-modify-write race with a Lua ratchet; this endpoint does the
   last-write-wins compare in JS and accepts a millisecond-wide race, because it
   **self-heals**: the POST answers with the stored document, the client merges
   it, and any device still holding a newer value republishes on its next
   comparison. A cjson round trip to close a gap that closes itself is not worth
   the untestable surface.
7. **`reveal:index:{userId}` is unbounded**, against §10.2's open question. A cap
   would make the erase silently incomplete for whatever fell off it, which
   defeats the only reason the index exists. It is a set of integers bounded by
   how many games a human actually opens. Open thread closed, deliberately, in
   the direction of completeness.
8. **ADR-0039 is deferred to phase 5**, so nothing cites an ADR that does not
   exist yet. The root `CLAUDE.md` architecture map and `src/api/CLAUDE.md` carry
   the exception now; the ADR gets written with the rest of the docs.

### 11.2 Files, as landed

**New — the pure rules (`src/lib/account/`, no React, no dependencies):**

| File | What it owns |
|---|---|
| `preferences.js` | the closed field registry, validators, normalize/parse/serialize, `setPreference`, `seedFromLegacy`, `applyRemotePreferences`, `adoptRemotePreferences`, `preferencesToPublish`, `mergeStrategyFor`, `clampUpdatedAt`, `samePreferences` |
| `preferencesStorage.js` | every localStorage access, each individually guarded |
| `syncStatus.js` | `initialSyncState`, `reduceSync`, `rollupSync`, `lastSyncedAt`, `phaseForResponse`, `reasonForResponse`, `isRecoverable` |
| `syncClaims.js` | `SYNCED_ITEMS`, `NEVER_SYNCED`, `claimsForChannel` |

**New — the React seam:**

| File | What it owns |
|---|---|
| `src/hooks/preferences/usePreferences.js` | the store: cross-tab `storage` listener + same-tab echo, both reading from **inside** the state updater |
| `src/hooks/preferences/useFavoriteTeam.js` | moved; now a thin wrapper, call-site shape unchanged |
| `src/hooks/preferences/useKeepAwakePreference.js` | moved; ditto |
| `src/components/sync/SyncStatusProvider.jsx` | external store (`useSyncExternalStore`), `useSyncReport` / `useSyncStatusState` |
| `src/components/sync/PreferencesCloudSync.jsx` | headless, Clerk-gated, lazy — pull, merge-or-adopt, publish |

**New — the endpoints:**

| File | What it owns |
|---|---|
| `api/preferences.js` | `GET` / `POST {field,value,updatedAt}`; exports `handleRequest`, `entryToStore`, `sanitizeStored` for the suite |
| `api/account.js` | `DELETE`; exports `erase`, `keysForUser` |

**Edited:** `api/reveal.js` (the `reveal:index:{userId}` SADD) · `src/App.jsx`
(`SyncStatusProvider` wraps the tree, `PreferencesCloudSync` mounts beside its
two siblings) · `src/screens/GameSelect.jsx` (the level toggle reads and writes
the document instead of `bbsbh:level`) · nine import-path updates for the moved
hooks · `scripts/check-dir-size.mjs` (`src/hooks` 21 → **19**, tightened) ·
`scripts/check-dead-exports.mjs` (one allowlist entry, see §11.6) · root
`CLAUDE.md` (the map now says five exceptions) · `src/api/CLAUDE.md` (the detail
tier).

**Deleted:** `src/hooks/useFavoriteTeam.js`, `src/hooks/useKeepAwakePreference.js`.

### 11.3 Sign-out and account switching, exactly

`bbsbh:prefsOwner` records which account's remote document was last merged into
the local one. `mergeStrategyFor(owner, userId)` reads it:

| Owner tag | Signing in as | Strategy | Effect |
|---|---|---|---|
| absent (a guest's own settings) | `user_a` | `backfill` | merge remote in, publish what the server lacks — **this is the guest-to-account merge** |
| `user_a` | `user_a` | `backfill` | ordinary resume |
| `user_a` | `user_b` | **`adopt`** | take the remote wholesale, publish **nothing** — A's club cannot reach B's account |
| anything | signed out | `none` | no remote to reconcile against |

Two things it deliberately does **not** do:

- **Sign-out does not clear the document.** Local-first means the device keeps
  working with what it has, and a signed-out user is still a user. The owner tag
  is what protects the next account, not an erase.
- **An unreadable owner tag falls back to `backfill`**, the safe direction —
  backfill only ever publishes what this device already holds, whereas guessing
  `adopt` would silently discard a guest's own settings on every sign-in.

The in-memory baseline (`known`) is dropped on sign-out as well, so the next
sign-in can never publish against the previous account's baseline. Same guard
the other two sync components already have.

### 11.4 The exact interface phase 3 consumes

Everything the My Tally page needs already exists. **Phase 3 should add no new
data plumbing.**

```js
// The preference document — read and write.
import { usePreferences } from '../hooks/preferences/usePreferences.js'
const {
  prefs,        // the raw document, for a diagnostic view; sections should not need it
  has,          // (field) => boolean — false means "never answered", NOT "answered with the default"
  set,          // (field, value) => void — validates, stamps Date.now(), persists, echoes
  club, level, keepAwake, motion,   // resolved values, fallback applied
} = usePreferences()

// The field vocabulary, so the page's controls cannot drift from the registry.
import { FIELDS, FIELD_NAMES, LEVEL_SPORT_IDS, MOTION_MODES, isValidValue }
  from '../lib/account/preferences.js'

// Sync state, for the receipt.
import { useSyncStatusState } from '../components/sync/SyncStatusProvider.jsx'
import { rollupSync, lastSyncedAt, isRecoverable } from '../lib/account/syncStatus.js'
const status = useSyncStatusState()
//   status[channel] = { phase, at, syncedAt, reason }
//   phase  : 'off' | 'local' | 'pulling' | 'synced' | 'unavailable' | 'error'
//   channel: 'reveal' | 'spoiledDays' | 'stamps' | 'prefs'
rollupSync(status)     // the page-level word — the WORST channel
lastSyncedAt(status)   // newest success across all channels, or null

// What the copy is allowed to claim.
import { SYNCED_ITEMS, NEVER_SYNCED } from '../lib/account/syncClaims.js'
// Render the receipt FROM SYNCED_ITEMS. Do not hand-write the four rows.
```

Mapping to §1.1's state matrix:

| Page state | How to detect it |
|---|---|
| Clerk unconfigured | `rollupSync(status) === 'off'`, or `isClerkEnabled` directly |
| Signed out ("This device.") | `rollupSync(status) === 'local'` |
| Signed in, syncing | `'pulling'` |
| Signed in, healthy | `'synced'` + `lastSyncedAt` for the relative time |
| Signed in, no store on this deploy (§1.3) | `'unavailable'` — say "not available on this deployment", **not** an error |
| Signed in, real fault | `'error'`, `isRecoverable(...) === true` |

Two things phase 3 still has to build, which are **not** in phase 2:

- **`DELETE /api/account` has no caller yet.** The endpoint and its tests exist;
  `EraseDataDialog.jsx` is phase 3's, and it must also clear this device's local
  keys, since the endpoint only erases the server side.
- **The merge receipt (§5.3)** has no trigger yet. `PreferencesCloudSync`
  reports `synced`; the "all configured channels have completed a first pull"
  condition is a phase-3 read over `useSyncStatusState()`.

### 11.5 Validation run

| Check | Result |
|---|---|
| `node --test` on the five new test files | **92 pass, 0 fail** |
| `npm test` (full CI-gated suite) | **exit 0** |
| `npm run lint` (eslint + all guards) | **exit 0** — verified by exit code, not by grep |
| `npm run build` | **exit 0**, built clean |
| Browser, against the production build on `:4172` | see below |

The browser check drove the built app, not the dev server, and confirmed the
four things unit tests cannot:

1. A visitor arriving with only the three legacy keys migrates to
   `{"club":{"value":147,"updatedAt":0},"level":{"value":11,"updatedAt":0},"keepAwake":{"value":true,"updatedAt":0}}`
   — seeded at clock 0, exactly as designed.
2. The legacy keys are **still present** afterwards (rollback safety).
3. Tapping the slate's AA toggle writes `level: {value: 12, updatedAt: <real clock>}`
   and leaves the seeded fields at 0.
4. It survives a reload, and a cleared profile still gets the first-visit intro
   (so `isFirstVisit` did not regress when it stopped keying on a bare key's
   presence).

No page errors. The only 404s are `/_vercel/insights/*`, which exist solely on a
real Vercel deploy and are pre-existing.

### 11.6 Two guard entries this phase added, and when to remove them

- `scripts/check-dead-exports.mjs` — `useSyncStatusState` is allowlisted, because
  the reading half of the sync seam landed with its four reporters, one phase
  ahead of the surface that renders it. **Delete that entry when
  `SyncReceipt.jsx` lands in phase 3.**
- `scripts/check-dir-size.mjs` — `src/hooks` tightened 21 → 19. Phase 3 must not
  loosen it; `src/screens/profile/` and `src/components/profile/` are why the
  page's parts go in subdirectories.

---

## 12. Phase 3, as built

Phase 3 (the My Tally page itself) is complete: `npm run lint`, `npm test`,
`npm run build` and the full `npm run e2e` suite all pass, and the page is
verified in a real browser at 320px, 390px and 1280px (§12.6).

### 12.1 Deliberate departures from §§4–6

Recorded rather than silently absorbed, the way §11.1 does for phase 2.

1. **The reusable club picker is `src/components/account/ClubPicker.jsx`, not a
   part of `ClubSection.jsx`.** §4.3 said "the favourite-team strip itself moves
   into `ClubSection.jsx` and is shared with the intro's step 1" — but that puts
   a component `src/components/account/FavoriteTeamModal.jsx` needs inside
   `src/screens/`, inverting the dependency direction every other shared piece
   in this app follows. It lives in `components/account/` instead, and **both**
   hosts render it today (the modal was refactored onto it in this phase), so
   there is exactly one club strip. Phase 4 imports it as-is — see HANDOFF.md
   for the props.
2. **`ClubPicker` takes `teams` as a PROP and fetches nothing.** Its two hosts
   want different sources and that is not an accident: `/profile` reads the
   same-origin static club file (`fetchStaticTeams`, `src/api/teams-static.js`),
   because a page whose whole promise is "no game data" should issue no request
   to statsapi at all — which is also the thing
   `e2e/invariants/profile-no-scores.spec.js` can actually assert. The intro
   modal keeps its existing live-with-static-fallback loader
   (`fetchTeams(SPORT_IDS.MLB)`), so nothing about first-visit behaviour changed.
3. **The stylesheet is TWO partials, `52-my-tally.css` and
   `53-my-tally-account.css`.** §6.4 planned one. One file came to 751 lines and
   `check-file-size.mjs` refused it at 600 — correctly. Split by subject, not by
   size: 52 is the page a signed-out visitor sees in full, 53 is the part that
   only means anything once an account exists. `src/styles` budget 51 → 53.
4. **`check-stamp-surfaces.mjs` gained a forbidden-DIRECTORY list with a
   NARROWER identifier set**, rather than two more entries in
   `FORBIDDEN_SURFACES`. Two reasons. A directory covers every file added later
   without anyone remembering to name it. And the existing list forbids
   `useStamps` as well as the art — which My Tally legitimately needs, because it
   COUNTS your collection ("14 stamps in your Game Log") and offers to export it.
   A count is not a score, and a local stamp record has never held one
   (ADR-0035: the Logbook resolves facts at render time). So the profile
   directories forbid `GameStamp` and `StampGameButton` only, and §7's P4 —
   which names exactly those two — is satisfied literally.
5. **The three remaining sync reporters were wired in phase 3, not phase 2.**
   §8's phase-2 table lists `{Reveal,SpoiledDays,Stamps}CloudSync.jsx` as
   "report into the status context from the existing `catch` blocks"; only
   `PreferencesCloudSync` actually shipped one. Without the other three the
   receipt would have rendered four rows of "on this device" to a signed-in
   user — a lie, from the exact seam built to stop the app lying about sync. No
   behaviour change: every catch block stays where it was and still swallows.
6. **`MergeReceipt` renders on `/profile` only.** §5.3 also wanted a one-line
   strip on the slate when the sign-in happened elsewhere. The card is built and
   triggered; the slate strip is deferred (it is a `GameSelect` edit, and phase 4
   is already opening that file for prompt 3). See HANDOFF.md.
7. **The page-level scope word comes from the `prefs` channel, not from
   `rollupSync` over all four.** §11.4's mapping table assumed every channel
   reports. `RevealCloudSync` mounts inside `InningViewer`, so on `/profile` the
   `reveal` channel has never spoken and is still sitting on
   `initialSyncState`'s opening phase — which `rollupSync` (worst channel wins)
   would turn into "This device." for a signed-in user. `ProfilePage`'s
   `normalizeStatus` gives a channel that has never reported (`at == null`, since
   `report()` always stamps a clock) the account's own phase, and its PHASE only,
   never a `syncedAt` — so nothing claims a "last checked" it never had. Read
   that function's header before touching the receipt.
8. **The Scores Unlocked row offers the same-day withdrawal** ("Re-seal today"),
   which §7's P3 explicitly permits. It offers nothing else: no standing
   opt-out, no default-on, nothing that pre-consents a future day. The e2e spec
   asserts that absence as well as the presence.

### 12.2 Files, as landed

**New — the page:**

| File | What it owns |
|---|---|
| `src/screens/profile/ProfilePage.jsx` | the shell, the masthead, `normalizeStatus`, and every hook read the sections need |
| `src/screens/profile/sections/ClubSection.jsx` | Baseball — club + level |
| `src/screens/profile/sections/DeviceSection.jsx` | Scorebook experience — Keep Awake, motion, the Scores Unlocked report |
| `src/screens/profile/sections/LedgerSection.jsx` | the progress ledger + the Game Log door |
| `src/screens/profile/sections/DataSection.jsx` | Sync & data — the receipt, export, clear recent searches, erase this device |

**New — the components:**

| File | What it owns |
|---|---|
| `src/components/profile/ProfileAccount.jsx` | the ONLY file here that touches Clerk; loading / signed-out / signed-in, `UserProfile routing="virtual"`, the `DELETE /api/account` caller |
| `src/components/profile/ClubSeal.jsx` | the club-seal roundel (identity art, mono knockout — ADR-0031) |
| `src/components/profile/DeviceHandoff.jsx` | the score-free handoff illustration |
| `src/components/profile/SyncReceipt.jsx` | the carbon-copy slip, rendered from `SYNCED_ITEMS` |
| `src/components/profile/ScopeBadge.jsx` | "This device." / "Every device you sign in on." |
| `src/components/profile/MergeReceipt.jsx` | the one-shot post-sign-in card (`bbsbh:mergeReceipt:{userId}`) |
| `src/components/profile/EraseDataDialog.jsx` | the confirm sheet for both deletion scopes |
| `src/components/account/ClubPicker.jsx` | the one club strip, shared with the intro modal |

**New — the rules, the styles, the tests:**

| File | What it owns |
|---|---|
| `src/lib/account/localData.js` | `tallyKeysIn`, `countGamesInProgress`, `clearTallyDataIn`, `buildGameLogExport`, `gameLogFilename` |
| `src/styles/52-my-tally.css` | the page |
| `src/styles/53-my-tally-account.css` | the account half |
| `test/local-data.test.js` | 11 cases |
| `e2e/my-tally.spec.js` | 8 cases × 3 viewports |
| `e2e/invariants/profile-no-scores.spec.js` | P4/P6 at runtime |

**Edited:** `src/lib/route.js` (+`profilePath`) · `test/route.test.js` (4 cases) ·
`src/App.jsx` (the lazy route) · `src/lib/reportPages.js` (My Tally leads the
personal group) · `src/components/chrome/SiteFooter.jsx` (Settings navigates;
the modal and its two props are gone) · `src/screens/GameSelect.jsx` (drops the
two now-unused footer props) · `src/components/account/AccountButton.jsx` (the
`UserButton.MenuItems` composition) · `src/components/account/FavoriteTeamModal.jsx`
(renders `ClubPicker`) · `src/lib/clerkAppearance.js` (`UserProfile` element
slots + the `manageAccount` relabel) ·
`src/components/sync/{Reveal,SpoiledDays,Stamps}CloudSync.jsx` (the reporters) ·
`src/index.css` (two `@import`s) · `scripts/check-stamp-surfaces.mjs` (the
forbidden directories) · `scripts/check-dir-size.mjs` (`src/styles` 51 → 53) ·
`scripts/check-dead-exports.mjs` (the `useSyncStatusState` entry is gone, as
§11.6 instructed).

### 12.3 The information architecture, as shipped

One page, six blocks, in this order:

1. **Masthead** — club seal, `My Tally`, *Profile & settings.*, the club name,
   the scope badge. The crest is the account identity, matching the header's
   `UserButton` overlay, which is untouched.
2. **Baseball** — the club picker, the level the slate opens on.
3. **Scorebook experience** — Keep Awake, motion, and the Scores Unlocked
   report (status + the same-day withdrawal only).
4. **Your ledger** — games in your pencil, stamps in your Game Log, days you
   unsealed, and the door to `/logbook`.
5. **Sync & data** — the receipt, the last-carried line, Export your Game Log,
   Clear recent searches, Erase this device.
6. **Account** — absent when Clerk is unconfigured; the benefit panel + handoff
   illustration when signed out; identity, merge receipt, Account & security
   (Clerk's `UserProfile`), Sign out and Erase everywhere when signed in.

### 12.4 The `UserButton` menu

`My Tally` → `/profile`, `Game Log` → `/logbook`, then Clerk's own
`manageAccount` and `signOut` actions, declared explicitly so the custom links
are not simply appended after the defaults. `manageAccount` is relabelled to
**Account & security** through `clerkLocalization`, so the menu and My Tally's
own disclosure name the same screen the same way. Navigation is a browser
navigation, not our History-API router — no Clerk router integration is
configured — which is fine, because `vercel.json` rewrites every path to
`index.html`.

### 12.5 What is deliberately NOT here

- **No `/profile` OG card.** Invariant P7: nothing is added to
  `api/_lib/cards.js`, so a shared link falls through to the static default card
  exactly as ADR-0012 specifies.
- **No new preference field, endpoint, or merge rule.** Phase 3 consumed §11.4's
  interface verbatim and added no data plumbing.
- **No "always show scores" control**, in any form. P3.

### 12.6 Validation run

| Check | Result |
|---|---|
| `node --test test/local-data.test.js` | **11 pass, 0 fail** |
| `npm test` (full CI-gated suite) | **exit 0** |
| `npm run lint` (eslint + all 12 guards) | **exit 0** — verified by exit code, not by grep |
| `npm run build` | **exit 0** |
| `E2E_PORT=4170 npx playwright test` (whole suite) | **122 passed, 1 skipped, 0 failed** |
| Browser, production build on `:4170`, 320 / 390 / 1280px | no layout shift, no overflow, no console error |

The browser pass confirmed the four things unit tests cannot: the club seal's
mono knockout reads on the navy disc at every width; the masthead stacks below
360px rather than crushing the club name against the seal; the erase sheet
focuses "Keep my data" first; and `/profile` issues **zero** requests to
`statsapi.mlb.com` for its whole lifetime.

**Signed-in paths remain unverifiable locally** — no `VITE_CLERK_PUBLISHABLE_KEY`
on this machine, the same gap ADR-0026 records. See HANDOFF.md's open threads for
the curl probes and exactly what to watch on the first real sign-in.
