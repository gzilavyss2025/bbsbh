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

// ---------------------------------------------------------------------------
// PER-SHAPE OVERRIDES
//
// The classifier above is a heuristic over art nobody controls, and when it is
// wrong it is wrong about a SHAPE — a brand color light enough to read as
// paper, or paper dark enough to read as ink. So a club can pin individual
// shapes, by their position in the art, in src/lib/data/mono-ink.json; the
// Team Identity Lab is where those get picked by eye (ADR-0031).
//
// A part index is the shape's ordinal among the drawable elements, in document
// order, counted the same way in all three functions below — which is why they
// all walk DRAWABLE_TAG over the same body string rather than each having
// their own idea of what a shape is. `monoLogoPickerSvg` hands the browser art
// stamped with those exact indices, so a click can't mean a different shape
// than a pin does.
//
// The indices only hold while the art holds still. `monoLogoFingerprint`
// travels with a saved pin set so a club that rebrands into different art
// drops back to the automatic pass instead of applying yesterday's answers to
// today's shapes.
// ---------------------------------------------------------------------------

// An inline style beats both a presentation attribute and a `<style>` rule, so
// this is the one place a pin can land and be sure to win. (A CSS rule beating
// a `fill=` attribute is exactly why forcing the attribute wouldn't do.)
const STYLE_ATTR = /(?<![\w-])style\s*=\s*(["'])([^"']*)\1/i
const OWN_PAINT_DECL = /^\s*(?:fill|stroke)\s*:/i

// A stroke is only re-painted when the element already draws one — handing a
// stroke color to a shape that has none turns SVG's 1px default on and outlines
// a shape that was never outlined.
function forcePaint(tag, hex) {
  const decl = `fill:${hex}${/(?<![\w-])stroke\s*[=:]/i.test(tag) ? `;stroke:${hex}` : ''}`
  const existing = STYLE_ATTR.exec(tag)
  if (existing) {
    const kept = existing[2]
      .split(';')
      .filter((d) => d.trim() && !OWN_PAINT_DECL.test(d))
      .join(';')
    return tag.replace(STYLE_ATTR, `style="${kept ? `${kept};` : ''}${decl}"`)
  }
  const [, body, close] = /^(.*?)(\s*\/?)>$/s.exec(tag) ?? []
  return body === undefined ? tag : `${body} style="${decl}"${close}>`
}

// Repaint selected shapes of `markup`, choosing each one's new color by its
// part index. `colorFor(index)` returns a hex or null to leave that shape
// alone. The one walk both this file's knockout pins and logoRecolor.js's
// full-color repaints go through, so "shape 3" can't come to mean two
// different shapes in the two editors that offer it.
function paintParts(markup, colorFor) {
  let out = ''
  let last = 0
  let index = 0
  for (const match of markup.matchAll(DRAWABLE_TAG)) {
    const color = colorFor(index)
    index += 1
    if (!color) continue
    out += markup.slice(last, match.index) + forcePaint(match[0], color)
    last = match.index + match[0].length
  }
  return out + markup.slice(last)
}

// `pins` is `{ [partIndex]: 'ink' | 'knockout' }`. Anything not pinned keeps
// whatever the automatic pass decided, so a pin set stays a short list of
// corrections rather than a full transcription of the art.
function applyPins(markup, pins) {
  if (!pins) return markup
  return paintParts(markup, (i) => {
    const verdict = pins[i]
    return verdict === 'ink' ? '#fff' : verdict === 'knockout' ? '#000' : null
  })
}

// The same repaint with arbitrary colors, for logoRecolor.js — kept here
// because the shape numbering and the inline-style-wins rule live here, and
// a second implementation of either is a second thing to keep in step.
export function forceFill(markup, fills) {
  return paintParts(markup, (i) => fills[i] ?? fills[String(i)] ?? null)
}

// `.cls-1{fill:#12284b}` -> { 'cls-1': '#12284b' }. Illustrator puts a mark's
// real colors here as often as in an attribute, and a shape whose only paint is
// a class needs its color shown in the picker like any other.
function classFills(svg) {
  const out = {}
  for (const [, css] of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    for (const [, selectors, block] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const fill = /(?<![\w-])fill\s*:\s*([^;]+)/i.exec(block)?.[1]?.trim()
      if (!fill) continue
      for (const [, name] of selectors.matchAll(/\.([\w-]+)/g)) out[name] = fill
    }
  }
  return out
}

const ATTR = (tag, name) =>
  new RegExp(`(?<![\\w-])${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i').exec(tag)?.[2]

// The shapes a club's art is made of, in the order a pin indexes them:
// `{ index, tag, fill, auto }`, where `fill` is the paint the art declares
// (null when the shape inherits one) and `auto` is what the classifier decides
// on its own. The lab renders this beside the picker so a shape can be judged
// before it is pinned — and so "why did that end up white" has an answer.
export function monoLogoParts(svg) {
  const source = String(svg ?? '')
  const byClass = classFills(source)
  const parts = []
  for (const match of bodyOf(source).matchAll(DRAWABLE_TAG)) {
    const tag = match[0]
    const inline = /(?<![\w-])fill\s*:\s*([^;"']+)/i.exec(ATTR(tag, 'style') ?? '')?.[1]?.trim()
    const fill = inline ?? ATTR(tag, 'fill') ?? byClass[(ATTR(tag, 'class') ?? '').trim().split(/\s+/)[0]] ?? null
    parts.push({
      index: parts.length,
      tag: /^<(\w+)/.exec(tag)?.[1] ?? '',
      fill,
      // A shape that declares no paint inherits the wrapper group's, which
      // monoLogoSvg makes ink — so "inherits" is an ink verdict, not a missing
      // one, and the picker must not show it as undecided.
      auto: (fill === null ? null : classifyPaint(fill)) ?? 'ink',
    })
  }
  return parts
}

// The same art, every drawable element stamped with the `data-mono-part` index
// a pin uses. Inlined by the lab so clicking a shape on screen and pinning a
// shape in the store are the same act — nothing maps one numbering onto
// another.
//
// Stamping only — this does NOT make markup safe to inline, and must not be
// asked to. It used to strip `<script>` and `on*` handlers with a pair of regex
// replaces, which is the technique that cannot be made correct: `</script\t\n
// foo>` is a closing tag no such pattern matches, and one pass can re-form what
// it removes (`<scr<script>ipt>`). Callers that inline the result sanitize at
// FETCH time with a real parser instead (src/lib/svgSanitize.js) and pass the
// sanitized markup here — which also keeps this function's shape numbering
// counting the same elements the editor's other calls see.
export function monoLogoPickerSvg(svg) {
  const source = String(svg ?? '')
  if (!source.includes('<svg')) return null
  let index = 0
  return source.replace(DRAWABLE_TAG, (tag) => {
    const [, body, close] = /^(.*?)(\s*\/?)>$/s.exec(tag) ?? []
    if (body === undefined) return tag
    return `${body} data-mono-part="${index++}"${close}>`
  })
}

// A cheap signature of the art's SHAPES — how many, of what kind, with what
// geometry. Saved next to a pin set purely so drift can be detected: a club
// that rebrands gets art whose shapes no longer mean what the pins say, and
// silently re-inking the wrong ones is worse than falling back to automatic.
// Not a security hash — FNV-1a is used because it's five lines and stable.
export function monoLogoFingerprint(svg) {
  let hash = 0x811c9dc5
  let count = 0
  for (const match of bodyOf(String(svg ?? '')).matchAll(DRAWABLE_TAG)) {
    count += 1
    const tag = match[0]
    const geometry = `${/^<(\w+)/.exec(tag)?.[1] ?? ''}|${(ATTR(tag, 'd') ?? ATTR(tag, 'points') ?? '').slice(0, 64)}`
    for (let i = 0; i < geometry.length; i += 1) {
      hash = Math.imul(hash ^ geometry.charCodeAt(i), 0x01000193) >>> 0
    }
  }
  return `${count}:${hash.toString(16)}`
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

// Everything inside the `<svg>` root, minus a decorative `<title>`. The one
// definition of "the art" all four functions below index into — the part
// numbering a pin uses is only stable because none of them trims differently.
function bodyOf(svg) {
  return svg
    .replace(/^[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg\s*>[\s\S]*$/i, '')
    // Decorative art inside an aria-hidden <img> — a <title> here only risks a
    // stray tooltip on hover.
    .replace(/<title\b[\s\S]*?<\/title\s*>/gi, '')
    .trim()
}

// The one-color knockout SVG for `svg`, or null when the art can't be re-inked
// (no viewBox, an embedded raster, or a mark that is entirely paper — nothing
// would be left to draw). A null tells the caller to fall back rather than
// write a file that renders as an empty box.
//
// `maskId` is scoped per club by the generator so several of these can be
// inlined into one document without their mask ids colliding.
//
// `pins` is the club's hand-picked `{ [partIndex]: 'ink' | 'knockout' }` (see
// PER-SHAPE OVERRIDES above), applied AFTER the automatic pass so a pin is a
// correction to it rather than a replacement for it. A pin to ink also counts
// toward the empty-mask bail below, so art the automatic pass reads as entirely
// paper still converts once someone points at the shape that isn't. The reverse
// isn't guarded: pinning away the last ink shape leaves an empty mark, which is
// what was asked for rather than a case to second-guess.
export function monoLogoSvg(svg, { maskId = 'ink', pins = null } = {}) {
  const source = String(svg ?? '')
  if (!source.includes('<svg') || UNCONVERTIBLE.test(source)) return null
  const box = parseViewBox(source)
  if (!box) return null

  const body = bodyOf(source)
  if (!body) return null

  const auto = toMaskSpace(body)
  const markup = applyPins(auto.markup, pins)
  const ink = auto.ink + Object.values(pins ?? {}).filter((v) => v === 'ink').length
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
