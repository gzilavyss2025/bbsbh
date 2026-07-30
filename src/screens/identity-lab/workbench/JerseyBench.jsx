import { useState } from 'react'
import { LogoPositionControls } from '../editors/LogoPositionControls.jsx'
import { WpaPreview } from '../editors/WpaPreview.jsx'
import { WpaScenarios } from '../editors/WpaScenarios.jsx'
import { HeaderBarMock } from '../editors/HeaderPreview.jsx'
import { LogoDropZone } from '../LogoDropZone.jsx'
import { liftStyle, useStyleCard } from '../styleClipboard.js'
import { ColorSwatch } from './ColorSwatch.jsx'
import { WearDates } from './WearDates.jsx'

// One jersey on the bench: every knob that tunes it down the left, and the
// three surfaces those knobs actually paint pinned down the right. The pinning
// is the point — the old stacked tile put the WPA mockups a scroll below the
// fields that drive them, so tuning a band meant type, scroll, look, scroll
// back. Here nothing moves but the numbers.
//
// The profile resolves every value (its own tables, its own draft chain, its
// own copy-text wording) and hands them in; this file owns only the
// composition, so the MLB and MiLB dimensions can't drift into two different
// bench layouts.
//
// The MLB-only bits are absent rather than special-cased: `nameField` is null
// for MiLB (no uniform catalog to name a jersey from — see src/api/CLAUDE.md),
// and its swatches simply arrive without an `onPickWpaBand` handler, so they
// render as plain chips instead of "try this as the band color" buttons.
// `upload` is the same idea for the logo drop target.
//
// `headerWrite` is present only for the one jersey per bar that OWNS it (MLB's
// Main and City Connect; a MiLB level's Home and Away) — and even then only so
// a pressed style can carry a palette's bar triad. The header EDITOR itself
// lives in exactly one place, the Header bars panel above; this column shows
// the resulting bar read-only, captioned with which one this jersey wears.
export function JerseyBench({
  teamId,
  label,
  nameField,
  logoBox,
  upload,
  wearDates,
  swatches,
  colorsPanel,
  position,
  wpa,
  scenarios,
  headerPreview,
  headerWrite,
}) {
  const card = useStyleCard()
  const [pressed, setPressed] = useState(false)

  const lift = () =>
    liftStyle({
      source: { teamId, teamName: position.name, treatment: label },
      // `bar/accent/onBar` are left out for a jersey that wears another's bar —
      // pressing this style onto a target must not invent a header edit for a
      // slot neither side owns.
      palette: {
        ...(headerWrite ? { bar: headerPreview.colors.bar, accent: headerPreview.colors.accent, onBar: headerPreview.colors.onBar } : {}),
        bg: position.bg,
        pinstripe: position.pinstripe,
      },
      position: { scale: position.scale, offsetX: position.offsetX, offsetY: position.offsetY },
      wpa: { ...wpa.layout, bandColor: wpa.bandColor },
    })

  // Every group lands in the DRAFT layer only, never straight to a JSON store,
  // so a press is reviewable, per-section Reset-able, auto-clearing, and shows
  // up in the pending tally exactly like a hand-typed edit.
  const press = () => {
    if (!card) return
    if (card.carry?.palette) {
      if (card.palette.bg !== undefined) position.onField('bg', card.palette.bg)
      if (card.palette.pinstripe !== undefined) position.onField('pinstripe', card.palette.pinstripe)
      if (headerWrite) {
        for (const field of ['bar', 'accent', 'onBar']) {
          if (card.palette[field] !== undefined) headerWrite(field, card.palette[field])
        }
      }
    }
    if (card.carry?.position) {
      for (const field of ['scale', 'offsetX', 'offsetY']) position.onField(field, card.position[field])
    }
    if (card.carry?.wpa) {
      for (const field of ['size', 'rotate', 'offsetX', 'offsetY', 'paddingX', 'paddingY', 'rowShift', 'bandColor']) {
        wpa.onField(field, card.wpa[field])
      }
    }
    setPressed(true)
    setTimeout(() => setPressed(false), 1200)
  }

  return (
    <section className="idlab__bench" aria-label={`${position.name} ${label}`}>
      <div className="idlab__benchhead">
        <h3 className="idlab__benchtitle">{label}</h3>
        <button type="button" className="colorlab__wparesetbtn" onClick={lift}>
          Lift style
        </button>
        {card && (
          <button
            type="button"
            className="colorlab__wparesetbtn"
            onClick={press}
            title={`Press ${card.source.teamName} ${card.source.treatment}'s style onto ${position.name} ${label}`}
          >
            Press style here
          </button>
        )}
        {pressed && <span className="idlab__tapeflash">✓ pressed</span>}
      </div>

      <div className="idlab__benchcols">
        <div className="idlab__tuning">
          {nameField && (
            <div className="idlab__section">
              <div className="colorlab__wpapreviewhead">
                <span className="colorlab__wpapreviewlabel">Name</span>
              </div>
              <input
                className="searchbox__input colorlab__nameinput"
                value={nameField.value}
                placeholder="Display name"
                onChange={(e) => nameField.onChange(e.target.value)}
              />
            </div>
          )}

          <div className="idlab__section">
            <div className="colorlab__wpapreviewhead">
              <span className="colorlab__wpapreviewlabel">Colors</span>
              {colorsPanel?.hasDraft && (
                <button type="button" className="colorlab__wparesetbtn" onClick={colorsPanel.onReset}>
                  Reset colors
                </button>
              )}
            </div>
            <div className="colorlab__swatchrow">
              {swatches.map((swatch, i) => (
                <ColorSwatch key={i} {...swatch} />
              ))}
            </div>
          </div>

          <LogoPositionControls {...position} />
          <WpaPreview {...wpa} />
          {wearDates && <WearDates {...wearDates} label={label} name={position.name} />}
        </div>

        <div className="idlab__field">
          <div className="idlab__stage">
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
          </div>

          <div className="idlab__benchbar">
            <HeaderBarMock name={headerPreview.name} colors={headerPreview.colors} unset={headerPreview.unset} />
            <p className="idlab__lineagecaption">
              {headerPreview.lineage.caption}
              {/* An anchor, not a button: the bar unit it lands on takes focus
                  from the browser's own fragment handling, so the "edit it
                  above" claim ends with the field actually reachable. */}
              {' '}
              <a className="idlab__lineagelink" href={`#${headerPreview.lineage.anchorId}`}>
                Edit it in Header bars above
              </a>
            </p>
          </div>

          <WpaScenarios {...scenarios} />
        </div>
      </div>
    </section>
  )
}
