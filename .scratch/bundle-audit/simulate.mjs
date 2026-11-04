// Slice simulator for the #2875 audit. It cuts static import edges (as if each
// became a dynamic import or moved), recomputes what src/main.jsx still reaches
// statically, and measures the modules that fall out of the first load, using the
// minified sourcemap slices of the real build (JSON modules, which carry no
// sourcemap, are measured as minified JSON from disk).
//
//   npx vite build --sourcemap --config .scratch/bundle-audit/vite.measure.config.mjs
//   node .scratch/bundle-audit/simulate.mjs
//
// The saving is an ESTIMATE: Rolldown may regroup chunks after a real change, and
// a module that falls out still loads later on the route that needs it. "gzip" is
// the gzip of the dropped modules' minified code joined in one stream.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { SourceMapConsumer } from 'source-map-js'

const ROOT = new URL('../../', import.meta.url).pathname
const g = JSON.parse(readFileSync(new URL('./out/graph.json', import.meta.url)))
const byFile = Object.fromEntries(g.chunks.map((c) => [c.file, c]))
const entry = g.chunks.find((c) => c.isEntry)
const closure = new Set()
const walkC = (f) => { if (closure.has(f)) return; closure.add(f); for (const i of byFile[f].imports) walkC(i) }
walkC(entry.file)

// Minified code per source module, across the first-load chunks.
const code = {}
const norm = (s) => s.replace(/^(\.\.\/)+/, '')
for (const f of closure) {
  const src = readFileSync(ROOT + 'dist/' + f, 'utf8')
  const map = JSON.parse(readFileSync(ROOT + 'dist/' + f + '.map', 'utf8'))
  const ls = []; let o = 0; for (const l of src.split('\n')) { ls.push(o); o += l.length + 1 }
  const ms = []
  new SourceMapConsumer(map).eachMapping((m) => m.source && ms.push([ls[m.generatedLine - 1] + m.generatedColumn, norm(m.source)]))
  ms.sort((a, b) => a[0] - b[0])
  for (let i = 0; i < ms.length; i++) code[ms[i][1]] = (code[ms[i][1]] ?? '') + src.slice(ms[i][0], i + 1 < ms.length ? ms[i + 1][0] : src.length)
}
const moduleCode = (id) => {
  if (code[id] != null) return code[id]
  if (id.endsWith('.json')) { try { return JSON.stringify(JSON.parse(readFileSync(ROOT + id, 'utf8'))) } catch { return '' } }
  return ''
}

// Forward static graph.
const fwd = {}
for (const [id, { static: imps }] of Object.entries(g.importers)) for (const imp of imps) (fwd[imp] ??= new Set()).add(id)
function reach(cuts, from = 'src/main.jsx') {
  const cut = new Set(cuts.map(([a, b]) => a + '>' + b))
  const seen = new Set(); const q = [from]
  while (q.length) { const m = q.pop(); if (seen.has(m)) continue; seen.add(m)
    for (const n of fwd[m] ?? []) if (!cut.has(m + '>' + n)) q.push(n) }
  return seen
}
const base = reach([])
const kb = (n) => (n / 1000).toFixed(1)
function measure(set) { const s = [...set].map(moduleCode).join(''); return { raw: Buffer.byteLength(s), gzip: gzipSync(s).length } }
const all = measure(base)
console.log(`baseline static closure of main.jsx: ${base.size} modules, ${kb(all.raw)} kB raw, ${kb(all.gzip)} kB gzip (joined; excludes Vite runtime + mapDeps)`)

