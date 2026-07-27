import { CopyIconButton } from '../../../components/CopyBox.jsx'

// The header chrome a lineup page wears when this club is in this jersey —
// Bar / Accent / On bar as hex text fields, seeded from whatever the profile
// resolves as landed (a TREATMENT_HEADER_COLOR_OVERRIDES /
// MILB_HEADER_COLOR_OVERRIDES entry, else the tile's own lead swatches); edits
// persist as a local draft, with a copy icon that hands over the three hexes
// plus the store path to land them at.
//
// No longer a sketch: since ADR-0030 these three drive the real
// `.teaminfo__head` bar and that side's section mastheads (screens/TeamInfo.jsx
// via lib/headerTheme.js). `coverage` says which side of that line this tile is
// on — a landed entry is what the app renders, an unlanded one is a proposal
// the app is still answering with default navy chrome. Coverage is partial by
// design, so the lab states it rather than leaving a preview that looks
// identical either way.
//
// `contrast` is the same WCAG ratio `scripts/check-contrast.mjs` computes over
// the landed store, shown live while you type: a pair that fails here fails
// `npm run lint` too, so the guard can't be discovered only at commit time.
const AA_TEXT = 4.5

export function HeaderPreview({
  name,
  treatmentLabel,
  colors,
  landed,
  contrast,
  hasDraft,
  copyText,
  onField,
  onReset,
}) {
  const { bar, accent, onBar } = colors
  const passes = contrast >= AA_TEXT
  return (
    <div className="colorlab__wpapreview colorlab__headerpreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Header colors</span>
        <span
          className={`colorlab__headercoverage${landed ? ' colorlab__headercoverage--on' : ''}`}
          title={
            landed
              ? 'This club wears these colors on its lineup page in this jersey.'
              : 'No landed entry — the lineup page falls back to default navy chrome for this jersey.'
          }
        >
          {landed ? 'Themed' : 'Default chrome'}
        </span>
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
            <span>Bar</span>
            <input type="text" value={bar} onChange={(e) => onField('bar', e.target.value)} />
          </label>
          <label>
            <span>Accent</span>
            <input type="text" value={accent} onChange={(e) => onField('accent', e.target.value)} />
          </label>
          <label>
            <span>On bar</span>
            <input type="text" value={onBar} onChange={(e) => onField('onBar', e.target.value)} />
          </label>
        </div>
        <div
          className="colorlab__headerbar"
          style={{ '--header-bar': bar, '--header-accent': accent, '--header-onbar': onBar }}
        >
          <span className="colorlab__headerbar__title">{name}</span>
        </div>
      </div>
      <p className={`colorlab__headercontrast${passes ? '' : ' colorlab__headercontrast--fail'}`}>
        {`On bar vs bar: ${contrast.toFixed(2)}:1 — ${passes ? 'clears' : 'FAILS'} WCAG AA (${AA_TEXT}:1)`}
      </p>
    </div>
  )
}
