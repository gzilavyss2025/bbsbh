# Who actually played in October: a follow-up on roster age, and a reusable tool

Research spike, 2026-08-25. Follow-up to `docs/team-success-roster-age.md`,
requested directly: that spike's age effect could plausibly be a trade-
deadline-rental artifact — a team's SEASON-LONG age counts every veteran
added in July, whether or not he did anything meaningful once October
started. This checks that directly, using each player's actual postseason
role rather than a date cutoff, and it produces a second, general-purpose
tool along the way: **a "postseason usage mismatch" measure — how far a
player's October role diverged from his regular-season role — that any
future factor spike in this program can reuse, not just this one.**

**The answers.**

1. **The age effect is not a rental mirage.** Weighting each team's age by
   who ACTUALLY played in October (rather than by full-season role) moves the
   number by essentially nothing — 0.09 years on the batting side, −0.01 on
   the pitching side. If the original finding were mostly deadline additions
   who never got into a game, this number would have moved a lot. It didn't.
2. **Restricted to just the 250 team-seasons that made the playoffs**,
   postseason-actual PITCHING age still predicts how far a team goes
   (rho=0.173, permutation p=0.0070). Batting age does not (rho=0.088,
   p=0.169) — consistent with spike #1's own finding that the pitching side
   carries the larger, more reliable effect.
3. **A striking first result almost got reported backwards, and the fix
   matters for every future spike, not just this one.** Teams that lean
   heavily on players whose October role greatly exceeded their regular-
   season role LOOK like they do worse (rho=−0.43, p<0.0001) — until you
   notice that "share of a team's total postseason playing time" is measured
   over a denominator that IS how far the team went (a first-round exit plays
   ~29 innings; a champion plays ~144 — rho=0.91 between the two, by
   construction). Controlling for total postseason innings played, the
   relationship **flips sign**: partial rho=+0.22, permutation p=0.0006.
   Leaning on a surprise contributor, for a GIVEN amount of October playing
   time, associates with going further, not less far — the opposite of what
   the raw number said.

## The tool: postseason usage mismatch

For a player who appeared on a team's regular-season AND/OR postseason
roster in a given year:

```
regularShare    = player's regular-season PA (hitters) or IP (pitchers) for that team
                  ÷ that team's regular-season team total
postseasonShare = the same player's postseason PA/IP for that team
                  ÷ that team's postseason team total
mismatch        = postseasonShare − regularShare
```

A large positive mismatch is exactly the case a trade-deadline arm suddenly
anchoring a playoff rotation would produce, but it also catches a September
call-up who breaks out, an injured regular returning just in time, or a
bench player who gets hot — the measure doesn't know or care WHY a player's
role changed, only that it did.

**Source**: `public/data/postseason-history.json`'s own game list (every
gamePk a team played that October, across every round) joined against
`GET /api/v1/game/{gamePk}/boxscore` for each one — ~940 distinct games
across 2000-2025, a tenth the size of the regular-season pull, since a
postseason run is a handful of games. A player is credited to whichever side
of a boxscore his team appears on for that specific game, so there is no
version of the traded-player attribution trap spike #1 found — a postseason
roster is fixed by rule for the games it plays.

### Every outlier found is a pitcher, and that is itself a finding

The 15 biggest positive mismatches and the 15 biggest negative ones are
**all pitchers** — not one hitter appears in either list. That makes sense
once you think about roster mechanics rather than acquisition: a lineup's
regular-season and postseason roles are usually similar (the same 8-9 hitters
play most days either way), while a pitching staff is completely
reorganized for October — rotations shrink from five starters to three or
four, journeyman relievers who ate innings in June get buried, and a handful
of high-leverage arms take on far more work. The mismatch measure is,
empirically, mostly a pitching-usage-reshaping measure, not an acquisition
measure — worth knowing before reading it as evidence about ROSTER
CONSTRUCTION specifically.

The single biggest case is genuinely the pattern this spike was built to
catch: **Jon Lester, traded to Oakland at the 2014 deadline**, went from 5.2%
of the team's regular-season innings to 62.9% of its postseason innings.
Others are a different story entirely — an injury-limited regular-season arm
returning for October (Johnny Cueto, 2013 Reds), or a rookie who simply
wasn't up yet when the season's innings were being logged (Jesús Luzardo,
2019 A's). The measure surfaces all of these as the same shape of event; it
takes a name and a year to tell them apart, and that's a reason to treat any
single spike's use of this tool as descriptive, not causal, without reading
the specific cases behind an aggregate number.

## The trap: a "share of postseason activity" needs a playing-time control

This is the reusable warning, and it belongs in the framework doc's
methodology section for every future spike, not just this one.
**`totalPostseasonIP` (or any equivalent volume measure) correlates at
rho=0.91 with the outcome ladder, by construction** — winning more rounds
IS playing more games. Any measure defined as a SHARE of a team's postseason
activity is therefore mechanically related to how far that team went before
it measures anything real, because the denominator itself grows with
success. The fix is a partial correlation (or an equivalent regression
control) against total postseason volume, not a raw correlation against the
ladder — and the check is cheap enough that there's no excuse to skip it.

```
surpriseReliance (sum of each team's positive mismatches) vs. ladder:
  raw:                                    rho = −0.4257, permutation p < 0.0002
  vs. total postseason innings pitched:   rho = −0.5478  (the confound itself)
  CONTROLLED for total postseason IP:     partial rho = +0.2201, permutation p = 0.0006
```

The raw number would have shipped as "leaning on surprise contributors hurts
you" — a plausible-sounding, wrong-signed finding. The controlled number says
something both more modest and more interesting: for a team that already
played a given number of October innings, relying more on a player whose
role expanded beyond his regular-season part associated with going FURTHER,
not less far.

## What this does not settle

- **The corrected partial correlation (+0.22) is modest**, same caution as
  every other number in this program: real, but not close to the dominant
  story.
- **Every mismatch outlier is a pitcher**, so this whole line of analysis is
  much better evidence about pitching-staff reshaping than about hitters or
  about acquisition strategy broadly — it should not be read as "adding
  players at the deadline helps," only as "when a team's October pitching
  usage diverges sharply from its regular-season usage, that is not, by
  itself, a bad sign, once volume is held constant."
- **Nothing here separates WHY a mismatch happened** — a trade, an injury
  return, and a rookie promotion all look identical to this measure. A
  finding built on this primitive for a specific factor (e.g. trades) needs
  its own case-level check before trusting an aggregate number.
- **Statistical power on the "postseason-actual age" checks is naturally
  thinner** than spike #1's full 750-team-season sample — this one only has
  the 250 team-seasons that made the playoffs at all, since a postseason-actual
  measure has nothing to compute for a team that didn't play in October.

## Where the work lives

`.scratch/team-success/`:
- **`build-postseason-usage.mjs`** → `postseason-usage.json` — the per-team-
  season postseason PA/IP pull, cached in `postseason-boxscore-cache.json`
  (~940 boxscore calls, so a rerun is free).
- **`build-roster-age.mjs`**, already extended for spike #1, now retains
  `personId`/`name` per split (not just the team-level aggregate) so this
  spike could join per-player regular-season role without re-pulling
  statsapi — `roster-age-cache.json` is a real, committed data source for
  this kind of follow-up, not just a rerun optimization.
- **`analyze-usage-mismatch.mjs`** — joins the two, computes postseason-actual
  age, the mismatch measure, the outlier lists, and the confound-checked
  partial correlation.
