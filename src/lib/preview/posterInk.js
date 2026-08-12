// Canvas drawing primitives for the game-preview poster — the small vocabulary
// every block in posterBlocks.js is painted with.
//
// Canvas has no CSS: no text-transform, no ellipsis, no letter-spacing, no
// box model. Each of those comes back here as an explicit helper so the block
// painters read as layout rather than as arithmetic. Two notes:
//
//  - `caps` uppercases in JS because a canvas has no text-transform to inherit
//    the global ALL-CAPS invariant from (src/index.css). That invariant's JS
//    guard (scripts/check-name-casing.mjs) walks .jsx only, so this .js module
//    is outside it by construction rather than by exemption — but the reason it
//    is allowed here is the real one: there is no CSS path to uppercase a
//    canvas glyph, so this is the ONLY implementation, never a redundant second
//    one. Do not copy the call into a component.
//  - `track` draws letter-spaced text one glyph at a time, since canvas has no
//    letterSpacing in Safari. It is only for short display strings (labels,
//    club names); never run a paragraph through it.

// Uppercase for a canvas label. See the module note above before reusing.
export function caps(text) {
  return String(text ?? '').toUpperCase() // caps-js-exempt: canvas has no text-transform; this is the only path
}

// One line of text, clipped to `maxWidth` with a real ellipsis rather than a
// hard cut. Returns the width actually painted, so a caller can flow something
// after it.
export function line(ctx, text, x, y, { font, fill, align = 'left', maxWidth = Infinity } = {}) {
  const str = String(text ?? '')
  if (!str) return 0
  if (font) ctx.font = font
  if (fill) ctx.fillStyle = fill
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  const shown = clip(ctx, str, maxWidth)
  ctx.fillText(shown, x, y)
  return ctx.measureText(shown).width
}

// Trim to fit, appending '…' — measured against the font already set on ctx.
export function clip(ctx, text, maxWidth) {
  const str = String(text ?? '')
  if (!Number.isFinite(maxWidth) || ctx.measureText(str).width <= maxWidth) return str
  let lo = 0
  let hi = str.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(`${str.slice(0, mid).trimEnd()}…`).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? `${str.slice(0, lo).trimEnd()}…` : ''
}

// Letter-spaced display text, one glyph at a time. `align` is honoured by
// measuring the tracked run first, so a centred club name really is centred.
// Returns the run's width.
export function track(ctx, text, x, y, { font, fill, spacing = 2, align = 'left', maxWidth = Infinity } = {}) {
  if (font) ctx.font = font
  if (fill) ctx.fillStyle = fill
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  let str = String(text ?? '')
  const runWidth = (s) =>
    [...s].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) - (s.length ? spacing : 0)
  while (str.length > 1 && runWidth(str) > maxWidth) str = str.slice(0, -1)
  const total = runWidth(str)
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  for (const ch of str) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + spacing
  }
  return total
}

// A horizontal rule — the poster's pencil grid line.
export function rule(ctx, x, y, width, { fill, thickness = 1 } = {}) {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, width, thickness)
}

export function rect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
}

// The faint graph-paper ruling the whole sheet is printed on, drawn over an
// arbitrary horizontal band. It is a band rather than the whole poster because
// the head paints a photograph over the top of it and then washes back to solid
// paper before its bottom edge — without re-ruling that landed strip, the grid
// would stop dead where the photo starts and resume under it, which reads as
// the seam the wash exists to avoid.
export function grid(ctx, top, bottom, palette, { step = 28, alpha = 0.5 } = {}) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = palette.ruleSoft
  for (let y = Math.ceil(top / step) * step; y < bottom; y += step) {
    ctx.fillRect(0, y, POSTER_WIDTH, 1)
  }
  for (let x = 0; x < POSTER_WIDTH; x += step) {
    ctx.fillRect(x, top, 1, bottom - top)
  }
  ctx.restore()
}

// Kept local rather than imported from posterLayout.js so this module stays a
// leaf — every other primitive here takes its geometry as arguments.
const POSTER_WIDTH = 1200

