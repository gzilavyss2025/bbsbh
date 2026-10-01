// Which vertical-stack rules can move onto <Stack> mechanically (#1180)?
// A candidate is a rule whose selector is ONE class, that sets display:flex,
// flex-direction:column and a gap on the 4/8/12/16px steps, in a non-bespoke
// partial. A candidate is SAFE when nothing else touches that class's layout
// (no other rule for it sets display, flex-*, gap or *-gap) and every JSX site
// that names the class is a plain static className on an element Stack can be.
// Run from the repo root: node .scratch/design-system/layout/stack-candidates.mjs [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import postcss from 'postcss'

const walk = (d, ext, o = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    statSync(p).isDirectory() ? walk(p, ext, o) : ext.some((e) => p.endsWith(e)) && o.push(p)
  }
  return o
}
const tokens = { '--space-1': 4, '--space-2': 8, '--space-3': 12, '--space-4': 16 }
const STEP = { 4: 'tight', 8: 'snug', 12: 'base', 16: 'loose' }
const px = (v) => {
  v = v.trim()
  const m = v.match(/^var\((--space-\d)\)$/)
  if (m) return tokens[m[1]] ?? null
  const n = v.match(/^(\d+)px$/)
  return n ? +n[1] : null
}
const BESPOKE = /(^|\/)(scorecard|box-score)\/|\/2[123][ab]?-box-score|21[ab]-/
const LAYOUT = /^(display|flex-direction|flex-flow|flex-wrap|gap|row-gap|column-gap)$/

const cssFiles = walk('src/styles', ['.css'])
const roots = cssFiles.map((f) => ({ f: relative('.', f), root: postcss.parse(readFileSync(f, 'utf8'), { from: f }) }))

// every rule that mentions .cls anywhere in a selector, with whether it touches layout
const touches = new Map()
for (const { f, root } of roots) {
  root.walkRules((r) => {
    for (const sel of r.selectors) {
      for (const m of sel.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
        const cls = m[1]
        const layout = []
        r.walkDecls((n) => {
          if (LAYOUT.test(n.prop)) layout.push(n.prop)
        })
        const subject = /\.([A-Za-z_][\w-]*)(?=[^.\s>+~]*$)/.exec(sel.trim())?.[1] === cls
        if (!touches.has(cls)) touches.set(cls, [])
        touches.get(cls).push({ f, line: r.source.start.line, sel: sel.trim(), layout, subject, inMedia: r.parent.type === 'atrule' })
      }
    }
  })
}

const jsx = walk('src', ['.jsx', '.js']).map((f) => ({ f: relative('.', f), text: readFileSync(f, 'utf8') }))
const sites = (cls) => {
  const out = []
  const re = new RegExp(`(?<![\\w-])${cls.replace(/[-]/g, '\\-')}(?![\\w-])`, 'g')
  for (const { f, text } of jsx) {
    for (const m of text.matchAll(re)) {
      const before = text.slice(Math.max(0, m.index - 400), m.index)
      const tag = [...before.matchAll(/<([A-Za-z][\w.]*)(?=[\s>])/g)].pop()?.[1] ?? '?'
      const lineStart = text.lastIndexOf('\n', m.index) + 1
      const line = text.slice(lineStart, text.indexOf('\n', m.index))
      const inClassName = /className\s*=\s*(\{[`'"]|["'])/.test(line) || /className=\{/.test(before.slice(-200))
      const dynamic = /\$\{|\+\s*['"`]|\?\s*['"`]|clsx|classNames|\.join\(/.test(line)
      out.push({ f, tag, inClassName, dynamic, line: line.trim().slice(0, 110), n: text.slice(0, m.index).split('\n').length })
    }
  }
  return out
}

const rows = []
for (const { f, root } of roots) {
  if (BESPOKE.test(f)) continue
  root.walkRules((r) => {
    if (r.parent.type === 'atrule') return
    if (!/^\.[A-Za-z_][\w-]*$/.test(r.selector.trim())) return
    const d = {}
    r.walkDecls((n) => {
      d[n.prop] = n.value
    })
    if (d.display !== 'flex' || d['flex-direction'] !== 'column' || d.gap == null) return
    const g = px(d.gap)
    if (!STEP[g]) return
    const cls = r.selector.trim().slice(1)
    const others = touches.get(cls).filter((t) => !(t.f === f && t.line === r.source.start.line) && t.layout.length && t.subject)
    const s = sites(cls).filter((x) => !/^\s*\/\//.test(x.line) && !/^\s*\*/.test(x.line))
    const otherDecls = []
    r.walkDecls((n) => {
      if (!/^(display|flex-direction|gap)$/.test(n.prop)) otherDecls.push(n.prop)
    })
    rows.push({ cls, f, line: r.source.start.line, step: STEP[g], keeps: otherDecls, others, sites: s })
  })
}

const safe = rows.filter((r) => !r.others.length && r.sites.length && r.sites.every((s) => s.inClassName && !s.dynamic && /^[a-z]+$/.test(s.tag)))
if (process.argv.includes('--json')) console.log(JSON.stringify({ rows, safe: safe.map((r) => r.cls) }, null, 1))
else {
  console.log(`candidates: ${rows.length}, with no other layout rule and static sites: ${safe.length}`)
  const by = {}
  for (const r of safe) (by[r.f] ||= []).push(r)
  for (const [f, rs] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${f}`)
    for (const r of rs) console.log(`  .${r.cls}  ${r.step}  sites:${r.sites.length} [${[...new Set(r.sites.map((s) => s.tag))]}]  keeps:${r.keeps.length}`)
  }
  const why = { other: 0, nosite: 0, dynamic: 0, tag: 0 }
  for (const r of rows) if (!safe.includes(r)) {
    if (r.others.length) why.other++
    else if (!r.sites.length) why.nosite++
    else if (r.sites.some((s) => s.dynamic || !s.inClassName)) why.dynamic++
    else why.tag++
  }
  console.log('\nnot safe (first reason):', why)
}
