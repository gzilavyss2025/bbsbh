# Placed runner in extra innings — a card of his own

Status: needs-triage
Research pass, July 2026. No product code changed yet.

## The ask

Extra innings start with a runner already on 2nd. Right now bbsbh gives him one
grey sub-line and nothing else. He should get **a card like an at-bat card**, so
his movement between bases can be notated the way every other baserunner's is.

## 1. What the app does today

The feed posts the placement as a `runner_placed` playEvent nested inside the
half's FIRST plate appearance (verified live, gamePk 777747 — `player.id`,
`base: 2`, `details.description: "Trevor Story starts inning at 2nd base."`,
`isPitch: false`, `index: 1`). `BASERUNNING_NOTE_EVENT_TYPES`
(`src/api/playbyplay.js:96`) catches it and turns it into a `baserunningNote` —
the italic sub-line under the leadoff batter's prose in the screenshot
("Josiah Ragsdale starts inning at 2nd base.").

That is the whole treatment. The placed runner:

- has **no card**, so he never enters `originIndex`
- therefore gets **no diamond** — no trace of him taking 3rd, no trace of him
  scoring, no trace of him being thrown out
- and his advances are silently discarded by the advancement bookkeeping, which
  only writes legs onto cards it can resolve an origin for
  (`playbyplay.js:1316`, `1391`)

### Two real bugs fall out of this

Both confirmed by running `computeHalfInningFeed` against the live 777747 feed:

**a) The stepped run tally undercounts.** `PlayByPlay`'s `onRunsSoFar` sums
`entries.filter(e => e.kind === 'atbat' && e.scored)` — one scoring runner per
his OWN card. A placed runner has no card, so his run is never counted. In
777747 bottom 10 (Yelich's walk-off grand slam, 4 runs) the feed reports **3**.
The linescore cell built up by at-bat stepping (ADR-0016) is wrong for every
extra half in which the placed runner scores — which is most of them.

**b) A pinch runner for the placed runner is dropped.** `prAlias`/
`pendingPinchRunnerCards` resolve through `originIndex.get(rootRunner(...))`
and bail when it's null (`playbyplay.js:1064`). Pinch-running for the automatic
runner is a common late-game move and currently leaves no mark at all.

Giving him a card fixes both as a side effect, which is the strongest argument
for this shape over a cosmetic one.

## 2. How scorers actually notate him

Sourced below; the convention is young (2020) and genuinely not fully settled,
but three points recur everywhere:

1. **He gets the batter-box slot, with a code where the result would go.** Reds
   official scorer Ron Roth: "I will be putting **XIR** (extra inning runner) in
   the box where I would normally put the result of the at-bat." Other books use
   **AR** (automatic runner) or **GR**. There is no plate appearance, no at-bat,
   no pitch sequence — the box carries a code and nothing else.
2. **The home→2nd portion of the diamond is NOT inked.** "That base advancement
   didn't happen." Digital books (BaseballScorer) draw it as a **dashed/dotted**
   path with a GHOST label; paper scorers circle or box the runner at 2nd and
   leave the first two legs blank. From 2nd onward, "the paths are drawn
   normally" — ordinary leg notations for how he took 3rd and how he scored.
3. **His run is unearned.** He is treated as having reached on an error for ERA
   purposes. The MLB feed already reflects this: in 777747, Ortiz's scoring
   movement carries `details.earned: false` while Turang/Chourio/Yelich on the
   same grand slam carry `earned: true`.

