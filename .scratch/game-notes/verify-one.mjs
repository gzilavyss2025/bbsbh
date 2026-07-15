import { getDocument } from '../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { extractForTeam } from '../../src/api/whatsBrewing.js'
import fs from 'node:fs'
const [file, teamId, pageNum] = process.argv.slice(2)
const data = new Uint8Array(fs.readFileSync(file))
const doc = await getDocument({ data, disableWorker: true }).promise
const page = await doc.getPage(Number(pageNum))
await page.getOperatorList()
const tc = await page.getTextContent()
const realName = (fn) => { try { return page.commonObjs.get(fn)?.name || '' } catch { return '' } }
const result = extractForTeam(tc.items, realName, Number(teamId))
console.log(JSON.stringify(result, null, 2))
