import { MOTION_MODES } from '../../../lib/account/preferences.js'

// Scorebook experience — how this app behaves while you are scoring.
//
// Keep Awake and the motion preference both live in the preference document, so
// both follow a signed-in user between devices. Scores Unlocked does NOT, and
// that is the section's one load-bearing distinction (see below).

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
  passActive,
  passResetLabel,
  onReseal,
  spoiledDayCount,
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
        <p className="mytally__fieldlabel">Motion</p>
        <div className="mytally__choices" role="group" aria-label="Motion">
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
        </div>
        <p className="mytally__fieldnote caps-exempt">{MOTION_COPY[motion]?.note ?? ''}</p>
      </div>

      {/* ------------------------------------------------------------------
          Scores Unlocked is reported here and never SET here.

          It is a day-specific, explicitly consented, device-local render
          override (ADR-0026). There is deliberately no "always show scores"
          setting, no default-on preference, and nothing that pre-consents a
          future day — that is invariant P3, forbidden by name. And the pass
          expiry never syncs (P2): mirroring it would unseal a second device
          the user never consented on, which is the single worst thing this
          program could do.

          What IS offered is the same-day withdrawal the switch itself offers,
          because an accidental tap should stay recoverable from anywhere.
          ------------------------------------------------------------------ */}
      <div className="mytally__field">
        <p className="mytally__fieldlabel">Scores Unlocked</p>
        <p className="mytally__fieldvalue">{passActive ? 'On' : 'Off'}</p>
        <p className="mytally__fieldnote caps-exempt">
          {passActive
            ? `Today’s games are showing plainly until ${passResetLabel}. This device only — it is never carried to another one.`
            : 'Off. Every result stays sealed until you tap to reveal it. You agree to a single day at a time, on the day itself.'}
        </p>
        {passActive && (
          <button type="button" className="mytally__inlinebtn" onClick={onReseal}>
            Re-seal today
          </button>
        )}
        {spoiledDayCount > 0 && (
          <p className="mytally__fieldnote caps-exempt">
            {spoiledDayCount === 1
              ? 'One earlier day stays unsealed, because you agreed to it on the day.'
              : `${spoiledDayCount} earlier days stay unsealed, because you agreed to each on the day.`}
          </p>
        )}
      </div>
    </section>
  )
}
