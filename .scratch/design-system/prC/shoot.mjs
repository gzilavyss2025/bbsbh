// Shoots one variant of the three C2 surfaces at 390px and measures the
// elements the odd band paints. Usage: node shoot.mjs <label>
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const label = process.argv[2] ?? 'shipped'
const BASE = process.env.BASE ?? 'http://localhost:5169'
const OUT = process.env.SHOTS ?? 'shots'
mkdirSync(OUT, { recursive: true })

const SURFACES = [
  {
    key: 'umpire',
    url: `${BASE}/umpire/lance-barksdale-427013?nointro`,
    wait: '.umptend__id',
    clip: '.umptend',
    measure: ['.umptend__id', '.umptend__lean', '.umptend__row', '.umptend__tile', '.umptend__prov'],
  },
  {
    key: 'standings',
    url: `${BASE}/standings?nointro`,
    wait: '.standings--full',
    clip: '.standings--full',
    measure: ['.standings--full', '.standings--full tbody tr', '.standings-jump', '.standings-ctrl'],
  },
  {
    key: 'player',
    url: `${BASE}/player/christian-yelich-592885?nointro`,
    wait: '.player__statgrid',
    clip: '.player__statgrid',
    measure: ['.player__statgrid', '.player__statgrid .stat', '.ledger', '.ledger tbody tr'],
  },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const report = {}

for (const s of SURFACES) {
  try {
    await page.goto(s.url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(s.wait, { timeout: 30000 })
    await page.waitForTimeout(1200)
    const el = await page.$(s.clip)
    if (el) await el.screenshot({ path: `${OUT}/${s.key}-${label}.png` })
    report[s.key] = {
      PAGE: await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      })),
    }
    for (const sel of s.measure) {
      const box = await page.evaluate((q) => {
        const n = document.querySelector(q)
        if (!n) return null
        const r = n.getBoundingClientRect()
        return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }
      }, sel)
      report[s.key][sel] = box
    }
  } catch (err) {
    report[s.key] = { error: String(err).slice(0, 120) }
    console.log(`  ! ${s.key}: ${String(err).slice(0, 120)}`)
  }
}

writeFileSync(`${OUT}/measure-${label}.json`, JSON.stringify(report, null, 2))
console.log(`${label}:`, JSON.stringify(report))
await browser.close()
