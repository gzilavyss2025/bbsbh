#!/usr/bin/env node
// Table census, by SHAPE not by name (#1132, slice T0). Re-runnable.
//
//   node .scratch/design-system/table-collapse/census.mjs           # writes census.json + census.md
//   node .scratch/design-system/table-collapse/census.mjs --dump    # one line per table, no files written
//   node .scratch/design-system/table-collapse/census.mjs --recipes # every cell padding, with the rules that set it
//
// Mirrors ../card-collapse/census.mjs. postcss is read from this worktree's
// node_modules, or from the primary checkout's when this worktree has none.
//
// ---------------------------------------------------------------------------
// DEFINITION 1 — a TABLE. Every `<table` opening tag in src/**/*.jsx, after JS
// comments are blanked (so a comment that says "<table>" is not a table). One
// tag = one row. A component that renders one tag for many callers
// (player/Ledger.jsx) is one row; its callers are listed in the row's note.
// Matched on the TAG, never on a class name: `.standings` is on 30 of them, and
// 40 others carry no shared class at all.
//
// DEFINITION 2 — the CSS that reaches a table. A rule reaches table t when one
// of its selectors names a class of t (the <table>'s own classes, the classes
// written on its <tr>/<th>/<td>, or the classes of the three nearest JSX
// ancestors) and EVERY other class in that selector is one of those too, or a
// state (`.is-*`, `.has-*`). A selector that also needs a class this census
// cannot see on the call site (`.player .ledger td`, `.focusrail
// .pitchers__grid td`) is a CONTEXT rule: it is listed, never used to compute
// the base recipe.
//
// DEFINITION 3 — the RECIPE. The padding of a plain body cell (`tbody td`) and
// of a plain head cell (`thead th`), resolved through the cascade the way a
// browser does it, one side at a time: of the base rules (no @media) whose
// selector reaches that cell with no class, attribute or :pseudo on the cell
// itself, the most specific wins, then the latest in src/index.css's import
// order. Tokens are resolved to px from src/tokens/spacing.css. A cell that a
// class or a :first-child singles out (`.rpt tbody th.team`, `.ledger .lft`) is
// a CELL VARIANT, counted in the distinct-recipe tally but not the row's recipe.
//
// DEFINITION 4 — the columns.
//   frame    (the TARGET Table frame)
//            sheet  the table, or a wrapper that reaches it, draws an edge on
//                   four sides AND a radius (the boxed .standings look).
//                   Read through the cascade, so
//                   `.standings-wrap .standings--full { border: none }` moves the
//                   frame to the wrap rather than removing it.
//            bare   neither (the box-score ledger), or the table sits in a
//                   <Card>: the card already draws the box (#1113 Q4).
//   density  row    body cell 6-8px tall, 6-10px wide (the issue's "7/8px": ADR-0085
//                   took 7px down to 6px, so today it reads 6/8)
//            tight  body cell 4-5px tall, 0-4px wide (the issue's "5/2px", today 4/2)
//            other  anything else, printed as its px
//   sticky   any reaching rule, at any width, sets position: sticky on a cell
//   hscroll  the table or an ancestor that reaches it scrolls sideways
//            (overflow-x auto|scroll, any width), or a JSX style says so
//   gate     the file reads revealedThrough, renders a SealBox, or is called
//            from inside one. The machine only flags; overrides.tsv names the
//            gate, and a flagged row with no override prints UNREVIEWED.
//
// Verdicts: MIGRATE, HOLD (scorecard/*, .bs__grid--tally, .sc-sheet, and what
// overrides.tsv adds with a reason) or UNREVIEWED. Slices come from
// overrides.tsv only: a row with no slice and verdict MIGRATE is UNREVIEWED.
// ---------------------------------------------------------------------------

import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
let postcss
try { postcss = createRequire(join(ROOT, 'package.json'))('postcss') }
catch { postcss = createRequire(join(ROOT, '..', 'bbsbh', 'package.json'))('postcss') }

const args = process.argv.slice(2)
const DUMP = args.includes('--dump')
const RECIPES = args.includes('--recipes')
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' })
const read = (f) => readFileSync(join(ROOT, f), 'utf8')
function walk(dir, ext) {
  const out = []
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel, ext))
    else if (ext.test(rel)) out.push(rel)
  }
  return out.sort()
}

