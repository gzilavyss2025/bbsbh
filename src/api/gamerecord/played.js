import { selectGameSeason } from '../select.js'

// What the record says about a finished game: was it played, is it closed, and
// does an old one hold any play-by-play. Structural status and a play COUNT,
// never a score, so spoiler-free like select.js (ADR-0101). Lives beside
// select.js rather than in it, which is at its file-size budget.

// Whether the game was PLAYED: `detailedState` starts with Final or Completed
// Early. A prefix, because the feed adds a reason where the schedule does not
// ("Forfeit: Unplayable" against "Forfeit"). Never `selectIsFinal` for this:
// `abstractGameState` says Final for postponed and cancelled games too
// (.scratch/old-games/findings.md, Step 3).
export function selectIsPlayed(feed) {
  return /^(Final|Completed Early)/.test(feed?.gameData?.status?.detailedState ?? '')
}

// Whether the record is CLOSED: played, or a forfeit. A closed game's missing
// lineup, starter or umpires will never post, so a card says "not in the
// record" instead of "not posted yet".
export function selectRecordIsClosed(feed) {
  return selectIsPlayed(feed) || /^Forfeit/.test(feed?.gameData?.status?.detailedState ?? '')
}

// A played game from before 1960 with 0 plays: the record holds no
// play-by-play, so the innings pages have nothing to reveal. From 1960 on a
// game keeps its innings pages, plays or not, since 0 plays there is nearly
// always a forfeit (D14 in .scratch/old-games/decisions.md). A feed with no
// season reads NaN and keeps its innings pages, the safe side.
const FIRST_PLAY_BY_PLAY_SEASON = 1960
export function selectHasNoPlayByPlay(feed) {
  const season = parseInt(selectGameSeason(feed), 10)
  const plays = feed?.liveData?.plays?.allPlays ?? []
  return selectIsPlayed(feed) && season < FIRST_PLAY_BY_PLAY_SEASON && plays.length === 0
}
