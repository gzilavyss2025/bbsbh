// The hand-picked half of a club's knockout mark: which SHAPES in its art are
// the mark and which are the paper it's drawn against, when the automatic
// classifier (logoMono.js) gets it wrong.
//
// Why a store rather than hand-edited art: the mono files under
// public/data/logos/mono/ are GENERATED, and gen-mono-logos.mjs rewrites that
// directory from scratch on every run (a club that rebrands must not keep a
// stale mark). Hand-editing one would survive exactly until the next nightly
// run. Pins live here instead, and the generator applies them — the same
// authoring-format / lookup-format split the tuning stores use
// (src/lib/CLAUDE.md), one layer further back: here the lookup format is the
// art itself.
//
// Picked by eye in /identity-lab's Knockout mark editor, which writes this file
// through the dev-only save endpoint (ADR-0029) and then asks the server to
// regenerate that club's file. Nothing at runtime reads this — the app only
// ever loads the finished SVG — so it is imported by the lab and the generator
// and by nothing on a real page.

import store from './data/mono-ink.json' with { type: 'json' }

// `{ art, parts }` for a club, or null. `parts` is `{ [partIndex]: 'ink' |
// 'knockout' }` and `art` is the monoLogoFingerprint of the source the pins
// were picked against.
export function monoInkFor(teamId) {
  const entry = store[String(teamId)]
  if (!entry) return null
  return { art: entry.art ?? null, parts: entry.parts ?? {} }
}

// The pins to actually apply to `sourceSvg`, or null. A saved set whose
// fingerprint doesn't match the art in hand is DROPPED, not applied: the club
// rebranded (or the CDN reordered its shapes) and part 3 is no longer the shape
// somebody looked at. Falling back to the automatic pass shows a mark that's
// merely unreviewed; applying stale pins shows one that's confidently wrong.
export function monoInkPins(teamId, fingerprint) {
  const entry = monoInkFor(teamId)
  if (!entry || !Object.keys(entry.parts).length) return null
  if (entry.art && fingerprint && entry.art !== fingerprint) return null
  return entry.parts
}

// The whole store, for the lab's save path (which posts it back in full, like
// every other dev store).
export function monoInkStore() {
  return store
}