// ---------- tokens → px ----------
const TOKENS = {}
for (const f of ['src/tokens/spacing.css', 'src/tokens/layout.css', 'src/tokens/effects.css']) {
  if (!existsSync(join(ROOT, f))) continue
  for (const m of read(f).matchAll(/(--[\w-]+):\s*([\d.]+)px\s*;/g)) TOKENS[m[1]] = +m[2]
}
const toPx = (v) => {
  const s = v.trim()
  if (s === '0') return 0
  const t = s.match(/^var\((--[\w-]+)\)$/)
  if (t && t[1] in TOKENS) return TOKENS[t[1]]
  const p = s.match(/^([\d.]+)px$/)
  return p ? +p[1] : s // anything else (calc, em) is kept as text
}
// Split a shorthand on top-level spaces only (calc(a + b) stays one value).
function splitTop(v) {
  const out = []; let depth = 0; let cur = ''
  for (const c of v) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ' ' && depth === 0) { if (cur) out.push(cur); cur = '' } else cur += c
  }
  if (cur) out.push(cur)
  return out
}
// padding declarations → { top, right, bottom, left } (only the sides a rule sets)
function padSides(decls) {
  const s = {}
  for (const [prop, value] of decls) {
    if (prop === 'padding') {
      const p = splitTop(value).map(toPx)
      const [t, r = t, b = t, l = r] = p
      Object.assign(s, { top: t, right: r, bottom: b, left: l })
    } else if (prop === 'padding-block') { const [a, b = a] = splitTop(value).map(toPx); Object.assign(s, { top: a, bottom: b }) }
    else if (prop === 'padding-inline') { const [a, b = a] = splitTop(value).map(toPx); Object.assign(s, { left: a, right: b }) }
    else { const m = prop.match(/^padding-(top|right|bottom|left)$/); if (m) s[m[1]] = toPx(value) }
  }
  return s
}
const fmtPad = (p) => {
  if (!p) return '—'
  const v = ['top', 'right', 'bottom', 'left'].map((k) => (p[k] ?? 0))
  if (v[0] === v[2] && v[1] === v[3]) return `${v[0]}/${v[1]}`
  return v.join(' ')
}

// ---------- CSS: every rule, in cascade order ----------
const importOrder = [...read('src/index.css').matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)].map((m) => `src/${m[1]}`)
const cssFiles = walk('src/styles', /\.css$/)
const orderOf = (f) => { const i = importOrder.indexOf(f); return i < 0 ? 1000 + cssFiles.indexOf(f) : i }
const atChain = (node) => { const o = []; for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') o.unshift(`@${p.name} ${p.params}`); return o }
const rules = []
for (const f of cssFiles) {
  postcss.parse(read(f), { from: f }).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    const decls = []
    rule.each((n) => { if (n.type === 'decl') decls.push([n.prop, n.value.replace(/\s+/g, ' ').trim()]) })
    rules.push({
      file: f.replace(/^src\/styles\//, ''),
      line: rule.source.start.line,
      order: orderOf(f) * 100000 + rule.source.start.line,
      selectors: rule.selectors.map((s) => s.replace(/\s+/g, ' ').trim()),
      decls,
      at: atChain(rule),
    })
  })
}
const STATE = /^(is|has)-/
const classesIn = (sel) => [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1])
function subjectOf(sel) {
  let s = sel
  for (let i = 0; i < 4; i++) s = s.replace(/:(not|where|has)\([^()]*\)/g, '')
  const parts = s.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean)
  return parts.at(-1) || ''
}
function specificity(sel) {
  let s = sel.replace(/:(where)\([^()]*\)/g, '')
  s = s.replace(/:(is|not|has)\(([^()]*)\)/g, (_, k, inner) => ` ${inner.split(',')[0]}`)
  const ids = (s.match(/#[\w-]+/g) || []).length
  const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(\([^)]*\))?/g) || []).length
  const el = (s.replace(/::?[\w-]+(\([^)]*\))?/g, '').match(/(^|[\s>+~])[a-z][\w-]*/g) || []).length
  return ids * 10000 + cls * 100 + el
}
const decl = (r, prop) => { let v; for (const [p, x] of r.decls) if (p === prop) v = x; return v }

