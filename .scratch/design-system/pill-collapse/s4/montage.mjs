// Before/after contact sheet for slice 4 (#1131): one row per target and
// state, the before crop beside the after crop, written as a PNG page. Node
// and Playwright only (no Pillow here).
//   node montage.mjs [state] [out.png] [names,...]
//   state: '' (the control in its row), rest, hover, focus, pressed, selected
import { chromium } from '@playwright/test'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { TARGETS } from './targets.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const state = process.argv[2] || ''
const outFile = join(here, process.argv[3] || `pairs${state ? '--' + state : ''}.png`)
const only = process.argv[4] ? process.argv[4].split(',') : null
const file = (ph, n) => join(here, ph, `${n}${state ? '--' + state : ''}.png`)
const rows = TARGETS.filter((t) => !only || only.includes(t.name)).filter((t) => existsSync(file('before', t.name)) || existsSync(file('after', t.name)))
const cell = (p) => (existsSync(p) ? `<img src="${pathToFileURL(p)}">` : '<i>none</i>')
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#F6EFDC;font:12px/1.3 system-ui}
table{border-collapse:collapse}td{padding:6px 10px;border-bottom:1px solid #cbc1a7;vertical-align:middle}
td:first-child{font-weight:600;white-space:nowrap}img{display:block;max-width:560px}
th{text-align:left;padding:4px 10px}</style>
<table><tr><th>${state || 'in its row'}</th><th>before (main)</th><th>after (slice 4)</th></tr>
${rows.map((t) => `<tr><td>${t.name}</td><td>${cell(file('before', t.name))}</td><td>${cell(file('after', t.name))}</td></tr>`).join('\n')}
</table>`
const tmp = join(here, '.montage.html')
writeFileSync(tmp, html)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(tmp).href)
await page.waitForTimeout(300)
await page.screenshot({ path: outFile, fullPage: true })
await browser.close()
unlinkSync(tmp)
console.log('wrote', outFile, rows.length, 'rows')
