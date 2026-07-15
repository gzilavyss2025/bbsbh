// For each flow-bold club, find recurring x-start clusters among body/head-font
// lines to distinguish "genuine 2nd column" (many lines start near the same x)
// from "occasional wrap overrun" (single line reaching past columnMaxX).
//   node column-scan.mjs
import { getDocument } from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'node:fs'

const CLUBS = {
  111: 'BOS', 121: 'NYM', 146: 'MIA', 143: 'PHI', 119: 'LAD', 133: 'ATH',
  117: 'HOU', 118: 'KC', 108: 'LAA', 136: 'SEA', 142: 'MIN', 147: 'NYY',
}
// current cfg (copied) for bodyFont/headFont/page/columnMaxX
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
  147: { bodyFont: /MyriadPro-Regular/, headFont: /MyriadPro-Bold/, page: 1, columnMaxX: null }, // 2-column club, skip
}

for (const [teamId, abbr] of Object.entries(CLUBS)) {
  const cfg = CFG[teamId]
  if (cfg.columnMaxX == null) { console.log(`\n=== ${abbr} (${teamId}) — SKIP (multi-column cfg) ===`); continue }
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
  const isContent = (w) => cfg.bodyFont.test(w.font) || cfg.headFont.test(w.font)
  const content = words.filter(isContent)
  // group into lines by y (tol 3)
  const lines = []
  for (const w of content) {
    let l = lines.find((l) => Math.abs(l.y - w.y) < 3)
    if (!l) { l = { y: w.y, words: [] }; lines.push(l) }
    l.words.push(w)
  }
  for (const l of lines) l.words.sort((a, b) => a.x - b.x)
  // xMin per line = leftmost word's x
  const xMins = lines.map((l) => l.words[0].x).filter((x) => x < 400)
  // histogram in 10pt buckets from 0-400
  const hist = {}
  for (const x of xMins) { const b = Math.floor(x / 10) * 10; hist[b] = (hist[b] || 0) + 1 }
  const buckets = Object.entries(hist).map(([b, c]) => [Number(b), c]).sort((a, b) => a[0] - b[0])
  console.log(`\n=== ${abbr} (${teamId}) — current columnMaxX=${cfg.columnMaxX} ===`)
  console.log('  xMin histogram (bucket: count):', buckets.map(([b, c]) => `${b}:${c}`).join(' '))
  // words that currently get dropped by columnMaxX but whose LINE starts within it (i.e. wrap overruns)
  const overruns = []
  for (const l of lines) {
    const xMin = l.words[0].x
    if (xMin < cfg.columnMaxX) {
      const maxX = Math.max(...l.words.map((w) => w.x))
      if (maxX >= cfg.columnMaxX) overruns.push({ y: l.y, maxX, text: l.words.map((w) => w.str).join(' ') })
    }
  }
  console.log(`  ${overruns.length} line(s) starting in-column but overrunning columnMaxX:`)
  for (const o of overruns.slice(0, 10)) console.log(`    y=${o.y.toFixed(0)} maxX=${o.maxX.toFixed(0)}: ${o.text.slice(0, 90)}`)
  doc.destroy?.()
}
