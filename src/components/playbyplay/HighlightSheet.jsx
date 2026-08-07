import { useEffect, useRef } from 'react'
import { highlightPlaybacks } from '../../api/highlights.js'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { SaveClipButton } from '../highlights/SaveClipButton.jsx'

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

  // Captions OFF by default. MLB's HLS manifests carry subtitle tracks, and
  // Safari/Chrome will auto-enable one whenever the viewer's OS caption
  // preference says to — which on a 30-second clip means burned-in text over
  // the play you opened it to watch. Disabling them is a DEFAULT, not a
  // removal: the tracks stay in the manifest and the player's own captions
  // menu still turns them back on for anyone who wants them.
  //
  // Two passes are needed because an HLS track list is populated
  // asynchronously, after the manifest parses — the tracks almost never exist
  // yet at mount, so the `addtrack` listener is what actually does the work
  // most of the time, and the initial sweep covers the progressive-mp4 case.
  const videoRef = useRef(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const silence = () => {
      for (const track of video.textTracks) track.mode = 'disabled'
    }
    silence()
    video.textTracks.addEventListener?.('addtrack', silence)
    return () => video.textTracks.removeEventListener?.('addtrack', silence)
  }, [item])

  if (!item) return null
  const { hls, mp4 } = highlightPlaybacks(item)
  const title = item.title || item.headline || 'Highlight'
  // "condensed-game-mil-stl-7-7-26.mp4" — the content item's own readable slug
  // (see classifyHighlight's note on why `id` is the stable identity, not
  // `guid`), so a saved file says what it is in the camera roll.
  const filename = `${item.id || 'highlight'}.mp4`

  return (
    <ModalPortal>
      <div
        className="scrim scrim--center"
        onClick={(e) => e.target.classList.contains('scrim') && onClose()}
      >
        <div className="sheet hlsheet" role="dialog" aria-modal="true" aria-label={title}>
          <div className="hlsheet__head">
            <h2 className="sheet__title">{title}</h2>
            <div className="hlsheet__actions">
              {/* Only ever the MP4: the HLS stream is a manifest of segments,
                  not a file anything can save. A clip with no MP4 rendition
                  simply gets no save button. */}
              {mp4 && <SaveClipButton url={mp4} title={title} filename={filename} />}
              <button ref={closeRef} className="hlsheet__close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          <div className="hlsheet__video">
            {hls || mp4 ? (
              // playsInline keeps this from taking over the whole screen on
              // iPhone Safari; no poster (see the spoiler note above). HLS
              // plays natively in Safari, so no hls.js dependency is needed for
              // this app's primary target — mp4Avc is the fallback <source>.
              <video ref={videoRef} controls playsInline preload="none">
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
