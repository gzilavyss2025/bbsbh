# The Matchup Scout is one scroll with one verdict

**Status:** Accepted (2026-10-19). Gary made each decision below in a design session on 2026-10-19.
**Date:** 2026-10-19
**Issue:** #2319
**Supersedes:** ADR-0093 (the View toggle and the pitcher's view), ADR-0099 (the second camera)
**Amends:** `docs/scout-design.md` sections B, C, E and F
**Relies on:** ADR-0097 (xwOBA (est.) prices a strikeout at 0), ADR-0034 (an open surface), ADR-0030 (a club never colours a control)

## Context

The scout page (#1490) puts its answer behind three tabs: Edge, Zones and Meetings. The
Edge tab gives two lenses, contact and whiff, and the two can disagree. For Pivetta vs
Chourio, contact favors the hitter and whiff favors the pitcher. The reader must decide
who has the advantage. Gary asked for a page that is easier to read and keeps every
figure, and then for "a single judgment on who has the advantage".

The design canvas is https://claude.ai/artifact/XFBPUYkP8Xf8VSs4dvV7rm (phone and
desktop boards).

## Decision

1. **One scroll, no tabs.** The order is: the matchup card, the edge, pitch by pitch,
   where, and past meetings. A sticky jump bar (`HubTabBar`, `variant="anchor"`) replaces
   the tabs. `?tab=` stops being read.
2. **One verdict.** The verdict is the hitter's expected xwOBA (est.) on the pitcher's
   whole mix, against the league's on the same pitches (`matchupVerdict` in
   `src/screens/scout/hitterBoard.js`). Each pilled type counts at its pitch count to
   this stance. Its hitter value is the location-weighted `exp` where the pitcher's map
   clears its floor, else `typeVal`. Its league value is `leagueFlat`. Whiff % is not a
   second verdict: xwOBA (est.) already prices each strikeout at 0 (ADR-0097), so the
   whiffs are inside the number. The page shows Whiff % as evidence.
3. **The headline follows the bands.** It uses `metrics.band('xwoba', …)`. Inside ±.030
   the headline is "Even". Past ±.030 it names the side and the band word ("Slight",
   "Clear"). Pivetta vs Chourio is +.027, so it reads "Even".
4. **One view: from behind the plate.** The View toggle, the pitcher's view on the page,
   the second camera's use on the page, and the `scout-turn` flip are removed. The map,
   the scene and the pitch modal draw the hitter's view (ADR-0093's "Hitter's view").
   `?view=` stops being read, and `bbsbh:scout:view` stops being written.
5. **One overlay map.** One map replaces the two maps. The fill is the hitter's result
   for the Metric, and a black square sized by area is the pitcher's share. A Show
   control (Both / Locations / Results) shows each original map alone. The Metric
   control sits by the map and leaves the Filters sheet.
6. **Side colours.** The pitcher's side is `--allstar-blue`. The hitter's side is
   `--award-line` for fills and `--award-ink` for text. Text on an `--award-line` fill
   is ink. Clay is not used, because the design system reserves it for "negative".
7. **The batter figure.** The batter's box shows the Gameday batter art
   (`batterFigureUrls`) in the hitter's club home set for the season. Each stance uses
   its own art. CSS never mirrors it, because a mirror reverses the lettering.
8. **Retired players: meetings first.** The season stores hold one season. When either
   player has no row in them, the page hides the edge, pitch by pitch and where, and
   their jump-bar buttons. It leads with past meetings and one line that says why. The
   card shows the last MLB club (`rosterStatusView(...).lastTeam`) and the span
   (`yearsPlayed`). A pair with no Savant rows (they met before pitch tracking) shows
   the Stats API `vsPlayer` career line once, from its total entry only, so it never
   double counts (#1408).

## Consequences

- `docs/scout-design.md` B (two maps), C (the View control), E15 (the View flip) and F
  (tabs) no longer describe the page. Section G points here.
- The region geometry keeps both projections (`src/lib/zone/regions.js`), and its tests
  stay. The page uses only the hitter's.
- Old links with `?view=pitcher` or `?tab=` still open the page. The page ignores the
  parameters.
- The page needs a new Stats API read for the pre-tracking line. Nothing in `src/` read
  `vsPlayer` before this.

## Alternatives rejected

- **Keep two lenses as two verdicts.** This is the page before this ADR. It leaves the
  judgment to the reader.
- **A side always named ("Edge Chourio · Narrow").** Gary chose the bands, so that the
  headline and the map's colour steps agree.
- **Build the season stores back to 2015 for retired pairs.** This is a large data job
  for a rare case. Meetings-first shows what the pair actually did.
- **Club colours for the two sides.** They differ for each pair, and some pairs clash.
