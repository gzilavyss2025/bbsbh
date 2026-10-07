# OVR: a 0-100 video-game rating for every player

**Status: proposal. No code exists yet.** Every number below is a starting value to
tune, not a result. Each "Open" item needs a decision from Gary before build.

## The goal

Give each player a card in the style of a baseball video game: one big **OVR**
(overall) from 0 to 100, attribute bars that add up to it, a **POT** (potential)
for prospects, and an arrow that shows how the rating moved. It is a toy for
clicking around. It is not a projection and not a score, so it needs no seal
(root `CLAUDE.md`: player pages are open surfaces, ADR-0034). **Open:** confirm
that no ADR forbids a rating on the lineup page. The plan below shows it on
player pages only.

## One band for every level

All levels share one 0-100 band, so an A+ player and a major leaguer compare
directly. A minor leaguer's OVR is his level-relative result, squeezed under a
ceiling for his level:

| Level | OVR ceiling (start value) | Why |
| --- | --- | --- |
| MLB | 99 | The scale top. |
| AAA | 58 | Above this, the player is an MLB regular. |
| AA | 50 | |
| A+ | 40 | Gary's example: an A+ player tops out near 40. |
| A | 35 | |
| Rk / complex | 30 | |

The ceilings are my guess. **Open:** derive them from the level-tenure cohort
(`docs/level-tenure-benchmark.md`, 881 MLB debuts 2019-2023), for example the
share of a level's players who reach the majors. That would replace a guess with
a number a reader can argue with.

## OVR for an MLB player

**Source.** `public/data/savant-percentiles.json` (read by
`src/api/savantPercentiles.js`). Savant already ranks each metric 0-100 against
the qualified pool, so this feature does no percentile math. I read the file on
2026-10-07. It holds these metrics, and no others:

- Hitters (612 players): `xwoba`, `ev`, `hardHit`, `brl`, `chase`,
  `sprintSpeed`, `batSpeed`, `squaredUp`, `swingLength`.
- Pitchers (703 players): `xera`, `k`, `bb`, `whiff`, `chase`, `fbVelo`,
  `hardHit`.

