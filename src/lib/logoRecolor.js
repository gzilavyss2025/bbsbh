// Repaint individual SHAPES of a club's logo art to chosen colors — the
// full-color sibling of logoMono.js's one-color knockout conversion.
//
// Same machinery, different target. logoMono decides ink-vs-paper for a mask;
// this assigns an arbitrary hex per shape and leaves the art in color. Both
// index shapes the same way (logoMono's DRAWABLE_TAG ordinal, exposed as
// `monoLogoParts`/`monoLogoPickerSvg`), so the two editors in /identity-lab
// count shapes identically and a shape means the same thing in both.
//
// Why this exists: the CDN carries one mark per club per variant and no
// alternate/City Connect art at all (src/lib/CLAUDE.md). A club's Alt jersey
// mark is often the SAME shapes in different colors, so recoloring the art we
// already have beats procuring a PNG that may not exist anywhere public.
//
// Pure string math over SVG markup, like its siblings — no DOM, so the unit
// suite exercises it directly and the same function could run server-side.

import { forceFill, splitCompoundPaths } from './logoMono.js'

// Repaint `fills` ({ [partIndex]: paint }) onto `svg`, leaving every other
// shape exactly as the art drew it. Returns null for markup with no `<svg>`.
//
// A shape's own paint may be a presentation attribute, an inline style, or a
// `<style>` rule, and only an inline style beats all three — so that's what a
// repaint lands as, the same way a knockout pin does.
export function recolorSvg(svg, fills) {
  const source = String(svg ?? '')
  if (!source.includes('<svg')) return null
  if (!fills || !Object.keys(fills).length) return source
  return forceFill(splitCompoundPaths(source), fills)
}

// SVG's own word for "draw nothing here" — a real paint value, not the absence
// of one, which is why it travels through the same field a hex does. Erasing a
// shape is a design move rather than an undo: a mark's plate or backing panel
// often has to GO for the art to sit on a colored jersey tile, and the shapes
// above it must stay exactly where they are.
export const TRANSPARENT_PAINT = 'none'

// A hex a repaint may carry: 3- or 6-digit, with the hash. Deliberately narrow
// — every color in this app's stores is a hex, and accepting `rgb()` or a
// keyword here would mean the validator, the editor, and the swatch preview
// each having their own idea of what a color is.
export function isRecolorHex(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

// Everything a shape may be repainted to: a hex, or transparent. The gate the
// editor actually uses — `isRecolorHex` stays hex-only because the palette and
// the swatch previews genuinely can't render `none` as a color and handle it
// as their own case.
export function isRecolorPaint(value) {
  return value === TRANSPARENT_PAINT || isRecolorHex(value)
}

// Slugify a mark's display name into the filename half of its identity.
// Round-trips well enough to show a readable fallback when a file exists on
// disk with no stored name (`serpent-red` -> `Serpent red`).
export function markSlug(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
