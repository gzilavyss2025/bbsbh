// A between-half-innings notice that play was stopped for a delay (rain, etc.)
// during the half being viewed. Fed by the spoiler-free selectDelays (see
// api/select.js): it says a stoppage happened, why, and — once play resumed —
// how long it lasted, never a score. InningViewer renders one per delay
// attributed to the current half; there's usually none. "Pops up" on mount per
// the design-engineering skills (a rare, worth-noticing event).
export function DelayCard({ delay }) {
  const { reason, durationMinutes, resolved } = delay
  const isRain = /rain/i.test(reason)
  const title = reason ? `${reason} delay` : 'Delay'
  return (
    <div className="delaycard" role="note">
      <span className="delaycard__icon" aria-hidden="true">
        {isRain ? <RainGlyph /> : <PauseGlyph />}
      </span>
      <div className="delaycard__body">
        <span className="delaycard__title">{title}</span>
        <span className="delaycard__detail">
          {resolved ? (
            <>
              Play stopped for <b>{formatDelay(durationMinutes)}</b>
            </>
          ) : (
            'Delay in progress'
          )}
        </span>
      </div>
    </div>
  )
}

// "2 hr 42 min" / "1 hr" / "38 min".
function formatDelay(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} hr ${m} min`
  if (h) return `${h} hr`
  return `${m} min`
}

// Cloud with three drops; the drops fall on a gentle loop (disabled under
// reduced motion — see index.css).
function RainGlyph() {
  return (
    <svg className="delayrain" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        className="delayrain__cloud"
        d="M7 14.5a3.75 3.75 0 0 1 .28-7.49 5 5 0 0 1 9.46 1.02A3.5 3.5 0 0 1 16.5 14.5H7z"
      />
      <line className="delayrain__drop delayrain__drop--1" x1="8.5" y1="16.5" x2="7.5" y2="20" />
      <line className="delayrain__drop delayrain__drop--2" x1="12" y1="16.5" x2="11" y2="21" />
      <line className="delayrain__drop delayrain__drop--3" x1="15.5" y1="16.5" x2="14.5" y2="20" />
    </svg>
  )
}

// Generic non-rain stoppage (a plain pause).
function PauseGlyph() {
  return (
    <svg className="delaypause" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="7" y="6" width="3.6" height="12" rx="1" />
      <rect x="13.4" y="6" width="3.6" height="12" rx="1" />
    </svg>
  )
}
