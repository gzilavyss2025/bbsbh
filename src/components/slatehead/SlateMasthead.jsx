import { useEffect, useRef, useState } from 'react'
import { TallyBaseballMark, TallyLockup } from '../chrome/TallyBrand.jsx'
import { LevelLadder } from './LevelLadder.jsx'
import { DateStepper } from './DateStepper.jsx'
import { CompactControls } from './CompactControls.jsx'

// THE D1 MASTHEAD — the top of the home slate (Gary's handoff "Slate masthead
// D1", 2026-10-18). It answers two questions before the games: which level,
// and which day. Three parts:
//
//   the bar        brand lockup (taps home) and the page's icon buttons. Wide,
//                  it is sticky, and it COMPACTS in place once the ladder card
//                  has scrolled away: it takes the card fill, a rule and the
//                  stamped shadow, and the compact controls fade into its
//                  centre slot.
//   the card       one stamped card: the level ladder over the date stepper on
//                  a phone, side by side from 740px.
//   compact bar    phone only: a separate 60px bar that slides down from the
//                  top once the card is gone. Hidden with `visibility`, so Tab
//                  never lands in it while it is off screen.
//
// Everything here navigates; nothing is local state the URL does not hold
// (ADR-0056). The masthead fetches nothing — the stops arrive with their
// counts (lib/slate/ladder.js), and `actions` are the caller's buttons.
//
// THE STAMP-IN plays once a session, on the first slate drawn: a cold load
// on every level and day change after that would be motion nobody asked for.
const STAMPED_KEY = 'bbsbh:slate-stamped'

function firstSlateThisSession() {
  try {
    return window.sessionStorage.getItem(STAMPED_KEY) == null
  } catch {
    return false
  }
}

export function SlateMasthead({ stops, dateStr, isToday, wide, onLevel, onDate, onToday, onHome, actions }) {
  const cardRef = useRef(null)
  const [compact, setCompact] = useState(false)
  const [stamp] = useState(firstSlateThisSession)

  useEffect(() => {
    if (!stamp) return
    try {
      window.sessionStorage.setItem(STAMPED_KEY, '1')
    } catch {
      // Private mode: the stamp may play again next load, which is harmless.
    }
  }, [stamp])

  // Compact once the card is wholly ABOVE the visible page — not when it is
  // below it (a short window scrolled to the top never compacts). Wide, the
  // sticky bar covers the page's top 76px, so the card counts as gone once it
  // is under the bar, not only once it leaves the window: the date stepper is
  // hidden behind the bar before then.
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const obs = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: wide ? '-76px 0px 0px 0px' : '0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [wide])

  const controls = (
    <CompactControls stops={stops} dateStr={dateStr} isToday={isToday} onLevel={onLevel} onDate={onDate} />
  )

  // A fragment, not a wrapper: the bar must be a direct child of .screen to
  // stay stuck for the whole page on desktop. A sticky element sticks only
  // while its own parent is in view, and a wrapper would be one card tall.
  const st = stamp ? ' slatemast--stamp' : ''
  return (
    <>
      <header className={`slatemast__bar${st}${compact && wide ? ' is-compact' : ''}`}>
        <button type="button" className="slatemast__brand" onClick={onHome} aria-label="Tally, today's games">
          <TallyLockup height={wide ? 34 : 28} />
        </button>
        <div className="slatemast__centre">{wide && compact && controls}</div>
        <div className="slatemast__actions">{actions}</div>
      </header>

      <div ref={cardRef} className={`slatemast__card${st}`}>
        <LevelLadder stops={stops} onPick={onLevel} />
        <DateStepper dateStr={dateStr} isToday={isToday} onStep={onDate} onToday={onToday} />
      </div>

      {!wide && (
        <div className={`slatemast__compactbar${compact ? ' is-on' : ''}`}>
          <TallyBaseballMark size={30} title="" aria-hidden="true" className="slatemast__compactmark" />
          {controls}
        </div>
      )}
    </>
  )
}
