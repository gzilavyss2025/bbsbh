# /outliers wireframe

Working notes for issue #2453 (the league-wide "Standing out" report). This folder is
history, not the tracker: the decisions live in the issue.

- `wireframe.html` / `wireframe.png`: the page at phone width (390 px), every row collapsed.
- `wireframe-expanded.html` / `wireframe-expanded.png`: the first row of each section open.

The player names, values and counts are real 2026 flags as of 2026-09-27, from the
prototype in the comment on #2453. The past-seasons table in the expanded view is a
placeholder: the real text comes from the player card's `hotColdView`. Colours and type
are rough; use the design-system tokens in the real page, not these values.
Not mocked: the loading and "Could not load" states of an open row.
