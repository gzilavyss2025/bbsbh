import { useEffect, useMemo, useState } from 'react'
import { selectGameStatus } from '../../api/select.js'
import { accessiblePregameCountdown, pregameCountdown } from '../../lib/time/pregameCountdown.js'

function useCountdownNow(scheduledAt, active) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const target = Date.parse(scheduledAt ?? '')
    if (!active || !Number.isFinite(target) || target <= Date.now()) return undefined

    let timer = null
    const tick = () => {
      const current = Date.now()
      setNow(current)
      if (current >= target && timer != null) window.clearInterval(timer)
    }
    timer = window.setInterval(tick, 1000)

    // Mobile browsers throttle background intervals. Re-derive immediately
    // from the absolute timestamp on return instead of waiting for the next
    // throttled tick to make the board truthful again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timer != null) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [scheduledAt, active])

  return now
}

function NumberPlate({ value, label }) {
  return (
    <div className="pregameboard__unit">
      <span className={`pregameboard__plate${value.length > 2 ? ' pregameboard__plate--wide' : ''}`}>
        {value}
      </span>
      <span className="pregameboard__unitlabel">{label}</span>
    </div>
  )
}

function scheduledLabel(gameData) {
  const datetime = gameData?.datetime ?? {}
  const clock = datetime.time && datetime.ampm ? `${datetime.time} ${datetime.ampm}` : ''
  const zone = gameData?.venue?.timeZone?.tz ?? ''
  return [clock, zone].filter(Boolean).join(' ')
}

// A Wrigley-inspired hand-set board, not a loading indicator: forest-green
// steel, painted lettering, and separate number plates. The numbers replace
// instantly once per second — no flip/pulse/tick animation on a change the user
// may watch hundreds of times. Every value here is structural pregame metadata,
// never a score.
export function PregameScoreboard({ feed }) {
  const gameData = feed?.gameData ?? {}
  const status = useMemo(() => selectGameStatus(feed), [feed])
  const scheduledAt = gameData.datetime?.dateTime ?? ''
  const startTimeTBD = gameData.status?.startTimeTBD === true
  const countdownActive = !startTimeTBD && !status.isDelayed && !status.isPostponed && !status.isSuspended
  const now = useCountdownNow(scheduledAt, countdownActive)
  const clock = pregameCountdown(startTimeTBD ? '' : scheduledAt, now)

  const away = gameData.teams?.away?.abbreviation || 'Away'
  const home = gameData.teams?.home?.abbreviation || 'Home'
  const venue = gameData.venue?.name ?? ''
  const schedule = scheduledLabel(gameData)

  let boardMessage = ''
  let headline = 'Top 1st is on deck'
  let detail = 'Inning totals appear here after the first pitch.'
  let statusTag = status.isWarmup ? 'Warmups underway' : 'Pregame'
  let accessible = accessiblePregameCountdown(clock)

  if (status.isPostponed) {
    boardMessage = 'Postponed'
    headline = 'This game was postponed'
    detail = status.reason || 'Check the game information for the updated schedule.'
    statusTag = ''
    accessible = `Game postponed${status.reason ? `: ${status.reason}` : '.'}`
  } else if (status.isSuspended) {
    boardMessage = 'Suspended'
    headline = 'This game is suspended'
    detail = status.reason || 'Play will resume when MLB updates the game status.'
    statusTag = ''
    accessible = `Game suspended${status.reason ? `: ${status.reason}` : '.'}`
  } else if (status.isDelayed) {
    boardMessage = 'Delayed'
    headline = 'First pitch is delayed'
    detail = status.reason || 'The countdown will return when MLB posts a new start time.'
    statusTag = ''
    accessible = `First pitch delayed${status.reason ? `: ${status.reason}` : '.'}`
  } else if (startTimeTBD || clock.kind === 'tbd') {
    boardMessage = 'Start time TBD'
    headline = 'First pitch time is still being set'
    detail = 'Lineups and game information remain available on the other tabs.'
    statusTag = ''
    accessible = 'The scheduled first pitch time has not been announced.'
  } else if (clock.kind === 'passed') {
    boardMessage = 'Any minute now'
  }

  if (status.isWarmup) {
    accessible = `Warmups are underway. ${accessible}`
  }

  const showClock = !boardMessage && clock.kind === 'countdown'

  return (
    <section
      className={`pregameboard${showClock ? ' pregameboard--counting' : ''}`}
      aria-labelledby="pregameboard-title"
    >
      <div className="pregameboard__board">
        <span className="pregameboard__clock" aria-hidden="true">
          <span className="pregameboard__clockhour" />
          <span className="pregameboard__clockminute" />
        </span>
        {!showClock && (
          <p className="pregameboard__teams">
            {away} <span aria-hidden="true">·</span> {home}
          </p>
        )}
        <p className="pregameboard__lead">First pitch{showClock ? ' in' : ''}</p>

        {showClock ? (
          <div className="pregameboard__countdown" aria-hidden="true">
            <NumberPlate value={clock.hours} label="Hours" />
            <span className="pregameboard__colon">:</span>
            <NumberPlate value={clock.minutes} label="Minutes" />
            <span className="pregameboard__colon">:</span>
            <NumberPlate value={clock.seconds} label="Seconds" />
          </div>
        ) : (
          <p className="pregameboard__message" aria-hidden="true">{boardMessage}</p>
        )}

        {statusTag && !showClock && <p className="pregameboard__status">{statusTag}</p>}
        {(schedule || venue) && (
          <div className="pregameboard__meta">
            {schedule && <p>Scheduled {schedule}</p>}
            {venue && <p>{venue}</p>}
          </div>
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true">{accessible}</p>
      </div>

      {/* The default "Top 1st is on deck" copy only earns its place once first
          pitch has actually arrived — while the countdown is still running the
          board above already says everything there is to say. The heading
          stays in the DOM (sr-only) rather than disappearing, since
          aria-labelledby above still points at its id. */}
      <h2
        className={`pregameboard__title${showClock ? ' sr-only' : ''}`}
        id="pregameboard-title"
      >
        {headline}
      </h2>
      {!showClock && <p className="pregameboard__detail">{detail}</p>}
    </section>
  )
}
