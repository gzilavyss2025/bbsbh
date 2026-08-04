# Game stamps — backend scoping

Status: needs-triage

Scope of this document: **backend infrastructure only.** Stamp visual design is
being scoped separately; UI surfacing (where the grid lives, how the button
looks) is deliberately out of scope beyond the seams the backend has to expose.

## The feature in one paragraph

Once you reveal a game's box score, you may **stamp** the game — a one-color
300×300 commemorative mark carrying the final score, the two clubs, the date and
the venue. Stamps accumulate in a per-account collection, and that collection
becomes the input to a per-user retrospective in the same spirit as the unlisted
`/first-scorebook` page: what clubs you saw, your record watching them, who
raked and who got knocked around in the games *you personally sat through*.

## Naming (not "passport")

Working name: **Logbook**. The collection is your Logbook, the verb is "stamp"
("stamp this game"), the object is "a stamp", and the count is "42 stamps".

Alternates, ranked:

| Name | For | Against |
|---|---|---|
| **Logbook** (recommended) | "Log a game" is natural; the noun already means a chronological record kept by hand; nothing in the codebase owns it | Another "-book" alongside Scorebook |
| **Stub Book** | A ticket stub is exactly the keepsake being modeled; distinct from Scorebook | A stub isn't a stamp; slight metaphor clash with the rubber-stamp art |
| **Cancellations** | The real term for a national-park passport stamp — the knowing choice | Obscure; "cancel" reads wrong in a UI |
| **The Rack** | Short, evocative of a scorer's card rack | Too oblique |

Avoid: **Scorebook** (taken twice — `scorebook:{userId}` in Redis, and the
`/first-scorebook` page), **Passport** (per the brief), **Mark** (`CONTEXT.md`
already uses "the reveal mark" for `revealedThrough`).

The rest of this doc says Logbook.

---

## 1. Where this sits in the "no backend" posture

This is the **fourth** opt-in exception, and the first one that stores
score-bearing data. It needs its own ADR. The honest framing:

- ADR-0012 — link previews (crawler-only, never a score)
- ADR-0022 — reveal sync (a half-index, never a score)
- ADR-0025 — admin copy (UI text, never a score)
- ADR-0026 — spoiled-days (consent, never a score)
- **NEW** — Logbook stamps (**a score, by design**)

A stamp is *definitionally* a score-bearing artifact — that is the whole point of
it. But it is only ever minted for a game the user has already unsealed, and the
design below makes that a **server-enforced invariant**, not a convention. That's
the argument the ADR turns on:

> You cannot own a stamp for a game you have not finished revealing. Therefore
> the Logbook, however many scores it renders, cannot spoil anything — every
> number on it is a number this user already chose to see.

That's structurally stronger than "we're careful about where we render it," and
it's the sentence the whole design should be built to make true. See §5.

Everything else stays as it is today: no Clerk key → no Logbook sync, no Upstash
→ the endpoint 501s, and the app is byte-for-byte what it was. Signed-out users
still get a Logbook — it just lives in `localStorage` on that device.

---

## 2. Stack — reuse, don't invent

Identical to `api/reveal.js` and `api/spoiled-days.js`, which is the point:

- **Vercel Node.js serverless function** (`export const config = { runtime: 'nodejs' }`)
  — not edge, for the same reason those two aren't: `@clerk/backend`'s
  `verifyToken` pulls in internals the edge sandbox rejects outright
  (`NOW_SANDBOX_WORKER_EDGE_FUNCTION_UNSUPPORTED_MODULES`).
- **Clerk** for identity, `verifyToken` on the `Authorization: Bearer` header,
  user key derived from the verified `sub` claim — never a client-supplied id.
- **Upstash Redis** for storage.
- `cache-control: private, no-store` on every response.
- Unconfigured → `501 { error: 'sync not configured' }`, client falls back to
  local-only.

No new vendors. No new runtime dependencies.

---

## 3. Data model

Three key families. The critical split: **user data holds consent and identity;
the score lives in a separate, shared, public-facts cache.** That separation is
what lets the ADR say the per-user record is no more sensitive than
`revealedThrough` is.

