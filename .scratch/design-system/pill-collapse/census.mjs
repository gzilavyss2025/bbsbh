#!/usr/bin/env node
// Pill census, by SHAPE not by name (#1131). Re-runnable.
//
//   node .scratch/design-system/pill-collapse/census.mjs            # working tree
//   node .scratch/design-system/pill-collapse/census.mjs --rev db3d0b972
//   node .scratch/design-system/pill-collapse/census.mjs --variants # the reconciliation table
//
// Writes census.json beside this file (working-tree run only) and prints a table.
//
// ---------------------------------------------------------------------------
// THE DEFINITION. A "pill base rule" is one postcss Rule node such that:
//
//  1. It lives in src/styles/**/*.css or src/tokens/*.css. (tokens hold no
//     rules with a radius today; they are walked so a future one is not missed.)
//     EXCEPT src/styles/system/pill.css: that is the canonical Pill the sweep
//     converges on, not a capsule still to be swept. Its rules print separately
//     as TARGET, so the census count keeps meaning "left to sweep".
//  2. It is NOT inside an at-rule (@media, @supports, @container ...). An
//     at-rule copy restates a rule for a viewport or a capability; it is an
//     override of a pill, not another pill. (--variants reports them.)
//  3. Its OWN declarations include BOTH
//       a. a pill radius: `border-radius` whose every component is
//          var(--radius-pill) (999px, src/tokens/spacing.css:46), a literal
//          >= 99px (999px, 9999px, 100px), or >= 50vh/50vw/50em-style halves.
//          50% is a CIRCLE, not a capsule, and is excluded. Corner-by-corner
//          shorthands (`999px 999px 0 0`) are excluded: that is a half-capsule.
//       b. a `font-size` declaration.
//     Radius and font-size in two different rules for the same selector do
//     NOT count: the definition is a rule that draws the whole object.
//  4. At least one selector in its list is a BASE selector. A selector is a
//     STATE selector when its SUBJECT (the last compound, after the last
//     combinator; :not(...) and :where(...)/:is(...) arguments ignored) carries
//       - a pseudo-class :hover :focus :focus-visible :focus-within :active
//         :disabled :checked :visited :target :open, or
//       - an attribute [aria-pressed] [aria-current] [aria-selected]
//         [aria-expanded] [aria-checked] [disabled] [data-state] [open], or
//       - a class .is-* / .has-*, or a BEM modifier ending --active --on
//         --off --selected --current --open --pressed --checked --live-on.
//     Ancestor compounds are context, not state (`.team-hub.is-themed .x` is a
//     base rule for .x). A selector whose subject is a pseudo-ELEMENT
//     (::before/::after) is excluded: it draws decoration, not the object.
//  5. One rule = one count, even if its selector list names several classes.
//
// The fill / role / verdict columns are heuristics plus the hand-checked
// overrides.json beside this file (a key that matches no row prints STALE); census.json keeps the raw declarations so a reader
// can re-derive any of them.
// ---------------------------------------------------------------------------

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const args = process.argv.slice(2)
const REV = args.includes('--rev') ? args[args.indexOf('--rev') + 1] : null
const VARIANTS = args.includes('--variants')
const QUIET = args.includes('--quiet')

const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })

// ---------- file access (working tree or a git rev) ----------
function walk(dir) {
  const out = []
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel))
    else out.push(rel)
  }
  return out
}
function listFiles(prefixes, ext) {
  if (REV) {
    return sh(`git ls-tree -r --name-only ${REV} -- ${prefixes.join(' ')}`)
      .split('\n').filter((f) => f && ext.test(f))
  }
  return prefixes.flatMap((p) => walk(p)).filter((f) => ext.test(f))
}
// At a rev, read every blob through ONE `git cat-file --batch` (a `git show`
// per JSX file takes minutes on Windows).
const REV_CACHE = new Map()
function prefetch(files) {
  if (!REV) return
  const want = files.filter((f) => !REV_CACHE.has(f))
  if (!want.length) return
  const buf = execSync('git cat-file --batch', {
    cwd: ROOT, input: want.map((f) => `${REV}:${f}`).join('\n') + '\n', maxBuffer: 1 << 30,
  })
  let i = 0
  for (const f of want) {
    const nl = buf.indexOf(10, i)
    const head = buf.subarray(i, nl).toString()
    if (/ missing$/.test(head)) { REV_CACHE.set(f, ''); i = nl + 1; continue }
    const size = +head.split(' ')[2]
    REV_CACHE.set(f, buf.subarray(nl + 1, nl + 1 + size).toString('utf8'))
    i = nl + 1 + size + 1
  }
}
function readFile(f) {
  if (!REV) return readFileSync(join(ROOT, f), 'utf8')
  prefetch([f])
  return REV_CACHE.get(f)
}

