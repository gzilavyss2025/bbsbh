import { MOTION_MODES } from '../../../lib/account/preferences.js'
import { Cluster } from '../../../components/ui/layout/Cluster.jsx'

// Scorebook experience — how this app behaves while you are scoring.
//
// Keep Awake and the motion preference both live in the preference document, so
// both follow a signed-in user between devices. (The Scores Unlocked status row
// that once sat here, the one device-local setting, was removed in ADR-0116.)

// Each note says what the setting ACTUALLY does. `full` in particular does not
// override an operating system that asks for reduced motion — the app follows
// that request either way — and the copy no longer implies it does. See
// hooks/preferences/useMotionPreference.js for why that is the right default
// rather than a gap.
const MOTION_COPY = {
  system: { label: 'Follow my system', note: 'Whatever this device’s accessibility settings say.' },
  reduced: { label: 'Reduced', note: 'Skip the page turns, the stamp landing, and every other animation — everywhere in Tally.' },
  full: { label: 'Full', note: 'Keep the animations, unless this device’s own accessibility settings ask for less.' },
}

export function DeviceSection({
  keepAwake,
  onKeepAwake,
  motion,
  onMotion,
}) {
  return (
    <section className="mytally__section">
      <h2 className="mytally__sectiontitle">Scorebook experience</h2>

      <div className="mytally__field">
        <button
          type="button"
          className={`mytally__switch${keepAwake ? ' is-on' : ''}`}
          role="switch"
          aria-checked={keepAwake}
          onClick={() => onKeepAwake(!keepAwake)}
        >
          <span className="mytally__switchlabel">Keep the screen awake</span>
          <span className="mytally__switchtrack" aria-hidden="true">
            <span className="mytally__switchknob" />
          </span>
        </button>
        <p className="mytally__fieldnote caps-exempt">
          Holds the screen on while a game is live. Off by default — three hours of an
          always-on screen is a real battery cost.
        </p>
      </div>

      <div className="mytally__field">
        <p className="t-label mytally__fieldlabel">Motion</p>
        <Cluster className="mytally__choices" role="group" aria-label="Motion">
          {MOTION_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`mytally__choice${mode === motion ? ' is-active' : ''}`}
              aria-pressed={mode === motion}
              onClick={() => onMotion(mode)}
            >
              {MOTION_COPY[mode].label}
            </button>
          ))}
        </Cluster>
        <p className="mytally__fieldnote caps-exempt">{MOTION_COPY[motion]?.note ?? ''}</p>
      </div>

    </section>
  )
}
