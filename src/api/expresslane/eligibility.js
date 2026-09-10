// EXPRESS LANE — whether film can exist for a game at all.
//
// Asked before the door into Express Lane is drawn anywhere, because the honest
// way to handle a game with no clips is to have NO DOOR. That is the same
// graceful-degradation posture every MiLB surface in this app takes, applied to
// a door rather than a field: a fact that has not been posted yet renders as
// "—", since the fact may still arrive, but a door into a surface that cannot
// exist is a promise the app is unable to keep.
//
// SPOILER-FREE, and it is worth being exact about WHY, because the near-miss
// version of this sentence is "it never opens liveData" and that is not true.
// `selectTeamMeta` falls back to `liveData.boxscore.teams[side].team` when
// gameData carries no sport block, which is the whole reason the level is read
// through the selector rather than off `gameData.teams` (see the note in
// `filmCanExist`). What it takes from there is the club's IDENTITY — its id,
// its name, its level. No play, no linescore, no half-index and no score is
// read on any path, and every fact the answer rests on was published by the
// schedule before the first pitch. Safe at render top-level on any surface.
//
// A SEPARATE MODULE FROM THE COMPONENT THAT ASKS IT, and that is the point of
// this file existing. The five rules below are the whole of MLB's clip coverage
// as this project has measured it, and each one was learned the hard way. Left
// inside a `.jsx` component they could not be unit-tested at all — `npm test`
// imports no JSX — so the coverage claims would rest on a browser run that CI
// never repeats. Here they are pinned by test/express-lane-eligibility.test.js.

import { selectGameStatus, selectHasStarted, selectTeamMeta } from '../select.js'
import { SPORT_IDS } from '../../lib/teams.js'

// The first season with pitch clips. MLB's film archive starts here, and there
// is no partial coverage below it to degrade into — `playId`s exist on older
// games, and none of them resolve to media.
export const FIRST_FILM_SEASON = 2016

// Whether film CAN exist for this game. Five hard structural facts, never a
// score:
//
//   • THE LEVEL. Clips are MLB only. The minor-league sportIds (11-14, see
//     lib/teams.js) carry none at all — not thin coverage, zero, verified
//     across all four levels — so a MiLB lineup page never shows the door.
//   • THE SEASON. Nothing before 2016 has film.
//   • THE GAME TYPE. The All-Star game (`gameType: "A"`) is not in this
//     archive either, however recent it is.
//   • WHETHER A PITCH HAS BEEN THROWN. A game still in Preview has no film for
//     the same reason it has no play-by-play.
//   • WHETHER IT WAS POSTPONED. A postponed game reports `abstractGameState:
//     'Final'` with nothing behind it, so "Final" alone is not enough to go on.
//
// Clips publish roughly eight to twenty-six minutes after the pitch, so a game
// under way has film for everything except its live edge. That lag is Express
// Lane's own to handle and is deliberately NOT a rule here: this asks only
// whether film can exist, never how much of it has landed.
export function filmCanExist(feed) {
  const game = feed?.gameData?.game ?? {}
  // THE LEVEL COMES OFF selectTeamMeta, not off `gameData.teams` directly, and
  // that is the difference between working and nearly working. The selector
  // reads `gdTeam.sport?.id ?? box.sport?.id` — a game whose gameData carries
  // no sport block can still name its level in the boxscore, and a hand-rolled
  // read of the first path alone answers "not MLB" for a real MLB game.
  const sportId = selectTeamMeta(feed, 'away')?.sportId ?? selectTeamMeta(feed, 'home')?.sportId
  if (sportId !== SPORT_IDS.MLB) return false
  if (game.type === 'A') return false
  const season = Number(game.season)
  if (!Number.isFinite(season) || season < FIRST_FILM_SEASON) return false
  if (!selectHasStarted(feed)) return false
  return !selectGameStatus(feed).isPostponed
}