**Percentile to rating.** Use a bell curve, as the scouting 20-80 scale does
([FanGraphs](https://blogs.fangraphs.com/?p=161314): 50 is average, about 10
points per standard deviation). Start value: percentile 50 maps to 60, and one
standard deviation is 12 points. So the 84th percentile is about 72, the 98th
is about 84, and the result is capped at 99 and floored at 20.

**Attribute buckets (proposed).**

| Bucket | Hitter metrics | Pitcher metrics |
| --- | --- | --- |
| Contact | `xwoba`, `squaredUp` | `xera` (Results) |
| Power | `ev`, `hardHit`, `brl`, `batSpeed` | |
| Discipline | `chase` | `bb` (Control) |
| Speed | `sprintSpeed` | |
| Stuff | | `whiff`, `k`, `fbVelo`, `hardHit` |
| Fielding | **no data yet** | |

Each bar is the mean of its metrics' ratings. A bucket with no metric shows no
bar. **Gap 1:** the file has no fielding metric, so hitters have no Fielding
bar. Savant publishes outs above average, but `gen-savant-percentiles.mjs` does
not fetch it. Adding it is a generator change. **Gap 2:** the pitcher side has
no durability or arsenal-depth metric.

**Roll-up (proposed weights).** Hitter: Power 25, Contact 25, Discipline 15,
Speed 15, Fielding 20. If a bucket is missing, share its weight across the rest.
Pitcher: Stuff 40, Results 35, Control 25. **Open:** check the result against
`war.json`. A rating that does not track WAR at all is a bad rating. A rating
that tracks it too closely is just WAR with a new label.

**The Show.** MLB The Show gives every player a 0-100 overall, and reports say it
uses a three-year average of Statcast and advanced stats
([The Comeback](https://amp.thecomeback.com/gaming/mlb-the-show-23-player-ratings-released.html)).
Its formula and weights are not public, so this rating is ours. Say that on the
card. Do not use the word "official" or copy The Show's tier names.

**Blend.** One hot month should not swing a rating. Start value: weight the
current season by its share of a full season of plate appearances, and fill the
rest with the two prior seasons. **Open:** `savant-percentiles.json` holds one
season only, so prior seasons need a new store.

## OVR for a minor leaguer

Savant has no percentiles for most minor leaguers (`savantPercentilesFor`
returns null). The input is `public/data/prospect-trend.json`: a level-relative
OPS or ERA percentile, with sample size and weekly history. Its header says it is
the app's own number and not a major-league equivalent.

Rating = `20 + (ceiling - 20) * percentile / 100`, using the level ceiling above.
A 97th-percentile A+ hitter is about 39. Attribute bars for a minor leaguer are
thin: the data gives one hitting number and one pitching number, not five
buckets. **Open:** decide whether a minor leaguer shows only OVR and POT, or also
a rough bar built from slash-line parts (K%, BB%, ISO). The second needs a new
generator and a check of the MiLB feeds.

## POT (potential)

The only potential signal on file is MLB Pipeline's Top 100 rank in
`public/data/top-prospects.json` (96 players at last read). It holds a rank and
no scouting grades. `docs/farm-index.md` already maps rank to a 20-80 future
value (FV) grade, so reuse that map and convert FV to the 0-100 band.

- On the list: POT comes from rank. Start values: ranks 1-5 are 90 and up, rank
  100 is about 70.
- Off the list: no POT. Show a dash. Do not invent one.
- An MLB regular's POT equals his OVR, so the card shows no POT for him.

**Open:** the Pipeline source is a rank, not a grade. Check whether Pipeline's
prospect pages carry 20-80 grades per tool (hit, power, run, arm, field). If they
do, they would give real attribute bars and a real POT. I have not checked.

## Rating changes over time

- A nightly snapshot of each player's OVR and bars goes into a sharded file, for
  example `public/data/ovr-history/`, written by a new `scripts/gen-ovr.mjs`.
  The reader goes through `staticJson.js` (`src/api/CLAUDE.md`).
- The card shows an arrow with the change since seven days ago, and a small
  sparkline of the season.
- `prospect-trend.json` already keeps weekly history for prospects. Reuse its
  weeks for the first version.

## Where it shows

- A card on the player page (`src/screens/player/`), beside the Savant percentile
  strip. **Open:** one tab or a header block.
- Optional second step: a two-player compare screen with attribute bars side by
  side. Gary did not pick this one, so it is out of scope for now.
- Tier colors (bronze, silver, gold, diamond style) use design-system tokens in
  `src/styles/`, never raw hex (`src/CLAUDE.md`). The tier names and cut points
  are an **open** item.

## Build order

1. `scripts/gen-ovr.mjs` and a pure rating module with tests: percentile-to-rating,
   bucket means, roll-up, missing-bucket handling. Test first, per `CLAUDE.md`.
2. MLB hitters and pitchers on the player page. Spoiler-free: classify the new
   module in `src/api/spoiler-manifest.json`.
3. Minor leaguers with ceilings, then POT.
4. History file and arrows.
5. Add Fielding from Savant outs above average.

Check each step in the browser against a real player before the next step.
`docs/test-games.md` and `.claude/skills/run/` describe the loop.

## Prior art (searched 2026-10-07, quick pass)

- MLB The Show: the video-game 0-100 overall, above.
- [Baseball Savant](https://www.mlb.com/news/baseball-savant-statcast-player-pages-new-look):
  0-100 percentile bars on a card-style page, and no single overall number. It
  added a [player comparison tool](https://baseballsavant.mlb.com/changelog/2026-07-20-player-comparison-tool)
  in July 2026.
- The 20-80 scouting scale ([FanGraphs](https://blogs.fangraphs.com/?p=161314)):
  the model for the curve above. It also notes that a 50 OVR is not a
  league-average player, because OVR includes playing time.
- I found no public site that publishes a real-stats 0-100 OVR with minor
  leaguers and potential on one band. The search did not cover GitHub.
