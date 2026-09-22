// Stitch a phase's rest crops into one labelled sheet (montage-<phase>.png),
// or two phases side by side (montage-pairs.png) when given "pairs".
import { chromium } from '@playwright/test'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2] || 'before'
const phases = mode === 'pairs' ? ['before', 'after'] : [mode]
const names = [...new Set(readdirSync(join(here, phases[0])).filter((f) => f.endsWith('.png')).map((f) => f.replace(/--(rest|hover|pressed|focus)\.png$/, '')))]
const img = (ph, f) => existsSync(join(here, ph, f)) ? `<img src="data:image/png;base64,${readFileSync(join(here, ph, f)).toString('base64')}">` : '<i>—</i>'
const states = process.env.STATES ? process.env.STATES.split(',') : ['rest', 'hover', 'pressed', 'focus']
const rows = names.map((n) => `<tr><th>${n}</th>${phases.map((ph) => states.map((s) => `<td>${img(ph, `${n}--${s}.png`)}</td>`).join('')).join('<td class=gap></td>')}</tr>`).join('')
const head = `<tr><th></th>${phases.map((ph) => states.map((s) => `<th>${ph} ${s}</th>`).join('')).join('<td class=gap></td>')}</tr>`
const html = `<style>body{background:#F6EFDC;font:12px sans-serif;margin:8px}td,th{padding:4px;vertical-align:middle;text-align:left}img{zoom:.5;display:block}.gap{width:24px}</style><table>${head}${rows}</table>`
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 800 } })
await p.setContent(html); await p.screenshot({ path: join(here, `montage-${mode}${process.env.STATES ? '-' + process.env.STATES.replace(/,/g, '-') : ''}.png`), fullPage: true }); await b.close()