// ---------- the shape test ----------
const PILL_TOKEN = /^var\(--radius-pill\)$/
function radiusKind(value) {
  const v = value.replace(/!important/, '').trim()
  const parts = v.split(/\s+(?![^(]*\))/)
  const one = (p) => {
    if (PILL_TOKEN.test(p)) return 'pill'
    let m = p.match(/^(\d+(?:\.\d+)?)px$/)
    if (m) return +m[1] >= 99 ? 'pill' : 'no'
    m = p.match(/^(\d+(?:\.\d+)?)(vh|vw|vmin|vmax|em|rem)$/)
    if (m) return +m[1] >= 50 ? 'pill' : 'no'
    if (p === '50%') return 'circle'
    return 'no'
  }
  const kinds = parts.map(one)
  if (kinds.every((k) => k === 'pill')) return parts.length === 1 ? 'pill' : 'pill'
  if (kinds.every((k) => k === 'circle')) return 'circle'
  if (kinds.some((k) => k === 'pill')) return 'partial'
  return 'no'
}

const STATE_PSEUDO = /:(hover|focus|focus-visible|focus-within|active|disabled|checked|visited|target|open)\b/
const STATE_ATTR = /\[(aria-pressed|aria-current|aria-selected|aria-expanded|aria-checked|disabled|data-state|open)\b/
const STATE_CLASS = /\.(is|has)-[\w-]+/
const STATE_MOD = /--(active|on|off|selected|current|open|pressed|checked|live-on)(?![\w-])/

function subjectOf(sel) {
  // strip functional pseudo arguments first so their combinators do not split
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
function subjectClasses(sel) {
  return [...subjectOf(sel).matchAll(/\.([\w-]+)/g)].map((m) => m[1])
}
// The class a consumer greps for: the subject's first class, or — when the
// subject is a bare element (`.x__filters button`) — the nearest class to its left.
function hookClass(sel) {
  const own = subjectClasses(sel)
  if (own.length) return own[0]
  const all = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1])
  return all.at(-1) || ''
}
const subjectElement = (sel) => (subjectOf(sel).match(/^([a-z][\w-]*)/) || [])[1] || null
function atChain(node) {
  const out = []
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') out.unshift(`@${p.name} ${p.params}`)
  }
  return out
}

// ---------- collect ----------
const TARGET_FILE = 'src/styles/system/pill.css'
const cssFiles = listFiles(['src/styles', 'src/tokens'], /\.css$/)
prefetch(cssFiles)
const allRules = [] // every rule, for state lookups + variants
const ALL_RULES = allRules
for (const f of cssFiles) {
  const root = postcss.parse(readFile(f), { from: f })
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    const decls = {}
    rule.each((n) => { if (n.type === 'decl') decls[n.prop] = n.value })
    const sels = rule.selectors.map((s) => s.replace(/\s+/g, ' ').trim())
    allRules.push({
      file: f.replace(/^src\/styles\//, ''), path: f, line: rule.source.start.line,
      selector: sels.join(', '), selectors: sels, decls, at: atChain(rule),
      radius: decls['border-radius'] ? radiusKind(decls['border-radius']) : null,
    })
  })
}

const isPillShape = (r) => r.radius === 'pill' && 'font-size' in r.decls
function baseSelectors(r) { return r.selectors.filter((s) => selectorKind(s) === 'base') }

const isCensus = (r) => isPillShape(r) && r.at.length === 0 && baseSelectors(r).length > 0
const census = allRules.filter((r) => isCensus(r) && r.path !== TARGET_FILE)
const target = allRules.filter((r) => r.path === TARGET_FILE && r.radius === 'pill')

