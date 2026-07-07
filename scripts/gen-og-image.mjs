// Rasterizes scripts/og-image.html into public/og-image.png (1200×630) — the
// Open Graph / Twitter card shown when the app link is shared (iMessage,
// Slack, Discord, etc.). Same Playwright-via-global approach as gen-icons.mjs.
// Run: node scripts/gen-og-image.mjs
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const require = createRequire(import.meta.url)
// playwright may be a project dep (local node_modules) or provided globally in
// the CI/sandbox environment — try the bare specifier first, then the global root.
function loadChromium() {
  try {
    return require('playwright').chromium
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim()
    return require(`${globalRoot}/playwright`).chromium
  }
}
const chromium = loadChromium()
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, 'og-image.html')
const out = join(here, '..', 'public', 'og-image.png')

const W = 1200
const H = 630

const browser = await chromium.launch()
try {
  // deviceScaleFactor: 2 → shoot at 2400×1200 for crisp text, but the file
  // declares 1200×630 so scrapers read the intended OG dimensions.
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  })
  await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' })
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } })
  console.log('wrote', out)
} finally {
  await browser.close()
}
