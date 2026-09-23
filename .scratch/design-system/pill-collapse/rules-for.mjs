// Print every rule in src/styles whose selector mentions one of the given
// classes (base, context, state, media copies), with file:line. Comments out.
//   node rules-for.mjs .rankchip .prospectpill ...
import postcss from 'postcss'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const STYLES = join(ROOT, 'src/styles')
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const a = join(d, f)
    return statSync(a).isDirectory() ? walk(a) : f.endsWith('.css') ? [a] : []
  })
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const want = process.argv.slice(2).map((c) => new RegExp(`${esc(c)}(?![\\w-])`))
const hit = (sel) => want.some((re) => re.test(sel))

for (const file of walk(STYLES)) {
  const root = postcss.parse(readFileSync(file, 'utf8'))
  root.walkRules((r) => {
    if (!hit(r.selector)) return
    const at = r.parent?.type === 'atrule' ? `@${r.parent.name} ${r.parent.params} ` : ''
    const body = r.nodes
      .filter((n) => n.type === 'decl')
      .map((d) => `${d.prop}: ${d.value}`)
      .join('; ')
    const rel = relative(STYLES, file).split('\\').join('/')
    console.log(`${rel}:${r.source.start.line}  ${at}${r.selector.replace(/\s+/g, ' ')}\n    ${body}`)
  })
}
