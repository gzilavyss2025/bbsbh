// Profiles a Game Notes PDF's page-1 fonts + geometry to produce the calibration
// signals whatsBrewing.js needs (body font, emphasis/heading face, header face,
// left-margin heading runs, x-bounds). Output is a structured report per team.
//
//   node profile-notes.mjs ATL-latest.pdf 144 ATL
import { readFile } from 'node:fs/promises'

const PDFJS = new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href
const [file, teamId = '?', abbr = '?', pageArg = '1'] = process.argv.slice(2)

const pdfjs = await import(PDFJS)
const data = new Uint8Array(await readFile(file))
const doc = await pdfjs.getDocument({ data }).promise
const page = await doc.getPage(Number(pageArg))
const vp = page.getViewport({ scale: 1 })
await page.getOperatorList()
const tc = await page.getTextContent()
const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || fn } catch { return fn } }

const words = tc.items
  .filter((i) => i.str.trim())
  .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width || 0, str: i.str, font: realName(i.fontName) }))

// base family = strip subset prefix "ABCDEF+" and weight suffix noise
const base = (f) => f.replace(/^[A-Z]{6}\+/, '')
const family = (f) => base(f).replace(/[-,].*$/, '')

const tally = {}
for (const w of words) tally[w.font] = (tally[w.font] || 0) + 1
const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
const bodyFont = sorted[0][0]
const bodyFam = family(bodyFont)

// per-font x stats
const stat = (fltr) => {
  const xs = words.filter(fltr).map((w) => w.x)
  if (!xs.length) return null
  return { n: xs.length, xmin: Math.min(...xs).toFixed(0), leftN: xs.filter((x) => x < 60).length }
}

console.log(`\n======== ${abbr} (${teamId}) ========`)
console.log(`page: ${vp.width.toFixed(0)} x ${vp.height.toFixed(0)}  (${vp.height > 900 ? 'US Legal' : 'US Letter'})`)
console.log(`items: ${words.length}   bodyFont: ${base(bodyFont)}   family: ${bodyFam}`)
console.log('fonts (count : name):')
for (const [f, c] of sorted.slice(0, 12)) console.log(`  ${String(c).padStart(4)} : ${base(f)}`)

// emphasis candidates = SAME base family as body but a different subset/font obj
console.log(`emphasis candidates (family ${bodyFam}, != bodyFont):`)
for (const [f, c] of sorted) {
  if (f === bodyFont || family(f) !== bodyFam) continue
  const s = stat((w) => w.font === f)
  console.log(`  ${base(f).padEnd(30)} n=${c} xmin=${s.xmin} leftMargin(x<60)=${s.leftN}`)
}

// header/display candidates = a DIFFERENT family from body (Gotham etc.)
console.log('other-family candidates (display/header):')
const fams = {}
for (const [f, c] of sorted) { const fm = family(f); if (fm !== bodyFam) fams[fm] = (fams[fm] || 0) + c }
for (const [fm, c] of Object.entries(fams).sort((a, b) => b[1] - a[1])) console.log(`  ${fm.padEnd(24)} total=${c}`)

// left-margin runs of the leading emphasis face (candidate inline blurb headings)
const empFonts = sorted.filter(([f]) => f !== bodyFont && family(f) === bodyFam).map(([f]) => f)
const emp = new Set(empFonts)
const leftEmp = words.filter((w) => emp.has(w.font) && w.x < 65).sort((a, b) => b.y - a.y || a.x - b.x)
// group into baselines
const lines = []
for (const w of leftEmp) {
  let l = lines.find((l) => Math.abs(l.y - w.y) < 3)
  if (!l) { l = { y: w.y, ws: [] }; lines.push(l) }
  l.ws.push(w)
}
console.log(`left-margin emphasis runs (x<65) — candidate blurb TITLES (${lines.length}):`)
for (const l of lines.slice(0, 40)) {
  const txt = l.ws.sort((a, b) => a.x - b.x).map((w) => w.str).join('').replace(/\s+/g, ' ').trim()
  console.log(`  y=${l.y.toFixed(0).padStart(4)} x=${Math.min(...l.ws.map((w) => w.x)).toFixed(0).padStart(3)}  ${txt}`)
}
await doc.destroy?.()
