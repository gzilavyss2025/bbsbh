# A runner's box outlives his time on the bases by one play

**Status:** Accepted
**Date:** 2026-09-14

## Context

Express Lane's scoring deck draws the batter's box and, beside it, the box of
every man standing on base. That second band is the whole reason the deck is
not one box: a scorer does not write a stolen base on the batter's box, he
writes it on the **runner's** box — the plate appearance in which that man
reached, which on the #22 sheet is a row further up (ADR-0016's cards,
`api/expresslane/runners.js`).

`runnersOnBase` names that band, and it answers exactly the question it is
asked: *reached a base, has not scored, was not put out.* Honest, and pinned
over the captured game — no base ever holding two men, no cursor holding four.

It is also the wrong question at the one moment that matters most.

On the play that **scores** a man or **cuts him down**, he stops satisfying the
predicate, so his card leaves the deck. But that card is the diamond the scorer
has to write **this very play** on:

- **A run.** Top of the 3rd, gamePk 823035: Yelich grounds out 6-3 and Cooper
  Pratt scores from third. The scorer fills Pratt's diamond solid and pencils
  the `GO¹` that drove him in — on Pratt's box, which left the screen in the
  same frame the run happened.
- **A force.** Bottom of the 2nd, same game: Fermín is on first, Blaze Jordan
  grounds into a fielder's choice and Fermín is forced at second. The `FC 6-4`
  and the out number go on **Fermín's** box, not Jordan's.
- Same for the back half of a double play, a caught stealing, a runner doubled
  off.

The batter's own box is never the problem — it is the deck's main box and it
stays. The box that disappears is always somebody else's, and always at the
moment it is needed.

## Decision

**A man the cursor's play took off the bases keeps his box for that one cursor
position, and loses it when the cursor moves on.**

`runnersDeparted(prevEntries, entries)` names them.
`expressDeck` returns them as **`departed`**, its own list beside `runners`.
`ScoringDeck.jsx` lays the two out as one row of paper. Pinned by
`test/express-lane-runners.test.js`.

### The cap is what knows which play changed him

A card carries `scored` and `outAt`; it never carries the play that set them.
So the question *did he leave on THIS play* cannot be answered from one card
list.

The cap answers it. `computeHalfInningFeed`'s `stepCap` gates each play's
write-back (ADR-0016), so a man on base at `cap - 1` and gone at `cap` left on
the cursor's own play and on no other. That is the entire derivation, and it is
why `runnersDeparted` takes the two entry lists rather than one — and why
`expressDeck` walks the half a third time to build the earlier one.

### Its own list, and `from` rather than `base`

"Standing on second" and "scored a moment ago" are different answers, and only
the first has a base to be on. Keeping them in one array would have put a man
into `runners` who is not on a base — and quietly broken the invariant that no
two men share one, since a runner scoring from second while the man behind him
takes it would give two entries at 2.

So `departed` is separate, and its field is `from`: the base he **left**. No
caller can read that list as men standing somewhere.

### Nothing here outruns the film

Both entry lists are capped at or behind the cursor, so a departure is only
ever one the scorer has just watched. A **held** play caps short of its own
card (`unwrittenRow`, ADR-0071), so the two lists are identical and nobody has
departed yet — which is the correct answer while the clip is still running: the
paper still says he is standing on third.

### Called out on the paper, not on the board

The departed box is ringed on its own cream ground — `--field` for a run,
`--clay` for an out — rather than tinted on the dark album board, where
`--clay` sits at 2.6:1. The label goes bright and bold and says which of the
two happened in words: "scored", "out at second".

The band's heading changed from "On base" to **"Runners"** for the same reason.
"On base" stops being true the moment one of these boxes appears, which is
precisely when the scorer is most likely to be reading it.

## Consequences

- The deck answers the question a scorer actually has — *which box does this
  play go on* — instead of the narrower one the data layer found easy.
- One extra `computeHalfInningFeed` pass per cursor move, inside the hook's own
  memo. A half-inning is a handful of plays; this is not a hot path.
- A scorer who wants a departed box back steps back a play, the same way he
  gets any other box back. There is no second way in and no sticky state.
- `runnersOnBase` keeps its exact contract and its existing tests. This is a
  second question asked beside it, never a loosening of the first.
