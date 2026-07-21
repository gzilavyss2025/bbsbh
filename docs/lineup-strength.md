# Lineup Strength — design notes

Grades tonight's posted batting order 0–10 against the best nine this roster
could plausibly field. Spoiler-free by construction: the inputs are the posted
starting nine plus season aggregates, nothing from the game itself, so the card
renders pregame on `TeamInfo` with no `SealBox`. MLB only — the values file is
MLB-only at source.

**Read this before changing the model.** Three things were removed from it after
each produced demonstrably wrong answers, and every one of them looks like an
obvious thing to add back. The evidence that killed them is recorded here so the
next agent doesn't have to rediscover it.

| where | what |
|---|---|
| `scripts/gen-war.mjs` | fetches wRC+ and Fielding runs alongside WAR |
| `scripts/gen-lineup-values.mjs` | builds `public/data/lineup-values.json` — per-hitter bat, glove, eligible positions |
| `src/lib/lineupSolver.js` | pure Hungarian assignment + the value function |
| `src/api/lineupStrength.js` | grade, receipt grouping, catcher-rest rule |
| `src/components/LineupStrengthCard.jsx` | the card |
| `test/lineup-strength.test.js` | pins every invariant below |

---

## The model, in one line

```
total = Σ(bat + glove) over the nine − glove(DH)
```

A designated hitter does not field, so his glove is worth nothing in that slot.
That is the entire defensive content of the model. Everything else is
feasibility: the eight fielders must actually be able to cover the eight
positions.

The grade is `10 − gap / SCORE_GAP_FULL`, clamped to 0–10, where `gap` is the
runs/game difference between the optimal and posted lineups.

### Per player

| field | source | meaning |
|---|---|---|
| `rpg` | wRC+, regressed toward **100** by PA | bat, runs/game above average for one lineup slot |
| `fldRpg` | season Fielding runs, regressed toward **0** by innings | glove, runs/game above average |
| `positions` | recent fielding innings by position | boolean set of what he can cover |

Both regressions target **average**, not replacement. A thin sample means "we
don't know," which is average — not "he's terrible." Regressing the bat toward
replacement is what once made a 27-PA callup read as a lineup weakness.

---

## Three deliberate absences

### 1. No positional adjustment

The FanGraphs constants (C +12.5 … DH −17.5 runs/162) are **not** in the model.

Every lineup fills the same nine slots, so `Σ POS_ADJ[slot]` is a constant. It
cancels out of the total, out of every receipt row (a row compares two players at
the *same* slot), and adding a per-slot constant to an assignment matrix cannot
change which assignment is optimal. It is inert.

It was originally used for something else: recovering a "bat" from a WAR total by
subtracting the adjustment. **That is not recoverable.** FanGraphs' `Positional`
is prorated by a player's *actual playing time*:

```
William Contreras, 400 PA:  had earned +4.7 positional runs; model stripped 12.5
Christian Yelich,  295 PA:  had paid   −6.9;                 model returned  17.5
```

A ~19-run phantom swing between two players, manufactured from a figure that was
in the source feed all along. The Marcel PA shrink compounded it: WAR *contains*
the adjustment, so shrinking WAR shrank it too, and removing a full-strength
constant afterwards left a further `(1 − shrink) × POS_ADJ[primary]` residual —
a penalty at premium positions, a bonus at DH and the corners.

Net effect on the bat ranking:

| | wRC+ | old model's "bat" |
|---|---|---|
| Gary Sánchez | **131.8** | worst on the roster |
| William Contreras | 104.6 | middle |
| Christian Yelich | **96.8** | **best** |

**Rule: read the components, never re-derive one from a composite.** This is why
`gen-war.mjs` uses FanGraphs `type=6` (Value) rather than `type=8` (Dashboard) —
same single request, but it carries `Batting`, `BaseRunning`, `Fielding`,
`Positional`, `Replacement` and `wRC+` separately. (`Fielding` already includes
`CFraming` for catchers; the components sum to WAR, so framing is **not**
additive on top.)

### 2. No familiarity discount

Eligibility is a hard yes/no. There is no weight shading a player's value at a
position he rarely plays.

`fldRpg` is a season total pooled across every position a player manned —
FanGraphs publishes one fielding figure per player, not one per position — so it
contributes *identically* at every fielding slot. That left the familiarity
weight as the **only** term that varied by arrangement, which meant every lineup
rearrangement the model ever proposed was driven by it.

And familiarity is innings data: evidence a player *can* cover a spot, not that
he is *good* there. Pricing feasibility as quality produced this:

