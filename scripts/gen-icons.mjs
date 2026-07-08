// Rasterizes public/icons/icon.svg into the PNG sizes the PWA manifest needs.
// Uses the pre-installed Chromium via Playwright — no network download.
// Run: node scripts/gen-icons.mjs
// playwright is provided by the environment (not a project dep). It may live in
// the global module path OR the local node_modules depending on the machine, so
// try the global root first and fall back to bare resolution.
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const require = createRequire(import.meta.url)
const chromium = (() => {
  try {
    const globalRoot = execSync('npm root -g').toString().trim()
    return require(`${globalRoot}/playwright`).chromium
  } catch {
    return require('playwright').chromium
  }
})()
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'public', 'icons')
// icon.svg has hard-coded width="512" height="512" attributes, which are the
// SVG's *intrinsic* size and win over a CSS-sized container — so without
// forcing it to fill (width/height:100%) it renders at 512x512 regardless of
// the wrapping div, silently overflowing/cropping at every other target size.
const svg = readFileSync(join(iconsDir, 'icon.svg'), 'utf8').replace(
  '<svg ',
  '<svg style="display:block;width:100%;height:100%" ',
)

// name -> { size, pad }. icon.svg is a full-bleed manila photo of the scorebook
// sketch with the drawing already inset to ~68% of the frame — so it is its own
// safe area and the maskable variant needs no extra padding (padding would inset
// the manila and leave a background border after Android's circular masking).
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0 },
]

const browser = await chromium.launch()
try {
  for (const t of targets) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    })
    const inner = t.size - t.pad * 2
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:#e5ddc5">
        <div style="width:${t.size}px;height:${t.size}px;display:flex;align-items:center;justify-content:center">
          <div style="width:${inner}px;height:${inner}px">${svg}</div>
        </div>
      </body></html>`,
      { waitUntil: 'networkidle' },
    )
    await page.screenshot({ path: join(iconsDir, t.file), omitBackground: false })
    await page.close()
    console.log('wrote', t.file)
  }
} finally {
  await browser.close()
}
