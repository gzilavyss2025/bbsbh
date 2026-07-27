import { useState } from 'react'
import { LogoPositionControls } from './editors/LogoPositionControls.jsx'
import { WpaPreview } from './editors/WpaPreview.jsx'
import { WpaScenarios } from './editors/WpaScenarios.jsx'
import { HeaderPreview } from './editors/HeaderPreview.jsx'
import { copyHex, copyPalette, useHexClipboard } from './hexClipboard.js'

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
  // The whole set the owner asked to move between mockups in one paste — the
  // header triad plus this tile's own fill/pinstripe state. Named
  // bar/accent/onBar/bg/pinstripe (PRD §"PR 2") rather than the store's
  // current blue/gold/font (PR 6 renames those; this clipboard is the
  // semantic shape early since it's an ephemeral in-page value, not a store
  // write).
  const palette = {
    bar: header.colors.blue,
    accent: header.colors.gold,
    onBar: header.colors.font,
    bg: position.bg,
    pinstripe: position.pinstripe,
  }
  const pastePalette = (clip) => {
    if (!clip) return
    if (clip.bg !== undefined) position.onField('bg', clip.bg)
    if (clip.pinstripe !== undefined) position.onField('pinstripe', clip.pinstripe)
    if (clip.bar !== undefined) header.onField('blue', clip.bar)
    if (clip.accent !== undefined) header.onField('gold', clip.accent)
    if (clip.onBar !== undefined) header.onField('font', clip.onBar)
  }

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
        <PaletteButtons name={position.name} treatmentLabel={position.treatmentLabel} value={palette} onPaste={pastePalette} />
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
//
// Every chip is ALSO a "copy this hex" button (the owner's hex copy/paste
// request) — for MLB, that's on top of its existing "use as WPA band" click
// rather than instead of it, so nothing already wired to this button stops
// working.
function ColorSwatch({ swatch, active, wpaSelected, onPickWpaBand }) {
  const [copied, setCopied] = useState(false)
  if (!swatch) {
    return (
      <div className="colorlab__swatchcell colorlab__swatchcell--placeholder">
        <div className="colorlab__swatchchip colorlab__swatchchip--placeholder" />
        <span className="colorlab__swatchlabel">—</span>
      </div>
    )
  }
  const handleClick = () => {
    copyHex(swatch.hex)
    onPickWpaBand?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  const cellClass = `colorlab__swatchcell${active ? ' colorlab__swatchcell--active' : ''}${wpaSelected ? ' colorlab__swatchcell--wpaselected' : ''}`
  return (
    <div className={cellClass}>
      <button
        type="button"
        className="colorlab__swatchchip colorlab__swatchchip--btn"
        style={{ background: swatch.hex }}
        onClick={handleClick}
        aria-label={`Copy ${swatch.label} (${swatch.hex})${onPickWpaBand ? ", or use as this tile's WPA band color" : ''}`}
        title={onPickWpaBand ? 'Copy hex / use as WPA band color' : 'Copy hex'}
      />
      <span className="colorlab__swatchlabel">{copied ? 'Copied!' : swatch.label}</span>
      <span className="colorlab__swatchhex">{swatch.hex}</span>
    </div>
  )
}

// The Copy/Paste pair for a whole tile's palette — lives in the treatment
// label row since it spans both the position editor's bg/pinstripe and the
// header editor's triad, neither of which owns the other. Paste is disabled
// until something has actually been copied (checked against the shared
// clipboard, not local state, so it stays correct across a dimension switch —
// see hexClipboard.js).
function PaletteButtons({ name, treatmentLabel, value, onPaste }) {
  const { palette } = useHexClipboard()
  return (
    <div className="colorlab__palettebtns">
      <button type="button" className="colorlab__wparesetbtn" onClick={() => copyPalette(value)}>
        Copy palette
      </button>
      <button
        type="button"
        className="colorlab__wparesetbtn"
        onClick={() => onPaste(palette)}
        disabled={!palette}
        title={palette ? `Paste the copied palette into ${name} ${treatmentLabel}` : 'Copy a palette from another tile first'}
      >
        Paste palette
      </button>
    </div>
  )
}
