import { LogoPositionControls } from './editors/LogoPositionControls.jsx'
import { WpaPreview } from './editors/WpaPreview.jsx'
import { WpaScenarios } from './editors/WpaScenarios.jsx'
import { HeaderPreview } from './editors/HeaderPreview.jsx'

// One tile: the mark on its curated fill, that fill's swatches, and the three
// editors stacked under it. The profile resolves every value (its own tables,
// its own draft chain, its own copy-text wording) and hands them in; this file
// owns only the composition, so the MLB and MiLB dimensions can't drift into
// two different card layouts the way the two lab screens had begun to.
//
// The MLB-only bits are absent rather than special-cased: `nameField` is null
// for MiLB (no uniform catalog to name a jersey from — see src/api/CLAUDE.md),
// and its swatches simply arrive without a `onPickWpaBand` handler, so they
// render as plain chips instead of "try this as the band color" buttons.
export function TreatmentBox({
  label,
  nameField,
  logoBox,
  swatches,
  position,
  wpa,
  scenarios,
  header,
}) {
  return (
    <div className="colorlab__treatment">
      <div className="colorlab__treatmentlabelrow">
        <span className="colorlab__treatmentlabel">{label}</span>
        {nameField && (
          <input
            className="searchbox__input colorlab__nameinput"
            value={nameField.value}
            placeholder="Display name"
            onChange={(e) => nameField.onChange(e.target.value)}
          />
        )}
      </div>
      <div className="colorlab__treatmentbox">
        <div className={logoBox.className} style={logoBox.style}>
          {logoBox.children}
        </div>
        <div className="colorlab__swatchrow">
          {swatches.map((swatch, i) => (
            <ColorSwatch key={i} {...swatch} />
          ))}
        </div>
        <LogoPositionControls {...position} />
      </div>
      <WpaPreview {...wpa} />
      <WpaScenarios {...scenarios} />
      <HeaderPreview {...header} />
    </div>
  )
}

// `onPickWpaBand`, when supplied, turns the chip into a button that sets this
// swatch's hex as the WPA preview's band color — a quick "try this one" instead
// of hand-typing a hex. `wpaSelected` rings the chip currently doing that job,
// in a distinct ring color (--accent-primary) from `active`'s
// (--accent-positive), so the two "this swatch is driving X" indicators — the
// tile's own background vs. the WPA preview's band — never read as the same
// claim. A null `swatch` is a slot the club has no color for yet.
function ColorSwatch({ swatch, active, wpaSelected, onPickWpaBand }) {
  if (!swatch) {
    return (
      <div className="colorlab__swatchcell colorlab__swatchcell--placeholder">
        <div className="colorlab__swatchchip colorlab__swatchchip--placeholder" />
        <span className="colorlab__swatchlabel">—</span>
      </div>
    )
  }
  const cellClass = `colorlab__swatchcell${active ? ' colorlab__swatchcell--active' : ''}${wpaSelected ? ' colorlab__swatchcell--wpaselected' : ''}`
  return (
    <div className={cellClass}>
      {onPickWpaBand ? (
        <button
          type="button"
          className="colorlab__swatchchip colorlab__swatchchip--btn"
          style={{ background: swatch.hex }}
          onClick={onPickWpaBand}
          aria-label={`Use ${swatch.label} (${swatch.hex}) as this tile's WPA band color`}
          title="Use as WPA band color"
        />
      ) : (
        <div className="colorlab__swatchchip" style={{ background: swatch.hex }} />
      )}
      <span className="colorlab__swatchlabel">{swatch.label}</span>
      <span className="colorlab__swatchhex">{swatch.hex}</span>
    </div>
  )
}
