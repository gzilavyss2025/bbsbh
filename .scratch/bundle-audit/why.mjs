// Static import chain src/main.jsx -> each module whose path contains an argument,
// over the whole module graph (not only the entry chunk). Every static importer is
// listed too, since the BFS shows only one shortest chain.
// Usage: node .scratch/bundle-audit/why.mjs <substring> ...
import { readFileSync } from 'node:fs'
const g = JSON.parse(readFileSync(new URL('./out/graph.json', import.meta.url)))
function chain(target) {
  const prev = new Map([[target, null]]); const q = [target]
  while (q.length) { const m = q.shift(); if (m === 'src/main.jsx') break
    for (const imp of g.importers[m]?.static ?? []) if (!prev.has(imp)) { prev.set(imp, m); q.push(imp) } }
  if (!prev.has('src/main.jsx')) return null
  const out = []; for (let m = 'src/main.jsx'; m; m = prev.get(m)) out.push(m); return out
}
for (const a of process.argv.slice(2)) for (const id of Object.keys(g.importers).filter((x) => x.includes(a)).slice(0, 3)) {
  console.log(id, '\n  chain:', (chain(id) ?? ['(no static chain from main.jsx)']).join(' -> '))
  console.log('  static importers:', g.importers[id].static.join(', ') || '-')
}
