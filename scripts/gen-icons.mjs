// Rasterizes public/icons/icon.svg into the PNG sizes the PWA manifest needs.
// Uses the pre-installed Chromium via Playwright — no network download.
// Run: node scripts/gen-icons.mjs
// playwright is provided globally in this environment (not a project dep), so
// resolve it from the global module path rather than a bare specifier.
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const globalRoot = execSync('npm root -g').toString().trim()
const require = createRequire(import.meta.url)
const { chromium } = require(`${globalRoot}/playwright`)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'public', 'icons')
const svg = readFileSync(join(iconsDir, 'icon.svg'), 'utf8')

// name -> { size, maskable }. Maskable icons get extra safe-area padding so
// the important content survives Android's circular/rounded masking.
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 52 },
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
      `<!doctype html><html><body style="margin:0;background:#0b1220">
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
