import { halfIndex, selectHasStarted, selectIsFinal } from './select.js'

// The "live edge" of a game: the half-index (see halfIndex) of the most recent
// play — how far the ACTUAL game has progressed. While the spoilers-off pass is
// running (ADR-0026), InningViewer keeps a caught-up viewer pinned to this half
// as the game is played.
//
// It reports NAVIGATION, not reveal. Nothing downstream of this writes the reveal
// mark — under the pass every half already renders open, so there is nothing for
// a ratchet to advance. That is deliberate: it is what lets a game be watched
// live without a single write to what you scored by hand.
//
// This is NOT a reveal-only module (ADR-0001): it reports only how far the game
// has gone (inning numbers + which half), never a run/score value, and it is
// consulted only when the user has explicitly consented. Two guards keep it inert
// otherwise:
//   1. It returns null unless `spoilersOff === true` — a bare truthy value (a
//      stale flag, a string) is not enough; the caller passes the resolved
//      boolean from useScoresUnlocked.
//   2. It returns null before first pitch and on empty/malformed play data, so a
//      bare linescore (or a Preview feed) never moves anything.

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
// so a stray future-half play can never over-advance the view. Null when
// there's no linescore to read — the plays edge then stands on its own.
//
// Checks the VALUE, not just key presence: an unverified assumption is that a
// live (non-Final) feed always omits `home.runs` entirely for an unreached
// half rather than posting it as `null` — if MLB ever does the latter, a bare
// `hasOwnProperty` check would misread the half as reached and the clamp would
// stop constraining the live edge for that inning.
function edgeFromLinescore(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  if (innings.length === 0) return null
  const last = innings[innings.length - 1]
  const homeReached = typeof last?.home?.runs === 'number'
  return halfIndex(innings.length, homeReached ? 'bottom' : 'top')
}

export function selectLiveEdge(feed, spoilersOff) {
  if (spoilersOff !== true) return null
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

// Whether a fresh live-edge reading should pull the viewer's NAVIGATION along
// with it. InningViewer keeps two refs across polls: `prevEdge` (what this
// selector reported last time it ran) and `prevSeenIdx` (where the viewer WAS
// SITTING as of that same last check — not where they are right now).
//
// Two cases:
//   - First read since activating (`prevEdge == null`): jump straight to the
//     current edge — that's the "catch me up to live" promise of turning
//     Follow Live on.
//   - Every read after: only jump when the edge just advanced past a half the
//     viewer was ALREADY sitting on as of the previous check. Using last
//     check's position rather than curIdx (now) is the whole fix: a viewer
//     who fell behind and just paged themselves forward to catch up shows the
//     same curIdx a genuinely-watching viewer would, but `prevSeenIdx` still
//     reflects where they were BEFORE that catch-up, so the two are told
//     apart. Without this, the instant they arrive at the half the game had
//     already moved past, a live edge that advanced again in the meantime
//     immediately flings them further — the "sends you all over" complaint.
//     A manual catch-up costs at most one poll interval of quiet before
//     auto-follow re-engages, which is the point, not a bug.
export function shouldFollowLiveEdge(edge, prevEdge, prevSeenIdx, curIdx) {
  if (edge == null) return false
  return prevEdge == null ? edge > curIdx : prevSeenIdx === prevEdge && edge > prevEdge
}
