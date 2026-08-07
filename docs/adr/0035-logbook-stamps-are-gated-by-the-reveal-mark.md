# ADR-0035 — Logbook stamps are score-bearing, and contained by where they render

Status: accepted (2026-08-04); **the reveal gate superseded 2026-08-06 — see the
second amendment at the bottom, which is the current decision.** Everything above
it is kept as written because the reasoning it records is still the reasoning
that has to be answered.

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
- **Removals propagate both ways** — a second gap, named here first and closed
  after the fact. An un-stamp reached the server as a tombstone, but every
  `GET /api/stamps` filtered tombstones out of its response, so the removal
  stopped there: a second device saw the gamePk simply ABSENT, absence
  correctly means "no opinion" to the merge, and it kept showing a stamp its
  owner had taken back. `readSeason`/`seasonRows` now split the payloads by
  purpose — `?export=1` is the SYNC payload and carries tombstones, while
  `?season=` and `?seasons=1` stay live-only because a tombstone has nothing to
  render or count. Every row states its own `state` (including `'on'`), and
  `StampsCloudSync` reads it rather than assuming; hardcoding `'on'` there was
  the client half of the same bug, so an endpoint-only fix would have merged
  each tombstone straight back in as a live stamp. The reveal gate is
  untouched — this is a read shape, not a permission. Pinned in
  `test/api-handlers.test.js`, round trip through `applyRemoteStamps` included.
- **The retrospective (`/logbook/stats`) inherits this containment argument,
  and only it.** `src/api/logbookStats.js` is pure and reveal-only by
  classification (ADR-0001): it handles scores, so it is callable only from the
  Logbook screens, and its input must only ever be the user's own stamps.
  Nothing on that page may involve a game the user has NOT stamped — no "recent
  games you might stamp", no club's other results, no league context. It
  renders no stamp art, so it stays off `check-stamp-surfaces.mjs`'s allowlist
  deliberately rather than widening a guard that is the containment argument.
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

## Amendment (2026-08) — the mark slot is tunable per club, and retroactively so

The stamp art stayed locked in every respect but one: WHERE a club's knockout
mark sits inside its 150×150 slot. One square slot has to hold a portrait cap
logo, a square roundel and a wide wordmark, and "centre it, letterbox it" —
correct for most clubs — leaves some marks tiny and others hard against the clip
circle. MiLB is where it shows worst, which is also where nobody was going to
hand-fix 120 files.

So a club may carry `{ scale, offsetX, offsetY, rotation }` **per side** —
`src/lib/data/stamp-logo-tuning.json`, picked by eye in `/identity-lab`'s Stamp
placement editor, resolved by `src/lib/stampLogoTuning.js`, applied by
`src/lib/stampArt.js`'s `markTransform`. Per side because the two slots are not
mirror images: each bleeds off the opposite edge of the clip circle, so the nudge
that rescues the away mark can ruin the home one.

Three things follow, and all three were the decision rather than a side effect:

- **It is retroactive, on purpose.** A stamp stores game facts and no art
  (that is the whole `game:final:{gamePk}` split above), so it is redrawn from
  these numbers on every render. Retuning a club restyles every stamp of that
  club everywhere the moment it ships, including keepsakes already minted and
  placed in someone's passport book. The alternative — freezing a placement into
  each stamp at mint time — would make a club's Logbook a museum of every
  version of its own logo placement, and would put art in a record that
  deliberately holds none.
- **Untuned is untouched.** `markTransform` answers `null` rather than an
  identity transform, so a club with no entry emits exactly the markup it did
  the day the design was locked. `test/stamp-art.test.js` pins that.
- **The values clamp, in three places.** The editor's inputs, the resolver
  (`resolveMarkPlacement`), and the dev-save validator
  (`scripts/lib/dev-data-stores.mjs`) all bound the same four fields. This store
  is the only tuning file read at render time by art in other people's
  collections; a typo may shift a mark, never fling it off the stamp.

The editor is the third name on `check-stamp-surfaces.mjs`'s `GameStamp`
allowlist, and the only one that renders a stamp for no real game: its preview
game is a literal in that file — a made-up ballpark, a fixed date, two invented
run totals — reaching no schedule, feed, collection or gamePk. It is also
DEV-only (`import.meta.env.DEV` in `App.jsx`), so it never reaches a production
build at all. Read this ADR before adding a fourth name.

## Second amendment (2026-08-06) — the reveal gate is retired

