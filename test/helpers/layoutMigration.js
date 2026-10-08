// One strict checker for the layout-part migrations (Stack, Cluster, Grid; #1180).
// A migrated class hands its layout to a part, and four things fail silently if
// they drift (lint green, page drawn, only a screenshot noticing):
//
//   1. NO LAYOUT LEFT. No rule in ANY stylesheet that ends in the class (inside
//      @media, in a grouped selector, compound or descendant) draws display,
//      flex, wrap, gap or grid. Only the part's own sheet is skipped.
//   2. THE KEEPS. A `keeps` entry stays in the class's own rule. A closed part
//      (Cluster, Grid) allows nothing else there; an open one (Stack) allows
//      padding, margin and frame too. `keeps: ['align-items: center']` pins a value.
//   3. THE SITES. Every JSX site of the class is the right component, with the
//      right props in any order, and the site count matches.
//   4. THE CASCADE. No migrated partial loads from index.css ahead of the part's
//      sheet, so it could not lose to it.
//
// The tree is read once per test file: node runs each file in its own process.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { walk, toPosix, ROOT } from '../../scripts/lib/walk.mjs'
import { stripComments } from './css.js'

export const SRC = join(ROOT, 'src')

const LAYOUT =
  /^(display|flex|flex-flow|flex-direction|flex-wrap|gap|row-gap|column-gap|grid|grid-template(-columns|-rows|-areas)?|grid-auto-(flow|columns|rows))$/

// ---- the tree ----

let tree
function loadTree() {
  if (tree) return tree
  const read = (f) => readFileSync(f, 'utf8')
  const rel = (f) => toPosix(relative(SRC, f))
  tree = {
    sheets: walk(join(SRC, 'styles'), { exts: ['.css'] }).map((f) => ({
      name: toPosix(relative(join(SRC, 'styles'), f)),
      rules: parseRules(stripComments(read(f))),
    })),
    sources: walk(SRC, { exts: ['.jsx', '.js'] }).map((f) => ({ where: rel(f), text: read(f) })),
    imports: [...read(join(SRC, 'index.css')).matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1]),
  }
  return tree
}

// ---- CSS ----

// Split on `sep` outside parentheses and brackets.
function splitTop(text, sep) {
  const out = []
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i += 1) {
    if ('(['.includes(text[i])) depth += 1
    else if (')]'.includes(text[i])) depth -= 1
    else if (text[i] === sep && depth === 0) {
      out.push(text.slice(from, i))
      from = i + 1
    }
  }
  out.push(text.slice(from))
  return out
}

// Declarations of a body as [property, value], skipping any nested block.
function declarations(body) {
  let flat = ''
  let depth = 0
  for (const ch of body) {
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    else if (depth === 0) flat += ch
  }
  return splitTop(flat, ';')
    .map((d) => d.split(/:(.*)/s))
    .filter((p) => p.length > 1)
    .map(([prop, value]) => [prop.trim().toLowerCase(), value.trim().replace(/\s+/g, ' ')])
}

// Every style rule as { selectors, decls }, descending into @media and friends.
function parseRules(css, out = []) {
  let i = 0
  for (;;) {
    const open = css.indexOf('{', i)
    if (open === -1) return out
    let depth = 1
    let j = open + 1
    for (; j < css.length && depth; j += 1) depth += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0
    const prelude = css.slice(i, open).replace(/^(\s*@[^{;]*;)+/, '').trim()
    const inner = css.slice(open + 1, j - 1)
    if (prelude.startsWith('@')) parseRules(inner, out)
    else out.push({ selectors: splitTop(prelude, ',').map((s) => s.trim()), decls: declarations(inner) })
    i = j
  }
}

// The compound selector a selector ends in: `.a > .b.c:hover` gives `.b.c:hover`.
function lastCompound(selector) {
  const bare = selector.replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  return bare.split(/\s*[>+~]\s*|\s+/).pop()
}

// Does the selector end in `.cls`, alone or compound (`.cls.on`, `.x .cls`)? A
// pseudo-element (`.cls::before`) styles something else, so it does not count.
function endsInClass(selector, cls) {
  const last = lastCompound(selector)
  return new RegExp(`\\.${cls}(?![\\w-])`).test(last) && !/::|:(before|after)\b/.test(last)
}

// ---- JSX ----

// Index past the `}` that closes the `{` at `at`; quoted strings are skipped whole.
function pastBraces(text, at) {
  let depth = 0
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') i = text.indexOf(ch, i + 1)
    else if (ch === '{') depth += 1
    else if (ch === '}' && --depth === 0) return i + 1
  }
  throw new Error('unbalanced braces')
}

