import { useEffect, useRef } from 'react'
import { highlightPlaybacks } from '../api/highlights.js'

// The video-highlight bottom sheet: opened from a "Watch highlight" button on
// an already-revealed play (see PlayByPlay.jsx). Reuses the app's existing
// .scrim/.sheet dialog contract (see BallparkModal/WhatsBrewingModal) rather
// than inventing new gesture/animation mechanics — dismiss via backdrop tap,
// Escape, or the close button; focus moves into the sheet on open and back to
// the trigger on close.
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
    <div
      className="scrim"
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
  )
}
