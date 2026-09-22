import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const label = process.argv[2] ?? 'c2'
const BASE = process.env.BASE ?? 'http://localhost:5169'
const OUT = process.env.SHOTS
mkdirSync(OUT, { recursive: true })

const SURFACES = [
  { key: 'umpire', url: '/umpire/lance-barksdale-427013', wait: '.umptend__id', clip: '.umptend' },
  { key: 'standings', url: '/standings', wait: '.standings--full', clip: '.standings--full' },
  { key: 'player', url: '/player/christian-yelich-592885', wait: '.player__statgrid', clip: '.player__statgrid' },
  { key: 'pills', url: '/team/158/roster', wait: '.rankchip', clip: '.thub-roster' },
  { key: 'contracts', url: '/team/158/contracts', wait: '.contractsgrid, .salaryrow, table', clip: '.screen' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
for (const s of SURFACES) {
  try {
    await page.goto(`${BASE}${s.url}?nointro`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForSelector(s.wait, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const el = await page.$(s.clip)
    if (!el) {
      console.log(`  ${s.key}: clip ${s.clip} not found`)
      continue
    }
    await el.screenshot({ path: `${OUT}/ba-${s.key}-${label}.png` })
    console.log(`  ${s.key}: shot`)
  } catch (err) {
    console.log(`  ${s.key}: FAILED ${String(err).slice(0, 90)}`)
  }
}
await browser.close()
