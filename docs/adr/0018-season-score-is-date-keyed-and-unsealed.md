# Season Surprise Score is unsealed only at the Team Page's standings cutoff

The Team Page already shows a club's record and division standings unsealed.
Season Surprise Score is a transformation of that same season-level result,
not a result of the game a user may be scoring. It may therefore render outside
a `SealBox`, but only under a stricter date contract than the current live
standings view.

`scripts/gen-season-score.mjs` runs after the previous day's games are final and
writes one static snapshot per MLB team and completed date. `seasonScoreFor`
selects the latest snapshot at or before the page's standings cutoff:

- historical Team Page: `dayBefore(asOf)`;
- current Team Page: yesterday.

The snapshot's own `asOf` date is displayed in the badge and sheet. The reader
never falls forward to a newer snapshot. This makes historical navigation safe
even after the season progresses, and avoids leaking a same-day result through a
nightly file generated while a game is still in progress.

The number has one deliberately narrow semantic: actual wins versus
schedule-adjusted preseason expectation. Earned pace and recent trend are
presented in the expanded sheet as diagnostics, never as hidden modifiers.
That keeps the visible number explainable and avoids turning a factual record
into a forecast or a roster-construction narrative.
