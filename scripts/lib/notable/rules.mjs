// The pure half of scripts/gen-notable.mjs, part 1: which games count at all.
//
// A generator file RUNS on import, so every rule a test must reach lives here, in
// scripts/lib/notable/ (scripts/CLAUDE.md). The folder has four more files: games.mjs
// (the season game map), kinds.mjs (the three kinds of feat), merge.mjs (merge, seed,
// file shape) and sweep.mjs (the API calls). cli.mjs reads the flags.
//
// LIVE CHECKS. The feed shape is not documented (root CLAUDE.md), so every field path
// below was read from a live response on 2026-10-06, and no rule here is a guess.
//
//   gamePk 177426  (1979-07-12 DET@CWS)  detailedState "Forfeit", score 0-0, innings [],
//                  both sides 0 hits. abstractGameState says "Final". Not a no-hitter.
//   gamePk 67524   (1956-10-08, W)       Larsen. Linescore: Brooklyn 0 hits in 9 innings,
//                  New York 2 runs, the home half of the 9th has no `runs` key (it was not
//                  played). The boxscore lists pitchers [117514] for the Yankees.
//                  gameData.flags.perfectGame is true in the live feed (see the PR).
//   gamePk 563375  (2018-10-08, D)       Brock Holt's cycle: 4 hits, 1 double, 1 triple,
//                  1 home run, in the player game log with gameType "D".
//   gamePk 716945  (2023-08-18 TBA@ANA)  the Angels' team fielding log says triplePlays 0.
//                  Only the seed row adds this game.
//   1927-07-04     28 schedule rows. 12 are Negro league games (league ids 427 and 430,
//                  for example gamePk 856407 KCM@CAG). 16 are AL and NL.
//   1975           1,941 schedule rows, 1,934 distinct gamePks (7 suspended games twice).
//   1914           Federal League games are NOT in the sportId=1 schedule: only ids 103
//                  and 104 came back.
//
// Two routes were tested because no known case existed (the PR has the numbers):
//   - The schedule takes `gameType=R,F,D,L,W` (a comma list; the repeated key and the
//     plural `gameTypes=` also work). One call per season holds every game we keep.
//   - The team fielding game log takes ONE game type at a time (`&gameType=D`). A list,
//     in brackets or with commas, silently falls back to the regular season. So a club
//     costs one call for the regular season plus one for each postseason type it played.
//   - The batched `people?...hydrate=stats(...)` form takes `gameType=[R,F,D,L,W]` with
//     brackets, in the same single call. A comma list silently falls back to regular season.

// The first season the index covers (D6 era floor in .scratch/old-games/plan.md).
export const FIRST_SEASON = 1901

// Regular season and the postseason (D13): Wild Card, Division, League Championship,
// World Series. No spring, exhibition or All-Star games.
export const REGULAR_SEASON = 'R'
export const POSTSEASON_TYPES = ['F', 'D', 'L', 'W']
export const GAME_TYPES = [REGULAR_SEASON, ...POSTSEASON_TYPES]

// AL and NL only (D6). The league id is the one statsapi gives each club.
export const LEAGUE_IDS = { 103: 'AL', 104: 'NL' }
export const LEAGUE_NAMES = ['AL', 'NL']

// A game was played only in these two states. `abstractGameState` is NOT used: a
// postponed or cancelled row says "Final" there (findings.md, Step 3). A forfeit says
// "Final" there too, and a forfeit has no innings: it is not a game that was played.
export const PLAYED_STATES = new Set(['Final', 'Completed Early'])

export const isPlayed = (game) => PLAYED_STATES.has(game?.state)
export const isMajorLeagueClub = (club) => club?.leagueId in LEAGUE_IDS
export const isKeptGameType = (type) => GAME_TYPES.includes(type)

// A game the index may hold: played, both clubs in the AL or the NL that season, and a
// game type we keep. A World Series game is AL against NL and stays.
export const isKeptGame = (game) =>
  isPlayed(game) &&
  isKeptGameType(game.gameType) &&
  isMajorLeagueClub(game.away) &&
  isMajorLeagueClub(game.home)
