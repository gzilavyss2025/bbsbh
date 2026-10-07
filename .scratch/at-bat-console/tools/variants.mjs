// Writes data-A/B/C.json: the canvas data under three notation rulings (mock patch, not app code).
import fs from 'node:fs'
const CACHE = '/home/user/bbsbh/node_modules/.cache/innings-console'
const base = fs.readFileSync(`${CACHE}/data.json`, 'utf8')
const walk = (o, f) => { if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === 'object') { f(o); Object.values(o).forEach((x) => walk(x, f)) } }
function patch(d, { po }) {
  walk(d, (o) => {
    // PKCS: show the full mark and put the out on the path to 2nd (feed text: "caught stealing 2nd").
    if (o.legNotations) {
      const legs = o.legNotations
      for (const [b, n] of Object.entries(legs)) if (/^E\d$/.test(n.code) && legs[b - 1]?.code === 'SB') n.slot = null
    }
    for (const k of ['code', 'outCode', 'center', 'outcome']) if (typeof o[k] === 'string' && po) o[k] = o[k].replace(/^PK(CS)?\b/, 'PO$1').replace(/^PK →/, 'PO →')
  })
  // Neto, 824951 top 1st: the one PKCS in the six games.
  const g = d.games.find((x) => x.pk === 824951)
  walk(g, (o) => { if (o.who?.last === 'Neto' && o.box?.outCode?.match(/^P[KO] 1-3$/)) { o.box.outCode = (po ? 'POCS' : 'PKCS') + ' 1-3'; o.box.outAt = 2 }; if (/^P[KO]CS 1-3$/.test(o.code)) { o.code = (po ? 'POCS' : 'PKCS') + ' 1-3'; o.outBase = '2B' } })
  return d
}
fs.writeFileSync(`${CACHE}/data-A.json`, base)
fs.writeFileSync(`${CACHE}/data-B.json`, JSON.stringify(patch(JSON.parse(base), { po: false })))
fs.writeFileSync(`${CACHE}/data-C.json`, JSON.stringify(patch(JSON.parse(base), { po: true })))
