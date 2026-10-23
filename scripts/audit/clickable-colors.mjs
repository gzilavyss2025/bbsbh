#!/usr/bin/env node
// Scan clickable text by computed colour, grouped by class. Use it to see which
// links and buttons paint a colour you are moving off (#2522: links in ink, not green).
//
//   node scripts/audit/clickable-colors.mjs [--color "rgb(0, 128, 0)"] [--routes /a,/b] [--widths 390]
//
// One line per group: colour, how many elements, the routes it appears on, and the
// element's own class list. With --color, only that colour is listed. Needs `npm run preview`.

import { eachPage, parseArgs } from './lib.mjs'

const args = parseArgs()
const groups = new Map()

await eachPage(args, async (page, { path }) => {
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], button, [role="button"], [role="link"]')]
      .filter((el) => el.textContent.trim() && el.getClientRects().length)
      .map((el) => ({ color: getComputedStyle(el).color, cls: [...el.classList].join('.') || el.tagName.toLowerCase() })),
  )
  for (const { color, cls } of rows) {
    const key = `${color}\t${cls}`
    const g = groups.get(key) || { n: 0, routes: new Set() }
    g.n++
    g.routes.add(path)
    groups.set(key, g)
  }
})

for (const [key, g] of [...groups].sort((a, b) => b[1].n - a[1].n)) {
  const [color, cls] = key.split('\t')
  if (typeof args.color === 'string' && color !== args.color) continue
  console.log(`${color}\t${g.n}\t${g.routes.size} routes (${[...g.routes].slice(0, 3).join(' ')})\t${cls}`)
}
