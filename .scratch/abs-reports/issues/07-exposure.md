Questions 5 and 6 need a per-player denominator, and there is none on file. Everything else in this report is `--export-only`; this is the one new fetch.

## Verified against the live API

One call per club gives everything, for both levels:

```
/api/v1/teams/{teamId}/roster?rosterType=fullSeason&season=2026
  &hydrate=person(stats(type=season,group=[hitting,fielding],season=2026,sportId={1|11}))
```

- the hitting split carries `numberOfPitches` and `plateAppearances`
- the fielding splits carry `innings` and `gamesStarted` per position, so a catcher's innings come from the split whose `position.abbreviation` is `C`
- **a traded player returns one split per club plus an aggregate**, so match on `split.team.id` and the exposure is attributed to the right club. 39 MLB players challenged under more than one club this season

Cost: 30 clubs per level, so about 60 calls. Matched **100% of MLB challenge rows and 99%+ of Triple-A** in testing.

## The catcher denominator

**Nothing in statsapi counts pitches received.** The honest options are innings caught or games started at catcher. Use **innings caught**, label the axis with what it is, and do not quietly reuse the batter pitches-seen number for a catcher. The two rates cannot be compared straight across and the surface must say so.

## What to build

A new table `abs_player_exposure` (season, level, team_id, player_id, name, position, pitches, plate_appearances, catcher_innings, catcher_starts) in the `abs-challenges` group, a sweep mode on the generator that fills it, and the per-1,000 and per-9 rates derived in `scripts/lib/abs/export.js`.

This table is a season snapshot, not an append-only ledger: a re-run should REPLACE a club's rows for the season, because a player's totals grow all year.

## Acceptance

- Verify the response shape against a real club before relying on it. The repo rule is to confirm a field path against a live response, never to guess (`src/api/statsapi.js`)
- Tests over a captured fixture: a traded player, a catcher who also hits, a pitcher with no hitting split, and a player with zero challenges who must still appear
- Say in the PR whether Triple-A is worth showing. Its rosters churn hard enough that a season scatter may be mostly noise
- statsapi calls need the Bash sandbox off (`dangerouslyDisableSandbox`), one retry on a connect timeout
