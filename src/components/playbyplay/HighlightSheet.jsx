import { useEffect, useRef } from 'react'
import { highlightPlaybacks } from '../../api/highlights.js'
import { ModalPortal } from '../ui/ModalPortal.jsx'

// The video-highlight player: opened from any "Watch" button in the app — a
// revealed play (PlayByPlay.jsx), the box score's Play of the Game and video
// row (GameVideoRow.jsx), the team and player rails. Reuses the app's existing
// .scrim/.sheet dialog contract (see BallparkModal/WhatsBrewingModal) rather
// than inventing new gesture/animation mechanics — dismiss via backdrop tap,
// Escape, or the close button; focus moves into the sheet on open and back to
// the trigger on close.
//
// CENTERED, not docked, which is the one place it departs from that contract:
// `scrim--center` overrides the shared scrim's bottom dock for this dialog
// only, because a video is a thing you look AT rather than a panel you pull
// up, and a 16:9 frame anchored to the bottom edge wastes the screen it most
// wants. Everything about the sizing is in .hlsheet's own CSS block.
//
// The ModalPortal wrapper is not optional: this sheet is declared inside a
// half-inning page, whose `.turnscene` ancestor isolates its stacking context,
// so without the portal the floating Refresh pill and reveal bar paint over
// the video (and eat taps aimed at it). See ModalPortal.jsx.
//
// Spoiler note: by the time this is open, the play it belongs to is already
// revealed prose on the card above it, so the clip's own title/description
// carry no additional spoiler risk here — unlike the WATCH BUTTON itself,
// which must stay generic (see PlayByPlay.jsx). No `poster` attribute is set
// on the video, matching that same discipline.
export function HighlightSheet({ item, onClose }) {
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

  if (!item) return null
  const { hls, mp4 } = highlightPlaybacks(item)
  const title = item.title || item.headline || 'Highlight'

  return (
    <ModalPortal>
      <div
        className="scrim scrim--center"
        onClick={(e) => e.target.classList.contains('scrim') && onClose()}
      >
        <div className="sheet hlsheet" role="dialog" aria-modal="true" aria-label={title}>
          <div className="hlsheet__head">
            <h2 className="sheet__title">{title}</h2>
            <button ref={closeRef} className="hlsheet__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="hlsheet__video">
            {hls || mp4 ? (
              // playsInline keeps this from taking over the whole screen on
              // iPhone Safari; no poster (see the spoiler note above). HLS
              // plays natively in Safari, so no hls.js dependency is needed for
              // this app's primary target — mp4Avc is the fallback <source>.
              <video controls playsInline preload="none">
                {hls && <source src={hls} type="application/vnd.apple.mpegurl" />}
                {mp4 && <source src={mp4} type="video/mp4" />}
              </video>
            ) : (
              <p className="hlsheet__empty">This clip isn’t playable right now.</p>
            )}
          </div>

          {item.description && <p className="hlsheet__desc">{item.description}</p>}
        </div>
      </div>
    </ModalPortal>
  )
}
