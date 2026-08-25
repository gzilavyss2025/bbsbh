import '../../styles/48d-stamp-detail.css'
import { useEffect, useRef } from 'react'
import { resolveStampArt } from '../../lib/ballpark/stampPrint.js'
import { useCopy } from '../../copy/copyContext.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// A bigger read of one filled slot on the stamp sheet (StampSheet.jsx) — the
// club or ballpark's own print, held under a soft, slowly-drifting spotlight
// like a case in a museum, next to your own history with it: the date you
// first stamped it, how many times, and the date you most recently did.
//
// NOT the checklist rule. `StampSheet.jsx`'s `counts` prop gates one specific
// thing — the ambient "N of 30" line, the completed-set ring, and the
// one-shot completion beat, none of which belong on the book page
// (docs/game-log.md §1/§3, "not a checklist"). This is a different register:
// nothing here shows until you tap ONE stamp you already hold, the same way
// StampGameButton.jsx's own "Details" disclosure only opens on a stamp you
// minted — so it renders identically whether it was opened from the book
// page or the retrospective, and needs no `counts`-style prop of its own.
//
// NO SPOILER SURFACE, same footing as StampSheet.jsx itself: `slot` carries a
// club id, a venue name, and your own stamp dates — never a score. Dialog
// contract (`.scrim`/`.sheet`, Escape, focus in/out) copied from
// components/ballpark/BallparkModal.jsx.
export function StampDetailModal({ kind, slot, onClose }) {
  const { t } = useCopy()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  if (!slot?.filled) return null

  const park = kind === 'park'
  const { name, art, caption } = resolveStampArt(slot, park, t, { full: true })
  const title = park ? name || caption : slot.label

  const first = humanDateWithYear(slot.date)
  const last = humanDateWithYear(slot.lastDate)
  const times = slot.stampCount ?? 0

  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet stampdetail" role="dialog" aria-modal="true" aria-label={title}>
        <div className="stampdetail__head">
          <h2 className="sheet__title">{title}</h2>
          <button ref={closeRef} className="stampdetail__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="stampdetail__case">
          {/* The perforated cream frame around the print — same mask
              (--perf, 48c-stamp-sheet.css) the small grid stamp uses, just
              bigger, so the enlarged read still reads as a STAMP rather than
              a plain photo card. */}
          <div className="stampdetail__frame">
            <div className="stampdetail__print">
              {park ? (
                <>
                  {art ? (
                    <img
                      src={art.src}
                      alt=""
                      className="stampdetail__photo"
                      style={art.focus ? { objectPosition: art.focus } : undefined}
                    />
                  ) : (
                    <div className="stampdetail__photo stampdetail__photo--empty" aria-hidden="true" />
                  )}
                  <span className="stampdetail__mark" aria-hidden="true">
                    <TeamLogo teamId={slot.id} name={slot.label} size={44} variant="mono" />
                  </span>
                </>
              ) : (
                <span className="stampdetail__club" aria-hidden="true">
                  <TeamLogo teamId={slot.id} name={slot.label} size={260} />
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="stampdetail__facts">
          <div className="stampdetail__fact">
            <dt>First stamped</dt>
            <dd>{first}</dd>
          </div>
          <div className="stampdetail__fact">
            <dt>Stamped</dt>
            <dd>{times === 1 ? '1 time' : `${times} times`}</dd>
          </div>
          <div className="stampdetail__fact">
            <dt>Most recently</dt>
            <dd>{last}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
