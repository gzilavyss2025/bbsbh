// ../look.mjs, pointed at ./boards/ instead of ../project/, and reporting the
// measured height of every part of the card rather than only the page total —
// records.md's numbers come from here.
//
//   MSYS_NO_PATHCONV=1 node .scratch/team-one-scroll/canvas/records/look-records.mjs "<absolute out dir>" Rec-Closed.dc.html ...
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const outDir = process.argv[2]
const SLICE = Number(process.env.SLICE) || 1600
mkdirSync(outDir, { recursive: true })

const names = process.argv.length > 3
  ? process.argv.slice(3)
  : readdirSync(join(HERE, 'boards')).filter((f) => f.endsWith('.dc.html'))

const browser = await chromium.launch()
for (const name of names) {
  const src = readFileSync(join(HERE, 'boards', name), 'utf8')
    .replace('<script src="./support.js"></script>', '')
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
    .replace(/<\/?x-dc>/g, '')
    .replace(/<helmet>/, '').replace(/<\/helmet>/, '')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.setContent(src, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const m = await page.evaluate(() => {
    const h = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
    const t = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const card = document.querySelector('.card')
    const tabs = [...card.querySelectorAll('.tabrow')]
    const groups = [...card.querySelectorAll('.idxg')].map((g) => ({
      name: t(g.querySelector('.idxn')),
      px: h(g),
      open: g.classList.contains('on'),
      line: h(g.querySelector('.idxb')),
    }))
    return {
      page: document.body.scrollHeight,
      card: h(card),
      chead: h(card.querySelector('.chead')),
      halves: h(tabs[0]),
      months: h(tabs[1]),
      index: h(card.querySelector('.idx')),
      foot: h(card.querySelector('.foot')),
      dow: h(document.querySelectorAll('.card')[1]),
      groups,
      wide: [...document.querySelectorAll('*')]
        .filter((e) => e.getBoundingClientRect().right > 390.5).map((e) => e.className).slice(0, 6),
    }
  })

  const slug = name.replace('.dc.html', '')
  const n = Math.ceil(m.page / SLICE)
  for (let i = 0; i < n; i++) {
    await page.screenshot({
      path: join(outDir, `${slug}-${String(i).padStart(2, '0')}.png`),
      clip: { x: 0, y: i * SLICE, width: 390, height: Math.min(SLICE, m.page - i * SLICE) },
      fullPage: true,
    })
  }
  console.log(`\n=== ${name}  page ${m.page}px -> ${n} strips`)
  console.log(`  CARD ${m.card}px   head ${m.chead} · halves ${m.halves} · months ${m.months} · index ${m.index} · foot ${m.foot}`)
  console.log(`  screens of 844: card ${(m.card / 844).toFixed(2)}   day-of-week card ${m.dow}px`)
  for (const g of m.groups) {
    console.log(`   ${String(g.px).padStart(5)}px  ${g.open ? 'OPEN ' : '     '}${g.name.padEnd(22)} line ${g.line}px`)
  }
  if (m.wide.length) console.log(`  !! overflowing 390px: ${m.wide.join(' | ')}`)
  await ctx.close()
}
await browser.close()