// The opening tag at `at` (the `<`): { name, props, end }. A prop is `true` for a
// bare attribute, the text of a string, or the `{...}` source (`{true}` and
// `{false}` become booleans).
function openingTag(text, at) {
  let i = at + 1
  while (/[\w.]/.test(text[i])) i += 1
  const name = text.slice(at + 1, i)
  const props = {}
  for (;;) {
    while (/\s/.test(text[i])) i += 1
    if (text[i] === '>' || text.startsWith('/>', i)) return { name, props, end: i }
    if (text[i] === '{') {
      i = pastBraces(text, i) // {...spread}
      continue
    }
    const from = i
    while (/[\w:-]/.test(text[i])) i += 1
    const key = text.slice(from, i)
    assert.ok(key, `could not read the <${name}> tag near "${text.slice(i, i + 20)}"`)
    props[key] = true
    if (text[i] !== '=') continue
    i += 1
    if (text[i] === '{') {
      const end = pastBraces(text, i)
      const raw = text.slice(i, end)
      props[key] = raw === '{true}' ? true : raw === '{false}' ? false : raw
      i = end
    } else {
      const end = text.indexOf(text[i], i + 1)
      props[key] = text.slice(i + 1, end)
      i = end + 1
    }
  }
}

// Every literal `className="… cls …"` site: { where, tag } with the tag it sits on.
function sitesOf(cls) {
  const re = new RegExp(`className="(?:[\\w-]+ )*${cls}(?: [\\w-]+)*"`, 'g')
  const out = []
  for (const { where, text } of loadTree().sources) {
    for (const m of text.matchAll(re)) {
      const open = [...text.slice(0, m.index).matchAll(/<([A-Za-z][\w.]*)(?=[\s>])/g)].pop()
      const tag = openingTag(text, open.index)
      assert.ok(tag.end > m.index, `${where}: could not find the tag that holds .${cls}`)
      out.push({ where, tag })
    }
  }
  return out
}

// ---- the checks ----

// part: { component, sheet, props, defaults, closed }
// rows: { [class]: { file, sites = 1, keeps = [], gap, align, min, fit, dropped, jsx } }
//   `dropped`: the rule and the class name went whole, so the one site is found by
//   `min` in `jsx` instead of by class.
export function checkMigration(part, rows) {
  for (const [cls, row] of Object.entries(rows)) {
    checkRules(part, cls, row)
    checkSites(part, cls, row)
  }
  checkCascade(part, rows)
}

function checkRules(part, cls, { file, keeps = [] }) {
  const kept = keeps.map((k) => k.split(/:\s*/))
  const keepNames = kept.map(([prop]) => prop)
  for (const { name, rules } of loadTree().sheets) {
    if (name === part.sheet) continue
    for (const { selectors, decls } of rules) {
      for (const sel of selectors.filter((s) => endsInClass(s, cls))) {
        const exact = sel === `.${cls}`
        for (const [prop] of decls) {
          if (keepNames.includes(prop)) continue
          assert.ok(!LAYOUT.test(prop), `${name}: "${sel}" still draws ${prop} on .${cls}`)
          assert.ok(!exact || !part.closed, `${name}: .${cls} keeps "${prop}", which is not on its keep list`)
        }
      }
    }
  }
  const own = loadTree().sheets.find((s) => s.name === file)
  const exact = (own?.rules ?? []).filter((r) => r.selectors.includes(`.${cls}`))
  for (const [prop, value] of kept) {
    const found = exact.flatMap((r) => r.decls).filter(([p]) => p === prop)
    assert.ok(found.length, `${file}: .${cls} should still hold ${prop}`)
    if (value) assert.ok(found.some(([, v]) => v === value), `${file}: .${cls} should hold ${prop}: ${value}`)
  }
}

function checkSites(part, cls, row) {
  let sites
  if (row.dropped) {
    const text = loadTree().sources.find((s) => s.where === row.jsx).text
    assert.ok(!text.includes(cls), `${row.jsx} still names .${cls}`)
    sites = [...text.matchAll(new RegExp(`<${part.component}\\b`, 'g'))]
      .map((m) => ({ where: row.jsx, tag: openingTag(text, m.index) }))
      .filter((s) => s.tag.props.min === row.min)
    assert.equal(sitesOf(cls).length, 0, `.${cls} should have no site`)
  } else sites = sitesOf(cls)
  for (const { where, tag } of sites) {
    assert.equal(tag.name, part.component, `${where}: .${cls} should sit on a ${part.component}, not <${tag.name}>`)
    for (const prop of part.props) {
      assert.equal(
        tag.props[prop] ?? part.defaults[prop], // the default may be left off
        row[prop] ?? part.defaults[prop],
        `${where}: .${cls} has the wrong ${prop}`,
      )
    }
  }
  assert.equal(sites.length, row.sites ?? 1, `.${cls} should have ${row.sites ?? 1} ${part.component} site(s)`)
}

function checkCascade(part, rows) {
  const { imports } = loadTree()
  const at = imports.indexOf(part.sheet)
  assert.ok(at !== -1, `index.css should import ${part.sheet}`)
  for (const { file } of Object.values(rows)) {
    const i = imports.indexOf(file)
    assert.ok(i === -1 || i > at, `${file} loads ahead of ${part.sheet}`)
  }
}
