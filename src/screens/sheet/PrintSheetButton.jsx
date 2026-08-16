import { useState } from 'react'

// The one action on the sheet page: get this sheet off the screen and onto
// something useful.
//
// SAME TWO-STEP SHAPE AS `SavePosterButton` (components/preview), deliberately,
// because it is the same problem: a phone has exactly one route out of a web
// page into its own apps, and that route is the system share sheet. What differs
// is the PAYLOAD, and the difference is the reason this isn't literally that
// component. A poster's deliverable IS the bytes, so it hands `share()` a File.
// A scorecard's deliverable is ink on paper, and no phone makes that by itself —
// what it can do is hand the sheet to something that can: AirPrint, a Mac over
// AirDrop, a message to whoever is carrying the scorebook tonight. So this shares
// the sheet's own ADDRESS, and the printing happens wherever it lands.
//
// The poster asks `navigator.canShare({ files })` rather than feature-detecting
// `navigator.share`, because desktop Safari and Chrome both HAVE share() and both
// refuse files — the payload itself is the discriminator there. A URL is not:
// every desktop browser's share() accepts one happily, so `canShare` alone can't
// tell a phone from a laptop here. The discriminator that fits is the pointer. A
// coarse-pointer device is the one with a share sheet worth opening and no
// printer cable; everything else has a print dialog and should just get it.
//
// `window.print()` is not awaited and reports nothing — the browser's dialog is
// modal and its outcome isn't observable from script — so the print path resolves
// straight back to idle rather than claiming a success it can't see.
function prefersShareSheet() {
  try {
    return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches)
  } catch {
    return false
  }
}

function canShareUrl(url) {
  try {
    return Boolean(navigator.canShare?.({ url }))
  } catch {
    return false
  }
}

export function PrintSheetButton({ title, text }) {
  const [state, setState] = useState('idle')

  const onClick = async () => {
    if (state === 'working') return
    const url = window.location.href
    if (!prefersShareSheet() || !canShareUrl(url)) {
      window.print()
      return
    }
    setState('working')
    try {
      await navigator.share({ url, title, text })
      setState('done')
    } catch (err) {
      // Dismissing the share sheet is not a failure — go back to offering it.
      setState(err?.name === 'AbortError' ? 'idle' : 'error')
    }
  }

  const share = prefersShareSheet()
  const label = {
    idle: share ? 'Send this sheet' : 'Print this sheet',
    working: 'Sending',
    done: 'Sent',
    error: 'Try again',
  }[state]

  return (
    <button
      type="button"
      className={`btn printsheet-screen__go printsheet-screen__go--${state}`}
      onClick={onClick}
      disabled={state === 'working'}
      aria-label={
        state === 'error'
          ? 'Sending the sheet failed — try again'
          : share
            ? 'Send this scorecard to another app to print it'
            : 'Print this scorecard'
      }
    >
      {label}
    </button>
  )
}
