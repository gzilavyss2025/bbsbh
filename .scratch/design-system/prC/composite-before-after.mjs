import { chromium } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'

const DIR = process.env.SHOTS
const SURFACES = [
  ['umpire', 'Umpire tendencies — /umpire/{id}', '53-umpire-tendencies.css · 15 literals in 10 declarations · page 6583 → 6569'],
  ['standings', 'Standings — /standings', '30-standings.css · 9px was HORIZONTAL in a 358px table · page 3230 → 3227'],
  ['player', 'Player stat grid — /player/{id}', '26-player-page.css · 11 literals in 11 declarations · page 2400 → 2388'],
  ['pills', 'The pill family — /team/{id}/roster', '.rankchip and friends at padding 2px 7px, rendered app-wide · 7px → 6px'],
  ['contracts', 'Contracts — /team/{id}/contracts', '70-contracts-grid.css · 9 literals in 9 declarations'],
]
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`

const browser = await chromium.launch()
for (const [key, title, sub] of SURFACES) {
  const before = `${DIR}/ba-${key}-before.png`
  const after = `${DIR}/ba-${key}-after.png`
  if (!existsSync(before) || !existsSync(after)) {
    console.log(`skip ${key}`)
    continue
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#2b2b2b;font:13px/1.4 ui-sans-serif,system-ui,sans-serif;color:#eee;padding:18px}
    h1{font-size:15px;margin:0 0 2px}
    p.sub{margin:0 0 14px;color:#aaa;font-size:12px}
    .row{display:flex;gap:16px;align-items:flex-start}
    .col{flex:1}
    .cap{font-weight:700;letter-spacing:.04em;font-size:11px}
    .cap small{display:block;font-weight:400;color:#aaa;letter-spacing:0}
    img{width:100%;display:block;border:1px solid #555;margin-top:6px}
  </style>
  <h1>${title}</h1><p class="sub">${sub} · viewport 390px</p>
  <div class="row">
    <div class="col"><div class="cap">BEFORE<small>5 7 9 11 13 raw</small></div><img src="${b64(before)}"></div>
    <div class="col"><div class="cap">AFTER — rounded down<small>5→4 7→6 9→8 11→10 13→12</small></div><img src="${b64(after)}"></div>
  </div>`
  const page = await browser.newPage({ viewport: { width: 1120, height: 900 }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${DIR}/c2-${key}.png`, fullPage: true })
  await page.close()
  console.log(`wrote c2-${key}.png`)
}
await browser.close()
