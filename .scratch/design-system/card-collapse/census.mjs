#!/usr/bin/env node
// Card + SectionHead census, by SHAPE not by name (#1113). Re-runnable.
//
//   node .scratch/design-system/card-collapse/census.mjs            # working tree, writes census.json + census.md
//   node .scratch/design-system/card-collapse/census.mjs --variants # the reconciliation table
//   node .scratch/design-system/card-collapse/census.mjs --dump     # every row, one line each, no files written
//
// Mirrors ../pill-collapse/census.mjs. postcss is read from this worktree's
// node_modules, or from the primary checkout's when this worktree has none.
//
// ---------------------------------------------------------------------------
// DEFINITION 1 — a CARD FRAME rule. One postcss Rule such that:
//
//  1. It lives in src/styles/**/*.css (src/tokens hold no box rules).
//     EXCEPT src/styles/system/card.css + section-head.css (the target, once
//     it exists): printed as TARGET, not counted.
//  2. It is NOT inside an at-rule. (--variants counts the @media copies.)
//  3. Its OWN declarations draw the whole box, i.e. ALL of
//       a. a GROUND: background / background-color that is a paper token
//          (--surface-card, --surface-inset, --paper-0..3, --bg-page,
//          --bg-canvas, or a var() whose fallback is one of those);
//       b. an EDGE on four sides: `border` shorthand, solid, non-zero width
//          (--bw-hair, --bw-rule, 1px, 1.5px), coloured with a rule token
//          (--border-rule, --border-hairline, --rule, --rule-soft) or a
//          color-mix that starts from one. Dashed is NOT a card edge (finding
//          7: dashed = provisional / empty / door) and is reported apart.
//       c. a BOX RADIUS: one value, --radius-sm | --radius-md | --radius-lg, or
//          a literal 4px..16px. --radius-xs (3px) is a TAG corner, a pill is
//          a capsule, 50% is a circle — none of them is a card.
//     A recipe split across two rules for one selector does NOT count (the
//     definition is a rule that draws the whole object); --variants reports it.
//  4. At least one selector in the list is a BASE selector (same test as the
//     pill census: the subject carries no :hover/:focus/[aria-*]/.is-*/--on…
//     state, and is not a ::before/::after).
//  5. One rule = one row.
//
// The FRAME column is then read off (b)+(c)+box-shadow:
//     sheet   md|lg radius + a shadow (--shadow-card / --shadow-raised)
//     plain   md|lg radius, no shadow            (the "un-named third frame", #1113 comment 2)
//     ledger  sm radius (or 4-8px), no shadow
//     sheet-sm  sm radius + a shadow             (a residue — which way does it go?)
//   and the GROUND column: card | inset | page | other.
//
// ---------------------------------------------------------------------------
// DEFINITION 2 — a SECTION HEAD rule. One top-level rule, base subject, such that
//     EITHER it paints the BAND: background reads var(--bar-fill …), or it is
//            the undressed band (background --navy|--header-bar AND a 3px
//            border-bottom). Context selectors count (`.team-hub.is-themed
//            .thub-card__head` is a base rule for .thub-card__head).
//     OR its subject class is a HEAD NAME — `section__title`, `metricbar`, or
//            ends `__head | __header | __hd | __heading | __title | __kicker |
//            __eyebrow | __masthead` — AND its own declarations set caps
//            type (text-transform: uppercase, or font-family --font-display).
//   LOOK column:
//     band     the club band (--bar-fill) or its undressed navy form
//     label    display caps + a hairline border-bottom (the .thub-card__head / .section__title idiom)
//     rule     display caps whose ::before/::after draws a line (flex:1 + a border or 1-2px height)
//     inset    display caps on its own inset ground (a label inside a box)
//     kicker   an __eyebrow / __kicker (a line OVER the title)
//     title    a head in a heading-size face (--fs-h1..h3, --fs-display*) — a page or card NAME
//     plain    display caps, no rule, no ground
//   A __sub / __lede / __note is not a head — it is the head's second line and
//   is counted in the NOTE tally, not as a row.
//
// Verdicts are heuristics, then overrides.tsv / overrides-heads.tsv (hand-checked,
// one row each; a key that matches no row prints STALE). TSV, not the pill
// census's JSON: 372 hand rows read better as one line each. census.json keeps
// the raw declarations; census.md is the readable table (generated).
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
const VARIANTS = args.includes('--variants')
const DUMP = args.includes('--dump')
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8' })

function walk(dir, ext) {
  const out = []
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel, ext))
    else if (ext.test(rel)) out.push(rel)
  }
  return out
}
const read = (f) => readFileSync(join(ROOT, f), 'utf8')

