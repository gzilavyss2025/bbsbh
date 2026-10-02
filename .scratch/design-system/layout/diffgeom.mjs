// usage: node .scratch/design-system/layout/diffgeom.mjs before.json after.json  (exit 1 on any difference)
import { readFileSync } from 'node:fs'
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')))
let bad = 0
for (const k of Object.keys(a)) {
  const x = a[k], y = b[k]
  if (x.count !== y.count || x.h !== y.h) { console.log(k, 'COUNT/HEIGHT differ', x.count, y.count, x.h, y.h); bad++; continue }
  let d = 0
  x.els.forEach((e, i) => { if (JSON.stringify(e) !== JSON.stringify(y.els[i])) { d++; if (d <= 3) console.log(k, 'DIFF', JSON.stringify(e), '->', JSON.stringify(y.els[i])) } })
  console.log(k, d ? `${d} elements differ` : `identical (${x.count} elements, page height ${x.h})`)
  bad += d
}
process.exit(bad ? 1 : 0)
