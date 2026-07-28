import { useState } from 'react'
import { LogoPositionControls } from './editors/LogoPositionControls.jsx'
import { TreatmentColorControls } from './editors/TreatmentColorControls.jsx'
import { WpaPreview } from './editors/WpaPreview.jsx'
import { WpaScenarios } from './editors/WpaScenarios.jsx'
import { HeaderPreview } from './editors/HeaderPreview.jsx'
import { copyHex, copyPalette, useHexClipboard } from './hexClipboard.js'
import { LogoDropZone } from './LogoDropZone.jsx'
import { monthDayYear } from '../../lib/dates.js'

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
// `upload` is the same idea for the logo drop target: MLB art is filed by club
// abbreviation under a treatment directory, so its tiles pass one; MiLB's
// home/away art is keyed by team id in directories that don't exist yet (PR 4),
// so its tiles pass nothing and render exactly as before.
export function TreatmentBox({
  label,
  nameField,
  logoBox,
  upload,
  wearDates,
  swatches,
  colorsPanel,
  treatmentColors,
  position,
  wpa,
  scenarios,
  header,
}) {
  // The whole set the owner asked to move between mockups in one paste — the
  // header triad plus this tile's own fill/pinstripe state. This clipboard
  // named the fields bar/accent/onBar before the store did; now that the store
  // carries the same names (ADR-0030), the two sides pass straight through
  // with no mapping between them.
  const palette = {
    bar: header.colors.bar,
    accent: header.colors.accent,
    onBar: header.colors.onBar,
    bg: position.bg,
    pinstripe: position.pinstripe,
  }
  const pastePalette = (clip) => {
    if (!clip) return
    if (clip.bg !== undefined) position.onField('bg', clip.bg)
    if (clip.pinstripe !== undefined) position.onField('pinstripe', clip.pinstripe)
    if (clip.bar !== undefined) header.onField('bar', clip.bar)
    if (clip.accent !== undefined) header.onField('accent', clip.accent)
    if (clip.onBar !== undefined) header.onField('onBar', clip.onBar)
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
        {upload ? (
          <LogoDropZone {...upload} label={`${position.name} ${label}`}>
            <div className={logoBox.className} style={logoBox.style}>
              {logoBox.children}
            </div>
          </LogoDropZone>
        ) : (
          <div className={logoBox.className} style={logoBox.style}>
            {logoBox.children}
          </div>
        )}
        {colorsPanel?.hasDraft && (
          <div className="colorlab__colorsresetrow">
            <button type="button" className="colorlab__wparesetbtn" onClick={colorsPanel.onReset}>
              Reset colors
            </button>
          </div>
        )}
        <div className="colorlab__swatchrow">
          {swatches.map((swatch, i) => (
            <ColorSwatch key={i} {...swatch} />
          ))}
        </div>
        {treatmentColors && <TreatmentColorControls {...treatmentColors} />}
        <LogoPositionControls {...position} />
        {wearDates && <WearDates {...wearDates} label={label} name={position.name} />}
      </div>
      <WpaPreview {...wpa} />
      <WpaScenarios {...scenarios} />
      <HeaderPreview {...header} />
    </div>
  )
}

// The dates this club actually wore this jersey, as small buttons into that
// game's photo gallery (`/photos/{gamePk}` — GamePhotosPage, deep-linked). The
// swatches above say what a tile is SUPPOSED to look like; this is how you
// check that against a photograph of the real uniform, which is the only source
// that settles an argument about a hex.
//
// Most-recent first and capped (see jerseyWearDates) — a club wears one jersey
// far too often for a full list to be a glance. `dates` is null while the
// join's two halves are still loading, [] for a jersey with no posted wear yet
// (a brand-new jersey, or any MiLB tile — that feed doesn't exist).
//
// The gallery it links to is deliberately NOT spoiler-safe and says so on its
// own page: a celebration photo narrates the result. That's an existing,
// consented property of that page, and this is a dev-only lab, so the link goes
// straight there rather than growing a second warning.
function WearDates({ dates, onOpen, name, label }) {
  if (dates == null) return <p className="colorlab__weardates-hint">Loading worn dates…</p>
  if (dates.length === 0) {
    return <p className="colorlab__weardates-hint">No posted wear this season.</p>
  }
  return (
    <div className="colorlab__weardates">
      <span className="colorlab__weardates-label">Worn</span>
      <div className="colorlab__weardates-list">
        {dates.map((d) => (
          <button
            key={d.gamePk}
            type="button"
            className="colorlab__weardate"
            onClick={() => onOpen(d.gamePk)}
            title={`Open the game photos for ${name} — ${label}, ${monthDayYear(d.apiDate)}`}
          >
            {monthDayYear(d.apiDate)}
          </button>
        ))}
      </div>
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
// working. `editable`, when supplied (the Main tile's Primary/Secondary/Accent
// only — see profiles/mlb.jsx), turns the hex text from a read-only label into
// a text input the owner can retype directly; the click-to-copy chip button
// is untouched, a separate element with no conflict.
//
// A `swatch` with an empty `hex` is an editable role the owner has CLEARED —
// distinct from a null `swatch`, which is a slot the club has no colour for at
// all. It keeps its input (there'd be no way to type a colour back in
// otherwise) but drops the copy button, since copying an empty string and
// announcing "Copy Primary ()" is worse than having nothing to click.
function ColorSwatch({ swatch, active, wpaSelected, onPickWpaBand, editable }) {
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
      {swatch.hex ? (
        <button
          type="button"
          className="colorlab__swatchchip colorlab__swatchchip--btn"
          style={{ background: swatch.hex }}
          onClick={handleClick}
          aria-label={`Copy ${swatch.label} (${swatch.hex})${onPickWpaBand ? ", or use as this tile's WPA band color" : ''}`}
          title={onPickWpaBand ? 'Copy hex / use as WPA band color' : 'Copy hex'}
        />
      ) : (
        <div className="colorlab__swatchchip colorlab__swatchchip--placeholder" />
      )}
      <span className="colorlab__swatchlabel">{copied ? 'Copied!' : swatch.label}</span>
      {editable ? (
        <input
          type="text"
          className="colorlab__swatchhexinput"
          value={editable.value}
          placeholder="#hex"
          onChange={(e) => editable.onChange(e.target.value)}
        />
      ) : (
        <span className="colorlab__swatchhex">{swatch.hex}</span>
      )}
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