// ---------- selector helpers (same as the pill census) ----------
const STATE_PSEUDO = /:(hover|focus|focus-visible|focus-within|active|disabled|checked|visited|target|open)\b/
const STATE_ATTR = /\[(aria-pressed|aria-current|aria-selected|aria-expanded|aria-checked|disabled|data-state|open)\b/
const STATE_CLASS = /\.(is|has)-[\w-]+/
const STATE_MOD = /--(active|on|off|selected|current|open|pressed|checked|live-on)(?![\w-])/
function subjectOf(sel) {
  let s = sel
  for (let i = 0; i < 4; i++) s = s.replace(/:(not|where|is|has)\([^()]*\)/g, '')
  const parts = s.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean)
  return parts.at(-1) || ''
}
function selectorKind(sel) {
  const subj = subjectOf(sel)
  if (/::?(before|after|placeholder|marker|selection|backdrop|-webkit-[\w-]+)/.test(subj)) return 'pseudo-element'
  if (STATE_PSEUDO.test(subj) || STATE_ATTR.test(subj) || STATE_CLASS.test(subj) || STATE_MOD.test(subj)) return 'state'
  return 'base'
}
const subjectClasses = (sel) => [...subjectOf(sel).matchAll(/\.([\w-]+)/g)].map((m) => m[1])
function hookClass(sel) {
  const own = subjectClasses(sel).filter((c) => !/^(is|has)-/.test(c))
  if (own.length) return own[0]
  const all = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).filter((c) => !/^(is|has)-/.test(c))
  return all.at(-1) || ''
}
const subjectElement = (sel) => (subjectOf(sel).match(/^([a-z][\w-]*)/) || [])[1] || null
const blockOf = (cls) => cls.replace(/(__|--).*$/, '')
const atChain = (node) => { const o = []; for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') o.unshift(`@${p.name} ${p.params}`); return o }

// ---------- collect every rule ----------
const TARGET_FILES = new Set(['src/styles/system/card.css', 'src/styles/system/section-head.css'])
const cssFiles = walk('src/styles', /\.css$/)
const allRules = []
for (const f of cssFiles) {
  postcss.parse(read(f), { from: f }).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    const decls = {}
    rule.each((n) => { if (n.type === 'decl') decls[n.prop] = n.value.replace(/\s+/g, ' ').trim() })
    const sels = rule.selectors.map((s) => s.replace(/\s+/g, ' ').trim())
    allRules.push({ file: f.replace(/^src\/styles\//, ''), path: f, line: rule.source.start.line, selector: sels.join(', '), selectors: sels, decls, at: atChain(rule) })
  })
}
const baseSelectors = (r) => r.selectors.filter((s) => selectorKind(s) === 'base')

// ---------- the frame test ----------
const PAPER = /^var\(--(surface-card|surface-inset|paper-[0-3]|bg-page|bg-canvas)\)$|^var\(--[\w-]+, ?var\(--(surface-card|surface-inset|paper-[0-3]|bg-page|bg-canvas)\)\)$/
function groundOf(d) {
  const bg = (d.background ?? d['background-color'] ?? '').trim()
  if (/^var\(--(border-rule|rule)\)$/.test(bg)) return 'grid'
  if (!bg || !PAPER.test(bg)) return null
  if (/surface-inset|paper-3/.test(bg)) return 'inset'
  if (/surface-card|paper-2/.test(bg)) return 'card'
  return 'page'
}
const EDGE_COLOUR = /var\(--(border-rule|border-hairline|rule|rule-soft)\)/
function edgeOf(d) {
  const b = (d.border ?? '').trim()
  if (!b || /^(0|none)\b/.test(b)) return null
  if (/dashed|dotted/.test(b)) return 'dashed'
  if (!/solid/.test(b)) return null
  if (!/(var\(--bw-(hair|rule)\)|\b1px|\b1\.5px)/.test(b)) return null
  if (!EDGE_COLOUR.test(b)) return null
  return /--bw-rule|1\.5px/.test(b) ? 'rule' : 'hair'
}
function radiusOf(d) {
  const v = (d['border-radius'] ?? '').trim()
  if (!v || /\s/.test(v.replace(/\([^)]*\)/g, ''))) return null
  const m = v.match(/^var\(--radius-(sm|md|lg)\)$/)
  if (m) return m[1]
  const px = v.match(/^(\d+(?:\.\d+)?)px$/)
  if (px && +px[1] >= 4 && +px[1] <= 16) return +px[1] >= 10 ? 'md' : 'sm'
  return null
}
const shadowOf = (d) => { const s = d['box-shadow'] ?? ''; return /--shadow-card/.test(s) ? 'card' : /--shadow-raised/.test(s) ? 'raised' : s && s !== 'none' ? 'other' : null }
function frameOf(radius, shadow) {
  const lift = shadow === 'card' || shadow === 'raised'
  if (radius === 'sm') return lift ? 'sheet-sm' : 'ledger'
  return lift ? 'sheet' : 'plain'
}
const isFrameShape = (r, { dashed = false } = {}) => {
  const g = groundOf(r.decls); const e = edgeOf(r.decls); const rad = radiusOf(r.decls)
  if (!g || !rad) return false
  if (dashed) return e === 'dashed'
  if (e && e !== 'dashed') return true
  // a sheet drawn by its shadow alone (no edge) is still a sheet
  return !e && /--shadow-(card|raised)/.test(r.decls['box-shadow'] ?? '') && !/^(0|none)/.test(r.decls.border ?? 'x')
}

// ---------- the head test ----------
const HEAD_NAME = /^(section__title|metricbar|[\w-]+__(head|header|hd|heading|title|kicker|eyebrow|masthead))(--[\w-]+)?$/
const readsBar = (d) => /--bar-fill/.test(d.background ?? d['background-color'] ?? '')
const undressedBand = (d) => /var\(--(navy|header-bar)/.test(d.background ?? d['background-color'] ?? '') && /3px/.test(d['border-bottom'] ?? '')
const capsType = (d) => /uppercase/.test(d['text-transform'] ?? '') || /--font-display/.test(d['font-family'] ?? '')

// ---------- JSX consumers ----------
const jsxFiles = walk('src', /\.(jsx|js)$/).filter((f) => !/\.test\.js$/.test(f))
// Blank JS comments with a tiny scanner that knows about strings. A regex pass
// is not enough: a line comment naming `profiles/*.jsx` opens a "block comment"
// that swallows the rest of the file (it hid LogoShelf.jsx's only className).
function stripJs(t) {
  let out = ''; let i = 0; let q = null
  while (i < t.length) {
    const c = t[i]; const n = t[i + 1]
    if (q) { out += c; if (c === '\\') { out += n ?? ''; i += 2; continue } if (c === q) q = null; i++; continue }
    // A ' or " opens a string only after an operator-ish char; an apostrophe in
    // JSX text ("don't") must not flip the scanner into a string.
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
const jsxText = new Map(jsxFiles.map((f) => [f, stripJs(read(f))]))
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const INTERACTIVE_TAGS = /^(button|a|Link|NavLink|select|input|label|summary|Button|Door|Pill|RouteLink|ExternalLink)$/
const consumerCache = new Map()
function consumersOf(cls) {
  if (consumerCache.has(cls)) return consumerCache.get(cls)
  // right edge: not a word char, and not a single '-' (so `tstats` does not match `tstats-card`), but `--mod` is fine
  const re = new RegExp(`(?<![\\w-])${esc(cls)}(?![\\w]|-(?!-))`, 'g')
  const hits = []
  for (const [f, text] of jsxText) {
    const tags = new Set(); const co = new Set(); let n = 0
    for (const m of text.matchAll(re)) {
      // only a match INSIDE a string literal is a class use: an odd count of
      // " or ' before it on its line, or of ` before it in the file. A bare
      // word (`half`, `stat`, `roster`) in code or JSX text is not a consumer.
      const ls = text.lastIndexOf('\n', m.index) + 1
      const pre = text.slice(ls, m.index)
      const odd = (s, ch) => (s.split(ch).length - 1) % 2 === 1
      if (!(odd(pre, '"') || odd(pre, "'") || odd(text.slice(0, m.index), '`'))) continue
      // …and a string near a class-writing site. `'half'` as a map key is data.
      if (!/className|class(Name)?\s*[=:]|clsx|\bcx\(|\bcls\b|Class\b|classes|\bblock\b|\bns\b|\bBLOCK\b|\bbase\b/.test(text.slice(Math.max(0, m.index - 300), m.index + 40))) continue
      n++
      const before = text.slice(Math.max(0, m.index - 600), m.index)
      const lt = before.lastIndexOf('<')
      const tm = lt >= 0 ? before.slice(lt).match(/^<([A-Za-z][\w.]*)/) : null
      if (tm && !/[>]/.test(before.slice(lt).replace(/=>/g, '').replace(/\{[^{}]*\}/g, ''))) tags.add(tm[1])
      // co-classes written in the same string literal
      const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index))
      const lit = line.match(/className=["'`{]([^"'`}]*)/)
      if (lit) for (const c of lit[1].split(/\s+/)) if (c && c !== cls && /^[a-z][\w-]*$/.test(c) && !/^(is|has)-/.test(c) && !c.startsWith(cls)) co.add(c)
    }
    if (n) hits.push({ file: f.replace(/^src\//, ''), n, tags: [...tags], co: [...co], text })
  }
  consumerCache.set(cls, hits)
  return hits
}

// ---------- guards ----------
const sealGuard = read('scripts/check-seal-scope.mjs')
const stampGuard = read('scripts/check-stamp-surfaces.mjs')
function section(start, close) { const a = stampGuard.indexOf(start); if (a < 0) return ''; const b = stampGuard.indexOf(close, a); return stampGuard.slice(a, b < 0 ? undefined : b) }
const STAMP_ALLOW_TEXT = section('const STAMP_ALLOWLIST = {', '\n}')
const STAMP_FORBID_TEXT = section('const FORBIDDEN_SURFACES = [', '\n]')
const stampAllowed = (f) => STAMP_ALLOW_TEXT.includes(`'${f}'`)
const stampForbidden = (f) => STAMP_FORBID_TEXT.includes(`'${f}'`)
const sealGuarded = (sels) => sels.some((s) => sealGuard.includes(`'${s}'`)) || sealGuard.includes(`'.${hookClass(sels[0])}`)
// Files that render inside a SealBox reveal or gate on revealedThrough: the spoiler scope (CLAUDE.md).
const SEAL_SCOPE_FILES = /(screens\/BoxScore|screens\/InningViewer|screens\/innings\/|components\/inning\/|components\/scoring\/|components\/gamehud\/|screens\/GameSelect|components\/game\/GameCard|SealBox|screens\/TeamInfo|components\/boxscore\/)/

// ---------- overrides ----------
// Two TAB-separated files (one row per census row; # lines are comments):
//   overrides.tsv        key verdict frame head body slice reason   (cards)
//   overrides-heads.tsv  key verdict look slice reason              (heads)
// An empty cell keeps the machine value. A key that matches no row is STALE.
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
const OVERRIDES = readTsv('overrides.tsv', ['verdict', 'frame', 'head', 'body', 'slice', 'reason'])
const HEAD_OVERRIDES = readTsv('overrides-heads.tsv', ['verdict', 'look', 'slice', 'reason'])

// ---------- build the card rows ----------
const topFrames = allRules.filter((r) => !TARGET_FILES.has(r.path) && r.at.length === 0 && baseSelectors(r).length && isFrameShape(r))
const topSel = new Set(topFrames.flatMap((r) => r.selectors))
// A box drawn ONLY inside an @media block (.abscard: display:none on a phone, a
// sheet from 740px) is a card too; one row, flagged with its at-rule.
const mediaOnly = allRules.filter((r) => !TARGET_FILES.has(r.path) && r.at.length && !r.at.some((a) => /@supports|print/.test(a)) && baseSelectors(r).length && isFrameShape(r) && !r.selectors.some((s) => topSel.has(s)))
const frameRules = [...topFrames, ...mediaOnly]
const dashedRules = allRules.filter((r) => r.at.length === 0 && baseSelectors(r).length && isFrameShape(r, { dashed: true }))

const rulesByClass = new Map()
for (const r of allRules) for (const s of r.selectors) for (const c of s.match(/\.([\w-]+)/g) || []) {
  const k = c.slice(1); const a = rulesByClass.get(k) || []; a.push(r); rulesByClass.set(k, a)
}
const HEAD_PART = /__(head|header|hd|heading|title|kicker|eyebrow|masthead|name|label|bar)$/
function headInfo(block, consumers) {
  const parts = [...rulesByClass.keys()].filter((k) => k.startsWith(`${block}__`) && HEAD_PART.test(k.replace(/--.*$/, '')))
  const uniq = [...new Set(parts.map((k) => k.replace(/--.*$/, '')))]
  const sub = [...rulesByClass.keys()].filter((k) => k.startsWith(`${block}__`) && /__(sub|lede|note|kicker|eyebrow)$/.test(k))
  const texts = consumers.map((c) => c.text).join('\n')
  const usesSectionTitle = /<SectionTitle\b/.test(texts)
  const usesMasthead = /<SectionMasthead\b/.test(texts)
  const barRead = uniq.some((p) => (rulesByClass.get(p) || []).some((r) => readsBar(r.decls) || undressedBand(r.decls)))
  return { parts: uniq, second: [...new Set(sub)], usesSectionTitle, usesMasthead, barRead }
}
// Where is the head, at the call site? Look at the 10 lines AFTER the frame's
// className (a head INSIDE the frame) and the 6 lines BEFORE it (a head that
// sits ABOVE the frame, outside it — the player page's SectionTitle-then-table).
const HEAD_JSX = /<SectionMasthead\b|<SectionTitle\b|<SectionHead\b|metricbar|section__title|className=["'`{][^"'`]*__(head|header|hd|heading|title|masthead)\b|<h[1-4]\b/
function headProbe(hook, consumers, barRead) {
  const found = { inside: null, outside: null }
  const re = new RegExp(`(?<![\\w-])${esc(hook)}(?![\\w]|-(?!-))`)
  for (const c of consumers) {
    const lines = c.text.split('\n')
    lines.forEach((ln, i) => {
      if (!re.test(ln) || !/className|cls|class/.test(ln)) return
      const after = lines.slice(i + 1, i + 11).join('\n')
      const before = lines.slice(Math.max(0, i - 6), i).join('\n')
      const kind = (s) => /<SectionMasthead\b|metricbar/.test(s) ? 'band' : /--bar\b|section__title--bar/.test(s) ? 'band' : HEAD_JSX.test(s) ? 'label' : null
      found.inside = found.inside || kind(after)
      found.outside = found.outside || kind(before)
    })
  }
  if (found.inside) return found.inside === 'label' && barRead ? 'band' : found.inside
  if (found.outside) return `outside:${found.outside}`
  return 'none'
}
function bodyOf(r, consumers) {
  const p = r.decls.padding ?? r.decls['padding-block'] ?? r.decls['padding-inline'] ?? null
  const zero = p == null || /^0(px)?( 0(px)?)*$/.test(p)
  const texts = consumers.map((c) => c.text).join('\n')
  const hasList = /<(table|ul|ol)\b/.test(texts)
  if (!zero) return { body: 'padded', padding: p }
  if (/hidden/.test(r.decls.overflow ?? '') || hasList) return { body: 'flush', padding: p }
  return { body: 'flush?', padding: p }
}

const cardRows = frameRules.map((r) => {
  const base = baseSelectors(r)
  const hook = hookClass(base[0])
  const block = blockOf(hook)
  const consumers = hook ? consumersOf(hook) : []
  const tags = [...new Set(consumers.flatMap((c) => c.tags))]
  const co = [...new Set(consumers.flatMap((c) => c.co))]
  const radius = radiusOf(r.decls); const shadow = shadowOf(r.decls); const ground = groundOf(r.decls)
  const d = r.decls
  const head = headInfo(block, consumers)
  const bd = bodyOf(r, consumers)
  const el = subjectElement(base[0]) || tags.join('/') || null
  const interactive = (el && INTERACTIVE_TAGS.test(el.split('/')[0])) || tags.some((t) => INTERACTIVE_TAGS.test(t)) || /pointer/.test(d.cursor ?? '')
  const isElement = /__/.test(hook)
  const row = {
    selector: base.join(', '), file: r.file, line: r.line, hook, block, isElement, element: el,
    consumers: consumers.map((c) => c.file), coClasses: co,
    frame: frameOf(radius, shadow), ground, radius, shadow, edge: edgeOf(d),
    edgeColour: ((d.border ?? '').match(EDGE_COLOUR) || [])[1] ?? null, at: r.at.join(' ') || null,
    head: headProbe(hook, consumers, head.barRead), headParts: head.parts, secondLines: head.second, usesSectionTitle: head.usesSectionTitle, usesMasthead: head.usesMasthead,
    body: bd.body, padding: bd.padding, overflow: d.overflow ?? null, display: d.display ?? null,
    fontSize: d['font-size'] ?? null, interactive, position: d.position ?? null,
    extra: Object.keys(d).filter((k) => !['background', 'background-color', 'border', 'border-radius', 'box-shadow'].includes(k)),
    decls: d,
    sealGuarded: sealGuarded(base),
    stampSurface: consumers.filter((c) => stampAllowed(c.file)).map((c) => c.file),
    stampForbidden: consumers.filter((c) => stampForbidden(c.file)).map((c) => c.file),
    sealScope: consumers.filter((c) => SEAL_SCOPE_FILES.test(c.file)).map((c) => c.file),
    nameSaysCard: /card/.test(base.join(' ')),
  }
  // heuristic verdict
  let v = 'card'; let why = ''
  if (!consumers.length) { v = 'delete'; why = 'no JSX consumer found' }
  else if (row.interactive && row.fontSize) { v = 'not-card'; why = 'a control (interactive + own font-size)' }
  else if (row.ground === 'inset') { v = 'not-card'; why = 'inset ground: a well inside a card' }
  else if (row.isElement) { v = 'not-card'; why = 'an element of another block (a panel inside a card)' }
  const o = OVERRIDES[row.selector] || OVERRIDES[`${row.file}:${row.selector}`] || {}
  return { ...row, verdict: v, reason: why, heuristicVerdict: v, heuristicFrame: row.frame, heuristicHead: row.head, heuristicBody: row.body, ...o, reviewed: !!(o.verdict) }
})

// ---------- build the head rows ----------
const headRules = allRules.filter((r) => {
  if (TARGET_FILES.has(r.path) || r.at.length) return false
  const base = baseSelectors(r)
  if (!base.length) return false
  if (readsBar(r.decls) || undressedBand(r.decls)) return true
  const cls = subjectClasses(base[0]).filter((c) => !/^(is|has)-/.test(c))
  return cls.some((c) => HEAD_NAME.test(c)) && capsType(r.decls)
})
function pseudoRuleFor(sel) {
  const rs = allRules.filter((x) => x.selectors.some((s) => s === `${sel}::after` || s === `${sel}::before` || s === `${sel}:after` || s === `${sel}:before`))
  return rs.some((x) => (/1|2/.test(x.decls.flex ?? '') || /100%|auto/.test(x.decls.width ?? '') || x.decls['flex-grow']) && (/--(border|rule)/.test(x.decls['border-top'] ?? x.decls['border-bottom'] ?? x.decls.background ?? '') || /^(1|2)px|--bw-/.test(x.decls.height ?? '')))
}
const headRows = headRules.map((r) => {
  const base = baseSelectors(r)
  const hook = hookClass(base[0])
  const d = r.decls
  const consumers = hook ? consumersOf(hook) : []
  let look
  const fs = d['font-size'] ?? ''
  const bb = d['border-bottom'] ?? ''
  if (readsBar(d) || undressedBand(d)) look = 'band'
  else if (/__(kicker|eyebrow)(--|$)/.test(hook)) look = 'kicker'
  else if (base.some(pseudoRuleFor)) look = 'rule'
  else if (/--fs-(h[1-3]|display|title|num-xl)/.test(fs)) look = 'title'
  else if (bb && !/^(0|none)/.test(bb) && /--(border|rule)/.test(bb)) look = 'label'
  else if (groundOf(d)) look = 'inset'
  else look = 'plain'
  const o = HEAD_OVERRIDES[`${r.file}:${base.join(', ')}`] || HEAD_OVERRIDES[base.join(', ')] || {}
  let v = { band: 'band', label: 'label', rule: 'rule', kicker: 'retire', title: 'title-keep', inset: 'label?', plain: 'label?' }[look]
  let why = ''
  if (!consumers.length) { v = 'delete'; why = 'no JSX consumer found' }
  return {
    selector: base.join(', '), file: r.file, line: r.line, hook, block: blockOf(hook),
    consumers: consumers.map((c) => c.file), look, fontSize: fs || null, fontFamily: d['font-family'] ?? null,
    borderBottom: bb || null, background: d.background ?? null, padding: d.padding ?? null, margin: d.margin ?? null,
    verdict: v, reason: why, heuristicLook: look, decls: d,
    sealScope: consumers.filter((c) => SEAL_SCOPE_FILES.test(c.file)).map((c) => c.file),
    sealGuarded: sealGuarded(base),
    ...o, reviewed: !!o.verdict,
  }
})

// ---------- second lines (the NOTE tally) ----------
const noteRules = allRules.filter((r) => r.at.length === 0 && baseSelectors(r).some((s) => subjectClasses(s).some((c) => /__(sub|lede|kicker|eyebrow)$/.test(c))))
const noteClasses = [...new Set(noteRules.flatMap((r) => baseSelectors(r).flatMap(subjectClasses)).filter((c) => /__(sub|lede|kicker|eyebrow)$/.test(c)))]

// ---------- variants ----------
if (VARIANTS) {
  const v = {}
  v['A. DEFINITION: card frame rules (top level, base, own ground+edge+radius)'] = cardRows.length
  v['B. + @media/@supports copies'] = allRules.filter((r) => baseSelectors(r).length && isFrameShape(r)).length
  v['C. dashed-edge boxes (reported apart: finding 7)'] = dashedRules.length
  v['D. ground+radius+shadow, NO edge (shadow-only sheets)'] = allRules.filter((r) => !r.at.length && baseSelectors(r).length && groundOf(r.decls) && radiusOf(r.decls) && !edgeOf(r.decls) && /--shadow-(card|raised)/.test(r.decls['box-shadow'] ?? '')).length
  v['E. ground+edge, radius --radius-xs (tags / cells, excluded)'] = allRules.filter((r) => !r.at.length && baseSelectors(r).length && groundOf(r.decls) && edgeOf(r.decls) && /radius-xs|^3px$/.test(r.decls['border-radius'] ?? '')).length
  v['F. edge+radius on a non-paper ground (navy, tints, seal)'] = allRules.filter((r) => !r.at.length && baseSelectors(r).length && !groundOf(r.decls) && (r.decls.background || r.decls['background-color']) && edgeOf(r.decls) && radiusOf(r.decls)).length
  v['G. the old name census: blocks whose NAME ends card'] = new Set(allRules.flatMap((r) => r.selectors.flatMap((s) => [...s.matchAll(/\.([a-z0-9-]*card)(?![a-z0-9-])/g)].map((m) => m[1])))).size
  v['H. head rules (band + named caps heads)'] = headRows.length
  v['I. second-line classes (__sub/__lede/__kicker/__eyebrow)'] = noteClasses.length
  for (const [k, n] of Object.entries(v)) console.log(`${String(n).padStart(4)}  ${k}`)
  process.exit(0)
}

// ---------- output ----------
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|')
const tally = (rows, f) => { const m = {}; for (const r of rows) { const k = f(r); m[k] = (m[k] || 0) + 1 } return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') }

if (DUMP) {
  for (const r of cardRows) console.log(`CARD ${r.frame.padEnd(8)} ${String(r.ground).padEnd(5)} ${r.verdict.padEnd(8)} ${`${r.file}:${r.line}`.padEnd(40)} ${r.selector.slice(0, 60).padEnd(60)} el=${r.element} head=${r.head} body=${r.body} fs=${r.fontSize ?? '-'} co=${r.coClasses.slice(0, 4).join(',')} n=${r.consumers.length} ${r.consumers.slice(0, 3).join(' ')}`)
  for (const r of headRows) console.log(`HEAD ${r.look.padEnd(7)} ${`${r.file}:${r.line}`.padEnd(40)} ${r.selector.slice(0, 70).padEnd(70)} fs=${r.fontSize ?? '-'} bb=${(r.borderBottom ?? '-').slice(0, 30)} n=${r.consumers.length} ${r.consumers.slice(0, 2).join(' ')}`)
  console.log(`\n${cardRows.length} card rows · ${headRows.length} head rows · ${dashedRules.length} dashed boxes · ${noteClasses.length} second-line classes`)
  process.exit(0)
}

const staleKeys = [
  ...Object.keys(OVERRIDES).filter((k) => !cardRows.some((r) => r.selector === k || `${r.file}:${r.selector}` === k)),
  ...Object.keys(HEAD_OVERRIDES).filter((k) => !headRows.some((r) => r.selector === k || `${r.file}:${r.selector}` === k)).map((k) => `head:${k}`),
]

// One row per line: diffable, and a fifth the size of a pretty-printed dump.
{
  const J = (v) => JSON.stringify(v)
  const rows = (a) => `[\n${a.map((r) => `    ${J(r)}`).join(',\n')}\n  ]`
  const out = [
    '{',
    `  "generated": ${J(new Date().toISOString().slice(0, 10))},`,
    `  "rev": ${J(sh('git rev-parse --short HEAD').trim() + ' (working tree)')},`,
    '  "definition": "see census.mjs header",',
    `  "cards": ${rows(cardRows)},`,
    `  "heads": ${rows(headRows)},`,
    `  "dashed": ${rows(dashedRules.map((r) => ({ selector: r.selector, file: r.file, line: r.line })))},`,
    `  "secondLines": ${J(noteClasses)},`,
    `  "stale": ${J(staleKeys)}`,
    '}',
  ]
  writeFileSync(join(HERE, 'census.json'), out.join('\n') + '\n')
}

console.log(`${cardRows.length} card-frame rules; ${cardRows.filter((r) => r.nameSaysCard).length} say "card".`)
console.log(`card verdict: ${tally(cardRows, (r) => r.verdict)}`)
console.log(`card frame: ${tally(cardRows, (r) => r.frame)}`)
console.log(`card frame x verdict: ${tally(cardRows, (r) => `${r.frame}/${r.verdict}`)}`)
console.log(`card ground: ${tally(cardRows, (r) => r.ground)}`)
console.log(`head rows: ${headRows.length}; look: ${tally(headRows, (r) => r.look)}; verdict: ${tally(headRows, (r) => r.verdict)}`)
console.log(`dashed boxes: ${dashedRules.length}; second-line classes: ${noteClasses.length}`)
console.log(`unreviewed card rows: ${cardRows.filter((r) => !r.reviewed).length}; unreviewed head rows: ${headRows.filter((r) => !r.reviewed).length}`)
if (staleKeys.length) console.log(`STALE overrides: ${staleKeys.join(' | ')}`)

// ---------- census.md (generated; do not hand-edit) ----------
const CARD_SLICES = {
  C1: 'Team hub', C2: 'Player page', C3: 'Pre-game (TeamInfo)', C4: 'Innings viewer + game HUD (SEAL SCOPE)',
  C5: 'Box score (inside the reveal render)', C6a: 'Postseason + All-Star', C6b: 'People, records, reference pages', C6c: 'Fouls, offseason, slate off-day tile', C7: 'Account, logbook, chrome', C8: 'Labs + admin (only if Gary says yes)',
}
const HEAD_SLICES = { H1: 'Band', H2: 'Label (+ rule)', H3: 'Notes (ledger renames)' }
const NOT_CARD_ORDER = ['bespoke', 'hold', 'table', 'modal', 'panel', 'well', 'notice', 'control', 'field', 'media', 'not-card', 'lab', 'delete']
const NOT_CARD_WHY = {
  bespoke: 'Bespoke — keeps its own box', hold: 'Hold — stamp surfaces (ADR-0035)', table: 'Table — belongs to #1132, not Card',
  modal: 'Modal — sheets and dialogs stay bespoke (ADR-0037)', panel: 'Panel — a box INSIDE a card (nested frame)', well: 'Well — an inset box inside a card',
  notice: 'Notice — the #1132 Notice family', control: 'Control — a boxed button (Button/Door, #1130)', field: 'Field — a form input',
  media: 'Media — a frame for a logo, photo or image', 'not-card': 'Not a card — tags, strips, mock parts', lab: 'Lab / admin page — no Card unless Gary says yes (decisions.md)', delete: 'Dead CSS — no consumer',
}
function flags(r) {
  const f = []
  if (r.at) f.push('@media only')
  if (r.sealScope?.length) f.push('SEAL')
  if (r.stampSurface?.length) f.push('STAMP-ALLOW')
  if (r.stampForbidden?.length) f.push('STAMP-FORBID')
  if (r.sealGuarded) f.push('seal-guard')
  return f.join(' ')
}
const cons = (r) => { const c = r.consumers || []; return c.length ? `${c.slice(0, 3).map((x) => x.replace(/^(components|screens)\//, '')).join('<br>')}${c.length > 3 ? `<br>+${c.length - 3}` : ''}` : '(none)' }
function renderMd() {
  const L = []
  const cards = cardRows.filter((r) => r.verdict === 'card')
  L.push('# Card + SectionHead census (#1113)', '')
  L.push(`Generated by \`census.mjs\` on ${new Date().toISOString().slice(0, 10)} from the working tree at ${sh('git rev-parse --short HEAD').trim()}. **Do not hand-edit.** Change \`overrides.tsv\` / \`overrides-heads.tsv\` and re-run \`node .scratch/design-system/card-collapse/census.mjs\`.`, '')
  L.push('The definitions are in the header of `census.mjs`. In short: a **card frame** is one CSS rule that draws a paper ground, a solid rule-coloured edge on four sides and a box radius (`--radius-sm/md/lg`), matched on SHAPE, never on the word "card". A **head** is a rule that paints the club band, or a caps rule on a head-named element.', '')
  L.push('## Headline', '')
  L.push(`- **${cardRows.length} card-shaped rules** (the name census counted 31 blocks named card; ${cardRows.filter((r) => r.nameSaysCard).length} of these rules carry the word).`)
  L.push(`- **${cards.length} are cards** that go onto \`Card\`. The other ${cardRows.length - cards.length}: ${NOT_CARD_ORDER.map((v) => `${v} ${cardRows.filter((r) => r.verdict === v).length}`).filter((s) => !/ 0$/.test(s)).join(' · ')}.`)
  L.push(`- Drawn frame of the ${cards.length} cards: ${tally(cards, (r) => r.heuristicFrame)}. **Target frame** (the radius decides): ${tally(cards, (r) => r.frame)}.`)
  L.push(`- Head of the ${cards.length} cards: ${tally(cards, (r) => r.head)}.`)
  L.push(`- Body of the ${cards.length} cards: ${tally(cards, (r) => r.body)}.`)
  L.push(`- Ground of the ${cards.length} cards: ${tally(cards, (r) => r.ground)} (page = \`--paper-1\` or \`--bg-page\`; grid = the 1px-gap rule trick on \`--border-rule\`).`)
  L.push(`- Cards by slice: ${Object.keys(CARD_SLICES).map((s) => `${s} ${cards.filter((r) => r.slice === s).length}`).join(' · ')}.`)
  L.push(`- Cards with a spoiler-scope consumer (innings viewer, box score reveal, TeamInfo, slate): **${cards.filter((r) => r.sealScope.length).length}**. Each is a box move only; none changes what is revealed.`)
  L.push(`- **${headRows.length} head rules**: ${tally(headRows, (r) => r.verdict)}. Of the band rules, ${headRows.filter((r) => r.sealGuarded && r.verdict === 'band').length} sit on a block check-seal-scope names.`)
  L.push(`- Reported apart: ${dashedRules.length} dashed-edge boxes (finding 7: empty / door / pencilled-in, not cards) and ${noteClasses.length} second-line classes (\`__sub\`, \`__lede\`, \`__kicker\`, \`__eyebrow\`).`)
  if (staleKeys.length) L.push(`- **STALE overrides**: ${staleKeys.join(' | ')}`)
  const unrev = cardRows.filter((r) => !r.reviewed).length + headRows.filter((r) => !r.reviewed).length
  if (unrev) L.push(`- **UNREVIEWED rows: ${unrev}**`)
  L.push('')
  L.push("Column key: **drawn** = frame/ground as the CSS draws it today (`sheet` md+shadow · `plain` md, no shadow · `ledger` sm, no shadow · `sheet-sm` sm+shadow). **→ frame** = the Card frame it lands on. **head** = inside the card (`label`, `band`, `none`) or `outside:` it (a head above the frame). **flags**: `SEAL` a spoiler-scope consumer · `STAMP-ALLOW` a consumer is on check-stamp-surfaces' STAMP_ALLOWLIST · `seal-guard` check-seal-scope names a selector of this block · `@media only` boxed only at a breakpoint.", '')
  L.push('Consumers are matched as a class inside a string literal near a class-writing site. For short common words (`half`, `stat`) the count is noisy; the reason column names the real call site.', '')
  const cardTable = (rs) => {
    L.push('| selector | file:line | consumers | drawn | → frame | head | body | flags | reason |')
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const r of rs) L.push(`| \`${cell(r.selector)}\` | ${r.file}:${r.line} | ${cell(cons(r))} | ${r.heuristicFrame}/${r.ground} | **${r.frame}** | ${r.head} | ${r.body} | ${flags(r)} | ${cell(r.reason)} |`)
    L.push('')
  }
  L.push('## Part 1 — cards, by slice', '')
  for (const [s, name] of Object.entries(CARD_SLICES)) {
    const rs = cards.filter((r) => r.slice === s)
    if (!rs.length) continue
    L.push(`### ${s}: ${name} (${rs.length})`, '')
    cardTable(rs)
  }
  L.push('## Part 2 — card-shaped, but not a card', '')
  for (const v of NOT_CARD_ORDER) {
    const rs = cardRows.filter((r) => r.verdict === v)
    if (!rs.length) continue
    L.push(`### ${NOT_CARD_WHY[v]} (${rs.length})`, '')
    L.push('| selector | file:line | consumers | drawn | flags | reason |')
    L.push('| --- | --- | --- | --- | --- | --- |')
    for (const r of rs) L.push(`| \`${cell(r.selector)}\` | ${r.file}:${r.line} | ${cell(cons(r))} | ${r.heuristicFrame}/${r.ground} | ${flags(r)} | ${cell(r.reason)} |`)
    L.push('')
  }
  L.push('## Part 3 — section heads', '')
  L.push('Look column: what the rule draws today (`band`, `label` = caps + hairline, `rule`, `kicker` = a line over the title, `title` = heading-size, `plain` = caps, no rule). Verdict: what it becomes.', '')
  const headTable = (rs) => {
    L.push('| selector | file:line | consumers | look today | → verdict | font-size | flags | reason |')
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const r of rs) L.push(`| \`${cell(r.selector)}\` | ${r.file}:${r.line} | ${cell(cons(r))} | ${r.heuristicLook} | **${r.verdict}** | ${cell(r.fontSize ?? '—')} | ${flags(r)} | ${cell(r.reason)} |`)
    L.push('')
  }
  for (const [s, name] of Object.entries(HEAD_SLICES)) {
    const rs = headRows.filter((r) => r.slice === s)
    L.push(`### ${s}: ${name} (${rs.length})`, '')
    headTable(rs)
  }
  const rest = headRows.filter((r) => !HEAD_SLICES[r.slice])
  L.push(`### Not a section head (${rest.length})`, '')
  headTable(rest)
  L.push('## Part 4 — reported apart', '')
  L.push(`**Dashed-edge boxes (${dashedRules.length}).** Finding 7: dashed means provisional, empty or door — never a card. Listed so the next census does not find them again: ${dashedRules.map((r) => `\`${r.selector}\` (${r.file}:${r.line})`).join(', ')}.`, '')
  L.push(`**Second-line classes (${noteClasses.length}).** The head's second line, which ADR-0084 renames \`__note\` (the ledger carries each): ${noteClasses.map((c) => `\`.${c}\``).join(', ')}.`, '')
  return L.join('\n')
}
writeFileSync(join(HERE, 'census.md'), renderMd() + '\n')
