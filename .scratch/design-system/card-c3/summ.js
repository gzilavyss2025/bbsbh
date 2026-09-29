const r = require(`./${process.argv[2]}/report.json`)
for (const [k, v] of Object.entries(r)) {
  if (k.endsWith(':focus')) { const bad = v.filter((x) => /CLIPPED/.test(x)); console.log(k, v.length + ' controls', bad.length ? 'CLIPPED: ' + bad.join(' | ') : ''); continue }
  if (!v || typeof v !== 'object' || Object.values(v).some((x) => !Array.isArray(x))) { console.log(k, JSON.stringify(v)); continue }
  console.log(k, Object.entries(v).map(([role, els]) => role + 'x' + els.length + (els.some((e) => e.over.length) ? ' OVER[' + [...new Set(els.flatMap((e) => e.over))].filter(o => !/seasonseries|img.teamlogo/.test(o)).slice(0, 5).join('; ') + ']' : '')).join(', '))
}