// ---------- reconciliation variants ----------
function variants() {
  const allRules = ALL_RULES.filter((r) => r.path !== TARGET_FILE)
  const shape = allRules.filter(isPillShape)
  const v = {}
  v['A. DEFINITION (top level, base, same rule)'] = census.length
  v['B. + at-rule copies (@media/@supports) of base selectors'] =
    shape.filter((r) => baseSelectors(r).length > 0).length
  v['C. + state rules (any selector)'] = shape.filter((r) => r.at.length === 0).length
  v['D. + pseudo-element subjects'] = shape.filter((r) => r.at.length === 0 &&
    r.selectors.some((s) => selectorKind(s) !== 'state')).length
  v['E. + 50% circles w/ font-size (top level, base)'] = census.length +
    allRules.filter((r) => r.radius === 'circle' && 'font-size' in r.decls && r.at.length === 0 && baseSelectors(r).length).length
  // radius in one rule, font-size in another rule for the SAME base selector (top level)
  const bySel = new Map()
  for (const r of allRules) {
    if (r.at.length) continue
    for (const s of baseSelectors(r)) {
      const k = `${r.file}|${s}`
      const e = bySel.get(k) || { radius: false, fs: false }
      if (r.radius === 'pill') e.radius = true
      if ('font-size' in r.decls) e.fs = true
      bySel.set(k, e)
    }
  }
  const split = [...bySel.values()].filter((e) => e.radius && e.fs).length
  v['F. per base SELECTOR, radius+font-size merged across rules in a file'] = split
  v['G. per base SELECTOR, same rule only (selector lists expanded)'] =
    census.reduce((n, r) => n + baseSelectors(r).length, 0)
  v['H. pill radius, no own font-size (top level, base)'] =
    allRules.filter((r) => r.radius === 'pill' && !('font-size' in r.decls) && r.at.length === 0 && baseSelectors(r).length).length
  return v
}

if (VARIANTS) {
  console.log(`rev: ${REV || 'working tree'}`)
  for (const [k, n] of Object.entries(variants())) console.log(`${String(n).padStart(4)}  ${k}`)
  if (args.includes('--list')) for (const r of census) console.log(`${r.file}:${r.line}  ${r.selector}`)
  process.exit(0)
}

// ---------- consumers ----------
const jsxFiles = listFiles(['src'], /\.(jsx|js)$/).filter((f) => !/\.test\.js$/.test(f))
prefetch(jsxFiles)
const jsxText = new Map(jsxFiles.map((f) => [f, readFile(f)]))
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const INTERACTIVE_TAGS = /^(button|a|Link|NavLink|select|input|label|summary|Button|Door|RouteLink|ExternalLink)$/

