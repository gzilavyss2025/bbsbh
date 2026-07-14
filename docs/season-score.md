# Season Surprise Score — the 0.0–10.0 measure of a team's season versus expectation

The MLB-only Season Surprise Score answers one question: **how far above or below
its preseason expectation has a team actually performed through this date?** It
is not a playoff forecast, a power ranking, or a measure of how sustainable the
record is. It is shown on the Team Page only when a matching dated snapshot is
available, and opens a breakdown on tap.

The pipeline is `scripts/gen-season-score.mjs` →
`public/data/season-score.json` → `src/api/seasonScore.js` → `TeamPage.jsx`.
It runs in the nightly batch. See ADR-0018 for the unsealed-rendering and
date-cutoff decision.

## Formula

Each completed regular-season game receives an expected win probability from
the two clubs' preseason baselines plus a fixed 54% home-field probability:

```
p(home win) = logistic(logit(home baseline / 162)
                     − logit(away baseline / 162)
                     + logit(0.54))
```

For all games through the snapshot date, the generator sums those probabilities
to `expectedWinsToDate`, then calculates:

```
residual = actualWins − expectedWinsToDate
effectiveZ = residual / sqrt(sum(p × (1 − p)) + 9)
score = clamp(5 + 4.5 × tanh(effectiveZ / 2), 0, 10)
```

The added 9 variance units are deliberate early-season damping: an April streak
can be clearly surprising without reaching a 9 or 10 on a handful of games.
The score is rounded to one decimal only after the transform.

**5.0** means the actual record matches the schedule-adjusted preseason
expectation. Values around **7–8** are a clear surprise; **9–10** require a
large, sustained outlier. The score is paired with the raw wins above/below
expectation in the sheet so it is always auditable.

## Inputs and diagnostics

`scripts/season-expectations-seed.json` is the annual, hand-curated market
baseline. A seed entry carries `baselineWins`, `source`, `sourceUrl`, and `capturedAt`; it
should use a consensus closing regular-season win total immediately before
Opening Day. Edit the seed, never the generated JSON.

If a market line is absent, the generator uses a self-computed Marcel-style
fallback: the prior three seasons weighted 3/2/1, regressed with 50 games of
.500 baseball. Every output row labels itself `market` or `marcel`, so the UI
never silently presents the fallback as market wisdom.

The score sheet also shows, without changing the score:

- **Earned pace** — MLB's `xWinLoss` pace, with a Pythagenpat calculation as a
  fallback when that field is absent. It answers whether the record is supported
  by runs scored and allowed.
- **Last 30** — the result over the club's latest 30 completed games. It is a
  trend indicator, not an extra reward or penalty.

Roster churn is deliberately excluded. A preseason market number already
incorporates publicly known departures and arrivals; scoring churn again would
double-count it. A later Ship of Theseus companion can tell that separate story.

## Storage and cutoff behavior

The output retains daily snapshots by season, team, and date:

```json
{
  "version": 1,
  "seasons": {
    "2026": {
      "byTeamId": {
        "158": {
          "2026-07-13": {
            "score": 7.6,
            "wins": 56,
            "expectedWinsToDate": 46.9,
            "baselineWins": 84.5,
            "earnedPaceWins": 90.7
          }
        }
      }
    }
  }
}
```

The normal nightly run adds yesterday's snapshot, after every scheduled game is
final. A historical Team Page asks for the latest snapshot at or before its
`dayBefore(asOf)` standings cutoff; a current Team Page uses yesterday's
snapshot. The score therefore cannot reveal today's game through a stale/live
standings mismatch.

Run manually:

```bash
node scripts/gen-season-score.mjs
node scripts/gen-season-score.mjs --date=2026-07-13
node scripts/gen-season-score.mjs --from=2024-04-01 --to=2024-09-29
```

Backfills should be run after adding historical market seeds, then reviewed at
same-date checkpoints rather than only against final-season standings.