> **Houston.** Posted: DH Alvarez (glove −0.022), LF Wade (+0.006). On bat-plus-
> glove the posted lineup is *better* by 0.028 — Alvarez is the worse glove, so
> DHing him is correct. The model recommended **Yordan Alvarez in left field**,
> entirely on a +0.046 familiarity term, because he had more career LF innings
> than the man posted there.

Across one slate, familiarity *overrode* the DH-choice logic in three of five
rearrangements it proposed.

**Consequence to know:** any two arrangements of the same eight fielders now have
exactly equal value. Only *who* is in the nine and *which one DHs* can move the
number. Ties are settled by `PREFER_EPSILON`, a nudge toward the manager's own
arrangement, so the optimal never comes back gratuitously reshuffled.

### 3. No career-based eligibility

A position stays eligible only on **recent** innings (`ELIG_WINDOW`, currently 3
seasons). Career totals alone made a player eligible somewhere forever:

| player | claimed at | career inn | last 3 seasons |
|---|---|---|---|
| Bryce Harper | RF | 7,785 | **0** |
| Marcus Semien | SS | 7,048 | **0** |
| Manny Machado | SS | 3,254 | **0** |
| Yandy Díaz | 3B | 2,226 | **0** |

**A third of every eligibility in the file was stale like this** (361 of 1,096).
Harper is a first baseman now; Semien and Machado left shortstop years ago.

This is coupled to §2 and the order matters. Familiarity used to *softly* discount
a stale claim (Harper at RF earned weight 0.4, a −0.072 penalty). With familiarity
gone, the gate is the only thing left constraining a proposal, so stale
eligibility would have gone from penalized to **free**. Tightening the window is a
prerequisite for removing the discount, not an independent nicety.

`gen-lineup-values.mjs` reads `stats=season,yearByYear` rather than
`stats=season,career` — the same single call, but it carries the season each block
of innings belongs to.

---

## What the model deliberately won't say

**Which fielding position a player should play.** The fielding input is
position-agnostic, so the model has no basis for preferring one arrangement of
the same eight fielders over another. It doesn't try. Position assignment is
purely a feasibility question.

**That a rested catcher should be back behind the plate.** A starting catcher
posted at DH is being rested from catching — no club catches one man 162 times.
`catcherRestForbids` forbids the proposal outright rather than deducting for it,
because the model cannot see workload and would otherwise fire this false
positive against a routine, correct managerial decision. Implemented as a
*constraint* on the solve, not a receipt filter, so the score and the rows stay
consistent. Safe by construction: another catcher is already posted at C, so the
solve stays feasible.

**That anyone is unavailable.** The model assumes all 26 roster players could
start tonight. Rest days, nagging injuries, platoon plans and the man who played
14 innings yesterday are all invisible, and all count against the grade. The card
says so in its info popover. This is the largest remaining known bias.

---

## The receipt: findings, not slots

The difference between the optimal and posted lineups is a permutation with
entries and exits. It decomposes exactly into:

- **path** — starts at a slot whose optimal occupant is *not* in the posted
  lineup, follows each displaced man to where the optimum would rather have him,
  ends at a posted starter the optimum has no place for. One player in, one out,
  everyone between shifted. A plain substitution is a path of length 1 (`sub`);
  longer ones are `chain`.
- **cycle** (`shuffle`) — nobody enters or leaves; the same nine, arranged
  differently. Always headlined at DH, the only slot where rearranging the same
  nine can change the value.

**Group first, then apply the noise floor.** Reporting slot-by-slot was not just
ugly, it was wrong: an optimum routinely accepts a *loss* at one slot to gain more
at another, and the floor (`deltaRpg < 0.02`) silently dropped the negative leg,
leaving the positive one to overstate itself.

```
Milwaukee, C/DH rotation, per slot:
  C   Contreras <- Sánchez    −0.4 pts   <- dropped by the floor
  DH  Sánchez   <- Contreras  +1.2 pts   <- shown alone
                       NET:    +0.7 pts   <- the truth
card's rows summed to 3.3 points against a 2.8-point gap
```

Grouped, the receipt's raw deltas sum to the gap **exactly** — verified across a
full slate. That property is the point; don't add a filter that breaks it without
also making the card admit what it dropped.

A `chain` row carries `startingPos`, the departing player's own position, because
he is *not* at the slot the incoming player takes. Without it, "C | Daniel Susac |
Willy Adames" reads as though Adames were catching; he's the shortstop.

---

## Explaining the grade — PARKED, and why

**The card currently shows the score and its tier word only.** The receipt is
fully computed and unit-tested (`lineupStrengthFor().rows`); it just isn't
rendered. This is deliberate, not an oversight: how to explain a grade is
unresolved, and a half-settled answer is worse than none.

What `rows` gives a future renderer, per finding:

