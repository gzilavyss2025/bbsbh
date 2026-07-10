// Fetch a club's latest Game Notes PDF by teamId, using the URLs the app already
// ships in public/data/game-notes.json. The PDFs are NOT committed (large + the
// "latest" one changes daily), so grab a fresh one to calibrate/verify against.
// The template (fonts/geometry) is stable across dates — only the blurb text of
// the day changes — so a freshly fetched PDF still matches CALIBRATION.md.
//
//   node .scratch/game-notes/fetch-note.mjs 111        # -> writes 111.pdf (Red Sox)
//   node .scratch/game-notes/fetch-note.mjs 111 out.pdf
import { readFile, writeFile } from 'node:fs/promises'
const [teamId, out = `${teamId}.pdf`] = process.argv.slice(2)
if (!teamId) { console.error('usage: node fetch-note.mjs <teamId> [out.pdf]'); process.exit(1) }
const notes = JSON.parse(await readFile(new URL('../../public/data/game-notes.json', import.meta.url))).notes
const list = notes[teamId]
if (!list?.length) { console.error(`no notes for teamId ${teamId}`); process.exit(1) }
const { url, title, date } = list[0] // newest first
console.error(`fetching ${teamId}: ${title || ''} (${date || ''})\n  ${url}`)
const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
await writeFile(out, buf)
console.log(`wrote ${out} (${(buf.length / 1024).toFixed(0)} KB)`)
