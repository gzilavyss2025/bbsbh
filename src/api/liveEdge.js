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

// ---------------------------------------------------------------------------
// THE SAME QUESTION, ASKED WITHOUT THE PASS: which half is the game IN?
//
// `selectLiveEdge` above answers "how far has the game got" from the PLAYS, and
// only under a running Scores Unlocked pass. The three readers below answer a
// narrower question from the LINESCORE'S OWN live state, ungated — because the
// thing they are asked for is not how far the game has got but whether the half
// already on screen is FINISHED, and the plays cannot tell you that. A half
// whose third out has just been recorded and a half whose next batter is still
// walking up look identical in `allPlays`: both end with the same last play,
// and no later half exists yet either way. `inningState` is the one field that
// separates them.
//
// WHAT THEY REPORT AND WHAT THEY DO NOT. An inning number and which half —
// exactly what `selectLiveEdge` reports, and exactly what the slate's own live
// line ("BOT 7") has always shown. Never a run, a hit, an out count, or a base
// state. That is why they need no pass: nothing here is a score, and the two
// callers use the answer to decide which BUTTON to draw, never to draw a value.
//
//   • `selectLiveHalf` — read by InningViewer, which compares its `idx` against
//     the half on screen to stop a still-being-played half from committing
//     itself the moment the reader catches up to it. See ADR-0054.
//   • `selectCatchUpTarget` — read on the lineup page, to offer "Catch up to
//     live" and to name where it lands. The INNING it names never reaches the
//     screen: the button's label is fixed copy, so a game in the 12th offers
//     the same three words as a game in the 2nd and ADR-0008's extras
//     protection is not spent by the offer, only by the tap.
//
// MiLB DEGRADES GRACEFULLY, AND IN THE SAFE DIRECTION. A feed with no
// `currentInning`/`inningState` reads as "no live half", so no half is ever
// treated as in progress — the pre-ADR-0054 behaviour, where catching up to the
// last fetched play commits the half. That is the right way to fail: the
// alternative (assuming a half is live because we cannot prove otherwise) would
// leave a half that can never commit, and a reader who can never move forward.

// linescore.inningState -> the half it is talking about. 'Middle' is the gap
// after the TOP has ended, 'End' the gap after the BOTTOM has — so both name a
// half that is over, which is exactly the half a reader catching up mid-gap
// wants to land on.
const STATE_HALF = { top: 'top', middle: 'top', bottom: 'bottom', end: 'bottom' }
const STATE_IN_PROGRESS = { top: true, middle: false, bottom: true, end: false }

// { idx, inning, half, inProgress } for the half the game is in (or the half it
// most recently finished, between halves), or null before first pitch, on a
// feed that posts no live inning state, or once the game is Final.
export function selectLiveHalf(feed) {
  if (!selectHasStarted(feed)) return null
  if (selectIsFinal(feed)) return null
  const line = feed?.liveData?.linescore
  const inning = line?.currentInning
  if (!Number.isInteger(inning) || inning < 1) return null
  const state = String(line?.inningState ?? '').toLowerCase()
  const half = STATE_HALF[state]
  if (!half) return null
  return { idx: halfIndex(inning, half), inning, half, inProgress: STATE_IN_PROGRESS[state] }
}

// Where "Catch up to live" lands: the half being played, or — between halves —
// the one most recently completed. The caller reveals through `idx - 1` and
// leaves THIS half sealed, so the reader picks the pencil up at the top of it
// and steps through at-bat by at-bat exactly as they would have all along.
// Null whenever there is no live half to catch up to.
export function selectCatchUpTarget(feed) {
  const live = selectLiveHalf(feed)
  return live == null ? null : { idx: live.idx, inning: live.inning, half: live.half }
}
