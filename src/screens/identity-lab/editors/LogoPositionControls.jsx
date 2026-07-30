import { CopyIconButton } from '../../../components/CopyBox.jsx'
import { shiftStepKeys } from './numberSteps.js'

// A compact numeric-precision editor for the same scale/offset knobs the main
// rectangle's own logo already renders with — the "move it around" counterpart
// to WpaPreview's Size/X/Y fields, for the one non-tiled mark this lab shows
// per treatment instead of a repeating WPA pattern. One section of the jersey
// bench's tuning stack, judged against the logo stage pinned beside it.
//
// One copy for both the MLB and MiLB profiles: the fields, the markup, and the
// draft-beats-landed-beats-default chain feeding them are identical, only the
// tables a value lands in differ (that's the profile's own copy-text builder).
export function LogoPositionControls({
  name,
  treatmentLabel,
  scale,
  offsetX,
  offsetY,
  bg,
  pinstripe,
  pinstripeBg,
  hasDraft,
  copyText,
  onField,
  onReset,
}) {
  return (
    <div className="idlab__section">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Position</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} logo-position context`} />
      </div>
      <div className="colorlab__posinlinefields">
        <label>
          <span>Scale</span>
          <input
            type="number"
            step="0.01"
            value={scale}
            onChange={(e) => onField('scale', Number(e.target.value))}
            onKeyDown={shiftStepKeys(scale, 0.01, (v) => onField('scale', v))}
          />
        </label>
        <label>
          <span>X</span>
          <input
            type="number"
            value={offsetX}
            onChange={(e) => onField('offsetX', Number(e.target.value))}
            onKeyDown={shiftStepKeys(offsetX, 1, (v) => onField('offsetX', v))}
          />
        </label>
        <label>
          <span>Y</span>
          <input
            type="number"
            value={offsetY}
            onChange={(e) => onField('offsetY', Number(e.target.value))}
            onKeyDown={shiftStepKeys(offsetY, 1, (v) => onField('offsetY', v))}
          />
        </label>
        <label className="colorlab__posbgfield">
          <span>{pinstripe ? 'Stripe' : 'Background'}</span>
          <input type="text" value={bg} placeholder="#hex" onChange={(e) => onField('bg', e.target.value)} />
        </label>
        <label className="colorlab__posbgfield colorlab__poscheck">
          <input type="checkbox" checked={pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
        {/* The colored fill under the stripes (White Sox City Connect's red) —
            `pinstripeBg` is undefined for Main, which has no fill-color concept
            in the data model (MAIN_OVERRIDES' pinstripe is line-color only), so
            this never renders there. White is the shared default when unset. */}
        {pinstripe && pinstripeBg !== undefined && (
          <label className="colorlab__posbgfield">
            <span>Fill</span>
            <input
              type="text"
              value={pinstripeBg}
              placeholder="#hex (white)"
              onChange={(e) => onField('pinstripeBg', e.target.value)}
            />
          </label>
        )}
      </div>
    </div>
  )
}
