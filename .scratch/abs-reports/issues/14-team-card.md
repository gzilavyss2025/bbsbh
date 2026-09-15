Question 5 asked for a club-level view of who is and is not challenging, against how much they see. It goes on the team hub's **Numbers tab**, beside the Run value card. Depends on the per-player exposure sweep.

**Design:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — artboard "Q5 - Team hub card".

## What it is

A `.thub-card` with a batter/catcher chip pair.

- Headline: the club's rate, with the league rate under it and the rank on its OWN line from the figure it ranks. Milwaukee is 4.51 per 1,000 pitches against a league 6.41, and 29 of 30.
- **The headline must follow the toggle.** On the catcher view it is 1.51 per 9 innings caught against a league 1.12 — the same club is near the bottom at the plate and above average behind it, which is the card's best fact.
- A scatter for the batter view: one dot per player, pitches seen against challenges called, with the league rate as a diagonal. A dot under the line asks less often than his time at the plate predicts. Fourteen of Milwaukee's sixteen are under it.
- **A table under the chart**, which is the only way to reach a player page — an SVG text node cannot be a link — and which gives the unlabelled dots their names.
- The catcher view is a table, not a scatter. Most clubs have two or three catchers, and Milwaukee's four include two points 1.15px apart.

## Build notes

- `.thub-card` is `--radius-md` and `--shadow-card`; the door at the foot is `.thub-door` with `ChevronLink`, pointing at the league board.
- One direct label on the chart at most — the outlier — in the accent hue. Three labels ran through other players' dots in the first draft.
- Emphasis by hue, not by dot size. A larger dot reads as "more important", not as "32".
- MLB only to start. Say in the PR whether a Triple-A club's season scatter is worth drawing.

## Acceptance

- The card does not render for a club with no exposure rows, the way `TeamRunValueCard` returns null for an affiliate
- A traded player is attributed by the exposure row's own club, not by his current one
- Verified in a browser at 390px on a real club page, local URL in the handoff