| field | meaning |
|---|---|
| `kind` | `sub` (one-for-one), `chain` (shifts others along), `shuffle` (same nine) |
| `pos` | where the incoming player would play |
| `expected` / `starting` | who comes in / who goes out |
| `startingPos` | the departing player's own position, when a chain means it isn't `pos` |
| `shifts` | `["Jake Burger to 3B", …]` — the men who move between |
| `scoreImpact` | points off the 10 |

### The two candidates, measured

A **table** (`Pos | Expected | Starting | Impact`) was built and shipped briefly.
It is scannable and its aligned Impact column makes the biggest deduction
obvious at a glance. It reads badly for a `chain`, where the incoming and
departing players are at different positions and three or four others shift
between them — and chains are **43% of all rows**.

**Prose** generated by template (the `callout-notes.js` pattern: template
literal + a rank score, no model) handles chains far better:

> Joc Pederson profiles as the stronger option at first, pushing Jake Burger to
> third, Josh Jung to DH and Wyatt Langford to left, with Alejandro Osuna
> sitting. (4.4 points)

against the same finding as a table row plus a shifts line. It also reads well
for the single-finding case. But it walls up at three or more findings, and it
loses magnitude comparison.

Findings per lineup, over three slates (85 lineups, 158 rows):

| findings | share | prose reads |
|---|---|---|
| 0–1 | 39% | clearly better than a table |
| 2 | 38% | fine, repetition starting |
| 3–4 | 24% | a wall |

### Known defects in the prose prototype

Cheap to fix, but they are why it wasn't shipped blind:

1. A fixed spine ("profiles as the stronger option") repeats on every line and
   grates by the third. Needs deterministic variation — `lineupStrengthTier.js`
   already does exactly this for tier words, seeded on `teamId`.
2. Team names are plural: "the Cardinals … **their** best nine", not "its".
3. "One change … **together** worth 1.0 point" — wrong for a single item.
4. Position words need "pushing X **to** third", not "at third".

`Intl.ListFormat` handles the "A, B and C" joins including the one- and two-item
cases; don't hand-roll a comma rule.

### The likely answer

One generated **lead sentence above** a table, rather than either alone — prose
where it earns most (naming the shape of the gap, and the chain detail), the
table where it earns most (scanning magnitudes). Not built. Also viable:
prose-only with a visible-sentence cap folding the tail into "…plus two
smaller", or an adaptive card that uses prose at 1–2 findings and a table at 3+
(rejected on the guess that a card changing shape between games reads as
inconsistent across a slate — untested).

## Tunables

All in `gen-lineup-values.mjs`, echoed into the file's `constants` block so the
runtime fallbacks (`rpgFromWar`, `fldRpgFromRuns`) stay in step.

| constant | current | notes |
|---|---|---|
| `REGRESSION_PA` | 250 | bat shrink toward 100 |
| `LEAGUE_R_PER_PA` × `PA_PER_SLOT` | 0.118 × 4.2 | wRC+ → runs/game |
| `REGRESSION_INN` | 600 | glove shrink toward 0; fielding stabilizes slowly |
| `ELIG_WINDOW` | 3 seasons | recency for eligibility |
| `ELIG_SEASON_INN` / `ELIG_RECENT_INN` | 20 / 100 | this season alone, or across the window |
| `SCORE_GAP_FULL` (`lineupStrength.js`) | 0.045 r/g | runs/game per grade point |

`SCORE_GAP_FULL` is the one purely empirical knob. It has never been calibrated
against a long sample — the distribution stopped saturating on its own once the
phantom gaps were removed, which lowered the urgency but didn't settle it. A
proper pass would sweep several weeks of slates rather than one night.

---

## Verifying a change

The unit suite (`npm test`) pins every invariant above. Beyond that, the useful
check is the league-wide distribution and the receipts themselves — a model error
here shows up as an *implausible recommendation*, not as a crash or a bad number.
Grade every posted lineup on a slate, print the receipts, and read them as a
baseball fan would. Every bug documented on this page was found that way, and none
of them would have been caught by a test written in advance.

Sanity anchors, one 2026-07-21 slate, after all of the above:

```
23 lineups | min 2.4  median 7.3  max 9.0  mean 6.72
row kinds: 20 sub, 22 chain, 0 shuffle
receipt raw deltas vs gap: exact on all 23
clubs with no eligible catcher: none
```

---

## History

The engine was chosen as "L2 — WAR-rate replacement delta" in
`.scratch/metric-engines/lineup-strength.md`, which still holds the original
survey of alternatives (L1 percentile-sum, L3 Markov/sim, L4 matchup overlay) and
the research pass behind the constants. Its L2 section carries a correction note
pointing here. The design as first shipped used WAR as the value input with a
positional adjustment applied at assignment time; §1–§3 above are what replaced
it, in that order.
