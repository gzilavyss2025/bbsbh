// Census of direct --paper-N / --rule* reads in src/styles/. Writes census-raw.json.
// Usage: node .scratch/design-system/paper-rule/census.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
const files = []
;(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.css')) files.push(p.split(sep).join('/'))
  }
})('src/styles')
files.sort()
const blank = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
const T = /var\(\s*(--(?:paper-\d+|rule(?:-[a-z0-9-]+)?))\s*[,)]/g
const rows = []
for (const f of files) {
  const css = blank(readFileSync(f, 'utf8'))
  for (const m of css.matchAll(T)) {
    // property: nearest `;` or `{` before, then name before colon
    const pre = css.slice(0, m.index)
    const cut = Math.max(pre.lastIndexOf(';'), pre.lastIndexOf('{'), pre.lastIndexOf('}'))
    const decl = pre.slice(cut + 1)
    const pm = decl.match(/([\w-]+)\s*:/)
    const property = pm ? pm[1] : ''
    const value = (css.slice(cut + 1 + (pm ? pm.index : 0)).split(/[;}]/)[0]).replace(/\s+/g, ' ').trim()
    // selector: walk back to the unmatched `{`
    let depth = 0, i = cut, sel = ''
    for (i = m.index; i >= 0; i--) {
      const c = css[i]
      if (c === '}') depth++
      else if (c === '{') { if (depth === 0) break; depth-- }
    }
    let end = i
    let start = Math.max(css.lastIndexOf('}', end), css.lastIndexOf('{', end - 1), css.lastIndexOf(';', end)) + 1
    sel = css.slice(start, end).replace(/\s+/g, ' ').trim()
    rows.push({ file: f, line: pre.split('\n').length, selector: sel, property, token: m[1], value })
  }
}
writeFileSync('.scratch/design-system/paper-rule/census-raw.json', JSON.stringify(rows, null, 1))
const c = {}
for (const r of rows) c[r.token] = (c[r.token] || 0) + 1
console.log(rows.length, c, new Set(rows.map((r) => r.file)).size)
// method B
let b = 0
for (const f of files) for (const p of blank(readFileSync(f, 'utf8')).split('var(').slice(1)) if (/^--(paper-\d+|rule(-[a-z0-9-]+)?)$/.test(p.trim().split(/[,)\s]/)[0])) b++
console.log('method B', b)
