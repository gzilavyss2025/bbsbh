import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json','utf8'))
const db = await openDb()
const rows = db.prepare('SELECT * FROM abs_challenges').all()
db.close()
const H = (h) => (h === 'top' ? 0 : 1)

// Candidate rules. Each returns the bank at the START of inning `i`, given the
// bank carried out of inning i-1.
const MODELS = {
  'A: top up to 1 each extra inning when empty': (bank, i) => (i >= 10 && bank === 0 ? 1 : bank),
  'B: one extra, once, at the top of the 10th':  (bank, i, seen) => (i === 10 && !seen.tenth ? bank + 1 : bank),
  'C: plus one every extra inning, always':      (bank, i) => (i >= 10 ? bank + 1 : bank),
  'D: no replenishment at all (current lib)':    (bank) => bank,
}

for (const level of ['MLB', 'AAA']) {
  const byGT = new Map()
  for (const r of rows) {
    if (r.level !== level) continue
    const k = `${r.game_pk}:${r.team_id}`
    if (!byGT.has(k)) byGT.set(k, [])
    byGT.get(k).push(r)
  }
  const results = {}
  for (const name of Object.keys(MODELS)) results[name] = { over: 0, unused: 0, examples: [] }

  for (const [k, list] of byGT) {
    const f = fin[k.split(':')[0]]
    if (!f || !f.fin) continue
    list.sort((a, b) => a.inning - b.inning || H(a.half) - H(b.half) || a.seq - b.seq)
    for (const [name, step] of Object.entries(MODELS)) {
      let bank = 2
      let cur = 0
      const seen = {}
      let broke = false
      let peak = 0
      for (const r of list) {
        // advance the bank inning by inning up to this challenge
        while (cur < r.inning) {
          cur += 1
          bank = step(bank, cur, seen)
          if (cur === 10) seen.tenth = true
        }
        if (bank <= 0) {
          // this challenge could not have been called under this rule
          if (!broke) {
            broke = true
            results[name].over += 1
            if (results[name].examples.length < 2) {
              results[name].examples.push(`${k} inn${r.inning} (${list.filter(x=>x.outcome==='fail').length} fails, final=${f.fin})`)
            }
          }
        } else if (r.outcome === 'fail') bank -= 1
        if (bank > peak) peak = bank
      }
      if (peak > 2) results[name].unused += 1
    }
  }
  console.log(`\n=== ${level} (${byGT.size} club-games) ===`)
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${r.over === 0 ? 'OK  ' : 'FAIL'} ${name.padEnd(44)} impossible challenges: ${String(r.over).padStart(4)}` +
      `  | club-games ever holding >2: ${r.unused}`)
    for (const e of r.examples) console.log(`         e.g. ${e}`)
  }
}
