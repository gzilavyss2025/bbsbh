import { useEffect, useState } from 'react'

// The lab-level clipboard the owner asked for: click any swatch to copy its
// single hex, or copy a whole tile's palette (header bar/accent/onBar plus
// bg/pinstripe) and paste it into another tile's draft. Backed by
// localStorage (survives switching dimensions — IdentityLab remounts every
// profile Body with `key={profile.key}`, and this needs to outlive that) plus
// a same-tab pub/sub, since localStorage's own `storage` event only fires in
// OTHER tabs — without it, a tile that copied a palette wouldn't see another
// tile's paste button unlock until something else re-rendered it.
const HEX_KEY = 'bbsbh:identity-lab:clipboard:hex'
const PALETTE_KEY = 'bbsbh:identity-lab:clipboard:palette'

const listeners = new Set()
function notify() {
  for (const fn of listeners) fn()
}

function readHex() {
  try {
    return localStorage.getItem(HEX_KEY) || null
  } catch {
    return null
  }
}

function readPalette() {
  try {
    const raw = localStorage.getItem(PALETTE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Best-effort system-clipboard write alongside the lab's own store — a copied
// hex is also handy to paste into an external tool, but the lab's paste
// buttons read the localStorage copy, not the system clipboard (which a
// browser won't let JS read back without a permission prompt).
function writeSystemClipboard(text) {
  navigator.clipboard?.writeText(text)?.catch(() => {})
}

export function copyHex(hex) {
  try {
    localStorage.setItem(HEX_KEY, hex)
  } catch {
    // Storage disabled/full — the copy still reaches the system clipboard.
  }
  writeSystemClipboard(hex)
  notify()
}

// `palette` is `{ bar, accent, onBar, bg, pinstripe }` — see TreatmentBox's
// paletteFromTile. Undo is implicit: a paste only ever lands in the draft
// layer (useDraftStore), never straight to a JSON store, so it's reviewable
// and Reset-able exactly like any other hand-typed edit.
export function copyPalette(palette) {
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(palette))
  } catch {
    // Storage disabled/full — the copy still reaches the system clipboard.
  }
  writeSystemClipboard(JSON.stringify(palette, null, 2))
  notify()
}

export function useHexClipboard() {
  const [hex, setHex] = useState(readHex)
  const [palette, setPalette] = useState(readPalette)
  useEffect(() => {
    const sync = () => {
      setHex(readHex())
      setPalette(readPalette())
    }
    listeners.add(sync)
    window.addEventListener('storage', sync)
    return () => {
      listeners.delete(sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return { hex, palette }
}
