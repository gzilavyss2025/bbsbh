// Render a MLB Pipeline prospect page in Chromium and list every network
// response whose body mentions grades, plus the visible text near "Scouting".
// Usage: node .scratch/ovr/probe-pipeline-page.mjs <slug>   e.g. jesus-made-815908
import { chromium } from 'playwright'
const slug = process.argv[2] ?? 'jesus-made-815908'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())
const p = await b.newPage()
const hits = []
p.on('response', async (r) => {
  try {
    const ct = r.headers()['content-type'] ?? ''
    if (!/json|javascript/.test(ct)) return
    const t = await r.text()
    if (/"(hit|power|arm|fielding|run)(Grade)?"\s*:\s*[2-8]0/i.test(t) || /scouting/i.test(r.url())) hits.push(r.url())
  } catch {}
})
await p.goto(`https://www.mlb.com/prospects/${slug}`, { waitUntil: 'networkidle', timeout: 60000 })
const text = await p.evaluate(() => document.body.innerText)
const i = text.search(/scouting/i)
console.log('final url', p.url())
console.log('grade-ish network responses:', hits)
console.log('text near "Scouting":', i < 0 ? '(none)' : text.slice(Math.max(0, i - 100), i + 400))
console.log('has Hit/Power/Run/Arm/Field grade labels:', /\b(Hit|Power|Run|Arm|Field)\b\s*\n?\s*[2-8]0\b/.test(text))
await b.close()
