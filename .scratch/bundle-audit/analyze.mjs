// Reads out/graph.json (from vite.measure.config.mjs) and prints the tables the
// #2875 report uses. Usage: node .scratch/bundle-audit/analyze.mjs [module-substring ...]
// With arguments, it prints only the static import chain from src/main.jsx to
// each matching module.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const g = JSON.parse(readFileSync(new URL('./out/graph.json', import.meta.url)))
const byFile = Object.fromEntries(g.chunks.map((c) => [c.file, c]))
const entry = g.chunks.find((c) => c.isEntry)
const kb = (n) => (n / 1000).toFixed(1)

// Static closure of the entry = what the first load downloads before any route.
const closure = new Set()
const walk = (f) => { if (closure.has(f)) return; closure.add(f); for (const i of byFile[f].imports) walk(i) }
walk(entry.file)

// Static import chain main.jsx -> module (BFS over importers, reversed).
function chain(target) {
  const prev = new Map([[target, null]])
  const q = [target]
  while (q.length) {
    const m = q.shift()
    if (m === 'src/main.jsx') break
    for (const imp of g.importers[m]?.static ?? []) if (!prev.has(imp)) { prev.set(imp, m); q.push(imp) }
  }
  if (!prev.has('src/main.jsx')) return null
  const out = []
  for (let m = 'src/main.jsx'; m; m = prev.get(m)) out.push(m)
  return out
}

const args = process.argv.slice(2)
if (args.length) {
  for (const a of args) for (const m of entry.modules.filter((x) => x.id.includes(a)))
    console.log(m.id, '\n   ', (chain(m.id) ?? ['(no static chain)']).join('\n    -> '))
  process.exit(0)
}

console.log(`ENTRY ${entry.file}: ${kb(entry.size)} kB raw, ${kb(entry.gzip)} kB gzip, ${entry.modules.length} modules`)
let cs = 0, cg = 0
for (const f of closure) { cs += byFile[f].size; cg += byFile[f].gzip }
console.log(`FIRST-LOAD JS (entry + ${closure.size - 1} static chunks): ${kb(cs)} kB raw, ${kb(cg)} kB gzip (per-chunk gzip, summed)`)

console.log('\nTOP 20 ENTRY MODULES (renderedLength; gzip = that module alone)')
const top = [...entry.modules].sort((a, b) => b.rendered - a.rendered)
for (const m of top.slice(0, 20)) console.log(`${kb(m.rendered).padStart(7)} ${kb(m.gzip).padStart(6)}  ${m.id}`)

// Directory groups: share of the entry by folder (gzip estimated pro rata).
const ratio = entry.gzip / entry.size
const groups = {}
for (const m of entry.modules) {
  const k = m.id.startsWith('node_modules/') ? m.id.split('/').slice(0, m.id.split('/')[1].startsWith('@') ? 3 : 2).join('/') : m.id.split('/').slice(0, 3).join('/')
  groups[k] = (groups[k] ?? 0) + m.rendered
}
console.log('\nENTRY BY FOLDER (raw; ~gzip = raw x entry ratio ' + ratio.toFixed(3) + ')')
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${kb(v).padStart(7)} ~${kb(v * ratio).padStart(6)}  ${k}`)

// Static chunks in the first load, biggest first.
console.log('\nSTATIC CHUNKS IN FIRST LOAD (biggest 12)')
for (const f of [...closure].sort((a, b) => byFile[b].size - byFile[a].size).slice(0, 12)) console.log(`${kb(byFile[f].size).padStart(7)} ${kb(byFile[f].gzip).padStart(6)}  ${f}  (${byFile[f].modules.map((m) => m.id).slice(0, 3).join(', ')})`)

// Concatenated gzip for a group of modules (closer to the real saving than a sum).
export function groupGzip(pred) {
  const mods = entry.modules.filter((m) => pred(m.id))
  return { raw: mods.reduce((s, m) => s + m.rendered, 0), n: mods.length }
}
const css = g.assets.filter((a) => a.file.endsWith('.css')).sort((a, b) => b.size - a.size)
console.log('\nCSS assets: ' + css.length + ', biggest: ' + css.slice(0, 3).map((a) => `${a.file} ${kb(a.size)}`).join('; '))
void gzipSync
