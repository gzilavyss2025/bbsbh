import { CopyIconButton } from '../../../components/ui/CopyBox.jsx'
import { HexField } from '../HexField.jsx'
import { shiftStepKeys } from './numberSteps.js'

// The editable Size/Rotate/X/Y/H-Pad/V-Pad/Shift%/Band/Pinstripe knobs for THIS
// treatment's WPA band — one per tile, not one per team, since a real game can
// wear ANY of a club's treatments (the chart reads that from that night's
// actual uniform, api/jerseys.js) rather than always tiling Main.
//
// Band color can also be set by clicking a swatch in the tile's own color row
// (ColorSwatch's onPickWpaBand) instead of typing a hex here. Used to carry its
// own live single-tile SVG mockup alongside these fields; dropped in favor of
// WpaScenarios, which shows the SAME knobs' real effect against a real opponent
// at three score states instead of one static tile with no sense of scale.
export function WpaPreview({
  name,
  treatmentLabel,
  layout,
  pinstripe,
  bandColor,
  bandBg,
  ownArt,
  artUpload,
  wordmark,
  hasDraft,
  copyText,
  onField,
  onReset,
}) {
  const { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } = layout

  return (
    <div className="colorlab__wpapreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">WPA</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} WPA context`} />
      </div>
      <div className="colorlab__wpapreviewfields">
        {/* Checked (the default — `ownArt` absent/false) tiles the exact same
            mark this treatment's own logo box shows, unchanged from before
            this checkbox existed. Unchecked switches to a separately
            uploaded WPA-only mark (artUpload below) — absent for MiLB, which
            has no WPA-only upload destination (src/lib/logoArt.js). */}
        {artUpload && (
          <label className="colorlab__wpapreviewcolor colorlab__wpapreviewcheck">
            <input
              type="checkbox"
              checked={!ownArt}
              onChange={(e) => onField('ownArt', !e.target.checked)}
            />
            <span>Use Logo Art</span>
          </label>
        )}
        {/* MiLB-only (mlb.jsx never passes this prop) — the minimal
            counterpart to MLB's own art-source picker above: one on/off
            switch to tile the club's wordmark instead of its normal mark,
            rather than a whole second upload/library system. */}
        {wordmark !== undefined && (
          <label className="colorlab__wpapreviewcolor colorlab__wpapreviewcheck">
            <input
              type="checkbox"
              checked={wordmark}
              onChange={(e) => {
                const checked = e.target.checked
                onField('wpaWordmark', checked)
                // A wordmark reads at a very different scale/crop than the
                // club's normal mark, so ticking this dials Size/H-Pad/V-Pad
                // to values tuned for wordmark art. Unticking clears those
                // three back to whatever the landed override/default chain
                // would otherwise show (milbWpaLogoLayout), rather than
                // guessing at a prior value to restore.
                if (checked) {
                  onField('size', 65)
                  onField('paddingX', 10)
                  onField('paddingY', -35)
                } else {
                  onField('size', undefined)
                  onField('paddingX', undefined)
                  onField('paddingY', undefined)
                }
              }}
            />
            <span>Use wordmark</span>
          </label>
        )}
        <LayoutField label="Size" field="size" value={size} onField={onField} />
        <LayoutField label="Rotate" field="rotate" value={rotate} onField={onField} />
        <LayoutField label="X" field="offsetX" value={offsetX} onField={onField} />
        <LayoutField label="Y" field="offsetY" value={offsetY} onField={onField} />
        <LayoutField label="H-Pad" field="paddingX" value={paddingX} onField={onField} />
        <LayoutField label="V-Pad" field="paddingY" value={paddingY} onField={onField} />
        {/* Percent of a tile's width each row steps sideways from the one
            above it — 0 (the shipped default) is a plain grid, 50 the
            brickwork half-drop. */}
        <LayoutField label="Shift %" field="rowShift" value={rowShift} onField={onField} />
        <label className="colorlab__wpapreviewcolor">
          <span>{pinstripe ? 'Stripe' : 'Band'}</span>
          <HexField value={bandColor} onChange={(v) => onField('bandColor', v)} />
        </label>
        <label className="colorlab__wpapreviewcolor colorlab__wpapreviewcheck">
          <input type="checkbox" checked={pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
        {/* The colored fill under the stripes — same White Sox City Connect
            case the Position panel's own Fill field covers, mirrored here so
            the WPA band can carry it too. `bandBg` is undefined only when a
            profile (MiLB) never supplies one at all — gated the same
            defensive way as that field rather than solely on `pinstripe`, so
            an uncontrolled-input warning can't happen there. */}
        {pinstripe && bandBg !== undefined && (
          <label className="colorlab__wpapreviewcolor">
            <span>Fill</span>
            <HexField value={bandBg} placeholder="#hex (white)" onChange={(v) => onField('bandBg', v)} />
          </label>
        )}
      </div>
      {ownArt && artUpload}
    </div>
  )
}

// The seven layout knobs are the same field seven times over — one whole-number
// box that also takes Shift+Arrow for a coarse nudge against the scenario
// mockups pinned beside it.
function LayoutField({ label, field, value, onField }) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onField(field, Number(e.target.value))}
        onKeyDown={shiftStepKeys(value, 1, (v) => onField(field, v))}
      />
    </label>
  )
}
