import { useEffect, useRef, useState } from 'react'
import { Loader } from './Loader.jsx'

// What's Brewing — a bottom-sheet modal that surfaces the narrative blurbs from
// the Brewers' pre-game Game Notes PDF (Hulk Logan, Don't Pitch to Mitch, …) as
// tap-to-read text, instead of sending the user straight out to the full PDF.
// The lineup page's Game notes button opens this for the Brewers; the whole-PDF
// link lives inside it ("modal first, PDF link inside"). Every other club still
// gets the plain link-out (see TeamInfo.jsx / whatsBrewing.js for why it's
// Brewers-only for now).
//
// Spoiler-safe: the blurbs are pre-game color that only recaps prior results, so
// this sits outside any seal like the rest of the lineup page. pdfjs is loaded
// lazily here (dynamic import) so it and the PDF only download when the sheet
// opens. Dismiss via the backdrop, the close button, or Escape.
export function WhatsBrewingModal({ notes, teamId, title = 'Game Notes', onClose }) {
  const [state, setState] = useState({ loading: true, blurbs: [] })

  useEffect(() => {
    let live = true
    import('../api/whatsBrewing.js')
      .then((m) => m.fetchWhatsBrewing(notes?.url, teamId))
      .then((blurbs) => live && setState({ loading: false, blurbs }))
      .catch(() => live && setState({ loading: false, blurbs: [] }))
    return () => {
      live = false
    }
  }, [notes?.url, teamId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Same dialog focus contract as LogoModal: focus into the sheet on open, back
  // to the trigger on close.
  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const { loading, blurbs } = state

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div
        className="sheet brewsheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="brewsheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button ref={closeRef} className="brewsheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {loading ? (
          <Loader size="inline" message="Reading the game notes…" className="brewsheet__loader" />
        ) : blurbs.length === 0 ? (
          <p className="brewsheet__status">
            Couldn&apos;t pull the notes text — open the full PDF below.
          </p>
        ) : (
          <ul className="brewsheet__list">
            {blurbs.map((b, i) => (
              <li key={i} className="brewblurb">
                <h3 className="brewblurb__title">{b.title}</h3>
                <p className="brewblurb__body">{b.body}</p>
              </li>
            ))}
          </ul>
        )}

        {notes?.url && (
          <a
            className="brewsheet__pdf"
            href={notes.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View full PDF
            <span className="brewsheet__ext" aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </div>
  )
}