// ---------- JSX: every <table ----------
// Blank JS comments with a scanner that knows about strings (copied from the
// card census, where a regex pass swallowed a whole file).
function stripJs(t) {
  let out = ''; let i = 0; let q = null
  while (i < t.length) {
    const c = t[i]; const n = t[i + 1]
    if (q) { out += c; if (c === '\\') { out += n ?? ''; i += 2; continue } if (c === q) q = null; i++; continue }
    if (c === '`' || c === '"' || c === "'") {
      const prev = out.trimEnd()
      if (c === '`' || prev === '' || /[=(,:[{?+!&|;]$/.test(prev) || /\b(return|case|in|of)$/.test(prev)) { q = c; out += c; i++; continue }
    }
    if (c === '/' && n === '/') { while (i < t.length && t[i] !== '\n') { out += ' '; i++ } continue }
    if (c === '/' && n === '*') { const e = t.indexOf('*/', i + 2); const end = e < 0 ? t.length : e + 2; out += t.slice(i, end).replace(/[^\n]/g, ' '); i = end; continue }
    out += c; i++
  }
  return out
}
// The extent of a JSX opening tag starting at `<`: to its `>`, skipping {…} and strings.
function tagEnd(text, start) {
  let depth = 0; let q = null
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '\\') { i++; continue } if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return i
  }
  return text.length
}
// Classes written in a className attribute: string literals and the static
// parts of template literals; `${…}` holes are dropped, but string literals
// inside a hole (`${open ? 'is-open' : ''}`) are kept.
function classAttr(tag) {
  const m = tag.match(/className=(\{|"|')/)
  if (!m) return { classes: [], dynamic: false, raw: '' }
  let raw
  if (m[1] !== '{') raw = tag.slice(m.index + 11, tag.indexOf(m[1], m.index + 11))
  else {
    let depth = 0; let i = m.index + 10
    for (; i < tag.length; i++) { if (tag[i] === '{') depth++; else if (tag[i] === '}' && --depth === 0) break }
    raw = tag.slice(m.index + 11, i)
  }
  const lits = m[1] === '{' ? [...raw.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/gs)].map((x) => x[2].replace(/\$\{[^}]*\}/g, ' ')) : [raw]
  const classes = [...new Set(lits.join(' ').split(/\s+/).filter((c) => /^[a-z][\w-]*$/i.test(c)))]
  const dynamic = m[1] === '{' && !/^\s*(["'`])[^$]*\1\s*$/.test(raw)
  return { classes, dynamic, raw: raw.replace(/\s+/g, ' ').trim() }
}
const TAG_RE = /<\/?([A-Za-z][\w.]*)(?=[\s>/])/g
// A component ancestor (<BoardScroller>, <BoardCard>) carries the classes of
// the element it renders. Read them off its definition: the first JSX tag after
// its `return (`. One level only; `Card` is read from its props instead.
const componentRoots = new Map()
function componentRoot(name) {
  if (componentRoots.has(name)) return componentRoots.get(name)
  let found = null
  for (const f of walk('src', /\.jsx$/)) {
    const t = stripJs(read(f))
    const m = t.match(new RegExp(`function ${name}\\s*\\(`))
    if (!m) continue
    const ret = t.indexOf('return (', m.index)
    const lt = ret < 0 ? -1 : t.indexOf('<', ret)
    if (lt < 0) break
    const open = t.slice(lt, tagEnd(t, lt) + 1)
    found = { file: f.replace(/^src\//, ''), tag: (open.match(/^<([\w.]+)/) || [])[1], ...classAttr(open), open }
    break
  }
  componentRoots.set(name, found)
  return found
}
function ancestorsOf(text, at, max = 3) {
  const tags = []
  for (const m of text.slice(0, at).matchAll(TAG_RE)) tags.push({ i: m.index, name: m[1], close: m[0][1] === '/' })
  const out = []; let depth = 0
  for (let k = tags.length - 1; k >= 0 && out.length < max; k--) {
    const t = tags[k]
    if (t.close) { depth++; continue }
    const end = tagEnd(text, t.i)
    if (text[end - 1] === '/') continue // self-closing
    if (depth > 0) { depth--; continue }
    const open = text.slice(t.i, end + 1)
    const own = classAttr(open)
    if (/^[A-Z]/.test(t.name) && t.name !== 'Card') {
      const root = componentRoot(t.name)
      if (root) { out.push({ name: root.tag === 'Card' ? 'Card' : t.name, classes: [...own.classes, ...root.classes], dynamic: own.dynamic, raw: own.raw, open: root.open, via: root.file, style: false }); continue }
    }
    out.push({ name: t.name, ...own, open, style: /overflowX|overflow:/.test(open) })
  }
  return out
}
const jsxFiles = walk('src', /\.jsx$/)
const tables = []
for (const f of jsxFiles) {
  const raw = read(f)
  const text = stripJs(raw)
  let n = 0
  for (const m of text.matchAll(/<table(?=[\s>])/g)) {
    n++
    const end = tagEnd(text, m.index)
    const open = text.slice(m.index, end + 1)
    const close = text.indexOf('</table>', end)
    const body = text.slice(end, close < 0 ? text.length : close)
    const cellClasses = new Set(); const rowClasses = new Set()
    for (const c of body.matchAll(/<(tr|th|td|thead|tbody|tfoot|col|colgroup)(?=[\s>/])/g)) {
      const t = body.slice(c.index, tagEnd(body, c.index) + 1)
      for (const k of classAttr(t).classes) (c[1] === 'tr' || c[1].startsWith('t') && c[1] !== 'th' && c[1] !== 'td' ? rowClasses : cellClasses).add(k)
    }
    // class names a cell helper writes (Ledger.jsx's cellClass): string literals in the body that look like classes
    const own = classAttr(open)
    tables.push({
      key: `${f.replace(/^src\//, '')}#${n}`,
      file: f.replace(/^src\//, ''),
      line: text.slice(0, m.index).split('\n').length,
      classes: own.classes, dynamic: own.dynamic, raw: own.raw,
      cellClasses: [...cellClasses], rowClasses: [...rowClasses],
      ancestors: ancestorsOf(text, m.index),
      text,
    })
  }
}

// ---------- which rules reach which table ----------
function reach(t) {
  const anchor = new Set([...t.classes, ...t.cellClasses, ...t.rowClasses])
  const known = new Set([...anchor, ...t.ancestors.flatMap((a) => a.classes)])
  const out = []
  for (const r of rules) {
    for (const s of r.selectors) {
      const cls = classesIn(s)
      if (!cls.some((c) => anchor.has(c) || (t.ancestors.slice(0, 2).some((a) => a.classes.includes(c)) && /overflow|sticky/.test(r.decls.map((d) => d.join(':')).join(';'))))) continue
      const unknown = cls.filter((c) => !known.has(c) && !STATE.test(c))
      out.push({ r, s, context: unknown.length ? unknown : null })
    }
  }
  return out
}
const isCellSubject = (subj) => /^(th|td)\b|^:is\((th|td)/.test(subj)
// the selector reaches a PLAIN body/head cell: subject is a bare th/td (or :is(th, td))
function plainCell(s, which) {
  const subj = subjectOf(s)
  const bare = /^(th|td)$|^:is\(\s*th\s*,\s*td\s*\)$|^:is\(\s*td\s*,\s*th\s*\)$/.test(subj)
  if (!bare) return false
  const el = subj.includes('(') ? 'both' : subj
  if (which === 'td') { if (el === 'th') return false; if (/\b(thead|tfoot)\b/.test(s)) return false }
  if (which === 'th') { if (el === 'td') return false; if (/\b(tbody|tfoot)\b/.test(s)) return false }
  // no row condition (tr.foo, tr:first-child) between the table and the cell
  if (/tr[.:[]|tbody[.:[]|thead[.:[]/.test(s)) return false
  return !classesIn(s).some((c) => STATE.test(c))
}
function cascadePad(t, reached, which) {
  // a row or cell class in the selector (`.rpt__between td`) makes it a variant, not the plain cell
  const variant = new Set([...t.rowClasses, ...t.cellClasses].filter((c) => !t.classes.includes(c)))
  const sides = {}; const won = {}
  for (const { r, s, context } of reached) {
    if (context || r.at.length || !plainCell(s, which) || classesIn(s).some((c) => variant.has(c))) continue
    const p = padSides(r.decls)
    const sp = specificity(s)
    for (const [k, v] of Object.entries(p)) {
      const cur = won[k]
      if (!cur || sp > cur.sp || (sp === cur.sp && r.order >= cur.order)) { won[k] = { sp, order: r.order, r }; sides[k] = v }
    }
  }
  if (!Object.keys(sides).length) return null
  return { pad: sides, rules: [...new Set(Object.values(won).map((w) => `${w.r.file}:${w.r.line}`))] }
}
const SOLID_EDGE = (b) => b && !/^(0|none)\b/.test(b) && /solid/.test(b)
// Inside a <Card>, the card draws the box, so the Table is bare. UNLESS the
// table also draws its own box today (a box in a box): #1113 Q4 put flattening
// those off to a later issue, so it stays a sheet and is listed for that issue.
function frameOf(t, reached) {
  const own = ownFrame(t, reached)
  const card = t.ancestors.find((a) => a.name === 'Card')
  if (!card) return own
  const fr = (card.open.match(/frame="(\w+)"/) || [])[1] || 'sheet'
  if (own.frame === 'sheet') return { frame: 'sheet', boxInBox: true, how: `draws its own box (${own.how}) INSIDE <Card frame="${fr}">: a box in a box today. Kept as a sheet; the nested-box issue decides (#1113 Q4: later)` }
  return { frame: 'bare', how: `inside <Card frame="${fr}">: the card draws the box` }
}
function ownFrame(t, reached) {
  // the table itself, through the cascade (border + radius on the table's own class)
  const mine = new Set(t.classes)
  let border = null; let radius = null; let bWin = null; let rWin = null
  for (const { r, s, context } of reached) {
    if (context || r.at.length) continue
    const subj = subjectOf(s)
    const subjCls = classesIn(subj)
    if (!subjCls.some((c) => mine.has(c)) && !(/^table\b/.test(subj) && classesIn(s).some((c) => mine.has(c)))) continue
    const sp = specificity(s)
    const b = decl(r, 'border'); const rad = decl(r, 'border-radius')
    if (b !== undefined && (!bWin || sp > bWin.sp || (sp === bWin.sp && r.order >= bWin.order))) { bWin = { sp, order: r.order, r }; border = b }
    if (rad !== undefined && (!rWin || sp > rWin.sp || (sp === rWin.sp && r.order >= rWin.order))) { rWin = { sp, order: r.order, r }; radius = rad }
  }
  if (SOLID_EDGE(border) && radius && !/^0/.test(radius)) return { frame: 'sheet', how: `table ${bWin.r.file}:${bWin.r.line}` }
  // a wrapper (the two nearest ancestors) that draws the box
  for (const a of t.ancestors.slice(0, 2)) {
    if (a.name === 'Card') break
    for (const c of a.classes) {
      for (const r of rules) {
        if (r.at.length) continue
        if (!r.selectors.some((s) => classesIn(subjectOf(s)).includes(c) && classesIn(s).every((k) => k === c || a.classes.includes(k) || STATE.test(k)))) continue
        const b = decl(r, 'border'); const rad = decl(r, 'border-radius'); const sh2 = decl(r, 'box-shadow')
        if ((SOLID_EDGE(b) && rad) || (rad && sh2 && /--shadow-card/.test(sh2))) return { frame: 'sheet', how: `wrap .${c} ${r.file}:${r.line}` }
      }
    }
  }
  return { frame: 'bare', how: SOLID_EDGE(border) ? 'edge, no radius' : '' }
}
function stickyOf(reached) {
  const hits = reached.filter(({ r, context }) => !context && decl(r, 'position') === 'sticky')
    .filter(({ s }) => isCellSubject(subjectOf(s)) || /\b(th|td)\b/.test(subjectOf(s)) || /^\.[\w-]*(team|name|lft|first|col)/.test(subjectOf(s)))
  return hits.map(({ r, s, context }) => `${s}${r.at.length ? ` ${r.at.join(' ')}` : ''}${context ? ' [ctx]' : ''} (${r.file}:${r.line})`)
}
function hscrollOf(t, reached) {
  const hits = []
  for (const { r, s, context } of reached) {
    if (context) continue
    const ox = decl(r, 'overflow-x'); const o = decl(r, 'overflow')
    if (!(/auto|scroll/.test(ox ?? '') || /auto|scroll/.test(o ?? ''))) continue
    const subjCls = classesIn(subjectOf(s))
    const onAncestor = t.ancestors.slice(0, 3).some((a) => a.classes.some((c) => subjCls.includes(c)))
    const onTable = subjCls.some((c) => t.classes.includes(c))
    if (onAncestor || onTable) hits.push(`${s}${r.at.length ? ` ${r.at.join(' ')}` : ''} (${r.file}:${r.line})`)
  }
  for (const a of t.ancestors) if (a.style && /overflowX:\s*['"](auto|scroll)/.test(a.open)) hits.push(`<${a.name} style overflowX>`)
  return [...new Set(hits)]
}
function densityOf(p) {
  if (!p) return 'other'
  const v = p.top; const h = p.left ?? p.right
  if (typeof v !== 'number' || typeof h !== 'number') return 'other'
  if (v >= 6 && v <= 8 && h >= 6 && h <= 10 && p.bottom === v) return 'row'
  if (v >= 4 && v <= 5 && h >= 0 && h <= 4 && p.bottom === v) return 'tight'
  return 'other'
}
// The owning partial: the file with the most rules that name the table's OWN
// family class. The shared bases (`.standings`, `.ledger`, `.bs__grid`,
// `.pitchers__grid`) are left out of the vote when the table has another
// class, so `standings rpt` is owned by the file that writes `.rpt`, not by
// 29-team-transactions.css, where `.standings th, td` happens to live.
const SHARED_BASES = new Set(['standings', 'standings--full', 'ledger', 'bs__grid', 'pitchers__grid'])
function owningPartial(t, reached) {
  const fam = t.classes.filter((c) => !SHARED_BASES.has(c) && !STATE.test(c))
  const tally = (vote) => {
    const n = new Map()
    for (const { r, s, context } of reached) {
      if (context) continue
      if (!classesIn(s).some((c) => vote.includes(c))) continue
      n.set(r.file, (n.get(r.file) || 0) + 1)
    }
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0]
  }
  // a family class no rule names (`.umprank`, `.formtrend__table`) falls back to the shared base
  return (fam.length && tally(fam)) || tally(t.classes) || '—'
}
// The spoiler scope: the file gates on revealedThrough or renders a SealBox, or
// is one a SealBox reveal / the live game renders (the card census's list).
const SEAL_SCOPE_FILES = /(screens\/BoxScore|screens\/boxscore\/|screens\/InningViewer|screens\/innings\/|components\/inning\/|components\/scoring\/|components\/gamehud\/|components\/playbyplay\/|screens\/Scorecard|screens\/GameSelect|components\/game\/GameCard|screens\/TeamInfo|components\/boxscore\/)/
function gateSignal(t) {
  const sig = []
  if (/revealedThrough/.test(t.text)) sig.push('reads revealedThrough')
  if (/SealBox/.test(t.text)) sig.push('renders SealBox')
  if (SEAL_SCOPE_FILES.test(t.file)) sig.push('spoiler-scope file')
  return sig
}

// ---------- overrides ----------
// overrides.tsv (TAB-separated; # lines are comments):
//   key  verdict  slice  gate  to  frame  sticky  hscroll  reason
// `to` is the TARGET density (row | tight | keep). keep = the namespace keeps
// its own cell padding, a listed residue (ADR-0085's pattern; decisions.md).
// key = file#n (the nth <table in the file). An empty cell keeps the machine value.
function readTsv(name, cols) {
  const f = join(HERE, name)
  if (!existsSync(f)) return {}
  const out = {}
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const cells = line.split('\t')
    const o = {}
    cols.forEach((c, i) => { const v = (cells[i + 1] ?? '').trim(); if (v) o[c] = v })
    if (out[cells[0]]) console.error(`DUPLICATE override key: ${cells[0]}`)
    out[cells[0]] = o
  }
  return out
}
const OVERRIDES = readTsv('overrides.tsv', ['verdict', 'slice', 'gate', 'to', 'frame', 'sticky', 'hscroll', 'reason'])

// ---------- build the rows ----------
const HOLD_RULES = [
  [(t) => /screens\/Scorecard\.jsx$/.test(t.file), 'scorecard/* — the sheet you score on (critique finding 8)'],
  [(t) => t.classes.includes('bs__grid--tally'), '.bs__grid--tally — the inning tally sheet you score on (finding 8)'],
  [(t) => t.classes.includes('sc-sheet'), '.sc-sheet — the scorecard grid (finding 8)'],
]
const usedKeys = new Set()
const rows = tables.map((t) => {
  const reached = reach(t)
  const td = cascadePad(t, reached, 'td')
  const th = cascadePad(t, reached, 'th')
  const fr = frameOf(t, reached)
  const sticky = stickyOf(reached)
  const hscroll = hscrollOf(t, reached)
  const signals = gateSignal(t)
  const o = OVERRIDES[t.key] || {}
  if (OVERRIDES[t.key]) usedKeys.add(t.key)
  const hold = HOLD_RULES.find(([test]) => test(t))
  let verdict = o.verdict || (hold ? 'HOLD' : 'MIGRATE')
  const problems = []
  if (signals.length && !o.gate) problems.push(`gate signal (${signals.join(', ')}) with no gate named`)
  if (verdict === 'MIGRATE' && !o.slice) problems.push('no slice')
  if (!td && !o.reason) problems.push('no body-cell padding found')
  const density = densityOf(td?.pad)
  const to = o.to || (density === 'other' ? '' : density)
  if (verdict === 'MIGRATE' && !to) problems.push('no target density for an `other` recipe')
  if (problems.length && !o.verdict) verdict = 'UNREVIEWED'
  const contexts = reached.filter((x) => x.context && /^padding|position/.test(x.r.decls.map((d) => d[0]).join(' '))).map((x) => `${x.s} (${x.r.file}:${x.r.line})`)
  // every distinct cell padding that reaches this table (base and @media, plain and variant cells)
  const cellPads = new Set()
  for (const { r, s, context } of reached) {
    if (context) continue
    const subj = subjectOf(s)
    const cellish = /\b(th|td)\b/.test(subj) || classesIn(subj).some((c) => t.cellClasses.includes(c))
    if (!cellish) continue
    const p = padSides(r.decls)
    if (Object.keys(p).length) cellPads.add(JSON.stringify({ rule: `${r.file}:${r.line}`, sel: s, at: r.at.join(' '), pad: p }))
  }
  return {
    key: t.key, file: t.file, line: t.line,
    cls: t.classes.length ? t.classes.map((c) => `.${c}`).join(' ') : `{${t.raw}}`,
    dynamic: t.dynamic,
    partial: owningPartial(t, reached),
    td: td ? fmtPad(td.pad) : '—', tdRules: td?.rules || [],
    th: th ? fmtPad(th.pad) : '—', thRules: th?.rules || [],
    frame: o.frame || fr.frame, frameHow: fr.how, boxInBox: !!fr.boxInBox && verdict === 'MIGRATE',
    density, to: verdict === 'HOLD' ? '—' : to,
    sticky: o.sticky || (sticky.length ? 'yes' : 'no'), stickyHow: sticky,
    hscroll: o.hscroll || (hscroll.length ? 'yes' : 'no'), hscrollHow: hscroll,
    gate: o.gate || (signals.length ? `? ${signals.join(', ')}` : 'no'),
    verdict, slice: (o.slice === '-' ? '—' : o.slice) || (verdict === 'HOLD' ? '—' : ''),
    reason: o.reason || (hold ? hold[1] : ''),
    problems,
    contexts,
    cellPads: [...cellPads].map((x) => JSON.parse(x)),
    ancestors: t.ancestors.map((a) => `<${a.name}${a.classes.length ? ` .${a.classes.join(' .')}` : ''}>`),
  }
})
const staleKeys = Object.keys(OVERRIDES).filter((k) => !usedKeys.has(k) && !k.startsWith('div:'))

// ---------- the global recipe tally ----------
// Every distinct padding written on a cell of a migrating or held table
// (base rules and @media rules, plain and variant cells), as px.
const recipeMap = new Map()
for (const row of rows) for (const c of row.cellPads) {
  const k = fmtPad(c.pad) + (Object.keys(c.pad).length < 4 ? ` (${Object.keys(c.pad).join('+')})` : '')
  const e = recipeMap.get(k) || { rules: new Set(), tables: new Set() }
  e.rules.add(c.rule); e.tables.add(row.key); recipeMap.set(k, e)
}
const shorthandRecipes = [...recipeMap.keys()].filter((k) => !k.includes('('))
const migKeys = new Set(rows.filter((r) => r.verdict === 'MIGRATE').map((r) => r.key))
const migRecipes = shorthandRecipes.filter((k) => [...recipeMap.get(k).tables].some((t) => migKeys.has(t)))
const plainRecipes = new Set(rows.map((r) => `${r.td} · ${r.th}`))
const families = new Map()
for (const r of rows) {
  const fam = r.partial
  const e = families.get(fam) || []; e.push(r); families.set(fam, e)
}

// ---------- div-built tables (reported apart, not in the 70) ----------
// A rule whose subject is a __row and that lays its children out as a grid of
// three or more tracks is a table drawn in divs. Listed so the next agent can
// see them; only the team-leaders pair is in this issue's text.
const rowGrids = []
for (const r of rules) {
  if (r.at.length) continue
  const gtc = decl(r, 'grid-template-columns')
  if (decl(r, 'display') !== 'grid' || !gtc) continue
  const sels = r.selectors.filter((s) => /(__row|row)$/.test(subjectOf(s).replace(/\.(is|has)-[\w-]+/g, '')))
  if (!sels.length) continue
  const tracks = splitTop(gtc).length
  if (tracks < 3 && !/repeat\(\s*([3-9]|\d\d)/.test(gtc)) continue
  const headRow = r.selectors.some((s) => /__[a-z]*head(er)?$/.test(subjectOf(s)))
  rowGrids.push({ sel: r.selectors.join(', '), at: `${r.file}:${r.line}`, gtc, headRow })
}
const DIV_TABLES = [
  {
    key: 'div:tledg',
    where: 'components/teamstats/TeamLeadersLedger.jsx',
    css: '23-box-score-detail.css (.tledg__row, flex)',
    what: 'the team-leaders Batting / Pitching pair: one <ul> per block, each <li> a flex row of three spans (category, leader, value). One JSX site, two blocks on screen. No column heads.',
  },
]

// ---------- output ----------
if (DUMP) {
  for (const r of rows) console.log([r.key, r.cls, r.partial, `td ${r.td}`, `th ${r.th}`, r.frame, r.density, `sticky ${r.sticky}`, `scroll ${r.hscroll}`, `gate ${r.gate}`, r.verdict, r.slice, r.problems.join('; ')].join(' | '))
  if (staleKeys.length) console.log(`STALE overrides: ${staleKeys.join(' | ')}`)
  process.exit(0)
}
if (RECIPES) {
  for (const [k, e] of [...recipeMap].sort((a, b) => b[1].tables.size - a[1].tables.size)) console.log(`${k}  — ${e.tables.size} tables, rules ${[...e.rules].join(' ')}`)
  process.exit(0)
}

const count = (pred) => rows.filter(pred).length
const by = (field, list = rows) => { const m = {}; for (const r of list) m[r[field]] = (m[r[field]] || 0) + 1; return m }
const fmtBy = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
const files = new Set(rows.map((r) => r.file))
const migrate = rows.filter((r) => r.verdict === 'MIGRATE')
const head = sh('git rev-parse --short HEAD').trim()

const L = []
L.push('# Table census (#1132, slice T0)', '')
L.push(`Generated by \`census.mjs\` on ${new Date().toISOString().slice(0, 10)} from the working tree at ${head}. **Do not hand-edit.** Change \`overrides.tsv\` and re-run \`node .scratch/design-system/table-collapse/census.mjs\`.`, '')
L.push('The definitions are in the header of `census.mjs`. In short: a **table** is a `<table` tag in a `.jsx` file, matched on the tag, never on a class name. The **recipe** is the padding of a plain body cell and a plain head cell, resolved through the cascade in px.', '')
L.push('## Headline', '')
L.push(`- **${rows.length} \`<table>\` tags in ${files.size} files.** The issue says "40 \`<table>\`s in JSX". That was wrong: it counted tables that carry a known class, not tags.`)
L.push(`- Verdicts: ${fmtBy(by('verdict'))}.`)
L.push(`- Of the ${migrate.length} that migrate — frame: ${fmtBy(by('frame', migrate))}; density: ${fmtBy(by('density', migrate))}; sticky first column: ${count((r) => r.verdict === 'MIGRATE' && r.sticky === 'yes')}; scroll sideways: ${count((r) => r.verdict === 'MIGRATE' && r.hscroll === 'yes')}; reveal-gated: ${count((r) => r.verdict === 'MIGRATE' && r.gate !== 'no')}.`)
L.push(`- **Boxes in a box:** ${count((r) => r.boxInBox)} migrating tables draw their own frame inside a \`Card\` (${rows.filter((r) => r.boxInBox).map((r) => `\`${r.key}\``).join(', ')}). They stay \`sheet\` until the nested-box issue (#1113 Q4: later).`)
L.push(`- \`.standings\` is on **${count((r) => /\.standings\b/.test(r.cls))}** tags (the issue says 30), \`standings rpt\` on **${count((r) => /\.standings \.rpt/.test(r.cls))}** (the issue says 18).`)
L.push(`- **Distinct cell paddings: ${shorthandRecipes.length}** written as a full \`padding\` on a cell rule that reaches a table (base and @media, plain and classed cells), **${recipeMap.size}** if each one-side longhand (\`padding-left: 0\` on a first cell) counts too. ${migRecipes.length} of the ${shorthandRecipes.length} reach a table that migrates. The issue says 25: its count is between these two, and its list of eight includes values ADR-0085 has since rounded (7px and 5px are 6px and 4px now; 9px is 8px).`)
L.push(`- **Distinct plain-cell recipes** (the td · th pair a plain cell gets): **${plainRecipes.size}**. **Owning partials** (the issue's "about 13 named families"): **${families.size}**.`)
L.push(`- Plain body cell of the ${migrate.length} migrating tables, today: ${fmtBy(by('td', migrate))}. **Target density**: ${fmtBy(by('to', migrate))} (decisions.md Q2).`)
L.push(`- **Div-built tables:** ${DIV_TABLES.length} named (the team-leaders pair), and ${rowGrids.length} row-grid rules of three or more tracks, listed in Part 4.`)
L.push(`- Not counted: the \`<table>\` that \`src/copy/landing/render.js\` writes as an HTML string for \`/learn\` (ADR-0053). It is server-rendered for crawlers and has no app CSS.`)
if (staleKeys.length) L.push(`- **STALE overrides**: ${staleKeys.join(' | ')}`)
L.push(`- **UNREVIEWED rows: ${count((r) => r.verdict === 'UNREVIEWED')}**${count((r) => r.verdict === 'UNREVIEWED') ? ` — ${rows.filter((r) => r.verdict === 'UNREVIEWED').map((r) => `\`${r.key}\``).join(', ')}` : ''}`, '')
L.push('Column key: **td · th** = the plain body cell and plain head cell padding, `vertical/horizontal` in px (four numbers when the sides differ). **frame** `sheet` boxed / `bare` ruled only. **density** `row` 6-8/6-10 · `tight` 4-5/0-4 · `other`. **sticky** a cell is `position: sticky` at some width. **scroll** the table or its wrap scrolls sideways. **gate** how the spoiler rule reaches the table (`no` = outside the scope).', '')

const esc = (s) => String(s).replace(/\|/g, '\\|')
const tableRow = (r) => `| \`${r.file}:${r.line}\` | \`${esc(r.cls)}\` | ${r.partial} | ${r.td} · ${r.th} | ${r.frame} | ${r.density} | ${r.to} | ${r.sticky} | ${r.hscroll} | ${esc(r.gate)} | ${r.verdict} | ${r.slice} |`
const TH = '| file | class | owning partial | td · th | frame | density | → density | sticky | scroll | gate | verdict | slice |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'

L.push('## Part 1 — every table, by slice', '')
const sliceOrder = [...new Set(rows.map((r) => r.slice || '?'))].sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b, 'en', { numeric: true })))
for (const s of sliceOrder) {
  const list = rows.filter((r) => (r.slice || '?') === s)
  L.push(`### ${s === '—' ? 'Held — no slice' : s === '?' ? 'No slice yet' : `Slice ${s}`} (${list.length})`, '')
  L.push(TH)
  for (const r of list) L.push(tableRow(r))
  L.push('')
}

L.push('## Part 2 — notes per table', '')
L.push('Why a row is what it is: the hand-checked reason from `overrides.tsv`, the rules that set the recipe, and where the frame, the sticky column and the scroll come from.', '')
for (const r of rows) {
  L.push(`- **\`${r.key}\`** \`${esc(r.cls)}\`${r.dynamic ? ' (className is an expression)' : ''} — ${r.reason || '(no note)'}`)
  L.push(`  - recipe: td ${r.td} from ${r.tdRules.join(', ') || '—'}; th ${r.th} from ${r.thRules.join(', ') || '—'}`)
  L.push(`  - frame: ${r.frame}${r.frameHow ? ` (${r.frameHow})` : ''}. Ancestors: ${r.ancestors.join(' ← ') || '—'}`)
  if (r.stickyHow.length) L.push(`  - sticky: ${r.stickyHow.join('; ')}`)
  if (r.hscrollHow.length) L.push(`  - scroll: ${r.hscrollHow.join('; ')}`)
  if (r.contexts.length) L.push(`  - context rules (need a class the call site does not show; not in the recipe): ${r.contexts.join('; ')}`)
  if (r.problems.length) L.push(`  - **open:** ${r.problems.join('; ')}`)
}
L.push('')

L.push('## Part 3 — the recipes', '')
L.push(`Every distinct cell padding that reaches a table, in px, with how many tables it reaches. ${shorthandRecipes.length} full \`padding\` values and ${recipeMap.size - shorthandRecipes.length} one-side longhands.`, '')
L.push('| padding (v/h px) | tables | rules |', '| --- | --- | --- |')
for (const [k, e] of [...recipeMap].sort((a, b) => b[1].tables.size - a[1].tables.size || a[0].localeCompare(b[0]))) L.push(`| ${k} | ${e.tables.size} | ${[...e.rules].join(', ')} |`)
L.push('')
L.push('### Owning partials (the families)', '')
L.push('| partial | tables | verdicts |', '| --- | --- | --- |')
for (const [f, list] of [...families].sort((a, b) => b[1].length - a[1].length)) L.push(`| ${f} | ${list.length} | ${fmtBy(by('verdict', list))} |`)
L.push('')

L.push('## Part 4 — tables built from divs (not in the count)', '')
for (const d of DIV_TABLES) L.push(`- **${d.where}** — ${d.what} CSS: ${d.css}. Verdict: ${(OVERRIDES[d.key] || {}).verdict || 'UNREVIEWED'} — ${(OVERRIDES[d.key] || {}).reason || ''}`)
L.push('', `Row-grid rules (subject \`__row\`, \`display: grid\`, three or more tracks). A **head** mark means a column-head row shares the grid, which is the strongest sign of a table in disguise. None of these is in this issue's scope; they are listed so a later pass can decide.`, '')
L.push('| selector | rule | columns | head row |', '| --- | --- | --- | --- |')
for (const g of rowGrids) L.push(`| \`${esc(g.sel)}\` | ${g.at} | \`${esc(g.gtc)}\` | ${g.headRow ? 'head' : ''} |`)
L.push('')

writeFileSync(join(HERE, 'census.md'), L.join('\n'))
writeFileSync(join(HERE, 'census.json'), JSON.stringify({ head, rows: rows.map(({ cellPads, ...r }) => ({ ...r, cellPads })), rowGrids }, null, 1))
console.log(`tables ${rows.length} in ${files.size} files · ${fmtBy(by('verdict'))} · paddings ${shorthandRecipes.length} (+${recipeMap.size - shorthandRecipes.length} longhands) · plain recipes ${plainRecipes.size} · partials ${families.size}`)
if (staleKeys.length) console.log(`STALE overrides: ${staleKeys.join(' | ')}`)
