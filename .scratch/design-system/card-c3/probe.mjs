// Measure every C3 block on main (port 5169) or the branch (5170): frame,
// size, and any descendant that reaches past the block's edge. Also full-page
// and per-block screenshots, and the focus-ring room of each control inside.
import { chromium } from 'file:///C:/Users/gzilavy/bbsbh-card-c3/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const [port, tag] = [process.argv[2], process.argv[3]]
const base = `http://localhost:${port}`
const OUT = `./${tag}/`
mkdirSync(OUT, { recursive: true })
const ROLES = [
  ['metric', '.metriccard, .metric'], ['lineup', 'section.lineup'], ['opp', 'section.opp'], ['starter', '.startercard, section.starter'],
  ['teammate', '.teammatecard, .teammate'], ['defdiamond', '.defdiamond'], ['umps', '.umps__list'], ['umpsframe', '.umps__list, .card:has(> .umps__list)'],
  ['lineuplist', '.lineup__list'], ['penboard', '.penboard'], ['infotip', '.infopop__tip'],
]
const report = {}
async function measure(p, key) {
  const r = await p.evaluate((ROLES) => {
    const out = {}
    const round = (n) => Math.round(n * 2) / 2
    for (const [role, sel] of ROLES) {
      const els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)
      if (!els.length) continue
      out[role] = els.map((el) => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
        const clip = el.closest('.card') ?? el
        const over = [...el.querySelectorAll('*')].filter((d) => {
          const q = d.getBoundingClientRect(); if (!q.width || !q.height) return false
          if (getComputedStyle(d).visibility === 'hidden') return false
          return q.left < r.left - 0.5 || q.right > r.right + 0.5 || q.top < r.top - 0.5 || q.bottom > r.bottom + 0.5
        }).map((d) => `${d.tagName.toLowerCase()}.${String(d.className?.baseVal ?? d.className).split(' ')[0]} ${d.textContent.trim().slice(0, 12)}`)
        return {
          cls: String(el.className), rect: [round(r.x), round(r.y + scrollY), round(r.width), round(r.height)],
          border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor} / ${cs.borderBottomWidth} ${cs.borderBottomColor}`,
          radius: cs.borderRadius, shadow: cs.boxShadow, bg: cs.backgroundColor, overflow: cs.overflow,
          margin: `${cs.marginTop} ${cs.marginBottom}`, padding: cs.padding, over: over.slice(0, 6),
        }
      })
    }
    return out
  }, ROLES)
  report[key] = r
}
async function focusRoom(p, key) {
  const sel = ROLES.slice(0, 7).map(([, s]) => s.split(', ').map((x) => `${x} a, ${x} button`).join(', ')).join(', ')
  const els = await p.$$(sel)
  const res = []
  for (const el of els.slice(0, 40)) {
    if (!(await el.isVisible())) continue
    await el.focus(); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab')
    res.push(await el.evaluate((e) => {
      const host = e.closest('.card') ?? e.closest('.metriccard, .startercard, .lineup, .opp, .teammatecard, .defdiamond, .umps__list')
      if (!host) return null
      const a = e.getBoundingClientRect(), h = host.getBoundingClientRect(); const cs = getComputedStyle(e)
      const ext = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset)
      const room = Math.min(a.left - h.left, h.right - a.right, a.top - h.top, h.bottom - a.bottom)
      const clips = getComputedStyle(host).overflow !== 'visible'
      return `${String(e.className).split(' ')[0] || e.tagName} ext=${ext} room=${Math.round(room * 10) / 10}${ext > room && clips ? ' CLIPPED' : ''}`
    }))
  }
  report[key + ':focus'] = res.filter(Boolean)
}
async function shot(p, name) { await p.screenshot({ path: `${OUT}${name}.png`, fullPage: true }) }
async function go(p, path) { await p.goto(base + path + (path.includes('?') ? '&' : '?') + 'nointro', { waitUntil: 'load', timeout: 120000 }); await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(3000) }
async function clickText(p, sel, text) { const l = p.locator(sel, { hasText: text }).first(); if (await l.count()) { await l.click(); await p.waitForTimeout(1500); return true } return false }
const b = await chromium.launch()
for (const w of [390, 900]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  const pages = ['/07072026/milstl-2/lineup1', '/07072026/milstl-2/lineup2', '/07062025/tolcol/lineup1', '/09302026/cwshou/lineup1', '/09302026/cwshou/lineup2']
  for (const path of pages) {
    await go(p, path); const k = `${w}${path}`
    await measure(p, k); await shot(p, `${w}${path.replaceAll('/', '_')}`)
    if (await clickText(p, '.mastheadpill', 'Bullpen')) {
      await measure(p, k + ':bullpen'); await shot(p, `${w}${path.replaceAll('/', '_')}-bullpen`)
      const btn = p.locator('.infopop__btn').first()
      if (await btn.count()) { await btn.click(); await p.waitForTimeout(500); await measure(p, k + ':infotip'); await btn.screenshot({ path: `${OUT}${w}${path.replaceAll('/', '_')}-tipbtn.png` }).catch(() => {}); await p.screenshot({ path: `${OUT}${w}${path.replaceAll('/', '_')}-tip.png` }) ; await p.keyboard.press('Escape') }
    }
    await focusRoom(p, k)
  }
  // innings: Field tab (the entering defence diamond) and Extras (umpires)
  await go(p, '/07072026/milstl-2/top1')
  for (const tab of ['Field', 'Extras']) {
    const ok = w >= 740 ? await clickText(p, '.refpanel__tab', tab) : await clickText(p, '.refbar__chip', tab)
    await p.waitForTimeout(800)
    await measure(p, `${w}/top1:${tab}:${ok}`); await shot(p, `${w}_top1-${tab}`)
    await focusRoom(p, `${w}/top1:${tab}`)
    if (w < 740) { await p.keyboard.press('Escape'); await p.waitForTimeout(600) }
  }
  // box score, sealed then opened
  await go(p, '/07072026/milstl-2/boxscore')
  await measure(p, `${w}/boxscore:sealed`); await shot(p, `${w}_boxscore-sealed`)
  report[`${w}/boxscore:sealed:dom`] = await p.evaluate(() => ({ diamond: document.querySelectorAll('.defdiamond').length, photos: document.querySelectorAll('.photostrip').length, cover: document.querySelectorAll('button[aria-label="Tap to reveal the box score"]').length }))
  const cover = p.locator('button[aria-label="Tap to reveal the box score"]').first(); await cover.waitFor({ timeout: 30000 }).catch(() => {}); report[w + '/boxscore:cover'] = await cover.count(); if (await cover.count()) { await cover.click(); await p.waitForTimeout(5000) }
  await measure(p, `${w}/boxscore:open`); await shot(p, `${w}_boxscore-open`)
  await focusRoom(p, `${w}/boxscore:open`)
  for (const path of ['/07072026/milstl-2/scorecard', '/fouls', '/team/158']) {
    await go(p, path); await measure(p, `${w}${path}`); await shot(p, `${w}${path.replaceAll('/', '_')}`); await focusRoom(p, `${w}${path}`)
  }
  await p.close()
}
await b.close()
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1))
console.log('done', Object.keys(report).length)
