import { halfIndex, selectHasStarted, selectIsFinal } from './select.js'

// The "live edge" of a game: the half-index (see halfIndex) of the most recent
// play — how far the ACTUAL game has progressed. Follow Live (ADR-0027) advances
// the reveal mark toward this on every fresh feed, so a follower stays pinned to
// the newest half as it is played.
//
// This is NOT a reveal-only module (ADR-0001): it reports only how far the game
// has gone (inning numbers + which half), never a run/score value, and it is
// consulted only when the user has explicitly opted to follow. Two guards keep
// it from ever advancing a mark it shouldn't:
//   1. It returns null unless `following === true` — a bare truthy value (a
//      stale flag, a string) is not enough; the caller passes the resolved
//      boolean from useFollowLive.
//   2. It returns null before first pitch and on empty/malformed play data, so a
//      bare linescore (or a Preview feed) never advances anything. mergeMark
//      drops a null, so a null edge is simply a no-op.

// The half of the last well-formed play — the game's true frontier. Walks
// backward so a trailing malformed/gameadvisory entry can't hide the real edge.
function edgeFromPlays(plays) {
  for (let i = plays.length - 1; i >= 0; i--) {
    const about = plays[i]?.about
    const inning = about?.inning
    const half = about?.halfInning
    if (Number.isInteger(inning) && inning >= 1 && (half === 'top' || half === 'bottom')) {
      return halfIndex(inning, half)
    }
  }
  return null
}

// A conservative ceiling from the linescore: the furthest half the linescore
// itself confirms exists (the last inning with a recorded HOME entry means the
// bottom has been reached, otherwise only the top). Used to clamp the plays edge
// so a stray future-half play can never over-advance a live follower. Null when
// there's no linescore to read — the plays edge then stands on its own.
function edgeFromLinescore(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  if (innings.length === 0) return null
  const last = innings[innings.length - 1]
  const homeReached = last?.home && Object.prototype.hasOwnProperty.call(last.home, 'runs')
  return halfIndex(innings.length, homeReached ? 'bottom' : 'top')
}

export function selectLiveEdge(feed, following) {
  if (following !== true) return null
  if (!selectHasStarted(feed)) return null
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const playEdge = edgeFromPlays(plays)
  // No completed/current play yet (or all malformed) → never advance, even if a
  // linescore skeleton is posted.
  if (playEdge == null) return null
  // A Final game's last play is authoritative — don't let a blank/late linescore
  // half clamp it below the real final half.
  if (selectIsFinal(feed)) return playEdge
  const lineEdge = edgeFromLinescore(feed)
  return lineEdge == null ? playEdge : Math.min(playEdge, lineEdge)
}
