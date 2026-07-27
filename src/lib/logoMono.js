// Turn a club's full-color logo SVG into a ONE-COLOR knockout mark — the art
// behind the navy section mastheads (the batting order / opposing starter /
// opposing defense headers), where a team's mark has to read as a single ink
// color against a dark bar.
//
// Why this exists instead of a CSS filter: the masthead used to whiten the CDN
// mark with `filter: brightness(0) invert(1)`, which crushes EVERY opaque pixel
// to the same white. A filter can't tell a logo's own shapes apart from the
// paper those shapes are drawn against, so any mark whose interior detail is
// defined by a light fill — an outline ring, knocked-out lettering, negative
// space painted white rather than left transparent — flattened into an
// unreadable solid blob (the Cubs' roundel, the Astros' circle, Biloxi's
// oyster, Chattanooga's octagon). See ADR-0031.
//
// The fix is to re-ink the art rather than filter it: classify each fill as
// INK (part of the mark) or KNOCKOUT (the paper it sits on), then rebuild the
// SVG as a `<mask>` where ink is opaque and knockout is punched back out.
// Stacking order does the rest — a knockout shape erases the ink beneath it
// exactly as it overpaints in the original — so the background shows through
// the holes and the mark reads in one color on any surface.
//
// Pure string/number math over SVG markup, the same shape as logoTint.js (and
// for the same reason: statsapi carries no color field and there are hundreds
// of MiLB clubs, so the fills are read out of the art itself rather than
// hand-tabulated). The fetching + file writing lives in
// scripts/gen-mono-logos.mjs, which precomputes one file per club into
// public/data/logos/mono/.

// A mark drawn as an `<image>` (embedded raster) or `<foreignObject>` carries
// no fills to classify, so it can't be re-inked at all — those bail to null and
// the caller falls back to the full-color mark.
const UNCONVERTIBLE = /<(?:image|foreignObject)\b/i

// Paint values that aren't a color we can classify. `none`/`transparent` draw
// nothing, and must keep drawing nothing in mask space; `currentColor`/
// `inherit` resolve elsewhere, and the wrapper group below already supplies
// ink as the inherited default.
const PASS_THROUGH = new Set([
  'none',
  'transparent',
  'currentcolor',
  'inherit',
  'context-fill',
  'context-stroke',
])

function hexToRgb(h) {
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  }
  return { s, l }
}

// A fill is KNOCKOUT when it's the paper the mark is drawn against rather than
// part of the mark. Two bands, tuned by rendering every club's art (see the
// generator's --sheet):
//
//   • Near-white, whatever its saturation — plain white, but also the cream,
//     bone, and pale-peach "papers" MiLB art is full of (#f0f7e8 behind
//     Asheville's mascot, #f1e5c7 behind Greensboro's). These read as paper to
//     the eye no matter how tinted they are, and a saturation guard high
//     enough to admit them would swallow real ink.
//   • Light AND unsaturated — the greys and silvers used as outline or shadow
//     (Chattanooga's #d8d9da). Saturation matters here: a light SATURATED
//     color at this lightness is a real brand color (the Brewers' #ffc52f
//     gold, the tans in Biloxi's oyster), and knocking those out would leave
//     the same holes the old CSS filter did, only inverted.
export const KNOCKOUT_NEAR_WHITE_LIGHTNESS = 0.85
export const KNOCKOUT_MIN_LIGHTNESS = 0.82
export const KNOCKOUT_MAX_SATURATION = 0.28

// 'ink' | 'knockout' | null (null = not a classifiable color; leave the value
// exactly as it is). Anything drawable we can't read — a gradient or pattern
// reference, an unrecognized keyword — is INK, so an unclassifiable case errs
// toward showing too much of the mark rather than erasing it.
export function classifyPaint(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v || PASS_THROUGH.has(v)) return null
  if (v === 'white') return 'knockout'
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)
  if (!hex) return 'ink'
  const { s, l } = rgbToHsl(hexToRgb(hex[1]))
  if (l >= KNOCKOUT_NEAR_WHITE_LIGHTNESS) return 'knockout'
  return l >= KNOCKOUT_MIN_LIGHTNESS && s <= KNOCKOUT_MAX_SATURATION ? 'knockout' : 'ink'
}

