# Peer sites: what other baseball sites do that is cool

Read this file when Gary asks "what are other sites doing that are cool?" or a
similar question. Start from this list. Then do a new search pass, and add what
you find. Do not start from zero.

This file covers **baseball** sites and tools: mostly independent analysts, not
national media. `docs/design-inspiration.md` is its partner. That file covers
patterns from outside sports.

Nothing here is committed work. An item becomes work only when an issue, a
`.scratch/` plan, or an ADR says so.

## How to add an entry

- Give the link, the unique value in one or two sentences, and the fit for Tally.
- Say how you checked it: "fetched the page", "read a write-up", or "from memory,
  not checked". Do not state a feature as fact if you did not see it.
- Put the date of the check in the "Last checked" column.
- If an entry uses a feed field, name the field and the endpoint.

## Sites

| Site | Unique value | Fit for Tally | How checked | Last checked |
|---|---|---|---|---|
| [Umpire Scorecards](https://umpscorecards.com) | An automatic card for each home plate umpire, for each game. It plots the missed calls on a zone. It also gives a net "favor" in runs to each team (from memory, not checked on the page). The archive starts in 2015. | **High.** Tally already shows umpires. A per-game umpire card can be a reveal-only add, because "favor" in runs points at the score. | Read the about page | 2026-10-06 |
| [Ballpark Pal](https://www.ballparkpal.com) | Ratings with luck removed, "based on contact quality and expected outcomes". It also has a *Ball Flight Dashboard*, daily park factors, game simulations, and a *Matchup Machine* (batter vs. pitcher). | **High.** It is the nearest match to a "hard-luck out" note on an at-bat card. Its ball-flight view is a peer to `src/lib/ballpark/ballFlight.js`. | Fetched the home page | 2026-10-06 |
| [@would_it_dong](https://x.com/would_it_dong) | For each home run: "a home run in N of 30 parks". | **High.** Savant's `/gf` feed already sends `homeRunBallparks` for each batted ball. No new source is necessary. | Read a write-up (NESN) | 2026-10-06 |
| [TJStats](https://tjstats.ca) (Thomas Nestico) | Dense one-image pitching summaries for MLB **and** MiLB. It has a "Live tjStuff+" app and a daily pipeline that runs every pitch through its own models. | Medium. It is a model for a compact pitcher card. It is one of few sites with MiLB pitch data. | Fetched the home page and the about page | 2026-10-06 |
| [Pitcher List: PLV](https://pitcherlist.com/plv-decision-value-weekly-team-swing-decisions/) | Grades each pitch (quality, average, bad). *Decision Value* grades each swing or take against the other choice. | Medium. A note such as "good take" or "chased a bad pitch" is strong on a second screen. The model belongs to Pitcher List, so Tally can only copy the idea. | Read the write-ups | 2026-10-06 |
| [SEAGER](https://philliesminorthoughts.com/phillies-hitters-and-swing-decisions-a-riff-on-rob-orrs-seager/) (Robert Orr; fans make their own versions) | "Selective aggression": it gives credit for swings at pitches a hitter can damage, and for takes of bad pitches. | Low for one at-bat. It is a season metric, so it fits a player page better. | Read a fan write-up | 2026-10-06 |
| [Adam Salorio (Substack)](https://adamsalorio.substack.com/p/a-closer-look-at-swing-decision-metrics) | Compares the public swing-decision metrics side by side. | Reference only. | Page responds; not read in full | 2026-10-06 |
| [Baseball Egg](https://baseballegg.com/2026/09/08/the-numbers-hidden-inside-every-baseball-swing) | A September 2026 article that explains bat-tracking data for fans. | Reference for how to explain bat data in plain words. | Search result; not read in full | 2026-10-06 |
| [PitchGrader](https://www.pitchgrader.com) | 3D pitch-flight software for iPad, used by teams. | Ideas for the PR #1521 pitch scene. It is not a data source. | Search result only; not read in full | 2026-10-06 |
| [Baseball Savant: pitch arsenal stats](https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats) | Pitchers and hitters split by pitch type, with run value, whiff rate and xwOBA for each type. | **High.** It is the standard view for "what a hitter does against a pitch". `hitter-grid` holds the same counts by cell, so a pitch-type matchup card needs no new source. Savant's run value is a different measure from our xwOBA, so label which one a card shows. | Search result only; not read in full | 2026-10-07 |
| [FanGraphs: pitch type linear weights](https://library.fangraphs.com/pitching/linear-weights) | Run value of each pitch type, as runs above or below average per 100 pitches. | Reference for a run-value column. | Search result only; not read in full | 2026-10-07 |
| Stuff+, Location+, Pitching+ (Eno Sarris and Max Bay; FanGraphs shows them) | Stuff+ grades velocity, spin, movement and release point. Location+ grades how well a pitcher hits his spot for the count. Pitching+ combines them. | Low for now. Spin and movement are not in the MLB live feed, so Tally cannot compute them. A Savant pull would be needed. | Search result only; not read in full | 2026-10-07 |
| [Adam Salorio: aStuff+ v2](https://adamsalorio.substack.com/p/introducing-astuff-v2?open=false) | An independent Stuff+ model. | Reference only. | Search result only; not read in full | 2026-10-07 |
| [Baseball Savant: bat tracking](https://baseballsavant.mlb.com/leaderboard/bat-tracking) | Bat speed, squared-up rate, blasts (a fast swing that squares the ball up) and swing length. A [swing path page](https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle) adds attack angle (5 to 20 degrees counts as "ideal"), attack direction and tilt. | Medium. See the freshness table below: `batSpeed` arrives minutes late and the swing-path fields exist only in the CSV. | Search result only; not read in full | 2026-10-07 |
| MLB.com: [best hitter against each pitch type](https://www.mlb.com/news/best-hitter-against-each-pitch-type-in-2023) | A yearly story that names the best hitter against each pitch type. | Low. It shows that fans already ask this question. | Search result only; not read in full | 2026-10-07 |

## Gaps: things no site does yet

- **Expected score for one game.** Hockey has a "deserve to win" meter. No
  baseball site found on 2026-10-06 shows the runs a team "deserved" in one
  game from contact quality (xBA or xwOBA summed over the game). Tally could
  show it on a revealed box score: "On contact, NYY deserved 4.1 runs; scored
  2." This is an idea; nobody has checked the math for it.

## Data notes from the 2026-10-06 pass

These notes say where the numbers behind the ideas above come from.

- **xBA has no public source earlier than Savant.** The MLB Stats API live
  feed (`feed/live`, `hitData`) has no hit probability, no xBA, and no barrel
  flag. `api/v1/game/{pk}/contextMetrics` has win probability and sac-fly
  distance windows only. `api/v1/game/{pk}/{playId}/analytics` returns a login
  page. (Inference: MLB's Gameday app probably gets "hit probability" from that
  locked endpoint.)
- **Savant `/gf`** (`baseballsavant.mlb.com/gf?game_pk=`) sends `xba`,
  `is_barrel`, `homeRunBallparks` and `batSpeed` per pitch. It sends
  `access-control-allow-origin: *`. It also sends the full scoreboard, so the
  spoiler rule applies (see the root `CLAUDE.md`).
- **Savant Statcast CSV** (`statcast_search/csv`) adds `attack_angle`,
  `attack_direction`, `swing_path_tilt`, and the bat/ball intercept point. It
  also carries `bat_score` and `post_bat_score`.
- **Freshness during a live game: measured on 2026-10-06.** A poll every 20 s
  ran for 90 minutes on gamePk 849819 (LAD @ ATL, postseason). It counted 65
  swings and 25 balls in play. The lag runs from the pitch's `endTime` in the
  MLB feed to the first poll that showed the field:

  | Field | Median | p90 | Coverage |
  |---|---|---|---|
  | MLB feed shows the pitch | 10 s | 18 s | 65 of 65 swings |
  | `/gf` `xba` | 51 s | 70 s | 24 of 25 balls in play |
  | `/gf` `is_barrel` | 45 s | 55 s | 24 of 25 balls in play |
  | `/gf` `batSpeed` | 162 s | 479 s | 63 of 65 swings |
  | CSV (any field) | — | — | 0: the CSV returned no rows for the day during the game |

  So xBA is close to live, about 40 s after the MLB feed. Bat speed often comes
  minutes later. The swing-path fields (attack angle, tilt, intercept) exist
  only in the CSV, so a live game cannot use them. Earlier checks found the CSV
  complete the next morning. When it first fills (at the final out, or later)
  is not measured. The lags carry up to 20 s of poll error.
