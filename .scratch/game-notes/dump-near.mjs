// Dump raw pdf.js text items (x, y, font, str) whose text matches a substring,
// plus their line neighbors, to diagnose why extractFlowBold dropped something.
//   node dump-near.mjs <pdf> <page> <substring>
import { getDocument } from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'

const [file, pageNum, needle] = process.argv.slice(2)
const data = new Uint8Array(fs.readFileSync(file))
const doc = await getDocument({ data, disableWorker: true }).promise
const page = await doc.getPage(Number(pageNum))
await page.getOperatorList()
const tc = await page.getTextContent()
const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || '' } catch { return '' } }
const items = tc.items
  .filter((i) => i.str.trim())
  .map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str, font: realName(i.fontName) }))

const hits = items.filter((i) => i.str.toLowerCase().includes(needle.toLowerCase()))
for (const h of hits) {
  console.log(`--- match "${h.str}" at (${h.x.toFixed(1)}, ${h.y.toFixed(1)}) font=${h.font}`)
  const line = items.filter((i) => Math.abs(i.y - h.y) < 4).sort((a, b) => a.x - b.x)
  for (const w of line) console.log(`   x=${w.x.toFixed(1).padStart(6)} y=${w.y.toFixed(1)} "${w.str}" [${w.font}]`)
}
