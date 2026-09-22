// Builds one labelled side-by-side PNG per surface: round-down | shipped | round-up.
import { chromium } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'

const DIR = process.env.SHOTS
const SURFACES = [
  ['umpire', 'Umpire tendencies — /umpire/{id}', '53-umpire-tendencies.css · 15 literals / 10 declarations'],
  ['standings', 'Standings table — /standings', '30-standings.css · 5 literals / 5 declarations'],
  ['player', 'Player stat grid — /player/{id}', '26-player-page.css · 11 literals / 11 declarations'],
]
const VARIANTS = [
  ['round-down', 'ROUND DOWN', '5→4  7→6  9→8  11→10  13→12'],
  ['shipped', 'AS SHIPPED', '5  7  9  11  13 raw'],
  ['round-up', 'ROUND UP', '5→6  7→8  9→10  11→12  13→14'],
]
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`

const browser = await chromium.launch()
for (const [key, title, sub] of SURFACES) {
  const cols = VARIANTS.filter(([v]) => existsSync(`${DIR}/${key}-${v}.png`))
  if (cols.length !== 3) {
    console.log(`skip ${key}: ${cols.length}/3 shots`)
    continue
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#2b2b2b;font:13px/1.4 ui-sans-serif,system-ui,sans-serif;color:#eee;padding:18px}
    h1{font-size:15px;margin:0 0 2px}
    p.sub{margin:0 0 14px;color:#aaa;font-size:12px}
    .row{display:flex;gap:14px;align-items:flex-start}
    .col{flex:1}
    .cap{font-weight:700;letter-spacing:.04em;font-size:11px;margin-bottom:2px}
    .cap small{display:block;font-weight:400;color:#aaa;letter-spacing:0}
    img{width:100%;display:block;border:1px solid #555;margin-top:6px}
  </style>
  <h1>${title}</h1><p class="sub">${sub} · viewport 390px · the two mechanical readings of "round to the nearest step"</p>
  <div class="row">${cols
    .map(
      ([v, cap, note]) =>
        `<div class="col"><div class="cap">${cap}<small>${note}</small></div><img src="${b64(`${DIR}/${key}-${v}.png`)}"></div>`,
    )
    .join('')}</div>`
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/compare-${key}.png`, fullPage: true })
  await page.close()
  console.log(`wrote compare-${key}.png`)
}
await browser.close()
