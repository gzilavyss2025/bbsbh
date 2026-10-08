// One strict checker for the layout-part migrations (Stack, Cluster, Grid; #1180).
// A migrated class hands its layout to a part, and four things fail silently if
// they drift (lint green, page drawn, only a screenshot noticing):
//
//   1. RULES. No rule in ANY stylesheet that ends in the class (inside @media,
//      nested with `&`, in a grouped selector or `:is()`, compound or descendant)
//      draws display, flex, wrap, gap or grid. Only the part's own sheet is
//      skipped. A layout property is allowed only in the class's OWN exact rule,
//      in its own `file`, only if it is on `keeps`, and only if the part lists it
//      as `keepable` (Stack: `flex`; Cluster and Grid: none). A closed part
//      (Cluster, Grid) allows nothing else in an exact rule; an open one (Stack)
//      allows padding, margin and frame too.
//   2. KEEPS. `file` is a real sheet, each `keeps` entry stays in the class's
//      rule there (`'align-items: center'` pins a value), and a row with no
//      `file` has no rule left anywhere.
//   3. SITES. Every JSX site of the class is the right component (in `jsx`, when
//      the row names it), with the right props in any order, and the site count
//      matches. Any quoted mention of the class that is not such a site fails. A
//      value equal to the part's default must be left off, unless the part
//      allows it (Stack allows `gap="base"`).
//   4. CASCADE. No migrated partial loads from index.css ahead of the part's
//      sheet, so it could not lose to it.
//
// The tree is read once per test file: node runs each file in its own process.
import test from 'node:test'
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

// Every style rule as { selectors, decls }. It descends into @media and friends and
// into nested rules (`&:hover`, `& .x`, a bare `.x`), which are resolved against
// their parent selectors.
function parseRules(css, parents = null, out = []) {
  let i = 0
  for (;;) {
    const open = css.indexOf('{', i)
    if (open === -1) return out
    let depth = 1
    let j = open + 1
    for (; j < css.length && depth; j += 1) depth += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0
    const prelude = splitTop(css.slice(i, open), ';').pop().trim() // drops `@import …;` and declarations
    const inner = css.slice(open + 1, j - 1)
    if (prelude.startsWith('@')) {
      if (parents) out.push({ selectors: parents, decls: declarations(inner) }) // a nested @media
      parseRules(inner, parents, out)
    } else {
      const own = splitTop(prelude, ',').map((s) => s.trim())
      const selectors = parents ? own.flatMap((s) => parents.map((p) => (s.includes('&') ? s.replaceAll('&', p) : `${p} ${s}`))) : own
      out.push({ selectors, decls: declarations(inner) })
      parseRules(inner, selectors, out)
    }
    i = j
  }
}

// `:is(a, b)` and `:where(a, b)` expanded to one selector per alternative.
function expand(selector) {
  const at = selector.search(/:(is|where)\(/)
  if (at === -1) return [selector]
  const from = selector.indexOf('(', at) + 1
  let depth = 1
  let to = from
  for (; depth; to += 1) depth += selector[to] === '(' ? 1 : selector[to] === ')' ? -1 : 0
  return splitTop(selector.slice(from, to - 1), ',').flatMap((alt) =>
    expand(selector.slice(0, at) + alt.trim() + selector.slice(to)),
  )
}

// The compound selector a selector ends in: `.a > .b.c:hover` gives `.b.c:hover`.
function lastCompound(selector) {
  const bare = selector.replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  return bare.split(/\s*[>+~]\s*|\s+/).pop()
}

// Does the selector end in `.cls`, alone or compound (`.cls.on`, `.x .cls`)? A
// pseudo-element (`.cls::before`) styles something else, so it does not count.
function endsInClass(selector, cls) {
  return expand(selector).some((sel) => {
    const last = lastCompound(sel)
    return new RegExp(`\\.${cls}(?![\\w-])`).test(last) && !/::|:(before|after)\b/.test(last)
  })
}

// ---- JSX ----

// Index past the `}` that closes the `{` at `at`. A quoted string is skipped whole,
// but a ' or " with no partner on its line is JSX text (an apostrophe), not a string.
function pastBraces(text, at) {
  let depth = 0
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = text.indexOf(ch, i + 1)
      const line = text.indexOf('\n', i)
      if (end !== -1 && (ch === '`' || line === -1 || end < line)) i = end
    } else if (ch === '{') depth += 1
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
      assert.ok(end !== -1, `unclosed string in the <${name}> tag`)
      props[key] = text.slice(i + 1, end)
      i = end + 1
    }
  }
}

// The opening tag that spans `index`: the nearest `<Name` before it whose tag runs
// past it. A tag inside a prop (`title={<b>…</b>}`) closes before `index`, so it is skipped.
function owningTag(text, index) {
  for (const m of [...text.slice(0, index).matchAll(/<([A-Za-z][\w.]*)(?=[\s>])/g)].reverse()) {
    try {
      const tag = openingTag(text, m.index)
      if (tag.end > index) return tag
    } catch {
      // not a tag: a generic or a comparison
    }
  }
  return null
}

