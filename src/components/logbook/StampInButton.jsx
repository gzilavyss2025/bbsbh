import { stampButtonState } from '../../lib/stampIn.js'

// The Stamp In page's per-row action — the control that mints a stamp for one
// game (ADR-0042).
//
// IT IS A CONTROL, NOT STAMP ART — which is why it is a new component rather
// than a reuse of GameStamp/StampGameButton, whose path allowlists in
// check-stamp-surfaces.mjs were not widened. A `GameStamp` import here fails
// lint, and it should.
//
// Presentational on purpose: the page reads `useStamps()` once, not once per
// row. That hook mounts a storage listener and re-parses the whole collection
// per echo, so 162 rows would turn one mint into 162 parses.
export function StampInButton({ stamped = false, seasonFull = false, onStamp, label = '' }) {
  const state = stampButtonState({ stamped, seasonFull })
  const suffix = label ? ` — ${label}` : ''

  if (state === 'stamped') {
    return (
      <span className="stampin__mark stampin__mark--on">
        <span className="stampin__check" aria-hidden="true">
          ✓
        </span>
        Stamped
        <span className="sr-only">{suffix}</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      className="stampin__mark stampin__mark--off"
      onClick={onStamp}
      disabled={state === 'full'}
      aria-label={`Stamp${suffix}`}
    >
      Stamp
    </button>
  )
}