### 3.1 `stamps:{userId}:{season}` — HASH, field = `gamePk`

The user's own record. Sharded by season so the Logbook loads a season at a time
and never HGETALLs a decade.

```jsonc
{
  "state": "on",            // 'on' | 'off' — see the tombstone note below
  "mode": "watched",        // 'watched' | 'followed' | 'attended'
  "stampedAt": 1754300000000,
  "note": ""                // optional, user-authored, capped ~140 chars
}
```

**Why `state` and not deletion.** Same reasoning as ADR-0026's spoiled-day state
map, and worth reusing verbatim: a stamp is *removable*, so a naive union merge
across devices resurrects a stamp the user just took back — stamp on the phone,
sync, un-stamp on the phone, next fetch unions the stale `on` right back in. So a
removal is published as an explicit `'off'`, last write wins per gamePk. Safe for
the same reason it's safe there: a stamp only ever changes by a deliberate tap on
one of this user's own devices.

`mode` is a small addition worth taking now rather than bolting on: the brief
already distinguishes *watched* from *followed*, and adding *attended* (you were
at the ballpark) costs nothing at write time, unlocks a genuinely good stat
("you were there for 11 of them"), and gives the stamp art an axis to vary on
(a different glyph or a "GATE" overprint) without needing a second color.

### 3.2 `game:final:{gamePk}` — STRING (JSON), shared across all users, no TTL

Server-verified, frozen-at-Final game facts. Written once, by whoever stamps the
game first; every subsequent stamper hits cache. Immutable — a Final game's score
never changes.

```jsonc
{
  "gamePk": 824680, "date": "2026-05-18", "gameNumber": 1, "sportId": 1,
  "venue": "Wrigley Field", "innings": 9, "status": "Final",
  "away": { "id": 158, "abbreviation": "MIL", "name": "Brewers", "runs": 9, "hits": 13, "errors": 0 },
  "home": { "id": 112, "abbreviation": "CHC", "name": "Cubs",    "runs": 3, "hits": 7,  "errors": 0 },
  "winnerId": 158,
  "decisions": { "winner": "Shane Drohan", "loser": "Shota Imanaga", "save": "" }
}
```

**The server fetches this itself** — it does not trust a client-supplied score.
One `/api/v1/schedule?gamePk=…&hydrate=linescore,decisions,venue` call (~20 KB,
fast) on cache miss. Two payoffs beyond integrity: a client can't mint a
fabricated 20–0 stamp, and the server can *verify the game is actually Final*
before allowing the mint at all.

This blob is the exact set of fields the stamp SVG needs. Rendering a Logbook
page is `HGETALL stamps:{userId}:{season}` + one `MGET` of the referenced
`game:final:*` keys — two round trips regardless of collection size.

### 3.3 `digest:{gamePk}` — STRING (JSON), shared, long TTL

The richer per-game blob that powers the retrospective's *player-level* stats.
Filled in asynchronously (§6), absent until then. ~4–8 KB.

```jsonc
{
  "gamePk": 824680,
  "battingLines": [ { "playerId": 661388, "name": "…", "teamId": 158,
                      "ab": 4, "h": 3, "hr": 1, "rbi": 3, "bb": 1, "k": 0,
                      "points": 12.4 } ],
  "pitchingLines": [ { "playerId": 694819, "name": "…", "teamId": 158,
                       "outs": 21, "h": 2, "er": 0, "bb": 1, "k": 11,
                       "decision": "W", "gameScore": 84 } ],
  "topMoment": { "inning": 9, "half": "Bottom", "swing": 78.6, "description": "…" },
  "homePlateUmpire": { "id": 427108, "name": "…" },
  "lineupPlayerIds": { "away": [ … ], "home": [ … ] },
  "attendance": 38112, "durationMinutes": 168, "weather": "…"
}
```

