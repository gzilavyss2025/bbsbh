// THE SWITCH (ADR-0112) — an on/off setting that takes effect at once: a ruled row
// with a label, a hint and the standard round-knob track (51 by 31, green when
// on). It is a button with role="switch", and it is the one round shape in the
// system: the shape every reader already knows as on and off. Styled in
// styles/system/report/controls.css.
//
//   label     the setting's name ("Show headshots"). It is the accessible name.
//   hint      one short line under it ("Turn off to save data").
//   checked   on or off.   onChange  called with the new value.
//   className the caller's namespace.
//
// A choice that waits for a Save button is a checkbox, not a switch.
export function Switch({ label, hint, checked, onChange, className = '', ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      className={`switch ${className}`.trim()}
      onClick={() => onChange?.(!checked)}
      {...rest}
    >
      <span>
        <span className="switch__label">{label}</span>
        {hint != null && hint !== '' && <span className="switch__hint">{hint}</span>}
      </span>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__knob" />
      </span>
    </button>
  )
}
