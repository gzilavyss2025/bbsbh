import { useState } from 'react'
import { copyHex } from '../styleClipboard.js'

// `onPickWpaBand`, when supplied, turns the chip into a button that sets this
// swatch's hex as the WPA preview's band color — a quick "try this one" instead
// of hand-typing a hex. `wpaSelected` rings the chip currently doing that job,
// in a distinct ring color (--accent-primary) from `active`'s
// (--accent-positive), so the two "this swatch is driving X" indicators — the
// jersey's own background vs. the WPA preview's band — never read as the same
// claim. A null `swatch` is a slot the club has no color for yet.
//
// Every chip is ALSO a "copy this hex" button (the owner's hex copy/paste
// request) — for MLB, that's on top of its existing "use as WPA band" click
// rather than instead of it, so nothing already wired to this button stops
// working. `editable`, when supplied (a role slot — Main's club-wide triad or
// any other treatment's own Primary/Secondary/Accent 1/Accent 2, see
// profiles/mlb.jsx; an extra beyond the triad has no role and stays read-only),
// turns the hex text from a read-only label into a text input the owner can
// retype directly; the click-to-copy chip button is untouched, a separate
// element with no conflict.
//
// A `swatch` with an empty `hex` is an editable role the owner has CLEARED —
// distinct from a null `swatch`, which is a slot the club has no colour for at
// all. It keeps its input (there'd be no way to type a colour back in
// otherwise) but drops the copy button, since copying an empty string and
// announcing "Copy Primary ()" is worse than having nothing to click.
//
// The copy confirmation is a kraft chip that fades beside the label rather than
// replacing it: the label is how you find the swatch again, and swapping it for
// "Copied!" moved the thing under the pointer every time it was clicked.
export function ColorSwatch({ swatch, active, wpaSelected, onPickWpaBand, editable }) {
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
          aria-label={`Copy ${swatch.label} (${swatch.hex})${onPickWpaBand ? ", or use as this jersey's WPA band color" : ''}`}
          title={onPickWpaBand ? 'Copy hex / use as WPA band color' : 'Copy hex'}
        />
      ) : (
        <div className="colorlab__swatchchip colorlab__swatchchip--placeholder" />
      )}
      <span className="colorlab__swatchlabel">
        {swatch.label}
        {copied && <span className="idlab__tapeflash">✓ copied</span>}
      </span>
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
