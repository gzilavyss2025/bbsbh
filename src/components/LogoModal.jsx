import { useEffect } from 'react'
import { TeamLogo } from './TeamLogo.jsx'

// A large grayscale team mark blown up for pencil-sketching, shown when the
// user taps a logo on a team page. Same tonal treatment as the printable Logo
// Sheet, just one club at a time and on demand. Carries no score, so it's
// spoiler-safe like the rest of the team pages. Dismiss by tapping the backdrop,
// the close button, or Escape.
export function LogoModal({ teamId, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="logomodal" role="dialog" aria-modal="true" aria-label={`${name} logo`}>
        <button
          className="logomodal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <TeamLogo teamId={teamId} name={name} size={240} bw className="logomodal__art" />
        <span className="logomodal__name">{name}</span>
        <span className="logomodal__hint">Grayscale reference for sketching · tap to close</span>
      </div>
    </div>
  )
}
