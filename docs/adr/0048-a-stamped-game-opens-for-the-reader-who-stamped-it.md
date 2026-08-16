# ADR-0048 — A stamped game opens for the reader who stamped it

Status: accepted (2026-08-16)

## Context

The spoiler rule seals the scoring surfaces until you tap. That is the app. But
it seals them for a reader who does not yet know the score, and there is one
reader it does not describe: the one who was at the game.

A stamp is the Game Log's keepsake. You mint it from inside a revealed box
score, on a game that is already Final, and it records "I watched this" — the
mode is literally `watched` or `followed` (`src/lib/stamps.js`). Minting one
requires having seen the result.

So the sequence that shipped was this. You watch a game. You open its box score,
lift the seal, stamp it. You come back a week later to look up who pitched the
8th — and the app asks you to lift the seal again, on a game you have a keepsake
for. Then again the next visit. The seal is protecting you from a fact you cared
enough about to put in a book.

This is not an edge case; it is the ordinary life of a stamped game. The Game
Log exists to be revisited.

ADR-0035's second amendment already established the half of this that matters
most: **a stamped game and an unrevealed mark routinely coexist, for legitimate
reasons.** The box score's mint `SealBox` deliberately carries no `onReveal` and
persists nothing, so a reader who stamps a game genuinely has
`revealedThrough === -1` for it. That amendment retired a server-side gate
because of it — nineteen real stamps had 403'd. The same fact, read forward
rather than backward, is this ADR.

## Decision

**A game carrying the reader's own stamp renders as though every half were
revealed — and persists nothing.**

> `effectiveReveal` (`src/hooks/revealProgressCore.js`) takes a second override
> input, `stamped`, alongside ADR-0026's `scoresUnlocked`. Either alone opens the
> game; neither cancels the other; both share one branch, which sets
> `commitReveals: false`. The three scoring surfaces inside a game — the innings
> viewer, the box score, the live scorecard — read `isStamped(feed.gamePk)` from
> `useStamps()` and pass it in.

Three things follow, and each was a choice.

### It is a render override, never a mark

The whole of ADR-0026's contract is inherited verbatim. The values
`effectiveReveal` returns are for RENDERING ONLY: never fed to `mergeMark`,
never written to `bbsbh:reveal:{gamePk}`, never handed to `RevealCloudSync`.

ADR-0026 closes by asking every future force-reveal source whether it must also
stop the commit. **This one must, and more urgently than the pass does.** The
day pass expires at 8am; a stamp does not. Were a stamped game to commit its
reveals, merely *revisiting* one would ratchet a mark the reader never earned by
hand, write it to disk, and push it to every device they own — permanently, and
for a game whose seal they would want back the moment they unstamped it.

Because it persists nothing, the override is exactly as reversible as the stamp:
unstamp the game and it seals again, everywhere, on the next render. A
tombstoned stamp (`state: 'off'`, how `removeStamp` records a removal so the sync
can carry it) is not a stamp, and `stampFor` already answers null for one.

### It is NOT the day pass, and must not borrow its flag

