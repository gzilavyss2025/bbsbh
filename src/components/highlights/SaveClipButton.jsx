import { useCallback, useEffect, useRef, useState } from 'react'

// Save a clip's MP4 out of the highlight player (HighlightSheet.jsx) — on an
// iPhone, into Photos rather than Files.
//
// WHY THIS IS A SHARE AND NOT A DOWNLOAD LINK. iOS Safari ignores an anchor's
// `download` attribute for a cross-origin file, and its Downloads manager puts
// what it does fetch into Files → Downloads. There is exactly one route from a
// web page into the camera roll: hand the bytes to the system share sheet as a
// File, where "Save Video" is one of the offered destinations. So this fetches
// the MP4 itself, wraps it in a File, and calls navigator.share(). MLB's CDN
// serves `access-control-allow-origin: *` (verified 2026-08-06 against
// mlb-cuts-diamond.mlb.com), which is what makes reading the bytes possible at
// all — without that header no amount of client code could do this.
//
// WHY IT TAKES TWO TAPS ON A PHONE. navigator.share() must be called while the
// page still holds user activation, and a 60 MB fetch outlives it — sharing
// straight after the await throws NotAllowedError. So the first tap downloads
// (with progress, since these are real files), and the second, on a button
// that now says SAVE TO PHOTOS, opens the share sheet inside a fresh gesture.
// Anywhere without file-sharing support — every desktop browser — there is no
// second step: the fetch finishes and the file drops straight into Downloads
// through an object URL, which honors `download` because it is same-origin.
//
// SIZES ARE NOT SMALL. A highlight clip is ~10-70 MB; the condensed game is
// ~360 MB (measured, 11:26 at 4000K). Hence the progress percentage rather
// than a spinner, and hence the abort on unmount — closing the player has to
// stop a download that could otherwise run for minutes on cellular.
export function SaveClipButton({ url, title, filename }) {
  // idle → working (fetching, with percent) → ready (phone only: bytes in
  // hand, waiting for the second tap) → done. `error` is its own resting
  // state so the button can say so without a toast system.
  const [state, setState] = useState('idle')
  const [percent, setPercent] = useState(0)
  const fileRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
      fileRef.current = null
    },
    [],
  )

  // Whether THIS file can go through the share sheet. Asked with a real File
  // rather than a feature-detect on navigator.share, because desktop Safari
  // and Chrome both have share() but refuse `files` — canShare is the only
  // honest answer, and it wants the actual thing you intend to share.
  const canShareFile = (file) => {
    try {
      return Boolean(navigator.canShare?.({ files: [file] }))
    } catch {
      return false
    }
  }

  const saveViaLink = (file) => {
    const href = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked on a timeout, not immediately: Safari reads the URL after the
    // click returns, and revoking synchronously cancels the download.
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
  }

  const share = useCallback(
    async (file) => {
      try {
        await navigator.share({ files: [file], title })
        setState('done')
      } catch (err) {
        // AbortError is the user dismissing the share sheet — not a failure,
        // and the file is still in hand, so stay offering the save.
        setState(err?.name === 'AbortError' ? 'ready' : 'error')
      }
    },
    [title],
  )

  const onClick = async () => {
    if (state === 'working') return
    if (state === 'ready' && fileRef.current) {
      await share(fileRef.current)
      return
    }

    setState('working')
    setPercent(0)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`clip download ${res.status}`)
      const total = Number(res.headers.get('content-length')) || 0

      // Streamed so the percentage is real. A body with no reader (or no
      // content-length to divide by) still works — it just lands at 100%
      // in one step instead of counting up.
      let blob
      if (res.body?.getReader && total) {
        const reader = res.body.getReader()
        const chunks = []
        let received = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          setPercent(Math.min(99, Math.round((received / total) * 100)))
        }
        blob = new Blob(chunks, { type: 'video/mp4' })
      } else {
        blob = await res.blob()
      }

      const file = new File([blob], filename, { type: 'video/mp4' })
      fileRef.current = file
      setPercent(100)

      if (canShareFile(file)) {
        // Second tap opens the share sheet with activation intact.
        setState('ready')
      } else {
        saveViaLink(file)
        setState('done')
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
      setState('error')
    } finally {
      abortRef.current = null
    }
  }

  const label = {
    idle: 'Save',
    working: `${percent}%`,
    ready: 'Save to Photos',
    done: 'Saved',
    error: 'Try again',
  }[state]

  const aria = {
    idle: `Save this video`,
    working: `Downloading, ${percent} percent`,
    ready: 'Save this video to Photos',
    done: 'Video saved',
    error: 'Saving failed — try again',
  }[state]

  return (
    <button
      type="button"
      className={`hlsheet__save hlsheet__save--${state}`}
      onClick={onClick}
      disabled={state === 'working'}
      aria-label={aria}
    >
      {/* Tray-and-arrow drawn in CSS (::before) so there's no icon font or
          inline SVG to carry; hidden once the button is only reporting a
          percentage. */}
      <span className="hlsheet__saveLabel">{label}</span>
    </button>
  )
}
