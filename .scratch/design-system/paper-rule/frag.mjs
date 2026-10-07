// Builds the generated tables that proposal.md embeds. Usage: node frag.mjs > frag.md
import { readFileSync } from 'node:fs'
const rows = readFileSync('census.csv', 'utf8').trim().split('\n').slice(1)
  .map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, '').replace(/^"|"$/g, '')))
  .filter((r) => r[0] === 'styles')
const short = (f) => f.replace('src/styles/', '')
// A: ready list = 1:1 token, confidence sure
const ready = rows.filter((r) => ['--paper-3', '--rule', '--rule-soft'].includes(r[5]) && r[9] === 'sure')
const byFile = {}
for (const r of ready) (byFile[short(r[1])] ??= []).push(`${r[2]} ${r[5].slice(2)}→${r[6].slice(2)}`)
console.log('### READY-LIST (' + ready.length + ')')
for (const [f, a] of Object.entries(byFile)) console.log(`- \`${f}\`: ${a.join('; ')}`)
const files = {}
for (const r of rows) (files[short(r[1])] ??= []).push(r)
const A = [], B = [], C = []
for (const [k, rs] of Object.entries(files)) {
  if (rs.every((r) => r[9] === 'sure')) A.push(k)
  else if (rs.some((r) => r[9] === 'ask' || r[6] === 'none' || ['--paper-0', '--paper-1'].includes(r[5]))) C.push(k)
  else B.push(k)
}
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
const bal = (a, max) => { const k = Math.ceil(a.length / max), o = []; let i = 0; for (let j = 0; j < k; j++) { const n = Math.ceil((a.length - i) / (k - j)); o.push(a.slice(i, i + n)); i += n } return o }
const reads = (fs) => fs.reduce((n, f) => n + files[f].length, 0)
console.log('### SLICES')
let n = 1
const row = (name, fs, model, when) => console.log(`| ${n++} | ${name} | ${fs.map((f) => '`' + f + '`').join(', ')} | ${reads(fs)} | ${model} | ${when} |`)
for (const s of bal(A, 5)) row('all-sure files', s, 'Haiku', '**now**')
for (const s of bal(B, 5)) row('same colour, mark reads', s, 'Sonnet', 'after decision 4')
const big = ['17-identity-lab-workbench.css', '68-around-the-game.css']
for (const f of big) row('big judgement file', [f], 'Sonnet, high effort', 'after decisions 1, 2, 3, 5, 6')
for (const s of bal(C.filter((f) => !big.includes(f)), 5)) row('mixed files', s, 'Sonnet', 'after decisions 1, 2, 3, 5, 6')
console.log('A', A.length, 'B', B.length, 'C', C.length)
// role counts
console.log('### ROLES')
const cnt = {}
for (const r of rows) { const k = `${r[5]} | ${r[7]}`; cnt[k] = (cnt[k] || 0) + 1 }
for (const [k, v] of Object.entries(cnt).sort()) console.log(v, k)
