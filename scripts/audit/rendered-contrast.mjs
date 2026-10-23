#!/usr/bin/env node
// Audit the real contrast of chosen selectors against the background actually behind
// each one. `scripts/check-contrast.mjs` checks declared token pairs; this reads
// rendered elements, so it finds a door at 1.2:1 on a navy band.
//
//   node scripts/audit/rendered-contrast.mjs --selector "a, .btn" [--min 4.5] [--routes /a,/b] [--widths 390,1024]
//
// One line per element under --min (default 4.5; use 3 for large text): ratio,
// route, width, text colour, background, the element's text and class chain.
// The background is the element's ancestors' backgrounds laid over white. An
// ancestor with a background image or gradient is reported as "image", and its
// ratio is a guess, so look at it. Needs `npm run preview`.

import { CHAIN_FN, contrast, eachPage, over, parseArgs, parseColor } from './lib.mjs'

const args = parseArgs()
if (typeof args.selector !== 'string') {
  console.error('usage: rendered-contrast.mjs --selector "<css>" [--min 4.5] [--routes /a,/b] [--widths 390,1024]')
  process.exit(2)
}
const min = Number(args.min) || 4.5
let read = 0

await eachPage(args, async (page, { path, width }) => {
  const rows = await page.evaluate(
    ({ selector, chainSrc }) => {
      const chain = eval(chainSrc)
      return [...document.querySelectorAll(selector)]
        .filter((el) => el.textContent.trim() && el.getClientRects().length)
        .map((el) => {
          const backs = []
          let image = false
          for (let n = el; n; n = n.parentElement) {
            const cs = getComputedStyle(n)
            backs.push(cs.backgroundColor)
            if (cs.backgroundImage !== 'none') image = true
          }
          return {
            color: getComputedStyle(el).color,
            backs,
            image,
            text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30),
            chain: chain(el),
          }
        })
    },
    { selector: args.selector, chainSrc: CHAIN_FN },
  )
  for (const r of rows) {
    read++
    // Lay each ancestor's background over the ones behind it, root first, on white.
    let bg = [255, 255, 255, 1]
    for (const b of r.backs.reverse()) {
      const c = parseColor(b)
      if (c && c[3] > 0) bg = over(c, bg)
    }
    const fg = parseColor(r.color)
    if (!fg) continue
    const ratio = contrast(over(fg, bg), bg)
    if (ratio >= min) continue
    const rgb = bg.slice(0, 3).map(Math.round).join(',')
    console.log(
      `${ratio.toFixed(2)}\t${path} @${width}\t${r.color}\ton ${r.image ? 'image' : `rgb(${rgb})`}\t"${r.text}"\t${r.chain}`,
    )
  }
})
console.log(`# read ${read} elements, listed those under ${min}:1`)
