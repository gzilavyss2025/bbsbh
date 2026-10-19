// Game-state selectors: structural facts about WHERE a game is (status, length,
// final half, delays). None reads a score — a `runs` key's mere presence is the
// only run-related thing looked at. Split out of ../select.js, which re-exports
// every name here so existing importers are untouched.

// A total order over half-innings: top of the 1st = 0, bottom = 1, top of the
// 2nd = 2, … Lets a single number express "revealed through here". Structural,
// never a score — safe to compute anywhere.
export function halfIndex(inning, half /* 'top' | 'bottom' */) {
  return (inning - 1) * 2 + (half === 'top' ? 0 : 1)
}

// A game's regulation length: its own `scheduledInnings` (7 for a Triple-A
// seven-inning doubleheader game, ADR-0075), else 9. Spoiler-safe: a fixed
// structural number, never a score. THE one home of the fallback-9 rule, so
// every "did it go to extras" check reads the same length (review of #1295).
export function regulationInnings(scheduledInnings) {
  const n = Number(scheduledInnings)
  return Number.isInteger(n) && n > 0 ? n : 9
}

// The inning count of a game that went past its own regulation length, else
// null — never 0 or undefined, so `{extra && …}` in JSX cannot print a "0".
export function extraInningsOf(innings, scheduledInnings) {
  return Number.isInteger(innings) && innings > regulationInnings(scheduledInnings) ? innings : null
}

// Regulation length of a live feed's game. Drives how many inning columns the
// boxscore shows before extra innings unlock one at a time.
export function selectRegulationInnings(feed) {
  return regulationInnings(feed?.liveData?.linescore?.scheduledInnings)
}

// Number of innings the linescore knows about (drives the inning navigator).
export function selectInningCount(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  return Math.max(innings.length, selectRegulationInnings(feed))
}

// Coarse Live/Final state used by GameView's fetch and polling gates. The
// Innings screen uses the exact boundary from playbyplay/firstPitch.js.
export function selectHasStarted(feed) {
  const abstract = feed?.gameData?.status?.abstractGameState
  return abstract === 'Live' || abstract === 'Final'
}

// Whether the game is over — structural status, not a score, so safe to read
// outside a SealBox (same footing as selectHasStarted above). Used to drop
// the box score's Refresh control once there's nothing left to refresh.
export function selectIsFinal(feed) {
  return feed?.gameData?.status?.abstractGameState === 'Final'
}

// Whether a given inning's HOME half was skipped entirely — the away team
// made the last out in the top with the game already decided (the home team
// already ahead, so batting the bottom half would be pointless — "the
// walk-off that wasn't needed"), or a suspended/curtailed game stopped
// there. Structural fact straight off the feed's own linescore: a completed
// inning's home entry carries no `runs` key at all when it was never played,
// vs. `runs: 0` for a played-but-scoreless half — not a score itself, same
// footing as selectIsFinal, but ONLY trustworthy once the whole game has
// actually concluded. Mid-game, a not-yet-`runs` bottom entry just means the
// home team hasn't batted YET, not that it never will — this must never be
// read before that, or "no bottom half coming" itself leaks that the home
// team is already leading entering it.
//
// Callers must additionally gate this on the TOP half already being fully
// revealed (halfIndex(inning, 'top') <= revealedThrough) before showing
// anything derived from it — selectIsFinal alone tells you the *game* is
// over, not that the user has caught up to this specific half yet.
export function selectSkippedBottomHalf(feed, inning) {
  if (!selectIsFinal(feed)) return false
  const row = (feed?.liveData?.linescore?.innings ?? []).find((i) => i.num === inning)
  return row != null && row.home?.runs === undefined
}

// The half-index of the LAST half actually played in a finished game — not
// halfIndex(selectInningCount(feed), 'bottom'), which is padded out to
// scheduledInnings (see revealStampFacts's header for why that padding
// exists and why it must be scanned around). Same structural footing as
// selectSkippedBottomHalf just above: a `runs` key's mere PRESENCE says a
// half was played, never its value, and this is only trustworthy once
// selectIsFinal is true — a live game's last-posted row just means "not yet
// posted," never "never coming." Feeds the cloud scorebook index's
// auto-drop-once-fully-revealed check (api/reveal.js) — a card in "Pick up
// your pencil" needs to know when there's nothing left to pick up.
export function selectFinalHalfIndex(feed) {
  if (!selectIsFinal(feed)) return null
  const rows = feed?.liveData?.linescore?.innings ?? []
  let last = null
  for (const row of rows) {
    if (typeof row?.away?.runs === 'number' || typeof row?.home?.runs === 'number') last = row
  }
  if (!Number.isInteger(last?.num)) return null
  const homeBattedLast = typeof last.home?.runs === 'number'
  return halfIndex(last.num, homeBattedLast ? 'bottom' : 'top')
}

// Whether the reader has reached the end of a FINISHED game — the last half
// actually played is inside what they have revealed. The scorebug HUD reads
// this to caption itself "F" instead of pointing its inning indicator at a
// half that will never be played (a game ending on the 3rd out of the bottom
// of the 9th left the bug reading "top 10th", because the indicator always
// names what comes NEXT — see ScorebugMount.jsx).
//
// Spoiler-free on the same footing as selectFinalHalfIndex it wraps: it reads
// the mere PRESENCE of a `runs` key, never a value, and it can only say "the
// game is over" to a reader who has already revealed the half that ended it.
// Callers reviewing an earlier half must pass the CLAMPED mark (the half on
// screen), not the game-wide high-water mark.
export function selectFinalReached(feed, revealedThrough) {
  const last = selectFinalHalfIndex(feed)
  return last != null && revealedThrough >= last
}

