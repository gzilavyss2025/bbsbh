// Rasterizes scripts/og-image.html into public/og-image.png (1200×630) — a
// generated-art Open Graph / Twitter card used by index.html. Same
// Playwright-via-global approach as gen-icons.mjs.
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
  // Shoot at deviceScaleFactor 2 (2400×1260) for crisp text, then downsample
  // to the declared 1200×630 in a second pass — most platforms (and
  // opengraph.xyz) expect the og:image file itself to BE 1200×630, not just
  // claim to be via og:image:width/height while actually shipping 2400×1260.
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  })
  await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' })
  const hiRes = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } })
  await page.close()

  const resizePage = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  })
  const b64 = hiRes.toString('base64')
  await resizePage.setContent(
    `<style>*{margin:0}img{display:block;width:${W}px;height:${H}px}</style>` +
      `<img src="data:image/png;base64,${b64}">`,
  )
  await resizePage.screenshot({ path: out })
  console.log('wrote', out)
} finally {
  await browser.close()
}
