// Helpers for tests that read a stylesheet as source text.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'

export const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// The declaration block of a rule whose selector is exactly `selector` — never
// a pseudo, a compound or a longer name that merely starts with it. Feed it
// comment-stripped CSS. Returns null when no such rule exists.
export function ruleBody(css, selector) {
  let from = 0
  for (;;) {
    const at = css.indexOf(selector, from)
    if (at === -1) return null
    from = at + selector.length
    const before = at === 0 ? '\n' : css[at - 1]
    if (!'\n;}{,'.includes(before)) continue
    let i = from
    while (css[i] === ' ' || css[i] === '\n' || css[i] === '\r') i += 1
    if (css[i] !== '{') continue
    return css.slice(i + 1, css.indexOf('}', i))
  }
}

// Every .css file under `dir`, as paths relative to it.
export function sheets(dir, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return sheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css') ? [`${prefix}${f}`] : []
  })
}

// Every rule under `stylesDir` whose selector ends on `cls`, with its declared
// property names, so a box put back by a later rule, a media query or another
// partial is found too. The design lab's own sheets are prototypes and skipped.
export function rulesEndingIn(stylesDir, cls) {
  const tail = new RegExp(`\\.${cls}(?![\\w-])[^\\s>+~]*$`)
  const found = []
  for (const rel of sheets(stylesDir).filter((f) => !f.startsWith('designlab/'))) {
    postcss.parse(readFileSync(join(stylesDir, rel), 'utf8')).walkRules((rule) => {
      if (!rule.selectors.some((sel) => tail.test(sel.trim()))) return
      const props = rule.nodes.filter((n) => n.type === 'decl').map((d) => d.prop.toLowerCase())
      found.push({ where: `${rel}: ${rule.selector}`, props })
    })
  }
  return found
}
