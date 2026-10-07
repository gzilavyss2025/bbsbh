import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:5173/09222026/minsf/bottom1?nointro', { waitUntil: 'load' })
await p.waitForTimeout(8000)
for (let i = 0; i < 3; i++) { const btn = p.getByRole('button', { name: /next at-bat/i }).first(); if (await btn.count()) { await btn.click(); await p.waitForTimeout(700) } }
await p.screenshot({ path: process.argv[2] })
console.log(await p.locator('body').innerText().then((t) => t.slice(0, 400)))
await b.close()