`points` and `gameScore` come from the **existing** pure module
`src/api/performanceScore.js` (`contextNeutralPoints`, `gameScore`) — the same
one `scripts/gen-scorebook-retrospective.mjs` already uses. Do not write a
parallel scoring path.

### 3.4 Bounds

| Key | Cap | Why |
|---|---|---|
| `stamps:{userId}:{season}` | 500 fields | A full MLB season is 2,430 games; 500 is generous for any real human and bounds a hostile client. Reject the 501st with a clear error rather than silently pruning — unlike the scorebook index, a stamp is a *keepsake* and must never vanish on its own. |
| `note` | 140 chars, sanitized server-side | Same defensive posture as `sanitizeSnapshot` in `api/reveal.js` |
| `game:final:*`, `digest:*` | unbounded, but ~2,500/season | 2,500 × 8 KB ≈ 20 MB/season. Upstash free tier is 256 MB. Fine for years. |

`stamps:{userId}:seasons` — a small SET of seasons the user has stamps in, so the
Logbook's season nav is one cheap `SMEMBERS` instead of a key scan.

---

## 4. Endpoints

One new function: **`api/stamps.js`**.

```
GET    /api/stamps?season=2026
       -> { season, stamps: [ { gamePk, mode, stampedAt, note, game: {…3.2…} } ] }
       Joins the user hash against game:final:* server-side. 'off' entries are
       filtered out of the response but stay in the hash as tombstones.

GET    /api/stamps?seasons=1
       -> { seasons: [ { season: 2026, count: 41 }, … ] }
       Cheap nav payload.

POST   /api/stamps  { gamePk, mode, note? }
       -> { stamp: { … } }   201 on create, 200 on update
       Validates → resolves game:final → ENFORCES THE REVEAL GATE (§5) →
       HSET. Idempotent: re-stamping updates mode/note, keeps stampedAt.

DELETE /api/stamps?gamePk=824680
       -> { ok: true }
       HSET state:'off'. Reversible — a stamp is a collectible, not a spoiler
       mark, so deliberately NO ratchet. This is the one place the Logbook
       differs in character from revealedThrough.

GET    /api/stamps?digests=824680,823778,…    (cap ~60 per call)
       -> { digests: { "824680": {…3.3…} }, pending: [ … ] }
       Feeds the retrospective. Returns only what exists; `pending` names the
       games still being tallied so the page can say so instead of lying.
```

All `private, no-store`. All 401 without a valid Clerk token, 501 without Redis.

### Rejected alternatives

- **A server-side aggregate endpoint** that returns a computed retrospective.
  Rejected: it duplicates math that belongs in a pure, `npm test`-covered module
  in `src/api/`, and the site's whole precedent (`FirstScorebookPage` computing
  rotation/leaders in `useMemo` over static JSON) is to do this in the client.
- **Storing the score in the per-user record.** Rejected: it makes the user
  document score-bearing for no gain, and it means trusting the client's number.
  The `game:final` split gives integrity and dedupe for free.
- **A sorted set keyed by date instead of a hash.** Rejected: idempotent upsert
  and O(1) un-stamp both want a hash, and the season shard already gives ordering
  cheaply enough at these sizes.

---

## 5. The spoiler rule — where this feature could hurt us

The Logbook renders scores plainly. That is intended, but every path to it needs
to be closed deliberately.

### 5.1 The server-side reveal gate (the load-bearing one)

`POST /api/stamps` **refuses to mint** unless, for that user and that gamePk, at
least one of:

1. `reveal:{userId}:{gamePk}` ≥ `regulation × 2 − 1` — they revealed the whole
   game through the existing ratchet; or
2. the game's `date` is `'on'` in `spoiled:{userId}` — they consented to spoil
   that day under the Scores Unlocked pass (ADR-0026), which is exactly the case
   where a user legitimately saw the score without ratcheting the mark.

The two existing stores compose perfectly here, which is a good sign the model is
right. This is what makes "the Logbook cannot spoil" a *structural* claim.

