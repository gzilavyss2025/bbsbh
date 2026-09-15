// Every club-game on file whose challenges cannot be spent under the bank rule
// confirmed in #1074: two issued, kept on a win, topped up to one at the start
// of each inning from the 10th. No network — pure replay of the stored rows.
//
//   node .scratch/abs-reports/diag-bank-violations.mjs
import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json', 'utf8'))
const db = await openDb()
const rows = db.prepare('SELECT * FROM abs_challenges').all()
db.close()
const H = (h) => (h === 'top' ? 0 : 1)

// The rule, as one function. This is the thing #1058 and #1061 need.
// TOLERATES an over-spend rather than assuming one cannot happen: two Triple-A
// club-games on file spend a challenge from an empty bank, and both are MLB's
// own data, not a derivation error (diag-verify-faithful.mjs proves it row by
// row). So the bank floors at zero, the impossible challenge is COUNTED and
// kept — it really was called, and it belongs in every figure on the page — and
// the walk carries on. Never throw, never go negative, never drop the row.
export function bankWalk(challenges) {
  let bank = 2
  let inning = 0
  const bad = []
  for (const c of challenges) {
    while (inning < c.inning) {
      inning += 1
      if (inning >= 10 && bank === 0) bank = 1 // topped up, not incremented
    }
    if (bank <= 0) bad.push(c)
    else if (c.outcome === 'fail') bank -= 1
    if (bank < 0) bank = 0
  }
  return bad
}

// The two club-games that break the rule in MLB's own feed. A reconciliation
// test should REPORT these and fail on a third, never fail on these.
export const KNOWN_OVERSPEND = new Set(['815094:102', '816599:416'])

let checked = 0
const violations = []
const byGT = new Map()
for (const r of rows) {
  const k = `${r.level}:${r.game_pk}:${r.team_id}`
  if (!byGT.has(k)) byGT.set(k, [])
  byGT.get(k).push(r)
}
for (const [k, list] of byGT) {
  list.sort((a, b) => a.inning - b.inning || H(a.half) - H(b.half) || a.seq - b.seq)
  checked += 1
  const bad = bankWalk(list)
  if (bad.length) {
    violations.push({
      key: k,
      trace: list.map((r) => `${r.half.slice(0, 1)}${r.inning} ${r.outcome === 'success' ? 'W' : 'L'}`).join(' '),
      firstBad: `${bad[0].half.slice(0, 1)}${bad[0].inning}`,
      names: [...new Set(list.map((r) => r.player_name))].join(', '),
      finalInning: fin[k.split(':')[1]]?.fin ?? null,
    })
  }
}

console.log(`${checked} club-games replayed, ${violations.length} cannot be spent under the rule\n`)
for (const v of violations) {
  const [level, pk, team] = v.key.split(':')
  console.log(`${level} gamePk ${pk} team ${team} (final inning ${v.finalInning})`)
  console.log(`   ${v.trace}   <- first impossible at ${v.firstBad}`)
  console.log(`   ${v.names}`)
}
// Same-half pairs: the stored order relies on Array.sort being stable over
// allPlays order. Worth knowing how much weight that carries.
let sameHalf = 0
for (const list of byGT.values()) {
  const seen = new Set()
  for (const r of list) {
    const key = `${r.inning}:${r.half}`
    if (seen.has(key)) sameHalf += 1
    seen.add(key)
  }
}
console.log(`\nclub-games with two challenges in the SAME half-inning: ${sameHalf}`)
