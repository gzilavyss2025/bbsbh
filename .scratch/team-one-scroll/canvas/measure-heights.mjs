// THE TRUE CONTENT HEIGHT OF EVERY PHASE 2 BOARD, so the frame on the canvas is
// sized to the drawing rather than guessed at. A frame too short clips the last
// card; a frame too tall ends the page in a field of empty paper, and on a
// canvas whose claim is true proportion both read as the design's fault.
//
//   MSYS_NO_PATHCONV=1 node .scratch/team-one-scroll/canvas/measure-heights.mjs
import { chromium } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(HERE, 'project')).filter((f) => f.startsWith('P2-') && f.endsWith('.dc.html'))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

for (const name of names) {
  const src = readFileSync(join(HERE, 'project', name), 'utf8')
    .replace('<script src="./support.js"></script>', '')
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
    .replace(/<\/?x-dc>/g, '').replace(/<\/?helmet>/g, '')
    // release the fixed frame so the drawing reports its own height
    .replace(/(<div style="width:390px;height:)\d+(px)/, '$1auto')
  await page.setContent(src, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const { content, frame } = await page.evaluate(() => ({
    content: Math.ceil(document.querySelector('.pagebody').getBoundingClientRect().height),
    frame: document.body.scrollHeight,
  }))
  const set = Number(readFileSync(join(HERE, 'project', name), 'utf8').match(/"height":(\d+)/)[1])
  const slack = set - content
  console.log(`${name.padEnd(30)} content ${String(content).padStart(5)}  frame ${String(set).padStart(5)}` +
    `  ${slack < 0 ? `CLIPS ${-slack}` : slack > 80 ? `slack ${slack}` : 'ok'}   -> ${content + 24}`)
}
await browser.close()