**Known gap, accept it explicitly:** reveal sync is opt-in and only populated for
signed-in users, so a user who revealed a game before signing in has no server
mark. Mitigation: the client POSTs its local `revealedThrough` to `/api/reveal`
first (it feeds the existing ratchet anyway, which is one-directional and safe),
then mints. Do *not* weaken the gate to "trust the client".

### 5.2 Render-surface containment

- The "Stamp this game" button must live **inside the box-score `SealBox`'s
  reveal render function** (`src/screens/BoxScore.jsx:128`), not
  rendered-then-hidden. ADR-0002 gives this for free — it is the same guarantee,
  used again. Note that this `SealBox` currently has **no `onReveal`** and
  persists nothing; the stamp button is additive and must not change that.
- A stamp SVG must never render on the slate, on a game card, in "Pick up your
  pencil" (`ContinueScoring.jsx`), or in any list of *unrevealed* games.
- Propose a guard script — `scripts/check-stamp-surfaces.mjs`, wired into
  `npm run lint` — asserting `GameStamp.jsx` is imported only from an allowlist
  (`LogbookPage`, `LogbookStatsPage`, `BoxScore`). This repo already runs eight
  such guards; one more is cheap, and this is exactly the class of drift they
  exist to catch.
- **Link previews**: `/logbook` must not get an OG card that renders scores.
  Crawler-visible, and users share links. Fail safe to the static default card
  (`api/og.js` already has that path).
- **Service worker**: nothing new needed — `game:final` is served from
  `/api/stamps` on an authenticated, `no-store` route, not from statsapi, so the
  `NetworkOnly` rule of ADR-0004 is untouched.

### 5.3 Live games

Refuse to mint anything that isn't `Final`. A live game's score changes; a stamp
is a permanent artifact. Enforced server-side in §3.2's fetch.

---

## 6. The retrospective — "First Scorebook, but yours"

Deliver this in **two tiers**, because they have very different data costs and
the first tier is most of the value.

### Tier 1 — team-level, available instantly

Computed purely from `game:final` blobs the mint already stored. No new
infrastructure at all. Covers:

- clubs seen, and your **record watching each** (the `teamRecords` shape that
  already exists in `first-scorebook.json`)
- games, innings, total runs, runs/game
- one-run games, shutouts, extra-inning games, blowouts
- venues visited, home vs. road split
- your longest watched win streak / losing streak
- most-seen matchup, most-seen opponent
- watched / followed / attended breakdown (the `mode` field)
- winning and losing pitchers you saw most often (from `decisions`)

That is a genuinely complete page on its own. **Ship Tier 1 first.**

### Tier 2 — player-level, filled in asynchronously

Needs `digest:{gamePk}`, which needs the full `/api/v1.1/game/{gamePk}/feed/live`
(2–5 MB) plus win probability. Unlocks:

- who **raked** in games you watched, and who **struggled** — aggregated batting
  and pitching lines across your stamped games only
- best single performance you witnessed (`contextNeutralPoints` / `gameScore`)
- the biggest win-probability swing you sat through
- players you've seen most often
- umpires you've seen most often

**Who builds the digest.** Not the POST handler — a 2–5 MB feed fetch inside a
mint request is a bad trade on both latency and serverless memory. Instead:

1. Mint pushes the gamePk onto a Redis set `digest:pending`.
2. A **nightly GitHub Action** runs a new `scripts/gen-game-digests.mjs`, which
   drains `digest:pending` over the Upstash REST API, fetches each feed, computes
   the digest via `src/api/performanceScore.js`, writes `digest:{gamePk}`, and
   removes it from the pending set.

Why a GitHub Action and not a Vercel cron: this repo already runs a dozen nightly
`gen-*.mjs` generators that way (`scripts/CLAUDE.md`), the conventions and
secrets plumbing exist, and Vercel Hobby only allows two daily crons — worth
keeping those slots free. Cost: a game stamped at 11pm doesn't get its
player-level stats until morning. That's fine, and the page should say
"still being tallied" rather than render an incomplete number — the same
graceful-degradation convention the MiLB feeds already established.

New repo secrets required for the Action: `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`.

### Where the math lives

