// Quick multi-page scan: page count, and per page the bold/emphasis left-margin
// runs (candidate narrative titles). Used to see if a table-front club's
// narrative lives on page 2+.
import { readFile } from 'node:fs/promises'
const PDFJS = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href
const [file] = process.argv.slice(2)
const pdfjs = await import(PDFJS)
const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(file)) }).promise
console.log(`${file}: ${doc.numPages} pages`)
for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
  const page = await doc.getPage(p); await page.getOperatorList()
  const tc = await page.getTextContent()
  const nm = (fn) => { try { return page.commonObjs.get(fn)?.name || fn } catch { return fn } }
  const ws = tc.items.filter((i) => i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], f: nm(i.fontName), s: i.str }))
  // "title-ish": a run at left margin (x<65) whose font name suggests bold/black/demi
  const bold = ws.filter((w) => w.x < 65 && /(Bold|Black|Blk|Demi|Heavy|Bd\b|BdCn|BoldIt|Semibold|-Bd)/i.test(w.f)).sort((a, b) => b.y - a.y)
  const lines = []
  for (const w of bold) { let l = lines.find((l) => Math.abs(l.y - w.y) < 3); if (!l) { l = { y: w.y, ws: [] }; lines.push(l) } l.ws.push(w) }
  const titles = lines.map((l) => l.ws.sort((a, b) => a.x - b.x).map((w) => w.s).join('').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 3 && t.length < 45 && /[A-Z]/.test(t))
  console.log(`  page ${p}: ${titles.length} bold-left runs -> ${titles.slice(0, 14).join(' | ')}`)
}
await doc.destroy?.()