// A rounded rectangle path, stroked and/or filled — the card chrome.
export function panel(ctx, x, y, w, h, { radius = 10, fill = null, stroke = null, thickness = 1 } = {}) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = thickness
    ctx.stroke()
  }
}

// The section masthead — the poster's copy of `.metricbar`
// (styles/44-pre-game-cards.css): a solid bar, a kraft-gold under-edge,
// condensed caps title left, an optional aside right, and the club's mark at
// the right edge (SectionMasthead's `logo` slot).
//
// `theme` is `headerThemeFor`'s triad or null. A themed bar wears the club's
// own colours (ADR-0030: a card that IDENTIFIES a club may be coloured by it);
// null keeps the default navy chrome, exactly as the CSS fallbacks do. Its
// `onBarTone` decides whether the white knockout mark stays white or is
// re-inked dark — the canvas equivalent of the `--mark-filter` custom property,
// and the same `brightness(0)` that CSS applies.
export function masthead(
  ctx,
  x,
  y,
  w,
  { title, aside = '', palette, height = 46, mark = null, theme = null, reinkMark = true },
) {
  const fill = theme?.bar || palette.navy
  const edge = theme?.accent || palette.seal
  const ink = theme?.onBar || palette.onInk
  rect(ctx, x, y, w, height, fill)
  rect(ctx, x, y + height - 4, w, 4, edge)
  const pad = 16
  let right = x + w - pad
  if (mark?.width) {
    const markH = height - 16
    const markW = (mark.width / mark.height) * markH
    ctx.save()
    // A flat white silhouette vanishes on a light bar. Only the mono knockout
    // is re-inked — a club's own uploaded City Connect masthead is finished
    // art, deliberately coloured for its bar, and `reinkMark: false` says so.
    if (reinkMark && theme?.onBarTone === 'dark') ctx.filter = 'brightness(0)'
    ctx.drawImage(mark, right - markW, y + 7, markW, markH)
    ctx.restore()
    right -= markW + 12
  }
  if (aside) {
    const asideWidth = track(ctx, caps(aside), right, y + height / 2 + 4, {
      font: FONT_MASTHEAD_ASIDE,
      fill: theme ? ink : palette.seal,
      spacing: 1.5,
      align: 'right',
    })
    right -= asideWidth + 24
  }
  track(ctx, caps(title), x + pad, y + height / 2 + 5, {
    font: FONT_MASTHEAD_TITLE,
    fill: ink,
    spacing: 1.8,
    maxWidth: Math.max(40, right - (x + pad)),
  })
  return y + height
}

const FONT_MASTHEAD_TITLE = '700 25px "Barlow Condensed", "Arial Narrow", sans-serif'
const FONT_MASTHEAD_ASIDE = '700 19px "Barlow Condensed", "Arial Narrow", sans-serif'

// Draw `img` to fill (cover) the box, cropped to it — background-size: cover
// plus overflow: hidden, which the poster needs for the ballpark backdrop and
// for a treatment tile's overscaled mark. `focus` is an {x, y} pair of 0–1
// fractions, matching CSS background-position.
export function cover(ctx, img, x, y, w, h, { focus = { x: 0.5, y: 0.5 }, scale = 1 } = {}) {
  if (!img?.width || !img?.height) return
  const ratio = Math.max(w / img.width, h / img.height) * scale
  const dw = img.width * ratio
  const dh = img.height * ratio
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - dw) * focus.x, y + (h - dh) * focus.y, dw, dh)
  ctx.restore()
}

// Draw `img` scaled to FIT inside the box without cropping, centred — what a
// logo wants, since cropping a club's mark is how you lose half of it.
export function contain(ctx, img, x, y, w, h, { scale = 1 } = {}) {
  if (!img?.width || !img?.height) return
  const ratio = Math.min(w / img.width, h / img.height) * scale
  const dw = img.width * ratio
  const dh = img.height * ratio
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}
