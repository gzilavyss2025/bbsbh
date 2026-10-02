// Injects the data from build-data.mjs (and the baseline screenshot) into
// template.html, giving one self-contained HTML file — the design canvas.
//
// Usage (from the repo root):
//   node .scratch/innings-console-redesign/mockup/build-page.mjs [data.json] [out.html]
// Defaults read node_modules/.cache/innings-console/data.json and write
// node_modules/.cache/innings-console/innings-console-studies.html. The output
// is about 2 MB (headshots ride along as data: URIs), so it is not committed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const CACHE = path.join(ROOT, 'node_modules/.cache/innings-console')
const [dataPath = path.join(CACHE, 'data.json'), outPath = path.join(CACHE, 'innings-console-studies.html')] = process.argv.slice(2)

const template = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8')
const data = fs.readFileSync(dataPath, 'utf8')
const today = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(HERE, 'today-390.jpg')).toString('base64')
const html = template
  .replace('/*__DATA__*/null', () => data.replace(/<\//g, '<\\/'))
  .replace('"__TODAY__"', () => JSON.stringify(today))
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, html)
console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB)`)
