// Capture real player-page cards from the running app: the card's DOM plus only the CSS rules that match inside it.
import { chromium } from 'playwright'
import fs from 'node:fs'
const WANT = [
  { id: '592885', pick: 'Season', as: 'Season' },
  { id: '592885', pick: 'Splits', as: 'Splits' },
  { id: '592885', pick: 'Plate approach', as: 'PlateApproach' },
  { id: '592885', pick: 'Contact', as: 'Contact' },
  { id: '592885', pick: 'Form trend', as: 'FormTrend' },
  { id: '642547', pick: 'Pitch arsenal', as: 'PitchArsenal' },
  { id: '642547', pick: 'On the mound', as: 'OnTheMound' },
]
const VIEW = Number(process.env.VIEW || 1180)
const bundleCss = fs.readFileSync((process.env.DS_OUT || 'ds-bundle') + '/_ds_bundle.css', 'utf8')
function extract({ pickName, bundleCss, origin }) {
  const card = [...document.querySelectorAll('.card--stamped.card--named')].find((n) => (n.querySelector('.card__name') || {}).textContent === pickName)
  if (!card) return { error: 'card not found: ' + pickName }
  card.scrollIntoView()
  // chain of ancestors up to #root
  const chain = []
  for (let n = card.parentElement; n && n.id !== 'root'; n = n.parentElement) chain.unshift({ tag: n.tagName.toLowerCase(), cls: n.className })
  const els = [card, ...card.querySelectorAll('*'), ...[...Array(chain.length)].map((_, i) => { let n = card; for (let k = 0; k <= i; k++) n = n.parentElement; return n })]
  const stripPseudo = (sel) => sel.replace(/::?(before|after|hover|focus-visible|focus-within|focus|active|disabled|checked|-webkit-[\w-]+|-moz-[\w-]+|placeholder|selection|first-line|first-letter)(\([^)]*\))?/g, '')
  const matchSel = (sel) => {
    const parts = sel.split(',')
    for (const raw of parts) {
      const s = stripPseudo(raw.trim()) || '*'
      if (/^(html|body|:root)\b/.test(s) && !/\s/.test(s)) continue
      try { if (els.some((e) => e.matches(s))) return true } catch (e) { /* unsupported selector */ }
    }
    return false
  }
  // rules already in the design system bundle
  const bs = document.createElement('style'); bs.textContent = bundleCss; document.head.appendChild(bs)
  const seen = new Set()
  const flat = (rules, pre) => { for (const r of rules) { if (r.cssRules && r.type === 4) flat(r.cssRules, pre + r.conditionText + '|'); else if (r.type === 1) seen.add(pre + r.cssText) } }
  flat(bs.sheet.cssRules, ''); bs.remove()
  const keyframes = new Map(); const out = []; const used = new Set()
  const walk = (rules, pre) => {
    const kept = []
    for (const r of rules) {
      if (r.type === 1) {
        if (!matchSel(r.selectorText)) continue
        if (seen.has(pre + r.cssText)) continue
        const an = (r.style.animationName || '') + ' ' + (r.style.animation || '')
        an.split(/[\s,]+/).forEach((w) => w && used.add(w))
        kept.push(r.cssText)
      } else if (r.type === 4 || r.type === 12) {
        const inner = walk(r.cssRules, pre + (r.conditionText || '') + '|')
        if (inner.length) kept.push(`@${r.type === 4 ? 'media' : 'supports'} ${r.conditionText} {\n${inner.join('\n')}\n}`)
      } else if (r.type === 7) keyframes.set(r.name, r.cssText)
    }
    return kept
  }
  for (const sheet of document.styleSheets) { try { out.push(...walk(sheet.cssRules, '')) } catch (e) { /* cross-origin */ } }
  for (const [n, t] of keyframes) if (used.has(n)) out.push(t)
  const clone = card.cloneNode(true)
  clone.querySelectorAll('script,noscript').forEach((n) => n.remove())
  const cv = [...card.querySelectorAll('canvas')]
  clone.querySelectorAll('canvas').forEach((c, i) => { try { const im = document.createElement('img'); im.src = cv[i].toDataURL('image/png'); im.className = c.className; im.setAttribute('style', c.getAttribute('style') || ''); im.width = cv[i].width; im.height = cv[i].height; im.style.width = cv[i].style.width || cv[i].clientWidth + 'px'; im.style.height = cv[i].style.height || cv[i].clientHeight + 'px'; c.replaceWith(im) } catch (e) { /* tainted */ } })
  clone.querySelectorAll('[src^="/"]').forEach((n) => n.setAttribute('src', origin + n.getAttribute('src')))
  clone.querySelectorAll('[srcset]').forEach((n) => n.removeAttribute('srcset'))
  clone.querySelectorAll('img').forEach((n) => n.setAttribute('loading', 'eager'))
  clone.querySelectorAll('.card--stamp-in, .player-rise, .player-rise--wait').forEach((n) => n.classList.remove('player-rise--wait'))
  return { html: clone.outerHTML, css: out.join('\n'), chain, tags: els.length }
}
;(async () => {
  const b = await chromium.launch()
  fs.mkdirSync('.design-sync/captures', { recursive: true })
  const byId = {}
  for (const w of WANT) (byId[w.id] ||= []).push(w)
  for (const [id, list] of Object.entries(byId)) {
    const p = await b.newPage({ viewport: { width: VIEW, height: 900 } })
    await p.goto('http://localhost:5173/player/' + id + '?nointro', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await p.waitForTimeout(3000)
    const h = await p.evaluate(() => document.body.scrollHeight)
    for (let y = 0; y < h + 2000; y += 500) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(350) }
    await p.waitForTimeout(1500)
    for (const w of list) {
      const el = await p.$(`.card--stamped.card--named:has(> .card__name:text-is("${w.pick}"))`)
      if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200) }
      const r = await p.evaluate(extract, { pickName: w.pick, bundleCss, origin: 'http://localhost:5173' })
      if (r.error) { console.log(w.as, r.error); continue }
      fs.writeFileSync(`.design-sync/captures/${w.as}.json`, JSON.stringify(r))
      console.log(w.as, 'html', r.html.length, 'css', r.css.length, 'chain', r.chain.map((c) => c.cls.split(' ')[0]).join('>'))
    }
    await p.close()
  }
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
