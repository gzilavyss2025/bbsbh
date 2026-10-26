// Run a capture plan: for each reading position, load today's page once and crop each block.
// node capture.mjs plan.json outdir
import { createRequire } from 'node:module'
import fs from 'node:fs'
const { chromium } = createRequire(import.meta.url)('playwright')
const [planFile, outDir] = process.argv.slice(2)
const plan = JSON.parse(fs.readFileSync(planFile))
fs.mkdirSync(outDir, { recursive: true })
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const report = {}
for (const st of plan) {
  if (process.argv[4] && !process.argv[4].split(',').includes(st.id)) continue
  const ctx = await b.newContext({ viewport: { width: st.w, height: st.h }, deviceScaleFactor: 2 })
  await ctx.addInitScript(([pk, rev, ab]) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    if (rev === '-') localStorage.removeItem('bbsbh:reveal:' + pk); else localStorage.setItem('bbsbh:reveal:' + pk, rev)
    if (ab === '-') localStorage.removeItem('bbsbh:reveal-atbat:' + pk); else localStorage.setItem('bbsbh:reveal-atbat:' + pk, ab)
  }, [String(st.pk), String(st.rev), st.ab ?? '-'])
  const page = await ctx.newPage()
  await page.route(/^https:\/\//, async (r) => {
    try { const res = await fetch(r.request().url()); const body = Buffer.from(await res.arrayBuffer())
      await r.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'access-control-allow-origin': '*' }, body })
    } catch { await r.abort() }
  })
  await page.goto('http://localhost:5173' + st.route + '?nointro', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2600)
  for (const c of st.clicks || []) {
    const [sel, nth = 0] = Array.isArray(c) ? c : [c, 0]
    await page.locator(sel).nth(nth).click({ timeout: 6000 }).catch((e) => console.log(st.id, 'click failed', sel))
    await page.waitForTimeout(1800)
  }
  if (st.full) await page.screenshot({ path: `${outDir}/${st.id}-full.jpg`, fullPage: true, type: 'jpeg', quality: 60 })
  // The fixed bottom bar covers whatever sits under it, so it is hidden unless it is the subject.
  await page.addStyleTag({ content: '.hidebar .pagenav--innings{visibility:hidden!important}' })
  for (const [name, spec] of Object.entries(st.crops || {})) {
    // spec: "sel" | [sel, nth] | {sel, nth, ctx, ctxNth}: with ctx, the context is shot and the target outlined.
    const o = typeof spec === 'string' ? { sel: spec } : Array.isArray(spec) ? { sel: spec[0], nth: spec[1] } : spec
    const isBar = /pagenav|revealsplit/.test(o.sel)
    await page.evaluate((h) => document.documentElement.classList.toggle('hidebar', h), !isBar)
    try {
      const loc = page.locator(o.sel).nth(o.nth || 0)
      if (o.ctx) {
        const c = page.locator(o.ctx).nth(o.ctxNth || 0)
        await c.scrollIntoViewIfNeeded({ timeout: 3000 })
        await page.waitForTimeout(150)
        const cb = await c.boundingBox(), tb = await loc.boundingBox()
        if (!cb || !tb) throw new Error('no box')
        await page.evaluate(([x, y, w, h]) => { const d = document.createElement('div'); d.id = '__hl'; Object.assign(d.style, { position: 'fixed', left: x - 4 + 'px', top: y - 4 + 'px', width: w + 8 + 'px', height: h + 8 + 'px', outline: '4px solid #f2c14e', boxShadow: '0 0 0 6px rgba(15,24,34,.85)', zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(d) }, [tb.x, tb.y, tb.width, tb.height])
        await page.screenshot({ path: `${outDir}/${name}.png`, clip: { x: Math.max(0, cb.x - 10), y: Math.max(0, cb.y - 10), width: cb.width + 20, height: cb.height + 20 }, animations: 'disabled' })
        await page.evaluate(() => document.getElementById('__hl')?.remove())
      } else {
        await loc.scrollIntoViewIfNeeded({ timeout: 3000 })
        await page.waitForTimeout(150)
        await loc.screenshot({ path: `${outDir}/${name}.png`, timeout: 4000, animations: 'disabled' })
      }
      report[name] = st.id
    } catch (e) { report[name] = 'MISSING ' + st.id + ' ' + o.sel }
  }
  console.log(st.id, 'done')
  await ctx.close()
}
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1))
for (const [k, v] of Object.entries(report)) if (String(v).startsWith('MISSING')) console.log(k, v)
await b.close()
