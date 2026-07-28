import { CopyIconButton } from '../../../components/CopyBox.jsx'

// Every treatment's own independent Primary/Secondary/Accent 1/Accent 2 —
// Main included. Deliberately a SEPARATE panel from the swatch row above it
// (`ColorSwatch`/`mlbColorRoles.js`'s Main-only triad): that triad is one
// club-wide brand identity value; this is per-jersey research/reference
// color notes, four fixed slots so editing has a stable slot-to-role mapping
// (same reasoning TreatmentBox.jsx's own swatch-editing comment gives).
export function TreatmentColorControls({ slots, hasDraft, onReset, onField, copyText }) {
  return (
    <div className="colorlab__tcolors">
      <div className="colorlab__tcolorshead">
        <span className="colorlab__tcolorslabel">Colors</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label="Copy this treatment's colors" />
      </div>
      <div className="colorlab__tcolorsrow">
        {slots.map((s) => (
          <label key={s.role} className="colorlab__tcolorfield">
            <span className="colorlab__tcolorfieldlabel">{s.label}</span>
            <input
              type="text"
              className="colorlab__swatchhexinput"
              placeholder="#hex"
              value={s.hex}
              onChange={(e) => onField(s.role, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
