const A = require('./before/report.json'), B = require('./after/report.json')
let diffs = 0
for (const k of Object.keys(A)) {
  if (k.endsWith(':focus') || !A[k] || typeof A[k] !== 'object' || Object.values(A[k]).some((x) => !Array.isArray(x))) continue
  for (const role of new Set([...Object.keys(A[k]), ...Object.keys(B[k] ?? {})])) {
    let a = A[k][role] ?? [], b = (B[k] ?? {})[role] ?? []
    if (role === 'umpsframe') { a = a.filter((e) => /umps__list/.test(e.cls)); b = b.filter((e) => /card/.test(e.cls)) }
    if (a.length !== b.length) { console.log(k, role, 'COUNT', a.length, b.length); diffs++; continue }
    a.forEach((ea, i) => {
      const eb = b[i]
      for (const f of ['rect', 'border', 'radius', 'shadow', 'bg', 'margin', 'padding', 'overflow']) {
        const va = JSON.stringify(ea[f]), vb = JSON.stringify(eb[f])
        if (va !== vb) { console.log(k, role, i, f, va, '->', vb); diffs++ }
      }
    })
  }
}
console.log('diffs', diffs)
