#!/usr/bin/env node
// Find an element by its text and print its computed style and class chain.
// Use it when grep cannot say which class paints a bit of text on screen.
//
//   node scripts/audit/find-by-text.mjs --text "Film room" [--routes /a,/b] [--widths 390] [--base URL]
//
// One line per match: route, width, tag, colour, font-size, then the class chain
// from the element up to the body. Needs `npm run preview` running.

import { CHAIN_FN, eachPage, parseArgs } from './lib.mjs'

const args = parseArgs()
if (typeof args.text !== 'string') {
  console.error('usage: find-by-text.mjs --text "<text>" [--routes /a,/b] [--widths 390,768] [--base URL]')
  process.exit(2)
}

await eachPage(args, async (page, { path, width }) => {
  const found = await page.evaluate(
    ({ text, chainSrc }) => {
      const chain = eval(chainSrc)
      const hits = []
      for (const el of document.querySelectorAll('body *')) {
        // The innermost element whose own text nodes hold the string.
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')
        if (!own.includes(text)) continue
        const cs = getComputedStyle(el)
        hits.push({ tag: el.tagName.toLowerCase(), color: cs.color, size: cs.fontSize, chain: chain(el) })
      }
      return hits
    },
    { text: args.text, chainSrc: CHAIN_FN },
  )
  for (const h of found) console.log(`${path} @${width}\t${h.tag}\t${h.color}\t${h.size}\t${h.chain}`)
})
