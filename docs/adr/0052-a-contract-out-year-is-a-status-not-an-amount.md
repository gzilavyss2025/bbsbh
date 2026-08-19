# ADR-0052 — A contract out-year is a status, not an amount

Status: accepted (2026-08-19)

## Context

`scripts/fever/gen-player-contracts.mjs` had shipped Cot's contract terms per
player since long before this, for one card on one profile. Nothing read those
terms across a club, and nothing read them across the league. Two pages now do:
`/team/{id}/contracts`, the club's book, and `/salaries`, the thirty-club view.

Both are additions, and both raise the same two questions the per-player card
never had to answer, because a card shows one contract and a ledger adds up
many.

**The first question is arithmetic.** Cot's writes a contract as a current-season
salary plus one cell per later season, and a later cell is one of two very
different things. It is either a figure — real, negotiated, guaranteed — or it is
a **code**:

| Code | What the source is saying |
| --- | --- |
| `A1`–`A4` | An arbitration year. The player is under club control; nobody has settled a figure. |
| `OPT` (and `club opt`, `player opt`, `mutual opt`, `vest opt`, `cond opt`) | An option year nobody has exercised. |
| `FA` | A year the club has no hold on the player at all. |

A ledger has to decide what a code contributes to a column total, and the
tempting answer is "an estimate". A club's 2029 column looks alarming when it
falls to a fifth of its 2026 column, and an arbitration projection would smooth
it. Every public payroll tool does some version of this.

**The second question is the spoiler rule**, and specifically its scope half.
Neither of these pages is sealed. That needs to be written down, because the
list of unsealed surfaces is exactly the thing that drifts.

## Decision

**A dollar is committed only when the source states a dollar.**

`cellFor()` in `scripts/lib/salaries.mjs` is the single place that classifies a
cell, and it is the only place. A figure is `guaranteed` and counts. Every code
is its own kind — `arbitration`, `option`, `free`, `other` — and none of them
count toward a column total, a club payroll, a player's `committed`, or a
position's spend. An arbitration cell prints `A2`; it never prints a guess at
what the player will win.

The consequence is that a club's later columns **fall away**, often steeply, and
we draw that fall rather than filling it in. That is what the commitment-cliff
bars are for. The fall is the true shape of the book: it is what the club has
actually promised, as against what it will probably end up paying. Those are two
different facts, and only one of them has a source.

Three things follow from stating it this way, and each is worth more than the
smoothing would have been:

1. **Nothing on either page is a projection.** Every number traces to a figure
   Cot's wrote. A reader who distrusts one can go find it.
2. **The cliff is legible.** A club with four guaranteed years and a club with
   one guaranteed year and three arbitration years look different, which is the
   whole point — those clubs *are* different, and a projection would have drawn
   them the same.
3. **The failure mode is honest.** Where the source stops, the page stops. A
   column that runs out is a column that ran out.

`test/salaries.test.js` pins this in both directions: a figure adds to its
column, and every code shape adds nothing while still rendering its own label.

**Neither page is sealed**, and that is the scope half of the spoiler rule rather
than an exception to it. A salary is season-long identity context — the same
class of fact as a stat line, a roster spot or a standings row — and ADR-0034 is
explicit that gating those was the rule reaching past what it protects. Nothing
in `src/api/salaries.js` reads a linescore, a game feed or a reveal mark, and the
module is classified `spoiler-free` in `src/api/spoiler-manifest.json` with that
reasoning. `e2e/salaries.spec.js` holds it at runtime: neither page may print a
score-shaped token, and neither may reach statsapi at all.

## Alternatives considered

**Project arbitration figures.** The usual model is a share of the player's
service-time-adjusted market rate, and it would make the cliff bars smoother and
the club totals more comparable. Rejected because the number it produces is
Tally's, not Cot's, and the page has no way to say so at the cell where a reader
would need to know it. A ledger that mixes stated money with modelled money and
prints both in the same ink is a worse document than one that stops.

**Count option years at their stated value.** An unexercised option usually
*does* carry a figure, so this is arithmetically available in a way arbitration
is not. Rejected for the same reason, one step further along: an option the club
has not picked up is money it has not committed. Counting it would put a club's
worst case on the page as its actual book. The options are counted instead — the
Contracts tab's stat wall shows how many there are — which is the fact without
the false total.

**Seal the pages behind the day's reveal.** Rejected on ADR-0034's reasoning.
The seal protects the surfaces where the reader is scoring a game. A payroll
is not a result, does not change during a game, and does not become known by
watching one.

## Consequences

- The money rule lives in one function. A new code Cot's starts writing falls
  through `cellFor()` to `other`, which renders the code and counts nothing —
  the safe default, and visible on the page rather than silent.
- Club totals here will not match a public payroll figure that includes
  projections. That is expected and is not a bug report.
- `scripts/fever/gen-salaries.mjs` derives both files from the shards
  `gen-player-contracts.mjs` writes, so a club ledger and a player card can never
  disagree about the same contract. The nightly ordering is a requirement, not a
  preference, and is recorded at both steps of `update-nightly-data.yml`.
- Two buckets on `/salaries` are labelled rather than folded into a neighbour:
  pitchers with no appearance yet (no line to split SP from RP) and the one- and
  three-player `TWP`/`OF` groups. Quietly adding an unclassified arm's money to
  the bullpen would invent a fact the source never states, which is the same
  error as projecting arbitration, only smaller.
