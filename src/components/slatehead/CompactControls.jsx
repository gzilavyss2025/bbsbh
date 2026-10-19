import { useEffect, useId, useRef, useState } from 'react'
import { DateStepper } from './DateStepper.jsx'

// The masthead folded small, for when the ladder card has scrolled away: a
// level chip that opens the level menu, and the one-line date stepper. The
// phone's compact bar and the desktop bar's centre slot both draw this.
//
// The chip shows and hides a small panel of level buttons: a disclosure, not an
// ARIA menu. A `menu` role promises arrow keys and a roving tabindex, and the
// slate offers neither anywhere (the reason LevelNav is not a tablist either).
// Each row is a toggle button like the ladder's stops, `aria-pressed` on the
// level on screen. The panel closes on a pick, on Escape (focus goes back to
// the chip), on a tap outside it, and on scroll — a panel left hanging over a
// moving page reads as stuck. Hidden, it is `visibility: hidden`, so Tab skips it.
export function CompactControls({ stops, dateStr, isToday, onLevel, onDate }) {
  const [open, setOpen] = useState(false)
  const chipRef = useRef(null)
  const menuRef = useRef(null)
  const panelId = useId()
  // No stop is picked on a cold winter link until the calendar lands; the chip
  // then names no level rather than claiming MLB.
  const picked = stops.find((s) => s.picked)

  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(false)
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || chipRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      close()
      chipRef.current?.focus()
    }
    menuRef.current?.querySelector('[aria-pressed="true"]')?.focus()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close)
    }
  }, [open])

  return (
    <div className="slatecompact">
      <div className="slatecompact__level">
        <button
          ref={chipRef}
          type="button"
          className={`slatecompact__chip${open ? ' is-open' : ''}`}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={picked ? `${picked.label}, ${picked.fullName}: change level` : 'Level'}
          onClick={() => setOpen((o) => !o)}
        >
          {picked?.label ?? 'Level'}
          <svg viewBox="0 0 24 24" className="slatecompact__caret" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div
          ref={menuRef}
          id={panelId}
          className={`slatemenu${open ? ' is-open' : ''}`}
          role="group"
          aria-label="Level"
        >
          {stops.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={s.picked}
              aria-label={s.aria}
              className={`slatemenu__item${s.picked ? ' is-picked' : ''}`}
              onClick={() => {
                setOpen(false)
                onLevel(s)
              }}
            >
              <span className="slatemenu__name">{s.label}</span>
              <span className="slatemenu__full">{s.fullName}</span>
              <span className="slatemenu__count">{s.count}</span>
            </button>
          ))}
        </div>
      </div>
      <DateStepper dateStr={dateStr} isToday={isToday} onStep={onDate} variant="mini" />
    </div>
  )
}