// Every literal `className="… cls …"` site: { where, tag } with the tag it sits on.
// Any other quoted mention of the class (`cx('cls')`, a template) is not a site, and
// fails, so a class cannot slip out of the count.
function sitesOf(cls) {
  const re = new RegExp(`className="(?:[\\w-]+ )*${cls}(?: [\\w-]+)*"`, 'g')
  const mention = new RegExp(`['"\`\\s]${cls}['"\`\\s]`, 'g')
  const out = []
  for (const { where, text } of loadTree().sources) {
    for (const m of text.matchAll(re)) {
      const tag = owningTag(text, m.index)
      assert.ok(tag, `${where}: could not find the tag that holds .${cls}`)
      out.push({ where, tag })
    }
    const all = [...text.matchAll(mention)].length
    const sites = [...text.matchAll(re)].length
    assert.equal(all, sites, `${where}: .${cls} is named somewhere that is not a className="…" site`)
  }
  return out
}

// ---- the checks ----

// part: { component, sheet, props, defaults, closed, allowDefault, keepable }
// rows: { [class]: { file, sites = 1, keeps = [], jsx, gap, align, min, fit, dropped } }
//   `file`: the sheet that held (or holds) the rule. Leave it off only when no rule
//   of the class exists anywhere.
//   `dropped`: the rule and the class name went whole, so the one site is found by
//   `min` in `jsx` instead of by class.
export function defineMigrationTests(label, part, rows) {
  test(`${label}: no rule that ends in a migrated class draws layout`, () => checkRules(part, rows))
  test(`${label}: each row's sheet exists and keeps what it should`, () => checkKeeps(part, rows))
  test(`${label}: each class has the right <${part.component}> sites`, () => checkSites(part, rows))
  test(`${label}: no migrated partial loads ahead of ${part.sheet}`, () => checkCascade(part, rows))
}

// A layout property a row may keep in its own rule. Cluster and Grid own all layout, so
// none. Stack's `flex` sizes the block as an item of its parent, which main allowed.
const keepable = (part, prop) => (part.keepable ?? []).includes(prop)

function checkRules(part, rows) {
  for (const [cls, { file, keeps = [] }] of Object.entries(rows)) {
    const keepNames = keeps.map((k) => k.split(/:\s*/)[0])
    for (const { name, rules } of loadTree().sheets) {
      if (name === part.sheet) continue
      for (const { selectors, decls } of rules) {
        for (const sel of selectors.filter((s) => endsInClass(s, cls))) {
          const exact = sel === `.${cls}`
          for (const [prop] of decls) {
            const kept = keepNames.includes(prop)
            if (LAYOUT.test(prop)) assert.ok(exact && name === file && kept && keepable(part, prop), `${name}: "${sel}" still draws ${prop} on .${cls}`)
            else assert.ok(!exact || !part.closed || kept, `${name}: .${cls} keeps "${prop}", which is not on its keep list`)
          }
        }
      }
    }
  }
}

function checkKeeps(part, rows) {
  const { sheets } = loadTree()
  for (const [cls, { file, keeps = [] }] of Object.entries(rows)) {
    const exact = (sheet) => sheet.rules.filter((r) => r.selectors.includes(`.${cls}`))
    if (!file) {
      assert.deepEqual(keeps, [], `.${cls} has keeps but no file`)
      for (const sheet of sheets) assert.equal(exact(sheet).length, 0, `${sheet.name} still has a .${cls} rule, so the row needs its file`)
      continue
    }
    for (const keep of keeps) {
      const prop = keep.split(/:\s*/)[0]
      assert.ok(!LAYOUT.test(prop) || keepable(part, prop), `.${cls} cannot keep ${prop}: the part draws layout`)
    }
    const own = sheets.find((s) => s.name === file)
    assert.ok(own, `${file} is not a stylesheet under src/styles`)
    for (const keep of keeps) {
      const [prop, value] = keep.split(/:\s*/)
      const found = exact(own).flatMap((r) => r.decls).filter(([p]) => p === prop)
      assert.ok(found.length, `${file}: .${cls} should still hold ${prop}`)
      if (value) assert.ok(found.some(([, v]) => v === value), `${file}: .${cls} should hold ${prop}: ${value}`)
    }
  }
}

function checkSites(part, rows) {
  for (const [cls, row] of Object.entries(rows)) {
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
      if (row.jsx) assert.equal(where, row.jsx, `.${cls} should sit in ${row.jsx}`)
      for (const prop of part.props) {
        const want = row[prop] ?? part.defaults[prop]
        const got = tag.props[prop] ?? part.defaults[prop]
        assert.equal(got, want, `${where}: .${cls} has the wrong ${prop}`)
        if (!part.allowDefault && prop in part.defaults && want === part.defaults[prop]) {
          assert.equal(tag.props[prop], undefined, `${where}: .${cls} ${prop} is the default, so leave it off`)
        }
      }
    }
    assert.equal(sites.length, row.sites ?? 1, `.${cls} should have ${row.sites ?? 1} ${part.component} site(s)`)
  }
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
