import { useEffect, useRef, useState } from 'react'
import { LOGO_VARIANTS } from '../lib/teams.js'
import { TeamLogo } from './TeamLogo.jsx'
import { TeamLink } from './TeamLink.jsx'

// A large grayscale team mark blown up for pencil-sketching, shown when the
// user taps a logo on a team page. Same tonal treatment as the printable Logo
// Sheet, just one club at a time and on demand. Carries no score, so it's
// spoiler-safe like the rest of the team pages. Dismiss by tapping the backdrop,
// the close button, or Escape.
//
// A club has three distinct marks on the CDN (primary / cap / wordmark, see
// teams.js); the segmented control flips between them so the sketcher can pick a
// different one instead of drawing the same roundel every time. Any mark a club
// happens to lack degrades to the base logo via TeamLogo's own fallback.
export function LogoModal({ teamId, name, onClose }) {
  const [variant, setVariant] = useState('primary')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Dialog focus contract: focus moves into the dialog on open (the close
  // button — the first and safest control) and back to the trigger on close,
  // so a keyboard/AT user isn't left focused on something under the scrim.
  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="logomodal" role="dialog" aria-modal="true" aria-label={`${name} logo`}>
        <button
          ref={closeRef}
          className="logomodal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <TeamLogo
          teamId={teamId}
          name={name}
          size={240}
          bw
          variant={variant}
          className="logomodal__art"
        />
        <div className="logomodal__variants" role="group" aria-label="Logo style">
          {LOGO_VARIANTS.map((v) => (
            <button
              key={v.key}
              className={`logomodal__variant ${
                variant === v.key ? 'is-active' : ''
              }`}
              onClick={() => setVariant(v.key)}
              aria-pressed={variant === v.key}
            >
              {v.label}
            </button>
          ))}
        </div>
        <TeamLink id={teamId} className="logomodal__name">
          {name}
        </TeamLink>
      </div>
    </div>
  )
}
