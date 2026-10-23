// Shared by the rendered-style audits in this folder (issue #2530): argument
// parsing, one Chromium page per route and width, and the colour maths.
//
// WHY THEY EXIST. Reading CSS cannot say what a page really paints. These read the
// RENDERED page: computed style, and the background actually behind an element.
// `scripts/check-contrast.mjs` checks declared token pairs, so it cannot see a door
// at 1.2:1 on a navy band. Run them by hand against `npm run preview`; not in CI.
//
// GOTCHAS, each from a real run:
//   - `?nointro` goes on every URL, or the welcome modal covers the page.
//   - Lazy bands mount only when scrolled near, so `settle` scrolls in 1000px steps.
//   - Routes come from `e2e/visual/routes.js`, the same list the screenshot suite uses.
//     Those are sealed pages with nothing revealed, so no score is ever read.

import { chromium } from 'playwright'
import { ROUTES } from '../../e2e/visual/routes.js'

const CHROMIUM = process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined

// `--key value` pairs and bare flags. `base`, `routes` and `widths` are shared.
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const next = argv[i + 1]
    out[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : argv[++i]
  }
  return out
}

export function routePaths(arg) {
  if (!arg || arg === true || arg === 'all') return ROUTES.map((r) => r.path)
  return String(arg).split(',').filter(Boolean)
}

function withNointro(base, path) {
  const url = new URL(path, base)
  url.searchParams.set('nointro', '')
  return url.toString()
}

// Scroll top to bottom so every lazy band mounts, then back up.
async function settle(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < height; y += 1000) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(150)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}

// Calls `visit(page, {path, width})` once per route and width, on a settled page.
export async function eachPage(args, visit) {
  const base = args.base || 'http://localhost:4173'
  const widths = String(args.widths || 390).split(',').map(Number)
  const browser = await chromium.launch({ executablePath: CHROMIUM })
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      for (const path of routePaths(args.routes)) {
        try {
          await page.goto(withNointro(base, path), { waitUntil: 'networkidle' })
          await settle(page)
          await visit(page, { path, width })
        } catch (err) {
          console.log(`${path} @${width}\tERROR\t${err.message.split('\n')[0]}`)
        }
      }
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

// 'rgb(1, 2, 3)' or 'rgba(1, 2, 3, 0.5)' → [r, g, b, a]; null for anything else.
export function parseColor(str) {
  const m = /^rgba?\(([^)]+)\)$/.exec(str || '')
  if (!m) return null
  const [r, g, b, a = 1] = m[1].split(/[,/\s]+/).filter(Boolean).map(Number)
  return [r, g, b, a]
}

// Lay `top` over `under`, both [r, g, b, a].
export function over(top, under) {
  const a = top[3] + under[3] * (1 - top[3])
  if (a === 0) return [0, 0, 0, 0]
  const mix = (i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a
  return [mix(0), mix(1), mix(2), a]
}

function luminance([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Class chain from an element up to <body>, as `div.a > section.b.c`, for a finding line.
export const CHAIN_FN = `(el) => {
  const parts = []
  for (let n = el; n && n.tagName !== 'HTML'; n = n.parentElement) {
    parts.push(n.tagName.toLowerCase() + [...n.classList].map((c) => '.' + c).join(''))
  }
  return parts.slice(0, 6).join(' < ')
}`