function consumersOf(cls) {
  const re = new RegExp(`(?<![\\w-])${esc(cls)}(?![\\w])`, 'g')
  const hits = []
  for (const [f, text] of jsxText) {
    if (!/\.jsx$/.test(f) && !/className|class:|cls|Class/.test(text)) continue
    const tags = new Set()
    let n = 0
    for (const m of text.matchAll(re)) {
      // skip a prefix match like `rankchip--x` only when the token continues with `--`? keep: modifier use implies base use
      n++
      const before = text.slice(Math.max(0, m.index - 600), m.index)
      const lt = before.lastIndexOf('<')
      const tm = lt >= 0 ? before.slice(lt).match(/^<([A-Za-z][\w.]*)/) : null
      if (tm && !/[>]/.test(before.slice(lt).replace(/=>/g, '').replace(/\{[^{}]*\}/g, ''))) tags.add(tm[1])
    }
    if (n) hits.push({ file: f.replace(/^src\//, ''), n, tags: [...tags] })
  }
  return hits
}

// ---------- state rules per class ----------
const stateBySubject = new Map()
for (const r of allRules) {
  for (const s of r.selectors) {
    if (selectorKind(s) !== 'state') continue
    const subj = subjectOf(s)
    const kinds = []
    if (/:hover/.test(subj)) kinds.push('hover')
    if (/:focus/.test(subj)) kinds.push('focus')
    if (/:active/.test(subj)) kinds.push('active')
    if (/aria-pressed/.test(subj)) kinds.push('aria-pressed')
    if (/aria-current/.test(subj)) kinds.push('aria-current')
    if (/aria-selected/.test(subj)) kinds.push('aria-selected')
    if (/:disabled|\[disabled/.test(subj)) kinds.push('disabled')
    if (STATE_CLASS.test(subj) || STATE_MOD.test(subj)) kinds.push('class-state')
    for (const c of subjectClasses(s)) {
      const set = stateBySubject.get(c) || new Set()
      kinds.forEach((k) => set.add(k))
      stateBySubject.set(c, set)
    }
  }
}

// ---------- fill ----------
const PAGEISH = /^(transparent|none|inherit|initial|unset|var\(--bg-page\)|var\(--surface-card\)|var\(--paper\))$/
function fillOf(d) {
  const bg = (d.background ?? d['background-color'] ?? '').trim()
  const border = (d.border ?? d['border-color'] ?? '').trim()
  const color = (d.color ?? '').trim()
  const all = `${bg} ${border} ${color}`
  const hasBorder = border && !/^(0|none)\b/.test(border)
  if (/--seal/.test(all)) return 'seal'
  if (/--marker/.test(bg)) return 'other:marker'
  if (/--text-on-ink|--paper-ink-on|--on-ink/.test(color) || /--navy|--accent-primary|--ink\b|--text-strong|--graphite/.test(bg)) return 'ink'
  if (!bg || PAGEISH.test(bg)) return hasBorder ? 'outline' : (bg ? 'bare' : 'bare')
  if (/--surface|--bg-|--paper|--manila|--card|color-mix/.test(bg)) return 'paper'
  return `other:${bg}`
}

// ---------- guards ----------
const sealGuard = readFile('scripts/check-seal-scope.mjs')
const stampGuard = readFile('scripts/check-stamp-surfaces.mjs')
// check-stamp-surfaces keeps two lists, paths relative to src/: STAMP_ALLOWLIST
// (files that render stamp art) and FORBIDDEN_SURFACES (files that list games
// the user has NOT revealed and may never name a stamp). Read each literal alone.
function section(start, close) {
  const a = stampGuard.indexOf(start)
  if (a < 0) return ''
  const b = stampGuard.indexOf(close, a)
  return stampGuard.slice(a, b < 0 ? undefined : b)
}
const STAMP_ALLOW_TEXT = section('const STAMP_ALLOWLIST = {', '\n}')
const STAMP_FORBID_TEXT = section('const FORBIDDEN_SURFACES = [', '\n]')
const stampAllowed = (f) => STAMP_ALLOW_TEXT.includes(`'${f}'`)
const stampForbidden = (f) => STAMP_FORBID_TEXT.includes(`'${f}'`)
const sealGuarded = (r) => r.selectors.some((s) => sealGuard.includes(`'${s}'`))

// ---------- hand-checked overrides ----------
// selector (first base selector) -> { verdict, slice, reason, role, fill }
const OVERRIDES = JSON.parse(readFileSync(join(HERE, 'overrides.json'), 'utf8'))

const rows = census.map((r) => {
  const base = baseSelectors(r)
  const block = hookClass(base[0])
  const element = subjectElement(base[0])
  const consumers = block ? consumersOf(block) : []
  const tags = [...new Set(consumers.flatMap((c) => c.tags))]
  const states = [...(stateBySubject.get(block) || [])]
  const interactiveTag = tags.some((t) => INTERACTIVE_TAGS.test(t))
  const cursor = /pointer/.test(r.decls.cursor || '')
  const role0 = (element && INTERACTIVE_TAGS.test(element)) || interactiveTag || cursor || states.some((s) => /hover|focus|active|pressed|current/.test(s)) ? 'control' : 'tag'
  const d = r.decls
  const row = {
    selector: base.join(', '), file: r.file, line: r.line, block, element,
    consumers: consumers.map((c) => c.file), tags, states,
    fill: fillOf(d), role: role0,
    background: d.background ?? d['background-color'] ?? null,
    border: d.border ?? d['border-color'] ?? null, color: d.color ?? null,
    height: d.height ?? null, minHeight: d['min-height'] ?? null, lineHeight: d['line-height'] ?? null,
    padding: d.padding ?? ([d['padding-top'], d['padding-inline'], d['padding-block']].filter(Boolean).join(' / ') || null),
    fontSize: d['font-size'], fontFamily: d['font-family'] ?? null, fontWeight: d['font-weight'] ?? null,
    radius: d['border-radius'], cursor: d.cursor ?? null,
    width: d.width ?? null, letterSpacing: d['letter-spacing'] ?? null, textTransform: d['text-transform'] ?? null,
    decls: d,
    sealGuarded: sealGuarded(r),
    stampSurface: consumers.filter((c) => stampAllowed(c.file)).map((c) => c.file),
    stampForbidden: consumers.filter((c) => stampForbidden(c.file)).map((c) => c.file),
    nameSaysPill: /pill/i.test(base.join(' ')),
  }
  const o = OVERRIDES[row.selector] || OVERRIDES[`${row.file}:${row.selector}`] || {}
  return { ...row, ...o, heuristicRole: role0, heuristicFill: row.fill }
})

// ---------- stale overrides ----------
const stale = Object.keys(OVERRIDES).filter((k) => !k.startsWith('_') && !rows.some((r) => r.selector === k || `${r.file}:${r.selector}` === k))
const unreviewed = rows.filter((r) => !r.verdict)

// ---------- slices ----------
const SLICES = {
  1: 'Tag / outline — the canonical badge (milestonepill recipe)',
  2: 'Tag / paper (tints: meaning passed as a colour token)',
  3: 'Tag / ink',
  4: 'Control / outline + paper (filters, toggles, small actions)',
  5: 'Control / ink (the club-band buttons)',
  0: 'Bespoke — a pill that must not merge',
  6: 'Rename-out — not a capsule (icon buttons, stamp slots, a CTA)',
  7: 'Delete — dead CSS, no consumer',
}
const SLICE_ORDER = [1, 2, 3, 4, 5, 0, 6, 7]

// ---------- geometry sets ----------
const TOKENS = {
  '--fs-label': '12px', '--fs-compact': '12px', '--fs-cell': '11px', '--fs-caption': '11px',
  '--fs-small': '13px', '--fs-body': '15px', '--fs-num-md': '16px',
  '--space-1': '4px', '--space-1h': '6px', '--space-2': '8px', '--space-2h': '10px',
  '--space-3': '12px', '--space-3h': '14px', '--space-5': '20px',
  '--tap-min': '44px', '--control-min': '34px',
}
const resolve = (v) => v == null ? v : v.replace(/var\((--[\w-]+)\)/g, (m, t) => TOKENS[t] ? `${TOKENS[t]}` : m)
function geometry(role) {
  const rs = rows.filter((r) => r.role === role && ['merge', 'bespoke'].includes(r.verdict))
  const tally = (f) => {
    const m = new Map()
    for (const r of rs) { const k = f(r) ?? '(none)'; m.set(k, (m.get(k) || 0) + 1) }
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} x${n}`)
  }
  return {
    n: rs.length,
    height: tally((r) => r.height || r.minHeight ? `${r.height ? 'h ' + resolve(r.height) : ''}${r.minHeight ? 'min-h ' + resolve(r.minHeight) : ''}` : null),
    padding: tally((r) => resolve(r.padding)),
    fontSize: tally((r) => `${r.fontSize} (${resolve(r.fontSize)})`),
    fontFamily: tally((r) => r.fontFamily),
    fontWeight: tally((r) => r.fontWeight),
    lineHeight: tally((r) => r.lineHeight),
  }
}

// ---------- output ----------
if (!REV) {
  writeFileSync(join(HERE, 'census.json'), JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    rev: sh('git rev-parse --short HEAD').trim() + ' (working tree)',
    definition: 'see census.mjs header', count: rows.length,
    geometry: { tag: geometry('tag'), control: geometry('control') },
    stale, unreviewed: unreviewed.map((r) => r.selector), rows,
  }, null, 2) + '\n')
  writeFileSync(join(HERE, 'map.md'), renderMap())
}

function count(f) {
  const m = {}
  for (const r of rows) { const k = f(r); m[k] = (m[k] || 0) + 1 }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')
}
function renderMap() {
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|')
  const L = []
  L.push('# Pill census map (#1131)', '')
  L.push(`Generated by \`census.mjs\` on ${new Date().toISOString().slice(0, 10)} from the working tree at ${sh('git rev-parse --short HEAD').trim()}. Do not hand-edit: change \`overrides.json\` and re-run.`, '')
  L.push('## Tally', '')
  L.push(`- **Total: ${rows.length}** pill base rules (${rows.filter((r) => r.nameSaysPill).length} say "pill")`)
  L.push(`- Verdict: ${count((r) => r.verdict || 'UNREVIEWED')}`)
  L.push(`- Fill: ${count((r) => r.fill)}`)
  L.push(`- Role: ${count((r) => r.role)}`)
  L.push(`- Role x verdict: ${count((r) => `${r.role}/${r.verdict}`)}`)
  L.push(`- Guarded by check-seal-scope: ${rows.filter((r) => r.sealGuarded).map((r) => '`' + r.selector + '`').join(', ') || 'none'}`)
  L.push(`- Consumed by a check-stamp-surfaces FORBIDDEN_SURFACES file (lists unrevealed games; may never name a stamp): ${rows.filter((r) => r.stampForbidden.length).map((r) => '`' + r.selector + '` (' + r.stampForbidden.join(', ') + ')').join(', ') || 'none'}`)
  L.push(`- Consumed by a check-stamp-surfaces STAMP_ALLOWLIST file (renders stamp art): ${rows.filter((r) => r.stampSurface.length).map((r) => '`' + r.selector + '` (' + r.stampSurface.join(', ') + ')').join(', ') || 'none'}`)
  if (stale.length) L.push(`- **STALE overrides** (no matching row): ${stale.join(', ')}`)
  if (unreviewed.length) L.push(`- **UNREVIEWED rows**: ${unreviewed.map((r) => r.selector).join(', ')}`)
  L.push(`- TARGET (not counted): ${target.map((r) => "`" + r.selector + "` " + r.file + ":" + r.line).join(", ") || "none yet"}`)
  L.push('')
  L.push('## Geometry found (merge + bespoke only; tokens resolved)', '')
  for (const role of ['tag', 'control']) {
    const g = geometry(role)
    L.push(`**${role}s (${g.n})**`, '')
    for (const k of ['height', 'padding', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight']) L.push(`- ${k}: ${g[k].join(', ')}`)
    L.push('')
  }
  for (const s of SLICE_ORDER) {
    const rs = rows.filter((r) => r.slice === s)
    if (!rs.length) continue
    L.push(`## ${s ? `Slice ${s}` : 'Hold'}: ${SLICES[s]} (${rs.length})`, '')
    L.push('| selector | file:line | consumers | el | fill | role | height | padding | font-size | family | verdict | reason |')
    L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const r of rs) {
      const h = [r.height && `h ${r.height}`, r.minHeight && `min ${r.minHeight}`].filter(Boolean).join(' ') || '—'
      L.push(`| \`${cell(r.selector)}\` | ${r.file}:${r.line} | ${cell(r.consumers.join('<br>') || '(none)')} | ${r.element || r.tags.join('/') || '—'} | ${r.fill} | ${r.role} | ${cell(h)} | ${cell(r.padding || '—')} | ${cell(r.fontSize)} | ${cell((r.fontFamily || '(inherit)').replace('var(--font-', '').replace(')', ''))} | **${r.verdict}** | ${cell(r.reason || '')} |`)
    }
    L.push('')
  }
  L.push('## Out of the census, named in #1131', '')
  L.push('- `.teamtabs__btn` (46-consent-modal.css:360, HubTabBar.jsx): `border-radius: var(--radius-sm)` — 6px, a ruled box, not a capsule. It was `--radius-sm` at the critique commit too (db3d0b972), so it was never one of the 70. It is a control that draws the same outline as `.mastheadpill`; #1166 says "a capsule is a Pill, and a ruled box is a control", so the tab bar belongs to the Button/tab slice, not the Pill sweep. Its selected hook is still `.is-active` + `aria-current="page"`.')
  L.push('- `.reg-pill`: `--radius-xs` (3px). Not a capsule; rename to `.reg__tag`, does not join.')
  L.push('- `.debutpill`: shell only, no font-size. `.radarpill`: no base rule.')
  L.push('')
  return L.join('\n')
}

if (!QUIET) {
  const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n)
  console.log(`${pad('selector', 34)} ${pad('file:line', 36)} ${pad('fill', 8)} ${pad('role', 7)} ${pad('verdict', 10)} ${pad('font-size', 16)} ${pad('padding', 22)} consumers`)
  for (const s of SLICE_ORDER.concat([undefined])) {
    for (const r of rows.filter((x) => x.slice === s)) {
      console.log(`${pad(r.selector, 34)} ${pad(`${r.file}:${r.line}`, 36)} ${pad(r.fill, 8)} ${pad(r.role, 7)} ${pad(r.verdict || '?', 10)} ${pad(r.fontSize, 16)} ${pad(r.padding, 22)} ${r.consumers.length ? r.consumers.join(' ') : '(none found)'}`)
    }
  }
}
console.log(`\n${rows.length} pill base rules (${REV || 'working tree'}); ${rows.filter((r) => r.nameSaysPill).length} say "pill".`)
if (stale.length) console.log(`STALE overrides: ${stale.join(', ')}`)
if (unreviewed.length) console.log(`UNREVIEWED: ${unreviewed.map((r) => r.selector).join(', ')}`)
if (target.length) console.log(`TARGET (system/pill.css, not counted): ${target.map((r) => r.selector).join(" | ")}`)
