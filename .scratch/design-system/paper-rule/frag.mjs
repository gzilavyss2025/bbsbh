// Builds the generated tables that proposal.md embeds. Usage: node .scratch/design-system/paper-rule/frag.mjs
import { readFileSync } from 'node:fs'
const rows = readFileSync('.scratch/design-system/paper-rule/census.csv', 'utf8').trim().split('\n').slice(1)
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
// Readiness after Gary's answers: a file waits on decision 4 if it holds a pending-4 read,
// on the --border-grid mint if it holds a rule-grid read, else it can run now.
const now = [], mint = [], d4 = []
for (const [k, rs] of Object.entries(files)) {
  if (rs.some((r) => r[9] === 'pending-4')) d4.push(k)
  else if (rs.some((r) => r[5] === '--rule-grid')) mint.push(k)
  else now.push(k)
}
const bal = (a, max) => { const k = Math.ceil(a.length / max), o = []; let i = 0; for (let j = 0; j < k; j++) { const n = Math.ceil((a.length - i) / (k - j)); o.push(a.slice(i, i + n)); i += n } return o }
const reads = (fs) => fs.reduce((n, f) => n + files[f].length, 0)
console.log('### SLICES')
let n = 1
const row = (name, fs, model, when) => console.log(`| ${n++} | ${name} | ${fs.map((f) => '`' + f + '`').join(', ')} | ${reads(fs)} | ${model} | ${when} |`)
for (const s of bal(now, 5)) row('no new token needed', s, 'Haiku', '**unblocked now**')
console.log('| M1 | **mint** `--border-grid` (= `--rule-grid`) | `src/tokens/colors.css` | 0 | Sonnet | **unblocked now**; slices after it need it |')
for (const s of bal(mint, 5)) row('needs `--border-grid`', s, 'Haiku', 'after M1')
console.log('| M2 | **mint** the decision 4 text tokens | `src/tokens/colors.css`, `src/lib/design/contrastPairings.js` | 0 | Sonnet | after decision 4 |')
const big = ['17-identity-lab-workbench.css', '68-around-the-game.css']
for (const f of big.filter((f) => d4.includes(f))) row('big file, holds "text" reads', [f], 'Sonnet, high effort', 'after M1 and M2' + (f.startsWith('17') ? ' and PR #1679 merges' : ''))
for (const s of bal(d4.filter((f) => !big.includes(f)), 5)) row('holds "text" reads', s, 'Sonnet', 'after M1 and M2')
console.log('now', now.length, 'mint', mint.length, 'd4', d4.length)
// role counts
console.log('### ROLES')
const cnt = {}
for (const r of rows) { const k = `${r[5]} | ${r[7]}`; cnt[k] = (cnt[k] || 0) + 1 }
for (const [k, v] of Object.entries(cnt).sort()) console.log(v, k)
