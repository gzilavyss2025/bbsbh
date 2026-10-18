import { useEffect, useRef, useState } from 'react'
import { DateStepper } from './DateStepper.jsx'

// The masthead folded small, for when the ladder card has scrolled away: a
// level chip that opens the level menu, and the one-line date stepper. The
// phone's compact bar and the desktop bar's centre slot both draw this.
//
// The menu closes on a pick, on Escape (focus goes back to the chip), on a tap
// outside it, and on scroll — a menu left hanging over a moving page reads as
// stuck. Rows are menuitemradio, so the level on screen is announced checked.
export function CompactControls({ stops, dateStr, isToday, onLevel, onDate }) {
  const [open, setOpen] = useState(false)
  const chipRef = useRef(null)
  const menuRef = useRef(null)
  const picked = stops.find((s) => s.picked) ?? stops[0]

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
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus()
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
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Level: ${picked?.fullName ?? ''}`}
          onClick={() => setOpen((o) => !o)}
        >
          {picked?.label}
          <svg viewBox="0 0 24 24" className="slatecompact__caret" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div
          ref={menuRef}
          className={`slatemenu${open ? ' is-open' : ''}`}
          role="menu"
          aria-label="Level"
        >
          {stops.map((s) => (
            <button
              key={s.key}
              type="button"
              role="menuitemradio"
              aria-checked={s.picked}
              tabIndex={open ? 0 : -1}
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
