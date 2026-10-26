// Capture today's innings page in a given reading position.
// node today.mjs <route> <w> <h> <gamePk> <revealThrough> <atbat "half:count"|-> <out-prefix> [clicks;sep] [dump=1]
import { createRequire } from 'node:module'
import fs from 'node:fs'
const { chromium } = createRequire(import.meta.url)('playwright')
const [route, w, h, pk, rev, ab, out, clicks = '', dump = '1'] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 })
await ctx.addInitScript(([pk, rev, ab]) => {
  if (sessionStorage.getItem('seeded')) return
  sessionStorage.setItem('seeded', '1')
  localStorage.setItem('bbsbh:reveal:' + pk, rev)
  if (ab !== '-') localStorage.setItem('bbsbh:reveal-atbat:' + pk, ab)
  else localStorage.removeItem('bbsbh:reveal-atbat:' + pk)
}, [pk, rev, ab])
const page = await ctx.newPage()
await page.route(/^https:\/\//, async (r) => {
  try { const res = await fetch(r.request().url()); const body = Buffer.from(await res.arrayBuffer())
    await r.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'access-control-allow-origin': '*' }, body })
  } catch { await r.abort() }
})
await page.goto('http://localhost:5173' + route + (route.includes('?') ? '&' : '?') + 'nointro', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(2500)
for (const c of clicks.split(';').filter(Boolean)) {
  const [sel, nth = '0'] = c.split('@')
  const loc = page.locator(sel).nth(+nth)
  await loc.click({ timeout: 5000 }).catch((e) => console.log('click failed', sel, String(e).slice(0, 80)))
  await page.waitForTimeout(1600)
}
await page.screenshot({ path: out + '.jpg', fullPage: true, type: 'jpeg', quality: 60 })
if (dump === '1') {
  const els = await page.evaluate(() => {
    const seen = new Map()
    for (const el of document.querySelectorAll('body [class]')) {
      const cls = [...el.classList].filter((c) => !c.startsWith('is-')).slice(0, 2).join('.')
      if (!cls || seen.has(cls)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 20 || r.height < 12) continue
      seen.set(cls, [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)])
    }
    return [...seen]
  })
  fs.writeFileSync(out + '.json', JSON.stringify(els))
  console.log(els.length, 'classes')
}
await b.close()
