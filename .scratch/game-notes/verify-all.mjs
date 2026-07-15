// Dump extractForTeam output for every calibrated club's freshly-fetched PDF,
// so a human can eyeball for dropped bold names, mangled text, wrong info.
//   node .scratch/game-notes/verify-all.mjs
import { getDocument } from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { extractForTeam } from '../../src/api/whatsBrewing.js'
import fs from 'node:fs'

const CLUBS = {
  158: 'MIL', 134: 'PIT', 111: 'BOS', 121: 'NYM', 146: 'MIA', 143: 'PHI',
  119: 'LAD', 133: 'ATH', 117: 'HOU', 118: 'KC', 108: 'LAA', 136: 'SEA',
  142: 'MIN', 147: 'NYY', 138: 'STL',
}

for (const [teamId, abbr] of Object.entries(CLUBS)) {
  const file = `.scratch/game-notes/pdfs/${teamId}.pdf`
  if (!fs.existsSync(file)) { console.log(`=== ${abbr} (${teamId}) — NO PDF ===`); continue }
  const data = new Uint8Array(fs.readFileSync(file))
  const doc = await getDocument({ data, disableWorker: true }).promise
  // try page 1 and page 2 depending on config; extractForTeam picks its own cfg.page
  const cfgPage = (await import('../../src/api/whatsBrewing.js'))
  const page = await doc.getPage(1) // placeholder, real page picked below
  console.log(`\n=== ${abbr} (${teamId}) ===`)
  try {
    const blurbs = await extractFromDoc(doc, Number(teamId))
    if (!blurbs.length) {
      console.log('  ** EMPTY — parser returned [] **')
    } else {
      for (const b of blurbs) {
        console.log(`  [${b.title}]`)
        console.log(`    ${b.body}`)
      }
    }
  } catch (e) {
    console.log('  ** ERROR **', e.message)
  }
  doc.destroy?.()
}

async function extractFromDoc(doc, teamId) {
  // Re-derive cfg.page the same way parsePdf does, by peeking at the module's CONFIG
  // via a tiny local copy of the page lookup logic isn't exported, so just try both pages.
  const mod = await import('../../src/api/whatsBrewing.js')
  // brute force: try page 1, then page 2, use extractForTeam on whichever cfg expects
  for (const pageNum of [1, 2]) {
    try {
      const page = await doc.getPage(pageNum)
      await page.getOperatorList()
      const tc = await page.getTextContent()
      const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || '' } catch { return '' } }
      const result = mod.extractForTeam(tc.items, realName, teamId)
      if (result.length) return result
    } catch {}
  }
  return []
}
