import { useEffect, useId, useRef, useState } from 'react'
import { markIntroSeenIn } from '../../lib/account/intro.js'
import { clearTallyDataIn } from '../../lib/account/localData.js'
import { browserStorage } from '../../lib/account/preferencesStorage.js'

// "Erase my Tally data" — the confirm sheet behind the two deletion actions in
// My Tally's Sync & data section. Deliberately TWO actions, never one:
//
//   scope 'device'   clear every `bbsbh:` key on this device. Works signed in,
//                    signed out, and on a deploy with no account feature at
//                    all, because the local copy is the one that always exists.
//   scope 'account'  DELETE /api/account (the server's prefs / spoiled-day /
//                    scorebook / stamp / reveal keys for the verified `sub`),
//                    and then clear this device too — the endpoint erases only
//                    the server side, so "erase everything" has to do both or
//                    it is not what it says.
//
// THE ORDERING MATTERS AND THE COPY SAYS SO. Deleting the Clerk account first
// leaves this data addressed to a userId that can never be re-issued —
// unreachable, but not erased. A `user.deleted` webhook is the robust fix and
// is deliberately deferred (it needs a signing secret, a public unauthenticated
// endpoint and dashboard configuration); until it exists, the honest thing is
// to state the order plainly rather than hide the residue. See api/account.js.
//
// Clerk-free on purpose: the account erase arrives as an `eraseAccount` prop
// from the Clerk-gated section above, so this sheet renders identically whether
// or not this deploy configures an account.
//
// Safety-by-default, same posture as ConsentModal: the CANCEL button is
// rendered first and takes initial focus, so an inattentive Enter or tap keeps
// your data. Nothing here is undoable.

const COPY = {
  device: {
    title: 'Erase this device',
    body: 'This clears everything Tally has saved in this browser — your club and settings, how far you have opened each game, the days you unsealed, and your Game Log.',
    tail: 'Your account, if you have one, keeps its copy. Signing in again brings it back.',
    confirm: 'Erase this device',
    working: 'Erasing…',
  },
  account: {
    title: 'Erase everything',
    body: 'This clears your Tally data from your account and from this browser — your club and settings, how far you have opened each game, the days you unsealed, and your Game Log.',
    tail: 'Erase your Tally data first, then delete your account. Deleting the account on its own leaves this data unreachable but not erased.',
    confirm: 'Erase everything',
    working: 'Erasing…',
  },
}

export function EraseDataDialog({ scope = 'device', eraseAccount = null, onClose }) {
  const copy = COPY[scope] ?? COPY.device
  const [state, setState] = useState('ask') // ask | working | failed
  const sheetRef = useRef(null)
  const cancelRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const trigger = document.activeElement
    cancelRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  // Focus trap + Escape, handled ON the dialog so aria-modal="true" is a
  // promise rather than a label. Same shape as ConsentModal.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (state !== 'working') onClose()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusable = sheetRef.current.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // The local half. Every hook in the app re-reads its key on mount, so the
  // only honest way to show the erased state is to start the app over — a
  // navigation to the slate rather than a re-render with a dozen stale stores.
  const wipeDeviceAndRestart = () => {
    clearTallyDataIn(browserStorage())
    // Erasing sweeps `bbsbh:intro` along with everything else, which made the
    // reload look like a brand-new visitor and reopened the welcome modal.
    // That is a bad moment on its own — you asked to be forgotten and got
    // onboarded — but it was also a live data bug: ANY exit from that modal
    // commits its pick, defaulting to the pinned club, and with `bbsbh:prefsOwner`
    // swept too the strategy falls back to `backfill`, so a still-signed-in
    // user's real club was overwritten with the default on every device.
    //
    // Re-seeding the flag is the whole fix: someone who just used the erase
    // sheet has plainly seen the intro.
    markIntroSeenIn(browserStorage())
    window.location.assign('/')
  }

  const run = async () => {
    if (scope === 'device' || !eraseAccount) {
      wipeDeviceAndRestart()
      return
    }
    setState('working')
    const ok = await eraseAccount()
    // A server erase that failed must NOT silently wipe the device: the user
    // asked for both, and doing half of it while reporting nothing is how a
    // "gone" that is not gone happens. Offer the local half explicitly instead.
    if (!ok) {
      setState('failed')
      return
    }
    wipeDeviceAndRestart()
  }

  return (
    <div
      className="scrim"
      onClick={(e) => state !== 'working' && e.target.classList.contains('scrim') && onClose()}
    >
      <div
        ref={sheetRef}
        className="sheet erasesheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="sheet__title erasesheet__title">
          {copy.title}
        </h2>
        <p className="sheet__body erasesheet__body caps-exempt">{copy.body}</p>
        <p className="erasesheet__tail caps-exempt">{copy.tail}</p>
        {state === 'failed' && (
          <p className="hint hint--error erasesheet__error caps-exempt" role="status">
            Your account could not be reached, so nothing was erased. Try again in a
            moment, or clear this device on its own.
          </p>
        )}
        <div className="erasesheet__actions">
          <button
            ref={cancelRef}
            type="button"
            className="erasesheet__btn"
            // aria-disabled, not `disabled`. A button that disables itself under
            // the user's focus drops focus to <body> — and this dialog's Escape
            // handler and Tab trap are both bound to the dialog element, so from
            // <body> neither one can fire: Escape stops working and Tab walks
            // straight out into the page behind the scrim, breaking the
            // aria-modal promise. ConsentModal, which this is modelled on, never
            // disables its buttons for exactly this reason.
            aria-disabled={state === 'working'}
            onClick={() => state !== 'working' && onClose()}
          >
            Keep my data
          </button>
          {state === 'failed' ? (
            <button
              type="button"
              className="erasesheet__btn erasesheet__btn--danger"
              onClick={wipeDeviceAndRestart}
            >
              Erase this device only
            </button>
          ) : (
            <button
              type="button"
              className="erasesheet__btn erasesheet__btn--danger"
              aria-disabled={state === 'working'}
              onClick={() => state !== 'working' && run()}
            >
              {state === 'working' ? copy.working : copy.confirm}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
