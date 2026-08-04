# ADR-0035 — Logbook stamps are score-bearing, and gated by the reveal mark

Status: accepted (2026-08-04)

## Context

Once you have revealed a game's box score, you can **stamp** it: a one-color
commemorative mark carrying the final score, the two clubs, the date and the
venue. Stamps accumulate into your **Logbook**, and that collection is the input
to a per-user retrospective — what clubs you saw, your record watching them, who
raked in the games you personally sat through. The full scoping is
`.scratch/game-stamps/PRD.md`; the locked stamp art is
`.scratch/game-stamps/designs/` (PR #502).

This is the **fourth** opt-in backend exception, and it is different in kind from
the three that came before:

| | Stores |
|---|---|
| ADR-0012 — link previews | crawler-only cards, never a score |
| ADR-0022 — reveal sync | a half-index, never a score |
| ADR-0025 — admin copy | UI text, never a score |
| ADR-0026 — spoiled days | consent, never a score |
| **ADR-0035 — Logbook stamps** | **a score, by design** |

A stamp is *definitionally* score-bearing — a stamp with the score left off is
not the artifact. So "we never store a score" stops being available as the
argument, and something has to take its place.

## Decision

**A stamp can only be minted for a game this user has already finished
revealing, and that is enforced on the server.**

> You cannot own a stamp for a game you have not finished revealing. Therefore
> the Logbook, however many scores it renders, cannot spoil anything — every
> number on it is a number this user already chose to see.

That is structurally stronger than "we are careful about where we render it,"
and the whole design is built to make the sentence true rather than merely
likely.

`POST /api/stamps` refuses to mint unless, for this user and this gamePk, one of:

1. `reveal:{userId}:{gamePk}` has reached the game's **last half-index** — they
   uncovered the whole game by hand through the existing ratchet (ADR-0022); or
2. the game's date is `'on'` in `spoiled:{userId}` — they consented to spoil that
   day under the Scores Unlocked pass (ADR-0026), which is exactly the case where
   a user legitimately knows a final score while the reveal mark never moved,
   because the pass deliberately never writes it.

The two existing stores compose here without either being bent, which is the
best evidence available that the model is right. Do not add a third way in.

The predicate itself is `meetsRevealGate` in `src/lib/stamps.js` — pure,
dependency-free, and covered by `test/stamps.test.js`, so the invariant is
pinned by CI rather than by review.

### The last half-index, not `regulation × 2 − 1`

The gate uses the game's **actual** innings and whether the home club batted in
the last one (`finalHalfIndex`). The obvious formula, `regulation × 2 − 1`, is
wrong in both directions on the two cases that matter:

- **Extra innings.** The game was tied after nine, so a user who revealed only
  regulation has seen none of the innings that decided it — the formula would
  mint them a stamp for a score they have not uncovered. (Compare ADR-0008:
  extras never spoil.)
- **The home team never bats.** Leading after the top of the ninth, the home
  club does not come up, so the bottom half the formula demands does not exist
  and the gate could never be satisfied for any such game.

`homeBattedLast` comes from the linescore's last inning actually carrying a home
entry — the same test `liveEdge.js`'s `edgeFromLinescore` already makes.

### The score lives in a shared cache, not in the user record

`game:final:{gamePk}` is a shared, immutable blob of public facts that **the
server fetches for itself** from statsapi on the first mint. Three consequences,
all load-bearing:

- The per-user record (`stamps:{userId}:{season}`) holds only
  `state`/`mode`/`stampedAt`/`updatedAt`/`note`/`date` — no score. It is on
  exactly the same footing as `revealedThrough`.
- A client cannot mint a fabricated 20–0 stamp; it does not supply the number.
- The server can verify the game is genuinely **Final** before minting. A live
  score still moves; a stamp is permanent.

The same split means `localStorage` stays non-score-bearing for signed-out users:
the local Logbook stores the record, and the Logbook screen resolves the facts at
render time.

### Removable, and therefore a state map — not a ratchet

Reveal sync is a monotonic ratchet because the mark only moves one way. A stamp
is a keepsake, not a spoiler mark, so it is **removable** — the one place the
Logbook deliberately differs in character from `revealedThrough`.

That rules out a union merge, for the same specific reason ADR-0026 rules it out
for spoiled days: stamp on the phone, sync, un-stamp on the phone, and the next
fetch unions the server's stale `'on'` straight back in, silently undoing the
removal. So a removal is published as an explicit `'off'` tombstone and the two
sides reconcile per gamePk on `updatedAt`, last write wins. Safe because a stamp
only ever changes by a deliberate tap on one of this user's own devices — there
is no third party to race, and the loser of any tie is one of the user's own taps.

`stampedAt` and `updatedAt` are two clocks on purpose: the first is the
keepsake's date and must survive a note edit; the second is the sync clock and
must move on an un-stamp. One field cannot do both.

### The cap refuses; it does not prune

500 stamps per season. At the cap the mint is **rejected with an error**, not
satisfied by dropping the oldest. This is the opposite of the scorebook index
(`api/reveal.js`), which prunes to `SCOREBOOK_MAX` — and the difference is the
point: a recently-scored-games list is a convenience, a stamp is a keepsake, and
a keepsake that vanishes on its own is a broken promise.

`GET /api/stamps?export=1` ships in v1 for the same reason.

## Consequences

- **Render-surface containment still matters**, the gate does not replace it. The
  stamp affordance lives inside the box-score `SealBox`'s reveal render function
  (ADR-0002), and a stamp must never render on the slate, on a game card, in
  "Pick up your pencil", or in any list of unrevealed games.
  `scripts/check-stamp-surfaces.mjs` (the ninth guard `npm run lint` runs) makes
  that structural: `GameStamp.jsx` may be imported only by `StampGameButton.jsx`
  and `LogbookPage.jsx`, `StampGameButton.jsx` only by `BoxScore.jsx`, and a
  named set of unrevealed-game surfaces may not so much as mention either. Its
  runtime half is `e2e/invariants/logbook-stamp.spec.js`, which asserts a stamp
  is *absent from the DOM* — not merely hidden — before the box score is tapped.
- **`/logbook` must not get an OG card that renders scores.** Crawler-visible,
  and users share links. Fail safe to the static default card (ADR-0012's path).
- **Known gap, accepted explicitly.** Reveal sync is opt-in and only populated
  for signed-in users, so someone who revealed a game before signing in has no
  server mark. The client closes this by POSTing its local `revealedThrough` to
  `/api/reveal` first — that endpoint is a one-directional ratchet and safe to
  feed. It is **not** closed by trusting a client-supplied claim, and must never
  be. Implemented in `src/components/StampsCloudSync.jsx`'s publish path: the
  reveal POST precedes the mint POST for every stamp it publishes.
- **A second gap, named rather than hidden: removals propagate one way.** An
  un-stamp reaches the server (DELETE writes a tombstone), but `GET /api/stamps`
  filters tombstones out of its response, so a second device holding that stamp
  never learns it was removed and keeps showing it until it changes that stamp
  itself. Closing it means teaching the read side to return tombstones — an
  endpoint change, not a client one. Not yet done.
- **The gate fails closed.** An unresolvable game, an unreadable Redis, a
  non-integer mark, a truthy-but-not-`true` consent flag all refuse the mint. A
  blip costs a retry; it never costs a stamp the gate did not allow.
- Nothing changes when unconfigured: no Redis (or no Clerk) and `/api/stamps`
  501s, leaving the client local-only, exactly like the other three exceptions.
- The service worker is untouched — `game:final` is served from an
  authenticated, `no-store` app route, not from statsapi, so ADR-0004's
  `NetworkOnly` rule still covers everything it covered before.

## Alternatives considered

- **Store the score in the per-user record.** Rejected: it makes the user
  document score-bearing for no gain, and it means trusting the client's number.
  The shared-facts split buys integrity and dedupe for free.
- **A client-side-only gate.** Rejected: it makes the central claim a convention
  rather than a guarantee, and conventions in this codebase have drifted into
  real spoiler bugs three times (ADR-0005, ADR-0006, ADR-0007).
- **Ratchet the stamp like the reveal mark**, so a stamp can never be removed.
  Rejected: it would make the merge trivially safe, but an un-removable keepsake
  turns a misfire into a permanent one.
- **`attended` as a third mode in v1.** Deferred. It wants its own overprint on
  the stamp art; adding an enum value later is cheap, un-shipping a half-drawn
  mark is not.
