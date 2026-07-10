// Proof harness for a generalized "flow-bold" extraction:
//   body     = words whose font matches bodyRe but NOT headRe
//   headings = words whose font matches headRe, sitting at the left margin (x<hx)
// Each heading owns the body lines below it (until the next heading). This is the
// recipe I'm inferring for the colon-headed-narrative clubs. If it yields clean
// blurbs, the per-team dossier's calibration recipe is sound.
//
//   node flowbold-test.mjs NYM-latest.pdf "Grift" "Grift-Bold" 60
import { readFile } from 'node:fs/promises'
const PDFJS = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href
const [file, bodyReS, headReS, hxS = '60'] = process.argv.slice(2)
const bodyRe = new RegExp(bodyReS), headRe = new RegExp(headReS), hx = Number(hxS)

const pdfjs = await import(PDFJS)
const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(file)) }).promise
const page = await doc.getPage(1)
await page.getOperatorList()
const tc = await page.getTextContent()
const nm = (fn) => { try { return page.commonObjs.get(fn)?.name || fn } catch { return fn } }
const words = tc.items.filter((i) => i.str.trim()).map((i) => ({
  x: i.transform[4], y: i.transform[5], w: i.width || 0, str: i.str, font: nm(i.fontName),
}))
const isHead = (w) => headRe.test(w.font)
const isBody = (w) => bodyRe.test(w.font) && !isHead(w)

// headings: bold at left margin, grouped by baseline
const heads = []
for (const w of words.filter((w) => isHead(w) && w.x < hx).sort((a, b) => b.y - a.y)) {
  let h = heads.find((h) => Math.abs(h.y - w.y) < 3)
  if (!h) { h = { y: w.y, ws: [] }; heads.push(h) }
  h.ws.push(w)
}
for (const h of heads) h.title = h.ws.sort((a, b) => a.x - b.x).map((w) => w.str).join('').replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim()

// body lines
const blines = []
for (const w of words.filter(isBody).sort((a, b) => b.y - a.y || a.x - b.x)) {
  let l = blines.find((l) => Math.abs(l.y - w.y) < 3)
  if (!l) { l = { y: w.y, ws: [] }; blines.push(l) }
  l.ws.push(w)
}
for (const l of blines) l.text = l.ws.sort((a, b) => a.x - b.x).map((w) => w.str).join(' ').replace(/\s+/g, ' ').trim()

for (const h of heads.sort((a, b) => b.y - a.y)) {
  const body = blines.filter((l) => l.y < h.y + 2 && (heads.filter((o) => o.y > l.y).sort((a, b) => a.y - b.y)[0] || h) === h)
    .sort((a, b) => b.y - a.y).map((l) => l.text).join(' ')
  console.log(`\n### ${h.title}\n${body.slice(0, 260)}`)
}
await doc.destroy?.()