The obvious implementation is `spoilersOff ||= stamped`. It is wrong.
`spoilersOff` is a property of the DAY: it drives the day-pass chrome ("scores
are unlocked today", with an off switch), the live-edge follow, and the feed poll
cadence. A stamped game opened on an ordinary sealed day would make that banner
announce an unlocked day that the reader never consented to — a lie about their
own consent, told by the one screen whose job is not to lie about it.

So they stay separate all the way down and meet exactly once, inside
`effectiveReveal`, as two inputs to one branch.

### It is read where it is used, not drilled from GameView

`spoilersOff` is computed in `GameView` because resolving it needs
`officialDate`, which only that screen holds. A stamp needs a `gamePk`, which
every one of the three consumers already has. So each reads `useStamps()`
itself. `GameView` is untouched by this change — which is also what keeps it
under ADR-0038's file-size ceiling, though that is a consequence and not the
reason.

## Why this does not violate the spirit of the rule

The same five tests ADR-0026 set for itself:

- **Consented.** More directly than the day pass, in fact. The pass is consent to
  spoil a day; a stamp is a record that the reader *already saw this specific
  game* and chose to keep it. There is nothing left to spoil.
- **Scoped to what was consented to.** One `gamePk`. Not the day, not the club,
  not the season. An unstamped game on the same day is untouched.
- **The default path is byte-identical.** `stamped` absent or `false` returns
  precisely what the function returned before. The overwhelming majority of games
  a reader opens are unstamped and still seal.
- **The ratchet is untouched.** No new writer of `bbsbh:reveal:{gamePk}` exists.
- **It fails closed.** Every failure mode leaves the game *sealed*: a malformed
  stamps blob parses to `{}` (`parseStamps` fails empty), a tombstone answers
  null, and a device that has not yet pulled the collection simply does not know
  yet.

That last one is the only accepted rough edge. `useStamps` seeds from
localStorage synchronously, so on any device that already holds the stamp the
game is open on the FIRST render — no sealed frame, no flash. On a device that
has never held it, `StampsCloudSync`'s first pull arrives a beat later and the
game opens then. For that beat the reader sees an ordinary seal they can tap.
Being late costs a tap; it never costs a score.

## Alternatives considered

**Ask once, then remember.** "You stamped this — show it unsealed from now on?",
stored per game. Rejected: it is a consent prompt for consent already given, and
it would need a new persisted per-game key — the one thing this decision is
built to avoid.

**Show a banner explaining why the seal is gone.** Rejected as noise on the
common path. The reader stamped the game; the book is the explanation. Note this
is a genuine departure from how ADR-0026 and ADR-0042 behave, both of which keep
their lift visible. The difference is that those two unseal games the reader has
*not* seen, where naming the lift is the point; this one unseals a game they
watched.

**Reuse Scores Unlocked.** Rejected on shape, for the same reason ADR-0042
rejected it: wrong axis. That one is site-wide and time-boxed; this is one game
and permanent.

**Gate it on being signed in.** Rejected. The stamp is the evidence, and stamps
are local-first by design (`useStamps` works on a deploy with no Clerk at all).
Signing in decides whether the stamp *syncs*, not whether it counts. Gating on
auth would re-seal a game for the reader who stamped it on that very device.

## Consequences

- A reader who stamps games gets a Game Log that opens. This is the point.
- `effectiveReveal` now has two override inputs and will accumulate more if
  further openers appear. Its single shared branch is what keeps that cheap — but
  a third input should prompt a look at whether the branch still says one thing.
- The `stamped ⇒ open` implication runs opposite to ADR-0035's original
  `revealed ⇒ may stamp`. Both are now gone as *enforcement*; what survives is
  ADR-0035's containment rule, that a stamp can only be reached from inside a
  revealed box score and rendered where `check-stamp-surfaces` allows. This
  decision does not touch either.
- Verified by `e2e/invariants/stamped-unlock.spec.js`, which asserts both halves:
  the game opens, and `bbsbh:reveal:{gamePk}` stays unwritten across the visit.
  The unit cases live in `test/reveal-progress-core.test.js`.

## Amendment (2026-08-16) — the tap is now remembered too

**ADR-0049** gives the box score a memory of its own: a tap on its seal is
recorded per game (`bbsbh:boxreveal:{gamePk}`) and mirrored across the reader's
devices, so the page they opened stays open whether or not they stamped it.

Two things in this ADR read differently afterwards, and neither weakens it.

The claim that this decision "would need a new persisted per-game key — the one
thing this decision is built to avoid" was about a *consent prompt for the stamp*,
and it stands. ADR-0049's key records something else entirely: not "yes, show my
stamped games unsealed" but "I lifted this seal." It asks nothing and it is scoped
to the one page whose seal was lifted.

The stamp override itself is unchanged and still persists nothing, which is why
`onReveal` is deliberately withheld when a stamp is the thing opening the box
score. Its reversibility is now pinned on the innings viewer rather than the box
score: un-stamping a game the reader also opened by hand re-seals the halves, and
leaves the box score open on its own account. `e2e/invariants/logbook-stamp.spec.js`
asserts that pair.
