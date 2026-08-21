// FINAL OUT — the wall-clock time of it, which is what the #22 prints in its
// bottom page's header beside the ballpark, the weather and the turnstile
// count. Named for the mark rather than the clock, and the two agree: a scorer
// writes down when the last out was recorded, and the LAST PLAY'S OWN TIMESTAMP
// is exactly that moment.
//
// SPOILER FOOTING: caller-gated, and the gate is not optional. Every other
// field in that header block is known before or during the game and tells you
// nothing about it (a ballpark, a wind reading, a crowd). This one is different
// in kind: read against FIRST PITCH it gives the length of the game, and a long
// one says extra innings — which is exactly what ADR-0008 spends the whole
// sheet withholding, unlocking one extra column at a time.
//
// So it is computed here but printed only where the FINAL line is:
// scorecardScoreboard hands it its own `done` (the game is Final AND every
// played half sits at or under `through`), and until that holds this returns ''
// and the sheet leaves a blank line to write on. By the time it fills, the
// reader has already walked every half — there is nothing left for it to tell.
//
// The park's clock, not the reader's. A scorer writes down the time on the
// stadium clock, and the same game read from another time zone must not say a
// different hour.
export function finalOutClock(feed, done) {
  if (!done) return ''
  const tz = feed?.gameData?.venue?.timeZone?.id ?? ''

  // The last play IS the final out, and its own timestamp is a real instant —
  // it already carries every rain delay and every extra inning rather than
  // needing them added back. (boxscore.js's `gameTimes` resolves its own end
  // time the same way and falls back the same way; that module is reveal-only,
  // so this is a deliberate second reader on the same feed path, not an
  // import.)
  const lastPlay = feed?.liveData?.plays?.allPlays?.at?.(-1)?.about?.endTime
  const fromPlay = clockInZone(lastPlay, tz)
  if (fromPlay) return fromPlay

  // A lean feed with no play timestamps: first pitch plus the playing time and
  // whatever it was delayed. Both are minute counts on gameInfo.
  const gi = feed?.gameData?.gameInfo ?? {}
  if (!gi.firstPitch || !Number.isFinite(gi.gameDurationMinutes)) return ''
  const delay = Number.isFinite(gi.delayDurationMinutes) ? gi.delayDurationMinutes : 0
  const start = new Date(gi.firstPitch)
  if (Number.isNaN(start.getTime())) return ''
  return clockInZone(
    new Date(start.getTime() + (gi.gameDurationMinutes + delay) * 60_000).toISOString(),
    tz,
  )
}

// An ISO instant as a clock time in the park's zone ("4:09 PM"). Blank on
// anything unparseable or a zone the platform does not know, so a MiLB feed
// missing its venue block leaves the line empty instead of throwing.
function clockInZone(iso, tzId) {
  if (!iso) return ''
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  try {
    return t.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(tzId ? { timeZone: tzId } : {}),
    })
  } catch {
    return ''
  }
}