const S = (a, ...bs) => bs.map((b) => [a, b])
const GS = 'src/screens/GameSelect.jsx'
const SLICES = {
  'A  slate seasonal panels lazy (GameSelect)': S(GS,
    'src/components/worldseries/WorldSeriesHome.jsx', 'src/components/bracket/PostseasonBracket.jsx',
    'src/components/bracket/BracketDock.jsx', 'src/components/postseason/SeriesPrimer.jsx',
    'src/components/offseason/OffseasonSlot.jsx', 'src/components/transactions/WireDock.jsx',
    'src/components/transactions/WireRail.jsx', 'src/components/allstar/DerbyCard.jsx',
    'src/components/winter/LeaguePicker.jsx'),
  'A-today  A without WorldSeriesHome (what / saves while the WS home shows)': S(GS,
    'src/components/bracket/PostseasonBracket.jsx', 'src/components/bracket/BracketDock.jsx',
    'src/components/postseason/SeriesPrimer.jsx', 'src/components/offseason/OffseasonSlot.jsx',
    'src/components/transactions/WireDock.jsx', 'src/components/transactions/WireRail.jsx',
    'src/components/allstar/DerbyCard.jsx', 'src/components/winter/LeaguePicker.jsx'),
  'A1 World Series home only': S(GS, 'src/components/worldseries/WorldSeriesHome.jsx'),
  'A2 bracket (PostseasonBracket + BracketDock)': S(GS, 'src/components/bracket/PostseasonBracket.jsx', 'src/components/bracket/BracketDock.jsx'),
  'A3 offseason slot': S(GS, 'src/components/offseason/OffseasonSlot.jsx'),
  'A4 wire (WireDock + WireRail)': S(GS, 'src/components/transactions/WireDock.jsx', 'src/components/transactions/WireRail.jsx'),
  'A5 series primer': S(GS, 'src/components/postseason/SeriesPrimer.jsx'),
  'B  reveal engine off the slate (PickedGame -> useRevealProgress)': S('src/components/offseason/PickedGame.jsx', 'src/hooks/useRevealProgress.js'),
  'C  copy registry: landing + ballpark tables off the runtime': S('src/copy/registry.js',
    'src/copy/landing/fields.js', 'src/lib/ballpark/ballparkData.js', 'src/lib/ballpark/parkKeys.js', 'src/lib/data/milb-ballparks.json'),
  'C1 copy registry: landing pages only': S('src/copy/registry.js', 'src/copy/landing/fields.js'),
  'D  PlayerHoverCard + HeadshotLogPanel lazy (App)': S('src/App.jsx', 'src/components/player/PlayerHoverCard.jsx', 'src/components/headshot-log/HeadshotLogPanel.jsx'),
  'E  GameSelect lazy (App) [non-slate routes only]': S('src/App.jsx', GS),
}
const results = {}
for (const [name, cuts] of Object.entries(SLICES)) {
  const after = reach(cuts)
  const dropped = [...base].filter((m) => !after.has(m))
  const m = measure(dropped)
  results[name] = { cuts, dropped, ...m }
  const top = dropped.map((d) => [d, Buffer.byteLength(moduleCode(d))]).sort((a, b) => b[1] - a[1]).slice(0, 5)
  console.log(`\n${name}\n  drops ${dropped.length} modules: ${kb(m.raw)} kB raw, ${kb(m.gzip)} kB gzip`)
  for (const [d, n] of top) console.log(`    ${kb(n).padStart(6)}  ${d}`)
}
// Combined A+B+C+D (they overlap, so this is not the sum).
const combo = reach(Object.entries(SLICES).filter(([k]) => /^[ABCD] /.test(k)).flatMap(([, c]) => c))
const cm = measure([...base].filter((m) => !combo.has(m)))
console.log(`\nA+B+C+D together: ${kb(cm.raw)} kB raw, ${kb(cm.gzip)} kB gzip`)
const combo2 = reach(Object.entries(SLICES).filter(([k]) => /^[ABCDE] /.test(k)).flatMap(([, c]) => c))
const cm2 = measure([...base].filter((m) => !combo2.has(m)))
console.log(`A+B+C+D+E together (a non-slate route): ${kb(cm2.raw)} kB raw, ${kb(cm2.gzip)} kB gzip`)