Point 3 is a gift — bbsbh already circles an unearned run in red
(`PlayDiamond`'s `unearned` ring). The placed runner's card gets the scorer's
correct treatment for free the moment he has a diamond.

## 3. Recommended design

### Card anatomy

A third entry kind, `kind: 'placed'`, rendered by a `PlacedRunnerCard` that
reuses the at-bat card's frame. It is closest to the existing **interrupted
at-bat** card (`codeKind: 'interrupted'`) — same idea: a card with no batting
result, prose plus a diamond.

| Zone | At-bat card | Placed-runner card |
|---|---|---|
| Name + position | batter, his position | the runner, his position |
| Result code | `1B` / `F8` / `ꓘ` | **`AR`**, penciled graphite (not green/red — no hit, no error) |
| RBI chip | `1 RBI` | never — he can't drive himself in |
| Prose | play description | the feed's own sentence, "…starts inning at 2nd base." |
| Pitch ladder (B/S) | pitch pips | **omitted entirely** — no pitches were thrown to him, and the missing strip is what makes the card read at a glance as not-a-plate-appearance |
| Diamond | home→wherever | ghost path home→2nd, real path from 2nd on |

Recommend **`AR`** over `XIR`: it's the more widely used of the two, and it
survives the "what does this mean" test better on a phone. The card's prose
sentence right beside it does the explaining either way.

### The diamond

`PlayDiamond` gains one prop, `placedAt = null` (2 in practice; leave it a base
number rather than a boolean so a future rule change — or a lower-level rule
placing a runner elsewhere — doesn't need a second prop).

- Legs 0→1 and 1→2 draw **dashed, in `--rule`/graphite at low opacity**, never
  solid. This is the "didn't happen in this at-bat" convention.
- Legs from 2 onward draw exactly as they do today.
- Leg notations at 3 and 4 (`1B³`, `HR⁴`) come through unchanged from the
  existing machinery — no special-casing.
- **The scored case needs a decision.** A run fills the whole polygon solid, and
  a solid fill would erase the ghost distinction. Recommendation: fill the
  polygon as usual (a run is a run — that meaning is load-bearing across the
  app) and **overdraw the two ghost legs on top in paper colour, dashed**, so
  the "he was given those 180 feet" reads even on a filled diamond. The red
  unearned ring is already there to reinforce it. The alternative — filling only
  the 2nd→3rd→home wedge — is more literally faithful to paper but reads as a
  rendering bug at phone-sized diamonds.
- An `AR` chip near 2nd is redundant with the card's result box; skip it. The
  slot just outside 2nd (`PR_LABELS`) is already spoken for by a pinch runner.

### Where the card sits

First entry of the half, above the leadoff batter — which is both where the feed
puts it (`playEvents` index 1, before the first pitch) and the order a scorer
works in: you place the runner, then you start the inning.

## 4. Implementation plan

### `src/api/playbyplay.js`

1. In the `playEvents` loop, on `et === 'runner_placed'`, push a `kind: 'placed'`
   entry instead of (not in addition to) the current `baserunningNotes.push`.
   Resolve the runner through `resolveBatter(feed, battingSide, e.player.id,
   positionEntering.get(...))` so he gets the same name/position treatment as a
   batter.
2. Register him: `originIndex.set(runnerId, cardIndex)` and seed
   `progress.set(runnerId, 2)`. **That is the whole integration.** Every
   downstream mechanism — leg notations, the out-on-the-bases tick and out code,
   `scored`/`earned`, `finalizeTrip`, pinch-runner aliasing, the `visible`
   stepCap gate — keys on `originIndex` and starts working with no further
   change. Seeding `progress` to 2 is what makes his 2B→3B movement register as
   a leg at 3 rather than being swallowed as "not past where he already stands".
3. Suppress the duplicate sub-line. `runner_placed` is a member of the exported
   `BASERUNNING_NOTE_EVENT_TYPES`, which `src/api/callout-notes.js:1838` also
   reads — so do NOT narrow the set. Skip the note push for `runner_placed` at
   this one call site instead, and say why in a comment.
4. Leave `nextStepBoundary` alone. It keys on `kind === 'atbat'`, so a `placed`
   entry is automatically bundled forward with the leadoff PA — the same
   behaviour as today's event note, so no stored step count changes meaning.
   This is the main reason to pick a third kind over `kind: 'atbat', placed:
   true`.
5. The repeat-batter reset at `playbyplay.js:1176` already handles the case
   where the placed runner later bats in the same half (he scores, the lineup
   bats around): his placement trip is finalized and his maps cleared before his
   real PA card claims the id. No change needed — but it wants a test.

### `src/components/PlayByPlay.jsx`

6. `onRunsSoFar`: count `(e.kind === 'atbat' || e.kind === 'placed') && e.scored`.
   This is bug (a) above.
7. `hasAtBat` — leave as `kind === 'atbat'`. A live half whose only fetched
   content is the placement must still not read as "whole half, done" (the guard
   at `PlayByPlay.jsx:72-84`, whose comment already names this exact case). The
   third kind keeps that guard correct for free; a `placed: true` flag on an
   `atbat` entry would have silently broken it.
8. Render branch for `kind === 'placed'` → `PlacedRunnerCard`.
9. `EVENT_CODES.runner_placed = 'RP'` becomes unreachable via the note path. It
   stays valid as the standalone-top-level-play fallback its comment describes;
   leave it and update the comment.

### Components / CSS

10. New `src/components/PlacedRunnerCard.jsx`. Reuse the at-bat card's classes
    with a `--placed` modifier rather than a new block.
11. `PlayDiamond` `placedAt` prop + dashed ghost legs (above).
12. `AtBatBox.jsx` (the printable `ScorecardSheet`) — same treatment, or an
    explicit decision to leave the sheet alone for now. Separate surface, can be
    a follow-up; note it either way so it isn't forgotten.

### Tests (`test/`, CI-gated)

Per the repo's test discipline each of these should be written first and fail
before the fix:

13. `placed-runner.test.js` off a captured 777747 fixture (see `test/fixtures`):
    - bottom 10 emits a `placed` entry for Ortiz, first in `entries`
    - his card ends `reached: 4, scored: true, earned: false`, with a leg at 4
    - **the half's `scored` count is 4, not 3** — the regression test for bug (a)
    - top 10: Story ends `reached: 3, scored: false` (stranded), leg at 3
    - the leadoff batter's card no longer carries the duplicate sub-line
14. Pinch-runner-for-the-placed-runner resolves to the placement card (bug b) —
    needs its own fixture; `docs/test-games.md` should gain a gamePk for it.
15. Step-boundary test: a `placed` entry is not its own step.

### Docs

16. `docs/test-games.md` — 777747 as the canonical extras/placed-runner game.
17. `src/CLAUDE.md` extras bullet + `src/api/CLAUDE.md`, one line each.
18. No new ADR needed on my read — this doesn't move a spoiler boundary. If the
    scored-diamond call in §3 goes the other way (partial fill), that IS worth a
    short ADR, since it makes a filled diamond mean two different things.

## 5. Spoiler analysis

Nothing here moves a seal.

- The card renders only inside `PlayByPlay`, which is reveal-only and only ever
  called from a `SealBox` reveal function. Same footing as every at-bat card.
- Retroactive annotation stays behind the existing `visible`/`stepCap` gate —
  his advances are written per-play under `if (visible)`, so stepping through
  the half can't show him scoring before the play that scored him.
- `finalizeTrip` running over `originIndex` at the end is safe: with `progress`
  seeded at 2 and no visible plays yet, he finalizes at `reached: 2` — standing
  on 2nd, which is exactly true.
- **Do not surface the placement pre-reveal.** The placed runner's identity is
  by rule the previous half's last batter, so naming him on the pre-pitch
  reference (`selectPrePitchChanges`, the defense diamond, the lineup cards)
  would leak who made the last out of a half the user may not have opened. Keep
  it strictly inside the seal.

## 6. Open questions for the owner

1. **`AR` or `XIR`** in the result box? (Recommend `AR`.)
2. **Scored diamond**: solid fill with dashed ghost legs overdrawn
   (recommended), or partial fill from 2nd only?
3. **Printable scorecard sheet** (`AtBatBox`/`ScorecardSheet`) — same pass, or a
   follow-up?
4. This is a MiLB-visible feature (the screenshot is AA). Placement rules match
   at every level bbsbh covers, so no level gating is proposed — confirm.

## Sources

- [How To Score Extra Innings — Official Scorer's Advice, Baseball Rules Academy](https://baseballrulesacademy.com/how-to-score-extra-innings-official-scorers-advice/)
- [The Ghost Runner — How to Score Baseball](http://scoring.theyawns.com/docs/runners/ghost-runner/)
- [Automatic Runner — MLB glossary](https://www.mlb.com/glossary/rules/designated-runner)
- [Scorecard Guide — BaseballScorecard.org](https://baseballscorecard.org/guide.html)
- Live feed verification: `statsapi.mlb.com/api/v1.1/game/777747/feed/live`
