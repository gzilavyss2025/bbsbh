// Find bold (head-font) runs beyond the current columnMaxX that are NOT
// ALL-CAPS (i.e. likely a player name/mixed-case phrase, not a genuine
// section-title box) — these are the words currently getting silently
// dropped by the columnMaxX word-filter.
import { getDocument } from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'

const CFG = {
  111: { bodyFont: /FrutigerLT-Cn/, headFont: /FrutigerLT-BlackCn/, page: 1, columnMaxX: 150 },
  121: { bodyFont: /Grift-Regular/, headFont: /Grift-Bold/, page: 1, columnMaxX: 150 },
  146: { bodyFont: /GothamXNarrow-Book/, headFont: /GothamXNarrow-Bold/, page: 1, columnMaxX: 150 },
  143: { bodyFont: /Tahoma$/, headFont: /Tahoma-Bold/, page: 1, columnMaxX: 150 },
  119: { bodyFont: /ArticulatCF-Regular/, headFont: /ArticulatCF-Bold/, page: 1, columnMaxX: 150 },
  133: { bodyFont: /ProximaNova-Regular/, headFont: /ProximaNova-BoldIt/, page: 1, columnMaxX: 150 },
  117: { bodyFont: /Colfax-Regular/, headFont: /Colfax-Bold/, page: 1, columnMaxX: 150 },
  118: { bodyFont: /Gotham-Book/, headFont: /Gotham-Bold/, page: 1, columnMaxX: 150 },
  108: { bodyFont: /QuietSans-Regular/, headFont: /QuietSans-Bold/, page: 1, columnMaxX: 150 },
  136: { bodyFont: /HelveticaNeueLTStd-Roman/, headFont: /HelveticaNeueLTStd-Bd$/, page: 2, columnMaxX: 150 },
  142: { bodyFont: /TradeGothicLTStd-Cn18/, headFont: /TradeGothicLTStd-BdCn20/, page: 2, columnMaxX: 150 },
}
const NAMES = { 111:'BOS',121:'NYM',146:'MIA',143:'PHI',119:'LAD',133:'ATH',117:'HOU',118:'KC',108:'LAA',136:'SEA',142:'MIN' }

function isAllCaps(t) {
  const n = t.replace(/\bMc(?=[A-Z])/g, 'MC')
  return n === n.toUpperCase()
}

for (const [teamId, cfg] of Object.entries(CFG)) {
  const file = `.scratch/game-notes/pdfs/${teamId}.pdf`
  const data = new Uint8Array(fs.readFileSync(file))
  const doc = await getDocument({ data, disableWorker: true }).promise
  const page = await doc.getPage(cfg.page)
  await page.getOperatorList()
  const tc = await page.getTextContent()
  const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || '' } catch { return '' } }
  const words = tc.items.filter((i) => i.str.trim()).map((i) => ({
    x: i.transform[4], y: i.transform[5], str: i.str, font: realName(i.fontName),
  }))
  const isHead = (w) => cfg.headFont.test(w.font)
  const head = words.filter((w) => isHead(w) && w.x >= cfg.columnMaxX && w.x < 400)
  // group into contiguous runs by y+adjacency
  const runs = []
  for (const w of head.sort((a,b)=>b.y-a.y||a.x-b.x)) {
    let r = runs.find((r) => Math.abs(r.y - w.y) < 3 && Math.abs(w.x - r.endX) < 15)
    if (!r) { r = { y: w.y, words: [], endX: -Infinity }; runs.push(r) }
    r.words.push(w); r.endX = w.x + 30
  }
  const suspects = runs.map((r) => r.words.map((w) => w.str).join(' ')).filter((t) => t.trim() && !isAllCaps(t.replace(/:$/, '')))
  console.log(`\n${NAMES[teamId]} (${teamId}): ${suspects.length} mixed-case bold run(s) past columnMaxX=${cfg.columnMaxX}`)
  for (const s of suspects.slice(0, 15)) console.log(`  "${s}"`)
  doc.destroy?.()
}
