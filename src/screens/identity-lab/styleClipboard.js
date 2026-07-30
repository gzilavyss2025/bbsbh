import { useEffect, useState } from 'react'

// The lab-level clipboard: click any swatch to copy its single hex, or LIFT a
// whole jersey's tuning off the bench and press it onto another one. Backed by
// localStorage (survives switching dimensions — IdentityLab remounts every
// profile Body with `key={profile.key}`, and this needs to outlive that) plus a
// same-tab pub/sub, since localStorage's own `storage` event only fires in
// OTHER tabs — without it, the Style Card wouldn't appear in the dugout until
// something else re-rendered it.
//
// The two slots are independent on purpose: a single hex and a whole style are
// different-sized things to be holding, and copying one shouldn't silently drop
// the other.
const HEX_KEY = 'bbsbh:identity-lab:clipboard:hex'
const CARD_KEY = 'bbsbh:identity-lab:clipboard:style'

// Which groups a press carries. Palette starts on because it's what the old
// single-slot palette clipboard did and is by far the common case; position and
// WPA layout are geometry tuned per mark, so carrying them across clubs is a
// deliberate act rather than the default.
const DEFAULT_CARRY = { palette: true, position: false, wpa: false }

const listeners = new Set()
function notify() {
  for (const fn of listeners) fn()
}

function readCard() {
  try {
    const raw = localStorage.getItem(CARD_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCard(card) {
  try {
    if (card) localStorage.setItem(CARD_KEY, JSON.stringify(card))
    else localStorage.removeItem(CARD_KEY)
  } catch {
    // Storage disabled/full — the lift still reached the system clipboard.
  }
  notify()
}

// Best-effort system-clipboard write alongside the lab's own store — a copied
// hex is also handy to paste into an external tool, but the lab's own press
// reads the localStorage copy, not the system clipboard (which a browser won't
// let JS read back without a permission prompt).
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

// `style` is `{ source: { teamId, teamName, treatment }, palette, position, wpa }`
// — see JerseyBench's liftStyle. Undo is implicit: a press only ever lands in
// the draft layer (useDraftStore), never straight to a JSON store, so it's
// reviewable and Reset-able exactly like any other hand-typed edit.
//
// A fresh lift keeps whatever carry toggles are already set, so spreading one
// group across a club's rack doesn't mean re-checking the same box each time.
export function liftStyle(style) {
  const carry = readCard()?.carry ?? DEFAULT_CARRY
  writeCard({ ...style, carry })
  writeSystemClipboard(JSON.stringify(style, null, 2))
}

export function toggleCarry(group) {
  const card = readCard()
  if (!card) return
  const carry = { ...DEFAULT_CARRY, ...card.carry }
  writeCard({ ...card, carry: { ...carry, [group]: !carry[group] } })
}

export function discardStyle() {
  writeCard(null)
}

export function useStyleCard() {
  const [card, setCard] = useState(readCard)
  useEffect(() => {
    const sync = () => setCard(readCard())
    listeners.add(sync)
    window.addEventListener('storage', sync)
    return () => {
      listeners.delete(sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return card
}
