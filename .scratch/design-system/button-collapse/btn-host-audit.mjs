// Every rule outside system/button.css whose selector reaches a .btn element
// (by .btn itself, a .btn--* modifier, or a class that is co-classed with .btn
// in JSX) and that declares a fill, an edge, an ink or a shadow. Those are the
// rules the shared hover and press states can repaint over.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const walk = (d) => readdirSync(d).flatMap((f) => { const a = join(d, f); return statSync(a).isDirectory() ? walk(a) : [a] })
const jsx = walk('src').filter((f) => /\.jsx?$/.test(f))
const co = new Set()
for (const f of jsx) for (const m of readFileSync(f, 'utf8').matchAll(/className=\{?[`'"]([^`'"]*)[`'"]/g)) {
  const cls = m[1].split(/\s+/)
  if (cls.includes('btn')) for (const c of cls) if (c && c !== 'btn' && !c.startsWith('${') && !c.startsWith('btn--')) co.add(c)
}
const esc = (h) => h.replace(/[.$]/g, (c) => '\\' + c)
const hooks = ['.btn', ...[...co].map((c) => '.' + c)].map((h) => new RegExp(esc(h) + '(?![a-zA-Z0-9_-])'))
const props = /^(background|background-color|border|border-color|color|box-shadow)\s*:/
for (const f of walk('src/styles').filter((f) => f.endsWith('.css') && !f.includes('system'))) {
  const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    if (!hooks.some((re) => re.test(sel))) continue
    const ds = m[2].split(';').map((d) => d.trim()).filter((d) => props.test(d))
    if (ds.length) console.log(`${f.split('\\').join('/')}  ${sel}\n    ${ds.join('; ')}`)
  }
}
console.log('\nco-classes:', [...co].sort().join(' '))
