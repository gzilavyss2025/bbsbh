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

// The navy/gold section masthead — the poster's copy of .metricbar
// (styles/44-pre-game-cards.css): navy fill, kraft-gold bottom edge, condensed
// caps title left, an optional aside right. `mark` is an already-loaded mono
// knockout image drawn at the bar's right edge, the same flourish
// SectionMasthead's `logo` slot carries.
export function masthead(ctx, x, y, w, { title, aside = '', palette, height = 46, mark = null }) {
  rect(ctx, x, y, w, height, palette.navy)
  rect(ctx, x, y + height - 4, w, 4, palette.seal)
  const pad = 18
  let right = x + w - pad
  if (mark) {
    const markH = height - 18
    const markW = (mark.width / mark.height) * markH
    ctx.drawImage(mark, right - markW, y + 9, markW, markH)
    right -= markW + 14
  }
  if (aside) {
    const asideWidth = track(ctx, caps(aside), right, y + height / 2 + 4, {
      font: FONT_MASTHEAD_ASIDE,
      fill: palette.seal,
      spacing: 1.5,
      align: 'right',
    })
    right -= asideWidth + 28
  }
  track(ctx, caps(title), x + pad, y + height / 2 + 5, {
    font: FONT_MASTHEAD_TITLE,
    fill: palette.onInk,
    spacing: 1.8,
    maxWidth: right - (x + pad),
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
