# Pitcher page redesign: notes for the build agent

Source design: the "Gasser Arsenal" artifact, https://claude.ai/artifact/RTUCgApjstMkmCTykSG1nX
(Robert Gasser, id 688107, 2026). Gary approved these changes. Nothing here is built in the app yet.

## What Gary asked for

1. **Pitch table.** The old "arsenal" table had 11 columns and was hard to read. Keep only:
   Used, Avg mph, Top mph, Whiff, In zone, and the "What happened" bar. Tap a pitch to
   highlight it in every other chart. Gary likes this tap-to-highlight. Keep it.
2. **Floating filter bar, desktop only.** It sticks to the bottom of the window.
   - Scope chips: All season, Regular season, Postseason. Show Postseason only for a
     pitcher whose team has postseason starts.
   - A two-handle slider over his starts, in date order (not calendar days).
   - An opponent picker. It lists each team with its start count.
   - It filters the header numbers, every chart, and the pitch table.
   - The Game Log does not hide starts. It dims the starts that are filtered out.
   - On a phone it is not floating. It moves to the top of the page.
3. **Game Log** replaces "Start by start".
4. **Start modal.** Tap a Game Log bar to open it.

## Game Log: scroll back through earlier seasons (NOT built, build this next)

The prototype shows one season. A dashed "2025" slot sits at the left end of the bar row.
It marks where earlier seasons go.

- The row scrolls left. Each earlier season adds a block of bars. Put a season label and a
  divider between blocks.
- Load a season on demand when the user scrolls to the dashed slot. Do not fetch all
  seasons at page load.
- Season list: `GET /api/v1/people/{id}/stats?stats=yearByYear&group=pitching`.
- One season of starts: `GET /api/v1/people/{id}/stats?stats=gameLog&group=pitching&season=YYYY&gameType=R,F,D,L,W`.
  Use `gamesStarted` to drop relief outings. Check how the page treats relievers.
- Pitch tracking starts around 2015 (from memory, not checked in the API). Check which seasons return `pitchData`. Older seasons show no pitch mix. Show a bar with only
  the date, opponent and result. Do not crash and do not invent data.
- MiLB seasons have partial tracking. Degrade the same way (see CLAUDE.md, "MiLB data
  degrades gracefully").
- Start the row scrolled to the newest season (right end).
- The filter bar slider covers only the loaded seasons. Decide if it should span seasons.
  Ask Gary before you choose.

## Start modal: data sources

All fields below were checked against real 2026 games.

| Need | Source |
| --- | --- |
| Stat line (IP, H, R, ER, BB, K, HR, pitches, strikes) | the `gameLog` split `stat` object |
| Final score, win or loss, series name, game type | `GET /api/v1/schedule?sportId=1&gamePk={pk}&hydrate=decisions` (`teams.*.score`, `isWinner`, `seriesDescription`, `gameType`) |
| His strikeouts and the hits and runs against him | `GET /api/v1.1/game/{pk}/feed/live`, `liveData.plays.allPlays` where `matchup.pitcher.id` is his id. Use `result.eventType`, `result.rbi`, `about.isScoringPlay`, `about.inning` |
| Game highlights | `GET /api/v1/game/{pk}/content`, `highlights.highlights.items[]`. Video url is in `playbacks[]`. Person ids are in `keywordsAll` with `type: "player_id"` |
| Pitch clip when MLB cut no highlight | `https://baseballsavant.mlb.com/sporty-videos?playId={playId}`. `playId` is on the last pitch of the play, in `playEvents[]` |

How the prototype matches a clip to a play:

- The clip headline must contain the batter's last name.
- The clip's `player_id` list must contain the batter or the pitcher.
- Strikeout plays also need "strike" or "K" in the headline.
- Damage plays must not match "catch", "safe at", "challenge" or "slides".
- Drop clips whose url date is more than one day from the game date. The content feed of
  one game can list clips from other games (seen on 2026-09-25).
- Drop the condensed game, recaps and the ABS-challenge clips.
- Clips about his outing (his id in `player_id`, not matched to a play) go in the
  "Game clips" list.

"Big plays against him" means: any hit, any run-scoring play, any play with an RBI.

Match rate in 2026: 76 of 208 plays had an MLB highlight. The rest use the Savant link.

## Open questions and caveats

- **Spoiler rule.** Player pages are open surfaces (CLAUDE.md, ADR-0034). Check that a
  start still in progress today does not show a final score or a result. Read ADR-0034 and
  ADR-0026 before you wire the modal.
- The "Open this game" button is a stub in the prototype. In the app it goes to
  `/game/{gamePk}`.
- The prototype modal closes with the Close button or a click on the dim area. The app
  must also close on Escape and trap focus.
- The prototype loads one JSON file (about 335 KB for 22 starts). The app should follow
  the build-time-fetch pattern in `src/api/CLAUDE.md`, or fetch per season on demand.
- The pitch table dropped Spin, Rise, Run and CSW. Rise and run still show in the
  Movement chart. Ask Gary if CSW should come back as a tooltip.
