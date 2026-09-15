The "How often is normal" section on `/abs-challenges`. Depends on the per-player exposure sweep and the page split.

**Design:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — artboard "Q6 - How often is normal".

## What it is

Two slabs and two histograms.

- **Batters: one challenge every 40 plate appearances**, which is 6.41 per 1,000 pitches seen
- **Catchers: one every 8 innings caught**, which is 1.12 per 9 innings

## The spread is the point, so draw it

The league mean describes almost nobody. Among 338 MLB hitters with 200 or more plate appearances the rate runs from 1.96 at the tenth percentile to 12.28 at the ninetieth; seven of them never challenged once all season, and Gary Sanchez called for 32 in 1,085 pitches. Catchers cluster far more tightly: 0.69 to 1.56 over 72 qualifiers.

So each histogram carries a count axis, a median rule and a mean rule. **Derive every rule's position from its value**, not from a bin index — a hand-entered index put the median mark at 5.11 under a label reading 5.90 in the first draft.

## The catcher denominator

Innings caught, not pitches received. Nothing in the feed counts those. It is a different denominator from the batter figure and the two rates cannot be compared straight across — say so once, in the shortest form that carries it.

## Acceptance

- Sample floors ride in the chart head, as the shipped boards on this page already do
- Axis labels are `--text-caption`. `--graphite-soft` is 3.10:1 on card paper and fails AA at this size
- Reads the `summary` it is given. Per-level floors: 200 plate appearances and 200 innings are MLB-tuned, and Triple-A rosters churn
- Verified in a browser at 390px and 960px, local URL in the handoff