// Every place a fill/stroke color can appear in these files: a presentation
// attribute (`fill="#fff"`), an inline style (`style="fill:#fff"`), and a CSS
// rule in a `<style>` block (`.cls-1{fill:#fff}`) — Illustrator exports use all
// three, sometimes in the same file. Both patterns exclude `fill-opacity` /
// `stroke-width` and friends by requiring the delimiter right after the name.
const PAINT_ATTR = /(?<![\w-])(fill|stroke)\s*=\s*(["'])([^"']*)\2/gi
const PAINT_CSS = /(?<![\w-])(fill|stroke)\s*:\s*([^;"'}]+)/gi

// Rewrite every paint into mask space: ink -> white (opaque), knockout ->
// black (punched out). Also reports how many explicit paints of each kind the
// art carried, which is how an all-paper mark is detected below.
function toMaskSpace(markup) {
  let ink = 0
  let knockout = 0
  const recolor = (verdict) => {
    if (verdict === 'ink') ink += 1
    else knockout += 1
    return verdict === 'ink' ? '#fff' : '#000'
  }
  const out = markup
    .replace(PAINT_ATTR, (whole, prop, quote, value) => {
      const verdict = classifyPaint(value)
      return verdict ? `${prop}=${quote}${recolor(verdict)}${quote}` : whole
    })
    .replace(PAINT_CSS, (whole, prop, value) => {
      const verdict = classifyPaint(value)
      return verdict ? `${prop}:${recolor(verdict)}` : whole
    })
  return { markup: out, ink, knockout }
}

// Drawable elements that state no paint of their own inherit one — the
// wrapper group below makes that inherited default ink. Counting them is how
// an all-paper mark (nothing would be drawn at all) is told apart from a mark
// like the White Sox's, whose art is four unfilled paths plus one white
// knockout and converts perfectly well.
const DRAWABLE_TAG = /<(?:path|circle|ellipse|rect|polygon|polyline|line|text|use)\b([^>]*)>/gi
const OWN_PAINT = /(?<![\w-])(?:fill|style|class)\s*=/i

function countInheriting(markup) {
  let n = 0
  for (const [, attrs] of markup.matchAll(DRAWABLE_TAG)) {
    if (!OWN_PAINT.test(attrs)) n += 1
  }
  return n
}

// Namespace declarations on the source's own `<svg>` root. These MUST carry
// over to the rewritten root: an SVG served as its own file is parsed as
// strict XML, so a body that uses `xlink:href` — which Illustrator emits for
// `<use>` elements and for gradients that inherit another's stops — is a parse
// ERROR under a root that never declared the prefix, and the whole file fails
// to render as an image. It still renders when inlined into an HTML document,
// whose parser is lenient, so this is invisible until the art is loaded the
// way the app actually loads it. (Two clubs, Albuquerque and Everett, failed
// exactly this way while this was being built.)
function namespaceDecls(svg) {
  const root = /<svg\b([^>]*)>/i.exec(svg)?.[1] ?? ''
  const decls = [...root.matchAll(/(?<![\w-])(xmlns:[\w.-]+)\s*=\s*(["'])(.*?)\2/g)]
  return decls.map(([, name, , value]) => ` ${name}="${value}"`).join('')
}

// Any attribute prefix the rewritten root doesn't declare — the same parse
// error as above, arriving from art whose OWN root never declared it either.
// Cheap backstop for a source file that was already broken.
function undeclaredPrefix(body, decls) {
  for (const [, prefix] of body.matchAll(/(?<![\w-])([a-z][\w.-]*):[\w.-]+\s*=\s*["']/gi)) {
    if (prefix.toLowerCase() === 'xmlns') continue
    if (!decls.includes(`xmlns:${prefix}=`)) return prefix
  }
  return null
}

// `0 0 60 72` -> the four numbers, or null when the file carries no usable box.
function parseViewBox(svg) {
  const raw = /viewBox\s*=\s*["']([^"']+)["']/i.exec(svg)?.[1]
  if (!raw) return null
  const parts = raw.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  if (parts[2] <= 0 || parts[3] <= 0) return null
  return parts
}

// The one-color knockout SVG for `svg`, or null when the art can't be re-inked
// (no viewBox, an embedded raster, or a mark that is entirely paper — nothing
// would be left to draw). A null tells the caller to fall back rather than
// write a file that renders as an empty box.
//
// `maskId` is scoped per club by the generator so several of these can be
// inlined into one document without their mask ids colliding.
export function monoLogoSvg(svg, { maskId = 'ink' } = {}) {
  const source = String(svg ?? '')
  if (!source.includes('<svg') || UNCONVERTIBLE.test(source)) return null
  const box = parseViewBox(source)
  if (!box) return null

  const body = source
    .replace(/^[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg\s*>[\s\S]*$/i, '')
    // Decorative art inside an aria-hidden <img> — a <title> here only risks a
    // stray tooltip on hover.
    .replace(/<title\b[\s\S]*?<\/title\s*>/gi, '')
    .trim()
  if (!body) return null

  const { markup, ink } = toMaskSpace(body)
  // Nothing to draw: no shape states an ink color and none inherits one
  // either, so the mask would come out empty. Bail rather than write a file
  // that renders as a blank box.
  if (ink === 0 && countInheriting(body) === 0) return null

  const decls = namespaceDecls(source)
  if (undeclaredPrefix(markup, decls)) return null

  const [x, y, w, h] = box
  const geom = `x="${x}" y="${y}" width="${w}" height="${h}"`
  // The wrapper group is the inherited default for any shape that never states
  // a fill: SVG's own default is black, which in mask space would silently
  // punch the shape out instead of drawing it. An element's own fill —
  // attribute, inline style, or CSS rule — still wins over an inherited one.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${decls} viewBox="${box.join(' ')}">` +
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" ${geom}><g fill="#fff">${markup}</g></mask>` +
    `<rect ${geom} fill="#fff" mask="url(#${maskId})"/></svg>`
  )
}
