import { useState } from 'react'
import { addDays, toApiDate } from '../../lib/dates.js'
import { dateLines } from '../../lib/slate/ladder.js'

// THE DATE STEPPER — previous and next day around the date on screen. Two
// sizes: `full` in the masthead's ladder card (the weekday over "Mon DD") and
// `mini` in the compact bar (one line).
//
// Every step navigates (the URL is the date, ADR-0056), so Back undoes it. The
// new date slides in from the side it came from, but only for a step the
// reader made HERE: `stepped` remembers that step, and the first date change
// that lands anywhere else forgets it, so a date reached by Back or a link
// draws in place. The label is keyed on the date, so each step
// mounts a fresh element and restarts its entrance.
//
// The app has no first or last date to stop at, so the arrows are never
// disabled today; `min`/`max` are there for the day it does.
export function DateStepper({ dateStr, isToday, onStep, onToday, variant = 'full', min = null, max = null }) {
  const [stepped, setStepped] = useState(null)
  const [seenDate, setSeenDate] = useState(dateStr)
  if (dateStr !== seenDate) {
    setSeenDate(dateStr)
    if (stepped?.date !== dateStr) setStepped(null)
  }
  const { dow, md, short } = dateLines(dateStr)
  const dir = stepped?.date === dateStr ? stepped.dir : 0
  const step = (n) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const iso = toApiDate(addDays(new Date(y, m - 1, d), n))
    setStepped({ date: iso, dir: n })
    onStep(iso)
  }
  const turn = dir > 0 ? ' slatedate__turn--next' : dir < 0 ? ' slatedate__turn--prev' : ''
  const mini = variant === 'mini'

  return (
    <div className={`slatedate slatedate--${variant}`}>
      <button
        type="button"
        className="slatedate__arrow"
        aria-label="Previous day"
        disabled={min != null && dateStr <= min}
        onClick={() => step(-1)}
      >
        <Chevron dir="prev" />
      </button>
      <div className="slatedate__label" aria-live={mini ? undefined : 'polite'}>
        <span key={dateStr} className={`slatedate__turn${turn}`}>
          {mini ? (
            <span className="slatedate__short">{short}</span>
          ) : (
            <>
              <span className="slatedate__dow">{dow}</span>
              <span className="slatedate__md">{md}</span>
            </>
          )}
        </span>
        {/* One tap back to today from a day you paged to — the old date
            banner's Today button, kept so a browsed-to day is never a
            dead end on a minor level (the brand goes to MLB). */}
        {!mini && !isToday && (
          <button type="button" className="slatedate__today" onClick={onToday}>
            Today
          </button>
        )}
      </div>
      <button
        type="button"
        className="slatedate__arrow"
        aria-label="Next day"
        disabled={max != null && dateStr >= max}
        onClick={() => step(1)}
      >
        <Chevron dir="next" />
      </button>
    </div>
  )
}

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" className="slatedate__chevron" aria-hidden="true">
      <path d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}
