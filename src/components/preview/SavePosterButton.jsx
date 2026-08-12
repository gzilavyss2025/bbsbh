import { useState } from 'react'
import { posterFile } from '../../lib/preview/drawPoster.js'

// Save the finished poster out of the canvas — on an iPhone, into Photos.
//
// The same two-step shape as SaveClipButton (components/highlights), and for
// the same reason: there is exactly one route from a web page into the camera
// roll, which is handing the bytes to the system share sheet as a File. What
// differs is where the bytes come from. A clip is a 60 MB cross-origin fetch,
// so it needs a progress bar and a second tap to regain user activation; a
// poster is already in memory, and canvas.toBlob() resolves in a few
// milliseconds — well inside the activation window. So the phone path shares
// straight from the first tap, and there is no percentage to report.
//
// The failure this button exists to make visible is a TAINTED canvas. Draw one
// image without CORS and toBlob() throws SecurityError forever after;
// lib/preview/posterImages.js is what prevents it, and this catch is what says
// so out loud instead of leaving a button that does nothing when pressed.
export function SavePosterButton({ canvasRef, filename, title, disabled }) {
  const [state, setState] = useState('idle')

  const saveViaLink = (file) => {
    const href = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked on a timeout, not immediately — Safari reads the URL after the
    // click returns, and revoking synchronously cancels the download.
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
  }

  const onClick = async () => {
    if (state === 'working' || disabled) return
    const canvas = canvasRef.current
    if (!canvas) return
    setState('working')
    try {
      const file = await posterFile(canvas, filename)
      // Asked with the real File rather than feature-detecting navigator.share:
      // desktop Safari and Chrome both HAVE share() and both refuse `files`.
      const canShare = (() => {
        try {
          return Boolean(navigator.canShare?.({ files: [file] }))
        } catch {
          return false
        }
      })()
      if (canShare) {
        await navigator.share({ files: [file], title })
        setState('done')
      } else {
        saveViaLink(file)
        setState('done')
      }
    } catch (err) {
      // Dismissing the share sheet is not a failure — go back to offering it.
      setState(err?.name === 'AbortError' ? 'idle' : 'error')
    }
  }

  const label = {
    idle: 'Save image',
    working: 'Saving',
    done: 'Saved',
    error: 'Try again',
  }[state]

  return (
    <button
      type="button"
      className={`posterstudio__save posterstudio__save--${state}`}
      onClick={onClick}
      disabled={disabled || state === 'working'}
      aria-label={
        state === 'error' ? 'Saving the poster failed — try again' : 'Save this preview as an image'
      }
    >
      {label}
    </button>
  )
}
