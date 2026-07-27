import { CopyIconButton } from '../../../components/CopyBox.jsx'

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
        <label>
          <span>Size</span>
          <input type="number" value={size} onChange={(e) => onField('size', Number(e.target.value))} />
        </label>
        <label>
          <span>Rotate</span>
          <input type="number" value={rotate} onChange={(e) => onField('rotate', Number(e.target.value))} />
        </label>
        <label>
          <span>X</span>
          <input type="number" value={offsetX} onChange={(e) => onField('offsetX', Number(e.target.value))} />
        </label>
        <label>
          <span>Y</span>
          <input type="number" value={offsetY} onChange={(e) => onField('offsetY', Number(e.target.value))} />
        </label>
        <label>
          <span>H-Pad</span>
          <input type="number" value={paddingX} onChange={(e) => onField('paddingX', Number(e.target.value))} />
        </label>
        <label>
          <span>V-Pad</span>
          <input type="number" value={paddingY} onChange={(e) => onField('paddingY', Number(e.target.value))} />
        </label>
        {/* Percent of a tile's width each row steps sideways from the one
            above it — 0 (the shipped default) is a plain grid, 50 the
            brickwork half-drop. */}
        <label>
          <span>Shift %</span>
          <input type="number" value={rowShift} onChange={(e) => onField('rowShift', Number(e.target.value))} />
        </label>
        <label className="colorlab__wpapreviewcolor">
          <span>{pinstripe ? 'Stripe' : 'Band'}</span>
          <input type="text" value={bandColor} onChange={(e) => onField('bandColor', e.target.value)} />
        </label>
        <label className="colorlab__wpapreviewcolor colorlab__wpapreviewcheck">
          <input type="checkbox" checked={pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
      </div>
    </div>
  )
}
