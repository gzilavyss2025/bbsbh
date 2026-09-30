import { useMemo, useRef, useState } from 'react'
import { sketchMarkVariants } from '../../lib/markSources.js'
import { TeamLogo } from './TeamLogo.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// A large grayscale team mark blown up for pencil-sketching, shown when the
// user taps a logo on a team page. Same tonal treatment as the printable Logo
// Sheet, just one club at a time and on demand. Carries no score, so it's
// spoiler-safe like the rest of the team pages. Dismiss by tapping the backdrop,
// the close button, or Escape.
//
// The segmented control flips between a club's distinct marks — cap, base,
// City Connect where we have the art, wordmark — so the sketcher can pick a
// different one instead of drawing the same roundel every time. The list is
// built per club by `sketchMarkVariants` (markSources.js), which is where the
// ordering and the City Connect condition are explained. Any mark a club
// happens to lack degrades to the base logo via TeamLogo's own fallback.
export function LogoModal({ teamId, name, onClose }) {
  const variants = useMemo(() => sketchMarkVariants(teamId), [teamId])
  const [variant, setVariant] = useState(variants[0].key)

  // Dialog focus contract: focus moves into the dialog on open (the close
  // button — the first and safest control) and back to the trigger on close,
  // so a keyboard/AT user isn't left focused on something under the scrim.
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="logomodal" role="dialog" aria-modal="true" aria-label={`${name} logo`}>
        <IconButton ref={closeRef} mark="md" className="logomodal__close" onClick={onClose} label="Close">
          ✕
        </IconButton>
        <TeamLogo
          teamId={teamId}
          name={name}
          size={240}
          bw
          variant={variant}
          className="logomodal__art"
        />
        <div className="logomodal__variants" role="group" aria-label="Logo style">
          {variants.map((v) => (
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
        <p className="logomodal__caption">Reference marks — not the tinted jersey tile</p>
      </div>
    </div>
  )
}
