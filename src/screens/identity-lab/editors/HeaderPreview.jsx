import { HexField } from '../HexField.jsx'

// The header chrome a lineup page wears when this club is in this jersey —
// Bar / Accent / On bar. Split into three pieces because the redesign puts them
// in two different places: the fields and the umpire's call live in the club's
// Header bars panel (the ONLY place a header is editable — TwoBarsPanel), while
// the bar mock alone also rides in every jersey bench's preview column, where it
// is read-only and captioned with which bar that jersey wears.
//
// No longer a sketch: since ADR-0030 these three drive the real
// `.teaminfo__head` bar and that side's section mastheads (screens/TeamInfo.jsx
// via lib/headerTheme.js). Coverage is partial by design, so the panel states
// which side of that line a club is on (the Themed / Default chrome chip)
// rather than leaving a preview that looks identical either way.
const AA_TEXT = 4.5

// `colors` is fully resolved (every slot filled with a fallback, so the bar
// always has something to paint); `unset` is true when NOTHING is landed or
// drafted for this bar, which the app answers with default navy chrome — drawn
// as an empty outline rather than a painted bar, so "not set" can't be mistaken
// for "set to navy".
export function HeaderBarMock({ name, colors, unset }) {
  if (unset) {
    return (
      <div className="idlab__barmock idlab__barmock--unset">
        <span className="idlab__barmock__empty">Not set — default navy chrome</span>
      </div>
    )
  }
  return (
    <div
      className="idlab__barmock"
      style={{ '--header-bar': colors.bar, '--header-accent': colors.accent, '--header-onbar': colors.onBar }}
    >
      <span className="idlab__barmock__title">{name}</span>
    </div>
  )
}

// `rawColors` stays undefined per-field when neither a draft nor the landed
// store actually has it, so a genuinely unset field shows blank with its
// placeholder rather than a resolved color that looks saved but isn't.
export function HeaderFields({ rawColors, onField }) {
  return (
    <div className="colorlab__headerfields">
      <label>
        <span>Bar</span>
        <HexField
          placeholder="not set"
          value={rawColors.bar ?? ''}
          onChange={(v) => onField('bar', v)}
        />
      </label>
      <label>
        <span>Accent</span>
        <HexField
          placeholder="not set"
          value={rawColors.accent ?? ''}
          onChange={(v) => onField('accent', v)}
        />
      </label>
      <label>
        <span>On bar</span>
        <HexField
          placeholder="not set"
          value={rawColors.onBar ?? ''}
          onChange={(v) => onField('onBar', v)}
        />
      </label>
    </div>
  )
}

// The same WCAG ratio `scripts/check-contrast.mjs` computes over the landed
// store, live while you type: a pair that fails here fails `npm run lint` too,
// so the guard can't be discovered only at commit time. Called like an umpire
// because a bare decimal is a number to interpret and SAFE/OUT is a verdict —
// the ratio itself stays on the chip so nothing is lost.
export function UmpireCall({ contrast }) {
  const passes = contrast >= AA_TEXT
  return (
    <div className="idlab__umpire">
      <span className={`idlab__umpirechip${passes ? '' : ' idlab__umpirechip--out'}`}>
        {passes ? 'Safe' : 'Out'} · {contrast.toFixed(2)}:1
      </span>
      <span className="idlab__umpirenote">On bar vs bar — WCAG AA needs {AA_TEXT}:1</span>
    </div>
  )
}