// Coarse game-state flags for the delayed/suspended/postponed/warmup banner.
// Structural metadata, not a score — safe to render unconditionally, same as
// selectHasStarted above. `detailedState` carries MLB's specific phrasing
// ("Delayed Start: Rain", "Suspended: Rain", "Postponed", "Warmup"); `reason`
// is the separate free-text cause field the feed sometimes also carries.
// Works from either a full live feed (`feed.gameData.status`) or a slate row
// already normalized by schedule.js's normalizeGame (same field names,
// flattened).
export function selectGameStatus(source) {
  const status = source?.gameData?.status ?? source ?? {}
  const detailedState = status.detailedState ?? ''
  const reason = status.reason ?? ''
  const lower = detailedState.toLowerCase()
  const isPostponed = lower.includes('postponed')
  // "Cancelled" (MLB's spelling; the substring also takes "Canceled"). Like a
  // postponement it reports abstractGameState 'Final' with no game behind it
  // (#1248), so callers that ask "was it called off?" read isCalledOff, which
  // takes both.
  const isCancelled = lower.includes('cancel')
  const isCalledOff = isPostponed || isCancelled
  const isSuspended = lower.includes('suspended')
  const isDelayed = lower.includes('delayed')
  // Exact match, not a substring test — "Warmup" is the literal detailedState
  // MLB posts between "Pre-Game" and "In Progress" while the teams take the
  // field, mirrored by the placeholder "Game Advisory" play
  // computeHalfInningFeed excludes from the play-by-play (see
  // GAME_ADVISORY_EVENT_TYPE in api/playbyplay.js) so it never surfaces there
  // as a bogus at-bat card.
  const isWarmup = lower === 'warmup'
  // Coarsest-first badge label, or null for a normal game. Postponed beats
  // suspended beats delayed beats warmup, matching how MLB's own detailedState
  // phrasing nests them (a postponed game is never also "delayed").
  const label = isPostponed
    ? 'Postponed'
    : isCancelled
      ? 'Cancelled'
      : isSuspended
      ? 'Suspended'
      : isDelayed
        ? 'Delayed'
        : isWarmup
          ? 'Warmups'
          : null
  return {
    detailedState,
    reason,
    isDelayed,
    isSuspended,
    isPostponed,
    isCancelled,
    isCalledOff,
    isWarmup,
    label,
  }
}

// True for a game that went Final AND was played, so it has a result to
// reveal. statsapi reports a postponed or cancelled game as 'Final' too
// (#1248), so "Final" alone drew a rained-out game as a 0-0 result card.
// Structural, not a score. Takes a slate row or a full feed, like
// selectGameStatus.
export function selectHasResult(source) {
  const abstract = source?.gameData?.status?.abstractGameState ?? source?.abstractState
  return abstract === 'Final' && !selectGameStatus(source).isCalledOff
}

// In-game delays (rain, etc.) for the between-half-innings notice (see
// components/DelayCard). Spoiler-FREE: a stoppage carries no score — only WHEN
// it happened, WHY, and (once play resumed) how long it lasted. Each delay is a
// non-pitch "Game Advisory" playEvent whose description reads "Status Change -
// Delayed: <reason>" (or "Delayed Start: <reason>"); the resume is a separate
// "In Progress" advisory. The delay event's own startTime/endTime bracket the
// stoppage — its endTime is when play resumed — so the duration comes straight
// from the event, no pairing needed. A still-ongoing delay has no resume yet
// (endTime absent or == startTime) and reports resolved:false with no duration.
// Attributed to the half-inning of the play it sits inside, so InningViewer can
// surface it on that half's page. Deliberately reads no score field on the
// event (it also carries awayScore/homeScore — left untouched).
export function selectDelays(feed) {
  const delays = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    for (const ev of play.playEvents ?? []) {
      const desc = ev.details?.description ?? ''
      if (!/delayed/i.test(desc)) continue // "In Progress" / "Delay Over" don't match
      // Reason is whatever trails the "Delayed[ Start]: " prefix ("Rain",
      // "Field conditions"), or '' when the advisory carries none.
      const reason = (desc.split(/delayed[^:]*:\s*/i)[1] ?? '').trim()
      const start = ev.startTime ? Date.parse(ev.startTime) : NaN
      const end = ev.endTime ? Date.parse(ev.endTime) : NaN
      const durationMinutes =
        Number.isFinite(start) && Number.isFinite(end) && end - start > 60_000
          ? Math.round((end - start) / 60_000)
          : null
      delays.push({
        inning,
        half,
        reason,
        durationMinutes,
        resolved: durationMinutes != null,
      })
    }
  }
  return delays
}

// "today" for a day game, "tonight" for a night game — the word the callout
// notes (api/callout-notes.js, api/pitcher-callouts.js) use in place of a
// hard-coded "tonight". `dayWordFor` takes the raw 'day'|'night' string
// directly (the callouts bundle carries its own copy — see gen-callouts.mjs —
// so those builders don't need the whole feed); `dayWord` reads it off
// gameData.datetime.dayNight (same field selectVenue's dayNight surfaces
// above) for callers that already have the feed. Both default to 'tonight'
// when the value is missing (an un-generated/older callouts bundle, or a feed
// that hasn't posted it yet) so callers never render a blank.
export function dayWordFor(dayNight) {
  return dayNight === 'day' ? 'today' : 'tonight'
}
export function dayWord(feed) {
  return dayWordFor(feed?.gameData?.datetime?.dayNight)
}
