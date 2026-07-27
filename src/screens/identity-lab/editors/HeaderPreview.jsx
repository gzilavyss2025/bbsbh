import { CopyIconButton } from '../../../components/CopyBox.jsx'

// A rough mockup of what the app's navy/gold header chrome could look like
// recolored to this club's brand for this treatment. Blue/Gold/Font are hex
// text fields seeded from whatever the profile resolves as landed (a
// TREATMENT_HEADER_COLOR_OVERRIDES / MILB_HEADER_COLOR_OVERRIDES entry, else
// the tile's own lead swatches); edits persist as a local draft, with a copy
// icon that hands over the three hexes plus the table path to land them at.
//
// Still a design-lab sketch: no shipped component reads the header tables yet.
// PR 6 of the Team Identity Lab plan is what wires them into TeamInfo, and
// renames the fields to the semantic { bar, accent, onBar } the theming feature
// needs — see .scratch/team-identity-lab/PRD.md §6.
export function HeaderPreview({ name, treatmentLabel, colors, hasDraft, copyText, onField, onReset }) {
  const { blue, gold, font } = colors
  return (
    <div className="colorlab__wpapreview colorlab__headerpreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Header colors</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} header-color context`} />
      </div>
      <div className="colorlab__headerpreviewbody">
        <div className="colorlab__headerfields">
          <label>
            <span>Blue</span>
            <input type="text" value={blue} onChange={(e) => onField('blue', e.target.value)} />
          </label>
          <label>
            <span>Gold</span>
            <input type="text" value={gold} onChange={(e) => onField('gold', e.target.value)} />
          </label>
          <label>
            <span>Font</span>
            <input type="text" value={font} onChange={(e) => onField('font', e.target.value)} />
          </label>
        </div>
        <div
          className="colorlab__headerbar"
          style={{ '--header-blue': blue, '--header-gold': gold, '--header-font': font }}
        >
          <span className="colorlab__headerbar__title">{name}</span>
        </div>
      </div>
    </div>
  )
}