**The server-side reveal gate is gone.** `POST /api/stamps` no longer reads
`reveal:{userId}:{gamePk}` or `spoiled:{userId}`, `meetsRevealGate` and
`finalHalfIndex` are deleted from `src/lib/stamps.js`, and `StampsCloudSync`'s
reveal push (the "known gap" closer named above) went with them. What survives
server-side is the refusal that protects the *artifact* rather than the user —
only a **Final** game mints, because a stamp is permanent and a live score is
not — plus the `game:final:{gamePk}` split, which is what still keeps a client
from minting a fabricated 20–0 keepsake. Both are `mintRefusal`/`stampEntry` in
`api/stamps.js`, pure and pinned in `test/api-handlers.test.js`.

### What forced it

Nineteen real stamps across sixteen dates could not be uploaded. Every
`POST /api/stamps` returned 403 "game not revealed", and the cause was not a bug
in the gate — the gate was working exactly as this ADR specifies:

- The mint affordance renders inside the box score's `SealBox` reveal render
  function, and **that `SealBox` deliberately has no `onReveal`**
  (`BoxScore.jsx`; the reason is in `src/CLAUDE.md` and it is a good one — an
  `onReveal` there would let a box score opened under the Scores Unlocked pass
  silently ratchet the game's whole `revealedThrough`).
- So stamping from a box score writes no `bbsbh:reveal:{gamePk}`, the client had
  no mark to push, and the server had nothing to find.
- The gate then correctly failed closed.

The client-side gate and the server-side gate disagreed about what counts as
proof, and the sanctioned bridge between them could only carry evidence the
normal flow never produces. **This was not an edge case. It was the flow.**

### Why the answer is to remove it rather than widen it

The obvious repair was a third door — let the client offer its local stamp, or
its "I opened this box score" claim, as evidence, and post a reveal mark before
minting. Rejected, because working out what that door should be forced the
question of what the gate was buying, and the answer was: less than this ADR
claims.

- **Containment, not the gate, is the argument.** What actually stops the
  Logbook spoiling anything is *where stamp art may render* —
  `scripts/check-stamp-surfaces.mjs`, which allowlists the import sites of
  `GameStamp.jsx`/`StampGameButton.jsx` by path and forbids a named set of
  unrevealed-game surfaces from mentioning either, with
  `e2e/invariants/logbook-stamp.spec.js` asserting a stamp is *absent from the
  DOM* before the box score is tapped. **All of that is untouched.** A stamp
  still cannot appear on the slate, on a game card, in "Pick up your pencil", or
  in any list of unrevealed games. The original text says containment "still
  matters, the gate does not replace it"; it turns out to be the other way round.
- **The threat model was a hostile client, and there isn't one.** The gate stops
  someone minting a stamp for a game they haven't opened. On a single-user app
  that someone is the owner, deliberately spoiling a game they went out of their
  way to stamp, in a collection only they can see. Reveal state is per *user*,
  not per device, so the multi-device case it appears to protect — stamp on the
  phone, see the score on the iPad — is a game this user already revealed.
- **A third door made the guarantee a fiction anyway.** Every candidate piece of
  evidence (a local reveal mark, a local stamp, a claim in the body) is
  user-editable `localStorage`. A gate fed by those is a gate in name only, and
  the honest options were "remove it" or "keep 403'ing the normal flow".

The sentence this ADR was built to make true — *you cannot own a stamp for a
game you have not finished revealing* — is retired with it. The replacement is
narrower and actually enforced:

> A stamp can only be **reached** from inside a revealed box score, and can only
> be **rendered** on a surface the containment guard allows. Nothing about the
> Logbook can put a score in front of you on a game you haven't opened.

### The wider decision this sits inside

This is the first change under a deliberate rescoping of the spoiler rule: it
governs the **scoring surfaces** — the slate, the lineup pages, the innings
viewer, the box score — and stops trying to govern everything score-adjacent
elsewhere in the app. The rule was written as "a score-revealing value must never
exist in the DOM until revealed" and had accreted into a general-purpose
guardrail that also froze season stats, team pages and player pages by default.
Treating a final score as though it were a credential cost real functionality and
bought very little. The narrowed scope lands across this change and two
companions: the `?d=&s=` cutoff on stats/team/player pages becoming opt-in time
travel rather than an on-by-default freeze, and then the root `CLAUDE.md` /
`CONTEXT.md` prose being rewritten to state the new scope outright.

**Tier 1 is unchanged and stays strict.** `SealBox`, `revealedThrough`, the
render-function gate (ADR-0002), reveal-only module isolation (ADR-0001), the
`NetworkOnly` service worker (ADR-0004), extras never spoiling (ADR-0008) — none
of that moves. Nothing here loosens what happens while you are scoring a game.

### Consequences

- `test/stamps.test.js`'s gate block was **deleted along with the predicate it
  pinned**, not loosened to pass. `test/api-handlers.test.js` gains the mint
  path driven against a fake Redis — a Final game with no reveal mark and no day
  consent mints 201 and never reads a `reveal:`/`spoiled:` key — which fails
  with 403 against the pre-change endpoint.
- `revealMarkFor` (`src/hooks/useRevealProgress.js`) is deleted; it existed only
  for the reveal push. `check-dead-exports.mjs` is what caught it.
- **The 500-stamps-per-season cap is now the only thing bounding writes** to a
  user's own shard. It refuses rather than prunes, as before.
- `/logbook/stats` inherits the *containment* argument rather than the gate one.
  Its input must still only ever be the user's own stamps — no "recent games you
  might stamp", no club's other results, no league context.
- ADR-0026's spoiled-day map keeps its own job (which days you agreed to see) and
  simply stops having a second one. It is no longer consulted at mint time.

## Third amendment (2026-08-07) — the mint moved to the head of the sheet

**The affordance is now a thin strip across the top of the revealed box score,
not a tall card at the bottom of it.** Nothing about the containment argument
changes, and the reason it doesn't is worth stating plainly, because the
original wording invited the opposite reading.

### The gate is a render function, not a place on the page

This ADR's client-side half is: *the mint affordance renders inside the box
score's `SealBox` reveal render function* (ADR-0002). `children` is a function
invoked only once revealed, so nothing it returns exists in the DOM before the
tap — **wherever in that returned tree it happens to sit.** Top of the sheet and
foot of the sheet are the same side of the seal. The invariant spec
(`e2e/invariants/logbook-stamp.spec.js`) asserts exactly that and needed no new
assertion for the move: it checks *absent from the DOM while sealed*, which is a
statement about the boundary, not about scroll position.

The two things that must not change are unchanged and still stated in
`StampGameButton.jsx`'s header: the host `SealBox` has **no `onReveal`** and
**persists nothing**.

### Why it moved

The old placement had a real argument — a keepsake is not a headline, and the
sheet is what you came for. In practice it made the one thing on the page you
can *keep* the one thing you had to scroll a full box score to find, past the
win-probability arc, three stars, Statcast leaders, both clubs' batting and
pitching tables and the game-info footnotes. An offer nobody scrolls to is not a
restrained offer; it is a hidden one.

A strip at the head of the page inverts that without shouting: it is one row
tall (about one stamp), it is declined by scrolling past it, and it is where the
eye already is when the seal lifts.

### The constraint that keeps it honest

The old card was 300–500px because every affordance a *minted* stamp offers was
laid out at once — the mode picker, the note field, three actions. At the top of
the page that is unaffordable, so the strip carries **one row: mount, one line
of copy, one action**, and everything a stamp you already have can do sits
behind a `Details` disclosure. That is the rule to keep: new affordances go in
the disclosure, the row does not grow. A future change that puts a fourth
control in the row has re-created the card in a worse position.

### Consequences

- Placement is CSS, not a second render. The strip is the first child of the
  Highlights section (`BoxScore.jsx`); on a phone `48-stamp-strip.css` floats
  the section title and the R/H/E/LOB totals above it with flex `order`, which
  works only because `.bs__duo`/`.bs__col` are `display: contents` below the
  wide breakpoint. One component, two positions, no duplicated state.
- `.stampcard__*` is now `.stampstrip__*`. The two solid button fills the Game
  Log's actions share are named `.btn--seal` / `.btn--ink`
  (`07-team-logo-and-buttons.css`) instead of the book borrowing the mint
  card's own class.
- The rules live in a new `48-stamp-strip.css`, because folding them back into
  `48-logbook.css` puts that file past `check-file-size.mjs`'s ceiling. It takes
  a duplicate `48` (precedent: the two `11-` partials); the cascade contract is
  order, not unique numbers, and this one has to land after `48-logbook.css`,
  which sizes and inks the `.gamestamp` it frames.
