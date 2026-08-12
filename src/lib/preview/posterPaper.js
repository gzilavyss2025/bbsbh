// The poster's palette and type roles, read OUT of the live stylesheet.
//
// A canvas can't resolve `var(--navy)`, so a painter has to be handed real
// values — and the obvious shortcut, typing the hex codes in, quietly forks the
// poster off the design system the first time a token moves. Instead this reads
// tokens/colors.css's PRIMITIVE tier off :root at call time.
//
// Primitives only, deliberately. getPropertyValue returns a custom property's
// SPECIFIED value, so asking for a semantic alias (`--surface-card: var(--paper-2)`)
// hands back the literal string "var(--paper-2)" rather than a color. The
// semantic mapping is therefore re-stated below, in the same pairs
// tokens/colors.css declares — the alias names are the comment on each line.
//
// The fallbacks are for a canvas painted before the stylesheet has parsed (and
// for the unit tests, which have no document at all). They are a safety net,
// not a second source of truth: if one is ever load-bearing, the poster has a
// bug upstream of it.
const FALLBACK = {
  paper0: '#F6EFDC',
  paper1: '#F3ECD8',
  paper2: '#FBF6E9',
  paper3: '#FFFDF6',
  ink0: '#16222F',
  ink1: '#1B2A3A',
  ink2: '#3C4A5A',
  graphite: '#6B6558',
  graphiteSoft: '#938C7C',
  rule: '#CBC1A7',
  ruleSoft: '#DED6C0',
  field: '#2F6E4F',
  clay: '#B4453A',
  navy: '#1B2A3A',
  seal: '#B5824A',
}

const TOKEN_OF = {
  paper0: '--paper-0',
  paper1: '--paper-1',
  paper2: '--paper-2',
  paper3: '--paper-3',
  ink0: '--ink-0',
  ink1: '--ink-1',
  ink2: '--ink-2',
  graphite: '--graphite',
  graphiteSoft: '--graphite-soft',
  rule: '--rule',
  ruleSoft: '--rule-soft',
  field: '--field',
  clay: '--clay',
  navy: '--navy',
  seal: '--seal',
}

export function posterPalette(root = typeof document === 'undefined' ? null : document.documentElement) {
  const cs = root && typeof getComputedStyle === 'function' ? getComputedStyle(root) : null
  const raw = {}
  for (const [key, token] of Object.entries(TOKEN_OF)) {
    const value = cs?.getPropertyValue(token)?.trim()
    raw[key] = value || FALLBACK[key]
  }
  return {
    ...raw,
    // Semantic roles, paired exactly as tokens/colors.css pairs them.
    canvas: raw.paper0, //      --bg-canvas
    card: raw.paper2, //        --surface-card
    inset: raw.paper3, //       --surface-inset
    heading: raw.ink0, //       --text-heading
    body: raw.ink1, //          --text-body
    muted: raw.ink2, //         --text-muted
    caption: raw.graphite, //   --text-caption
    onInk: raw.paper2, //       --text-on-ink
    border: raw.rule, //        --border-rule
    hairline: raw.ruleSoft, //  --border-hairline
    positive: raw.field, //     --accent-positive
    negative: raw.clay, //      --accent-negative
  }
}

// The four type roles from tokens/typography.css, as canvas font stacks. The
// families are bundled woff2 (tokens/fonts.css) at ONE weight each, so a canvas
// `font` string asking for a weight the face doesn't have gets synthesised —
// hence every role below states the weight its file actually ships.
export const FONT = {
  display: (px) => `700 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`,
  body: (px) => `400 ${px}px "Source Sans 3", system-ui, sans-serif`,
  mono: (px) => `700 ${px}px "JetBrains Mono", ui-monospace, monospace`,
  read: (px) => `400 ${px}px "Lora", Georgia, serif`,
  // Not one of the four roles — the slate card's '@' watermark face, borrowed
  // here for the same mark at poster scale (tokens/fonts.css: "one weight,
  // one use", and this is that one use, printed larger).
  watermark: (px) => `900 ${px}px "Big Shoulders Display", "Barlow Condensed", sans-serif`,
}

// The four faces the poster paints with, waited on before the first draw.
// A canvas measures and rasterises with whatever face is loaded AT THE MOMENT
// ctx.fillText runs — there is no reflow when a webfont arrives later, so a
// poster painted early bakes the fallback metrics into the exported PNG and
// simply looks wrong. document.fonts.load() per role is what makes the first
// paint the right one; `font-display: swap` cannot help a bitmap.
export async function ensurePosterFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await Promise.all([
    document.fonts.load(FONT.display(64)),
    document.fonts.load(FONT.body(24)),
    document.fonts.load(FONT.mono(24)),
    document.fonts.load(FONT.read(24)),
    document.fonts.load(FONT.watermark(200)),
  ])
  await document.fonts.ready
}