`src/api/logbookStats.js` — a **pure module**, no fetching, taking
`(stamps, gameFacts, digests)` and returning the digest the page renders. It is
**reveal-only by classification** (it handles scores), so it must obey ADR-0001:
callable only from the Logbook screens, never at render top-level elsewhere.
Being pure is what lets the interesting math — records, streaks, aggregation,
tiering — land in the CI-gated `npm test` suite, which is where the equivalent
`first-scorebook` math should have been all along.

---

## 7. Client wiring (the seams the backend has to serve)

Each of these has an existing file to mirror, which is the cheapest way to get
this right:

| New file | Mirrors | Role |
|---|---|---|
| `src/lib/stamps.js` | `src/lib/spoiledDays.js` | Pure: local store shape, validation, `applyRemoteStates` merge |
| `src/hooks/useStamps.js` | `src/hooks/useRevealProgress.js` | Local-first state, `localStorage` under `bbsbh:stamps`, cross-tab `storage` listener |
| `src/components/StampsCloudSync.jsx` | `src/components/RevealCloudSync.jsx` | Headless Clerk sync, GET-merge on mount, POST on change |
| `src/components/GameStamp.jsx` | — | Data → one-color SVG (design scoped separately) |
| `src/components/StampGameButton.jsx` | — | The mint affordance, **inside** the box-score seal |
| `src/screens/LogbookPage.jsx` | — | The grid |
| `src/screens/LogbookStatsPage.jsx` | `src/screens/FirstScorebookPage.jsx` | The retrospective |
| `src/api/logbookStats.js` | — | Pure aggregation, unit-tested |

Routes to add in `src/lib/route.js`: `/logbook`, `/logbook/{season}`,
`/logbook/stats`. Note `route.js`'s parse order is significant.

**Local-first is non-negotiable**, per the project's posture: a signed-out user
gets a working Logbook on their device; signing in merges it upward via the
`state` map in §3.1. Clerk stays optional.

---

## 8. Cost and scale

Upstash free tier: 500K commands/month, 256 MB.

- Mint: ~5 commands (reveal check, spoiled check, `game:final` get, HSET, SADD
  seasons) + at most one statsapi call on a cold game.
- Logbook page load: 3 commands (SMEMBERS, HGETALL, MGET).
- Retrospective load: +1 MGET.

For a solo project with a handful of users this is orders of magnitude under the
free tier. Storage grows ~20 MB/season of digests, shared across all users. No
concern for years.

The one real cost is the nightly Action's feed fetches: one 2–5 MB feed per
newly-stamped game per night. Bounded by how many games get stamped, which is
bounded by how many humans use this.

---

## 9. Build order

1. **ADR** — the fourth exception, and specifically the "you cannot own a stamp
   for a game you haven't revealed" invariant. Write it before the code; this is
   the decision that will get quietly eroded otherwise.
2. `api/stamps.js` + `src/lib/stamps.js` + the reveal gate. Unit-test the gate.
3. `useStamps` + `StampsCloudSync` + `StampGameButton` inside the box-score seal.
4. `GameStamp.jsx` from the chosen design.
5. `LogbookPage` — the grid. Ship here; the feature is useful with no stats.
6. `src/api/logbookStats.js` Tier 1 + `LogbookStatsPage`, with tests.
7. `scripts/gen-game-digests.mjs` + the nightly Action + Tier 2 stats.
8. `scripts/check-stamp-surfaces.mjs` guard.

Steps 1–5 are the feature. 6–8 are the payoff.

## 10. Open questions

- Naming: confirm **Logbook**, or pick from the table above.
- Should `attended` be in v1, or is watched/followed enough to start? (Cheap now,
  awkward to retrofit into stamp art later.)
- Does a stamp survive account deletion / is there an export? A keepsake
  collection with no export is a bad promise; a `GET /api/stamps?export=1`
  returning the full JSON is ~10 lines and worth doing at v1.
- Un-stamping: silent, or does the Logbook show a "removed" ghost? Tombstones
  make either possible; pick before the UI lands.
