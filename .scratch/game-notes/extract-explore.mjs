import { getDocument } from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { extractForTeam } from '../../src/api/whatsBrewing.js'
import fs from 'node:fs'

const teamId = process.argv[2]
const page = Number(process.argv[3] || 1)
const OUT = process.argv[4]
const j = JSON.parse(fs.readFileSync('public/data/game-notes.json', 'utf8'))
const notes = (j.notes[teamId] || []).slice(0, 5)

const out = []
for (const note of notes) {
  const buf = new Uint8Array(await fetch(note.url).then((r) => r.arrayBuffer()))
  const doc = await getDocument({ data: buf, disableWorker: true }).promise
  const p = await doc.getPage(page)
  await p.getOperatorList()
  const tc = await p.getTextContent()
  const realName = (fn) => { try { return p.commonObjs.get(fn)?.name || '' } catch { return '' } }
  const blurbs = extractForTeam(tc.items, realName, Number(teamId))
  out.push({ date: note.date, title: note.title, blurbs })
  console.error(`${note.date}: ${blurbs.length} blurbs`)
  doc.destroy?.()
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.error('wrote ' + OUT)
