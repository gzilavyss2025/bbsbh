#!/usr/bin/env node
// EmptyState census, by JOB not by name (#1132, slice E0). Re-runnable.
//
//   node .scratch/design-system/empty-state-collapse/census.mjs          # writes census.json + census.md
//   node .scratch/design-system/empty-state-collapse/census.mjs --dump   # one line per row, no files written
//
// Mirrors ../table-collapse/census.mjs. postcss is read from this worktree's
// node_modules, or from the primary checkout's when this worktree has none.
//
// ---------------------------------------------------------------------------
// DEFINITION 1 — a CANDIDATE SELECTOR. A class X such that a rule in
// src/styles/**/*.css names .X as the SUBJECT (the last compound) of one of
// its selectors, or as the parent in a descendant rule (`.X p`), AND either
//   a. X carries an empty WORD. A word counts when it is a whole segment
//      (split on `__`, `--`, `-`), or a segment's prefix or suffix
//      (`flowempty`, `emptynote`, `notposted`). Never a bare substring
//      (ADR-0084 clause 6). The words are in WORDS below; or
//   b. X is written on a JSX site found by Definition 2c (empty COPY with no
//      empty word in the class name: `.lookupdeck__status`, `.umpmodal__hint`).
// One class = one selector row. Its rules are listed; its style columns are
// read from its BASE rules only (no @media, no ancestor class the selector
// needs), in cascade order: later partial wins at equal specificity.
//
// DEFINITION 2 — a JSX SITE. In src/**/*.jsx, with JS comments blanked:
//   a. an opening tag whose className holds a candidate class (Definition 1a);
//   b. an <AsyncStatus …> element (it renders `.hint` for loading, error and,
//      with `emptyMessage`, empty); and the AsyncGate(…) call;
//   c. a lower-case tag whose first text child starts with an empty PHRASE
//      (PHRASE below: "No …", "Nothing …", "Not posted …").
// One tag = one site, keyed file#n (the nth site in that file).
//
// DEFINITION 3 — the JOB. The machine guesses it, overrides.tsv decides it.
//   empty        nothing to show here, and that is a fact about the data
//   loading      the data is on its way
//   error        the fetch failed
//   door         a control that opens more (Door, #1130)
//   caveat       a note ABOUT data that is on screen (a `.hint` used as a
//                footnote): not an empty state
//   provisional  the pencil mark: a TBD seed, a pending row (keeps dashed)
//   mark         a value cell that reads "—" or "none" inside a table or a row:
//                a figure, not a state of the block
//   placeholder  art that stands in for a missing image (a blank photo well)
//   control      a button or a switch that happens to carry the word
//   tool         a lab or admin page (#1113 Q5: leave them)
//   other        none of these: a class found by its copy that is not a state
// The machine guess reads the copy first (Loading → loading; Couldn't, Try
// again → error; No / Nothing / Not posted / yet. → empty), then the name.
// A guess with no override prints with a `?` and counts as UNREVIEWED.
//
// DEFINITION 4 — the columns.
//   shape    box          the class draws an edge or a ground and a padding
//            label+note   the site renders two text lines (a label and a note)
//            bare hint    `.hint` and nothing else
//            label        one line, its own class, no box
//   border   the base rule's border (solid | dashed | none), any side
//   tokens   color · font-family · font-size · font-weight, as written
//   scope    the file is one of the four spoiler surfaces (the slate, the
//            lineups, the innings viewer, the box score) or the two scoring
//            sheets (the scorecard, Express Lane) — SURFACES below — and
//            `gated` when the file reads revealedThrough or renders a SealBox.
//
// Verdicts: MIGRATE (job empty, the copy fits the component) or HOLD (with a
// reason) or n/a (not an empty state: the job says what it is). A row with
// no override is UNREVIEWED.
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

const DUMP = process.argv.includes('--dump')
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

// ---------- the vocabulary ----------
const WORDS = ['empty', 'none', 'nil', 'blank', 'placeholder', 'missing', 'notposted', 'nostat', 'nodata',
  'pending', 'waiting', 'wait', 'tbd', 'quiet', 'idle', 'hint']
function emptyWord(cls) {
  for (const seg of cls.split(/__|--|-/).filter(Boolean)) {
    for (const w of WORDS) if (seg === w || seg.startsWith(w) || seg.endsWith(w)) {
      // `wait` must not match inside `waiver`; `hint` must be the whole word or a suffix
      if (w === 'wait' && seg !== 'wait' && !seg.startsWith('waiting')) continue
      if (w === 'hint' && !(seg === 'hint' || seg.endsWith('hint'))) continue
      if (w === 'idle' && seg !== 'idle') continue
      if (w === 'nil' && seg !== 'nil') continue
      if (w === 'none' && !(seg === 'none' || seg.endsWith('none'))) continue
      return w
    }
  }
  return null
}
const PHRASE = /^\s*(No|Nothing|None|Not posted|Not yet|Not announced|Not listed|Awaiting|Waiting)\b/

// ---------- CSS: every rule, in cascade order ----------
const importOrder = [...read('src/index.css').matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)].map((m) => `src/${m[1]}`)
const cssFiles = walk('src/styles', /\.css$/)
const orderOf = (f) => { const i = importOrder.indexOf(f); return i < 0 ? 1000 + cssFiles.indexOf(f) : i }
const atChain = (node) => { const o = []; for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') o.unshift(`@${p.name} ${p.params}`); return o }
const rules = []
for (const f of cssFiles) {
  postcss.parse(read(f), { from: f }).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    // walkDecls, keeping only this rule's OWN declarations (a nested rule's are its own row).
    // Never `rule.each` with a `return false` callback: that stops the walk early
    // (the bug in ../layout/stack-candidates.mjs).
    const decls = []
    rule.walkDecls((d) => { if (d.parent === rule) decls.push([d.prop, d.value.replace(/\s+/g, ' ').trim()]) })
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
function compounds(sel) {
  let s = sel
  for (let i = 0; i < 4; i++) s = s.replace(/:(not|where|has|is)\([^()]*\)/g, '')
  return s.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean)
}
function specificity(sel) {
  let s = sel.replace(/:(where)\([^()]*\)/g, '')
  s = s.replace(/:(is|not|has)\(([^()]*)\)/g, (_, k, inner) => ` ${inner.split(',')[0]}`)
  const ids = (s.match(/#[\w-]+/g) || []).length
  const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(\([^)]*\))?/g) || []).length
  const el = (s.replace(/::?[\w-]+(\([^)]*\))?/g, '').match(/(^|[\s>+~])[a-z][\w-]*/g) || []).length
  return ids * 10000 + cls * 100 + el
}

// Every class that is a selector SUBJECT, with the rules that reach it.
//   role 'self'  .X is in the subject compound
//   role 'child' .X is the compound right before a bare-element subject (`.X p`)
const subjectRules = new Map()
const addSR = (c, x) => { if (!subjectRules.has(c)) subjectRules.set(c, []); subjectRules.get(c).push(x) }
for (const r of rules) {
  for (const s of r.selectors) {
    const parts = compounds(s)
    const subj = parts.at(-1) || ''
    const pseudo = /::?(before|after|placeholder|marker)/.test(subj)
    for (const c of classesIn(subj)) addSR(c, { r, s, role: pseudo ? 'pseudo' : 'self', ctx: parts.slice(0, -1).flatMap(classesIn).filter((k) => !STATE.test(k)) })
    if (parts.length >= 2 && /^[a-z]+$/.test(subj)) for (const c of classesIn(parts.at(-2))) addSR(c, { r, s, role: 'child', ctx: parts.slice(0, -2).flatMap(classesIn).filter((k) => !STATE.test(k)) })
  }
}

// The style of a class: its BASE rules (role self, no @media, no other class
// in the selector but itself, a state or the html `#root` prefix), resolved
// one property at a time by specificity, then cascade order.
const STYLE_PROPS = ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-style', 'outline',
  'background', 'background-color', 'padding', 'padding-block', 'padding-inline', 'margin', 'color', 'fill',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-transform', 'text-align', 'border-radius']
function styleOf(cls, extra = []) {
  const allowed = new Set([cls, ...extra])
  const won = {}; const v = {}
  for (const x of subjectRules.get(cls) || []) {
    if (x.role !== 'self' || x.r.at.length) continue
    if (classesIn(x.s).some((k) => !allowed.has(k) && !STATE.test(k))) continue
    const sp = specificity(x.s)
    for (const [p, val] of x.r.decls) {
      if (!STYLE_PROPS.includes(p)) continue
      const cur = won[p]
      if (!cur || sp > cur.sp || (sp === cur.sp && x.r.order >= cur.order)) { won[p] = { sp, order: x.r.order }; v[p] = val }
    }
  }
  return v
}
function childStyle(cls) {
  const v = {}
  for (const x of subjectRules.get(cls) || []) if (x.role === 'child' && !x.r.at.length) for (const [p, val] of x.r.decls) if (STYLE_PROPS.includes(p)) v[p] = val
  return v
}
function borderOf(st) {
  const b = ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'outline'].map((p) => [p, st[p]]).filter(([, x]) => x && !/^(0|none)\b/.test(x))
  if (st['border-style'] && /dashed/.test(st['border-style'])) return 'dashed'
  if (!b.length) return 'none'
  const dashed = b.filter(([, x]) => /dashed|dotted/.test(x))
  if (dashed.length) return `dashed (${dashed.map(([p]) => p).join(', ')})`
  return `solid (${b.map(([p]) => p).join(', ')})`
}
const tok = (x) => (x ? x.replace(/var\((--[\w-]+)(,[^)]*)?\)/g, '$1') : '')
function tokensOf(st) {
  return [tok(st.color || st.fill) || '·', tok(st['font-family']) || '·', tok(st['font-size']) || '·', tok(st['font-weight']) || '·'].join(' ')
}
const hasGround = (st) => !!(st.background || st['background-color']) && !/^(none|transparent)$/.test(st.background || st['background-color'])
const hasPad = (st) => !!(st.padding || st['padding-block'] || st['padding-inline'])

// ---------- JSX ----------
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
// Every class-like literal in a className expression: the static text of a
// template literal, and every quoted string, including the ones inside a
// `${…}` hole (`${existing ? '' : ' stampstrip__mount--empty'}`). The table
// census dropped the holes, so it missed classes added on a condition.
function literalsIn(raw) {
  const out = []
  const HOLE = /\$\{((?:[^{}]|\{[^{}]*\})*)\}/g
  const quoted = (t) => [...t.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2])
  const rest = raw.replace(/`((?:\\.|[^`])*)`/gs, (_, body) => {
    out.push(body.replace(HOLE, (h, inner) => { out.push(...quoted(inner)); return ' ' }))
    return ' '
  })
  out.push(...quoted(rest))
  return out
}
function classAttr(tag) {
  const m = tag.match(/className=(\{|"|')/)
  if (!m) return { classes: [], prefixes: [], raw: '' }
  let raw
  if (m[1] !== '{') raw = tag.slice(m.index + 11, tag.indexOf(m[1], m.index + 11))
  else {
    let depth = 0; let i = m.index + 10
    for (; i < tag.length; i++) { if (tag[i] === '{') depth++; else if (tag[i] === '}' && --depth === 0) break }
    raw = tag.slice(m.index + 11, i)
  }
  const lits = m[1] === '{' ? literalsIn(raw) : [raw]
  const words = lits.join(' ').split(/\s+/)
  // `ctr__cell--${kind}` leaves the prefix `ctr__cell--`: a class built at run time.
  const prefixes = [...new Set(words.filter((c) => /^[a-z][\w-]*-$/i.test(c)))]
  const classes = [...new Set(words.filter((c) => /^[a-z][\w-]*[a-z0-9]$/i.test(c)))]
  return { classes, prefixes, raw: raw.replace(/\s+/g, ' ').trim() }
}
// The copy right after an opening tag: text and {…} up to the next tag, with
// string literals inside {…} kept and code dropped.
function copyAfter(text, end) {
  const lt = text.indexOf('<', end + 1)
  let s = text.slice(end + 1, lt < 0 ? end + 400 : Math.min(lt, end + 400))
  s = s.replace(/\{([^{}]*)\}/g, (_, inner) => { const lits = [...inner.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]); return lits.length ? lits.join(' / ') : '{…}' })
  return s.replace(/\s+/g, ' ').trim()
}
// The body of an element up to its matching close tag (same name), for the
// label+note test: how many child elements carry a class or are a <p>/<span>/<strong>.
function bodyOf(text, start, name) {
  const end = tagEnd(text, start)
  if (text[end - 1] === '/') return { body: '', close: end }
  const re = new RegExp(`<\\/?${name}(?=[\\s>/])`, 'g'); re.lastIndex = end
  let depth = 1; let m
  while ((m = re.exec(text))) {
    if (m[0][1] === '/') { if (--depth === 0) return { body: text.slice(end + 1, m.index), close: m.index } }
    else { const e = tagEnd(text, m.index); if (text[e - 1] !== '/') depth++ }
  }
  return { body: text.slice(end + 1, end + 600), close: end + 600 }
}
function textChildren(body) {
  let n = 0
  for (const m of body.matchAll(/<(p|span|strong|em|small|b)(?=[\s>])/g)) n++
  return n
}

// The spoiler surfaces (root CLAUDE.md): which page a file is drawn on.
const SURFACES = [
  ['slate', /^screens\/GameSelect\.jsx$|^components\/game\/(GameCard|GameCardParts|PastGameFlipCard|GameResultFace|GameStoryCard|ContinueScoring)\.jsx$/],
  ['lineups', /^screens\/(TeamInfo|GameView)\.jsx$|^components\/boxlines\/|^components\/inning\/RosterPanel\.jsx$/],
  ['innings', /^screens\/InningViewer\.jsx$|^screens\/innings\/|^components\/inning\/|^components\/playbyplay\/|^components\/gamehud\/|^components\/page-turn\//],
  ['boxscore', /^screens\/BoxScore\.jsx$|^screens\/boxscore\/|^components\/logbook\/StampGameButton\.jsx$/],
  ['scorecard', /^screens\/Scorecard\.jsx$|^components\/scoring\//],
  ['expresslane', /^screens\/expresslane\//],
]
// One level more: a component the surface's PAGE file imports directly is
// drawn on that surface too (FormerTeammates on the lineups page). Not
// transitive: chrome that every page imports would put every file in scope.
const SURFACE_PAGES = { slate: 'screens/GameSelect.jsx', lineups: 'screens/TeamInfo.jsx', innings: 'screens/InningViewer.jsx', boxscore: 'screens/BoxScore.jsx', scorecard: 'screens/Scorecard.jsx' }
const viaImport = new Map()
for (const [surf, page] of Object.entries(SURFACE_PAGES)) {
  if (!existsSync(join(ROOT, 'src', page))) continue
  for (const m of read(`src/${page}`).matchAll(/from\s+['"](\.[^'"]+\.jsx)['"]/g)) {
    const target = join(dirname(page), m[1]).replace(/\\/g, '/')
    if (!viaImport.has(target)) viaImport.set(target, `${surf} (via ${page.split('/').pop()})`)
  }
}
const surfaceOf = (f) => (SURFACES.find(([, re]) => re.test(f)) || [])[0] || viaImport.get(f) || ''

const jsxFiles = walk('src', /\.jsx$/)
const FOLD_MAX = 800 // characters of JSX between the outer tag and its close
const sites = []
const phraseClasses = new Set()
for (const f of jsxFiles) {
  const raw = read(f)
  const text = stripJs(raw)
  const file = f.replace(/^src\//, '')
  const gatedFile = /revealedThrough/.test(text) || /<SealBox\b/.test(text)
  let n = 0
  for (const m of text.matchAll(/<([A-Za-z][\w.]*)(?=[\s>/])/g)) {
    const name = m[1]
    const end = tagEnd(text, m.index)
    const open = text.slice(m.index, end + 1)
    const { classes, prefixes, raw: clsRaw } = classAttr(open)
    const copy = copyAfter(text, end)
    let why = null
    const words = classes.filter((c) => emptyWord(c) && !STATE.test(c))
    const wordPrefixes = prefixes.filter((p) => [...subjectRules.keys()].some((c) => c.startsWith(p) && emptyWord(c)))
    if (name === 'AsyncStatus') why = 'AsyncStatus'
    else if (words.length || wordPrefixes.length) why = 'class'
    else if (/^[a-z]/.test(name) && PHRASE.test(copy)) why = 'copy'
    if (!why) continue
    // A site inside another SMALL site's element is part of it (a label and a
    // note inside one empty block): it is folded into the outer site, not
    // counted. A big outer element (a page root that wears `--quiet`) folds nothing.
    const outer = sites.findLast((s) => s.file === file && m.index < s.close && s.close - s.at < FOLD_MAX)
    if (outer) { outer.inner.push(...classes); if (why === 'copy' && !outer.copy) outer.copy = copy.slice(0, 110); continue }
    n++
    if (why === 'copy') for (const c of classes) if (c.includes('__')) phraseClasses.add(c)
    const { body, close } = bodyOf(text, m.index, name)
    let props = ''
    if (name === 'AsyncStatus') {
      const pm = [...open.matchAll(/(emptyMessage|errorMessage|staleErrorMessage|onRetry|emptyProse)=(\{|"|')/g)].map((x) => x[1])
      props = pm.join(' ')
      const em = open.match(/emptyMessage=(?:"([^"]*)"|\{([\s\S]*?)\}\s*(?=\w+=|\/?>))/)
      if (em) {
        const v = em[1] ?? em[2]
        const lits = [...(v || '').matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2])
        props += ` · empty: ${(em[1] ?? (lits.join(' / ') || '{…}')).replace(/\s+/g, ' ').slice(0, 90)}`
      }
    }
    sites.push({
      key: `${file}#${n}`, file, line: text.slice(0, m.index).split('\n').length, tag: name, why,
      classes, prefixes, clsRaw, words, copy: copy.slice(0, 110), props,
      texts: textChildren(body), surface: surfaceOf(file), gated: gatedFile, at: m.index, close, inner: [],
    })
  }
}
// AsyncGate is a function call, not a tag: count its calls apart.
const gateCalls = []
for (const f of jsxFiles) {
  const text = stripJs(read(f))
  for (const m of text.matchAll(/\bAsyncGate\(\{/g)) gateCalls.push(`${f.replace(/^src\//, '')}:${text.slice(0, m.index).split('\n').length}`)
}

// ---------- candidate selectors ----------
const candidates = new Set()
for (const c of subjectRules.keys()) if (emptyWord(c) && !STATE.test(c)) candidates.add(c)
for (const c of phraseClasses) if (subjectRules.has(c) && !STATE.test(c)) candidates.add(c)
for (const s of sites) for (const c of s.words) if (!subjectRules.has(c)) s.unstyled = [...(s.unstyled || []), c]

// ---------- overrides ----------
// overrides.tsv (TAB-separated; # lines are comments):
//   key  job  verdict  slice  shape  reason
// key = `.class` for a selector row, file#n for a JSX site. Empty cell = machine value.
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
const OVR = readTsv('overrides.tsv', ['job', 'verdict', 'slice', 'shape', 'reason'])
const used = new Set()

// ---------- the machine's job guess ----------
function guessFromCopy(copy) {
  if (/\bLoading\b|^Fetching|^Checking|…$/.test(copy) && !PHRASE.test(copy)) return 'loading'
  if (/Couldn|could not|Could not|failed|Failed|Try again|unavailable|error/.test(copy)) return 'error'
  if (PHRASE.test(copy) || /\byet\.?$/.test(copy)) return 'empty'
  return null
}
function guessFromName(cls) {
  const w = emptyWord(cls)
  if (/--error/.test(cls)) return 'error'
  if (/^(idlab|colorlab|dlab|admincopy|cwb|lookupdeck)\b|^idlab|^colorlab/.test(cls)) return 'tool'
  if (w === 'tbd' || w === 'pending') return 'provisional'
  if (/__btn|__toggle|__check|__chip/.test(cls)) return 'control'
  if (/(cell|fig|ct|rank|col|out|change|name|starter|arms|watchtxt|row)(--|$)/.test(cls) && (w === 'none' || w === 'nil')) return 'mark'
  if (/photo|swatch|logo|mark|blank|mount/.test(cls) && (w === 'empty' || w === 'blank' || w === 'placeholder')) return 'placeholder'
  if (w === 'empty' || w === 'notposted' || w === 'nostat' || w === 'none') return 'empty'
  if (w === 'hint') return 'caveat'
  return null
}
function siteJob(s) {
  const fromCopy = guessFromCopy(s.copy + (s.props.includes('empty:') ? ' No' : ''))
  if (s.tag === 'AsyncStatus') return s.props.includes('emptyMessage') ? 'empty' : 'loading'
  if (s.classes.includes('hint--error')) return 'error'
  return fromCopy || s.words.map(guessFromName).find(Boolean) || null
}
function shapeOfSite(s) {
  if (s.tag === 'AsyncStatus') return 'bare hint'
  if (s.texts >= 2) return 'label+note'
  const st = Object.assign({}, ...s.classes.map((c) => styleOf(c, s.classes)))
  if ((borderOf(st) !== 'none' || hasGround(st)) && hasPad(st)) return 'box'
  const own = s.classes.filter((c) => !/^hint(--|$)/.test(c))
  if (s.classes.includes('hint') && !own.length) return 'bare hint'
  if (s.classes.includes('hint')) return 'hint + own class'
  return 'label'
}

// ---------- selector rows ----------
const selRows = [...candidates].sort().map((c) => {
  const st = styleOf(c)
  const ch = childStyle(c)
  const reach = subjectRules.get(c) || []
  const usedBy = sites.filter((s) => s.classes.includes(c) || s.inner.includes(c) || s.prefixes.some((p) => c.startsWith(p)))
  const jobs = [...new Set(usedBy.map(siteJob).filter(Boolean))]
  const machine = guessFromName(c) || (jobs.length === 1 ? jobs[0] : null)
  const key = `.${c}`
  const o = OVR[key] || {}
  if (OVR[key]) used.add(key)
  const job = o.job || (machine ? `${machine}?` : '?')
  const boxed = (borderOf(st) !== 'none' || hasGround(st)) && hasPad(st)
  const shape = o.shape || (boxed ? 'box' : usedBy.some((s) => s.texts >= 2) ? 'label+note' : c === 'hint' ? 'bare hint' : 'label')
  const verdict = o.verdict || 'UNREVIEWED'
  const surfaces = [...new Set(usedBy.map((s) => s.surface).filter(Boolean))]
  return {
    key, cls: c, word: emptyWord(c) || '(copy)', job, verdict, slice: o.slice || '', reason: o.reason || '',
    shape, border: borderOf(st), childBorder: borderOf(ch) === 'none' ? '' : borderOf(ch),
    tokens: tokensOf(st), childTokens: Object.keys(ch).length ? tokensOf(ch) : '',
    ground: tok(st.background || st['background-color']) || '', pad: tok(st.padding || st['padding-block'] || '') || '',
    rules: [...new Set(reach.map((x) => `${x.r.file}:${x.r.line}${x.r.at.length ? ' @' : ''}${x.ctx.length ? ' ctx' : ''}`))],
    dashedAnywhere: reach.some((x) => x.r.decls.some(([p, v]) => /^(border|outline)/.test(p) && /dashed|dotted/.test(v))),
    sites: usedBy.map((s) => s.key), surfaces, gated: usedBy.some((s) => s.gated),
  }
})

// ---------- site rows ----------
const siteRows = sites.map(({ close, at, ...s }) => {
  const o = OVR[s.key] || {}
  if (OVR[s.key]) used.add(s.key)
  const machine = siteJob(s)
  const job = o.job || (machine ? `${machine}?` : '?')
  const st = Object.assign({}, ...s.classes.map((c) => styleOf(c, s.classes)))
  return {
    ...s, job, machine, verdict: o.verdict || 'UNREVIEWED', slice: o.slice || '', reason: o.reason || '',
    shape: o.shape || shapeOfSite(s), border: borderOf(st), tokens: tokensOf(st),
    cls: s.classes.length || s.prefixes.length ? [...s.classes.map((c) => `.${c}`), ...s.prefixes.map((p) => `.${p}*`)].join(' ') : s.clsRaw ? `{${s.clsRaw.slice(0, 50)}}` : '—',
  }
})
const stale = Object.keys(OVR).filter((k) => !used.has(k))

// ---------- the dashed rules (the issue's three meanings) ----------
// Every base or @media rule that draws a dashed or dotted border or outline, by partial.
const dashed = []
for (const r of rules) {
  const d = r.decls.filter(([p, v]) => /^(border|outline)/.test(p) && /\b(dashed|dotted)\b/.test(v))
  if (!d.length) continue
  const subjCls = r.selectors.flatMap((s) => classesIn(compounds(s).at(-1) || ''))
  const cand = subjCls.filter((c) => candidates.has(c))
  const selText = r.selectors.join(', ')
  // The meaning column is INFERENCE from the selector text, except where the
  // rule draws a census candidate (then it is that row's hand-checked job).
  const guess = /door|__more|btn|button|__add|__new|__cta|__link|toggle/.test(selText) ? 'door? (inference)'
    : /tbd|pending|placed|postponed|bye|option|future|proj|pencil|ghost|draft|plan/.test(selText) ? 'provisional? (inference)'
    : /focus|:focus|outline/.test(selText + d.map(([p]) => p).join(' ')) ? 'focus ring? (inference)' : '?'
  dashed.push({ at: `${r.file}:${r.line}`, file: r.file, sel: selText, how: d.map(([p, v]) => `${p}: ${v}`).join('; '), cand, guess })
}
const dashedFiles = new Set(dashed.map((d) => d.file))

// ---------- output ----------
if (DUMP) {
  for (const r of selRows) console.log(['SEL', r.key, r.word, r.job, r.verdict, r.slice, r.shape, r.border, r.tokens, r.surfaces.join('+'), r.sites.length].join(' | '))
  for (const r of siteRows) console.log(['JSX', r.key, r.line, r.tag, r.cls, r.job, r.verdict, r.slice, r.shape, r.surface || '-', r.gated ? 'gated' : '', r.copy.slice(0, 70), r.props].join(' | '))
  if (stale.length) console.log(`STALE overrides: ${stale.join(' | ')}`)
  process.exit(0)
}

const by = (list, f) => { const m = {}; for (const r of list) { const k = f(r); m[k] = (m[k] || 0) + 1 } return m }
const fmtBy = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
const bare = (j) => j.replace(/\?$/, '')
const esc = (s) => String(s).replace(/\|/g, '\\|')
const head = sh('git rev-parse --short HEAD').trim()
const emptySel = selRows.filter((r) => bare(r.job) === 'empty')
const emptySites = siteRows.filter((r) => bare(r.job) === 'empty')
const unrev = [...selRows, ...siteRows].filter((r) => r.verdict === 'UNREVIEWED')
const inScope = siteRows.filter((r) => r.surface)

const L = []
L.push('# EmptyState census (#1132, slice E0)', '')
L.push(`Generated by \`census.mjs\` on ${new Date().toISOString().slice(0, 10)} from the working tree at ${head}. **Do not hand-edit.** Change \`overrides.tsv\` and re-run \`node .scratch/design-system/empty-state-collapse/census.mjs\`.`, '')
L.push('The definitions are in the header of `census.mjs`. In short: a **selector** is a class that a CSS rule draws and whose name carries an empty word (or that sits on empty copy). A **JSX site** is a tag that wears one, an `<AsyncStatus>`, or a tag whose copy starts "No …", "Nothing …", "Not posted …". The **job** sorts each one: a true empty state, or a loading line, an error, a door, a caveat, a pencil mark, a value cell, a placeholder, a control, or a tool page.', '')
L.push('A job with a `?` is the machine\'s guess (inference from the copy or the class name) and was not checked by hand. A job with no `?` comes from `overrides.tsv`.', '')
L.push('## Headline', '')
L.push(`- **${selRows.length} candidate selectors** (classes a rule draws). By job: ${fmtBy(by(selRows, (r) => bare(r.job)))}.`)
const byWord = by(selRows, (r) => r.word)
L.push(`- By the word in the name: ${fmtBy(byWord)}.`)
L.push(`- **${emptySel.length} of them are true empty states** (${fmtBy(by(emptySel, (r) => r.verdict))}). The issue says "40 selectors, no component". This census cannot reproduce 40: it is more than the ${emptySel.length} true empties and far less than the ${selRows.length} candidates. Most classes that carry an empty word are a value mark, a pencil mark, a placeholder or a tool-page line.`)
L.push(`- **${siteRows.length} JSX sites** in ${new Set(siteRows.map((r) => r.file)).size} files. By job: ${fmtBy(by(siteRows, (r) => bare(r.job)))}.`)
L.push(`- **${emptySites.length} empty-state sites.** By shape: ${fmtBy(by(emptySites, (r) => r.shape))}. By verdict: ${fmtBy(by(emptySites, (r) => r.verdict))}.`)
L.push(`- \`<AsyncStatus>\`: **${siteRows.filter((r) => r.tag === 'AsyncStatus').length}** sites, **${siteRows.filter((r) => r.tag === 'AsyncStatus' && /emptyMessage/.test(r.props)).length}** with an \`emptyMessage\` (it renders a bare \`.hint\`). \`AsyncGate(…)\` calls: **${gateCalls.length}** (loading and not-found only, never empty).`)
L.push(`- Sites on a spoiler surface: **${inScope.length}** (${fmtBy(by(inScope, (r) => r.surface.split(' ')[0]))}); of the empty ones: **${emptySites.filter((r) => r.surface).length}** (${emptySites.filter((r) => r.surface).map((r) => `\`${r.key}\``).join(', ')}). In a file that reads \`revealedThrough\` or renders a \`SealBox\`: **${emptySites.filter((r) => r.gated).length}** empty sites. \`(via X)\` in the surface column means the page file X imports the component directly; the shared \`AsyncGate.jsx\` reads as the slate for that reason.`)
L.push(`- Empty-state selectors by border today: ${fmtBy(by(emptySel, (r) => r.border.split(' ')[0]))}. The target is ONE dashed inset.`)
L.push(`- **Dashed rules:** ${dashed.length} rules in ${dashedFiles.size} partials draw a dashed or dotted border or outline (the issue says 44 partials). ${dashed.filter((d) => d.cand.length).length} of them are on a candidate selector. Part 4 lists them.`)
if (stale.length) L.push(`- **STALE overrides**: ${stale.join(' | ')}`)
L.push(`- **UNREVIEWED rows: ${unrev.length}**${unrev.length ? ` — ${unrev.slice(0, 40).map((r) => `\`${r.key}\``).join(', ')}${unrev.length > 40 ? ' …' : ''}` : ''}`, '')
L.push('Column key: **word** the empty word in the name (`(copy)` = found by its copy). **shape** `box` (an edge or a ground, and padding) · `label+note` (two text lines) · `bare hint` (`.hint` only) · `hint + own class` · `label`. **border** the base rule\'s border today. **tokens** color · font-family · font-size · font-weight, as the base rule writes them (`·` = not set: inherited). **surface** the spoiler surface the site is drawn on (`gated` = the file reads `revealedThrough` or renders a `SealBox`).', '')

const JOBS = ['empty', 'loading', 'error', 'door', 'caveat', 'provisional', 'mark', 'placeholder', 'control', 'tool', 'other', '']
L.push('## Part 1 — the selectors, by job', '')
for (const j of JOBS) {
  const list = selRows.filter((r) => bare(r.job).replace(/^\?$/, '') === j)
  if (!list.length) continue
  L.push(`### ${j || 'no guess'} (${list.length})`, '')
  L.push('| selector | word | job | shape | border | tokens | ground · padding | surfaces | sites | verdict | slice | reason |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of list) L.push(`| \`${r.key}\` | ${r.word} | ${r.job} | ${r.shape} | ${r.border}${r.childBorder ? `; child ${r.childBorder}` : ''} | ${r.tokens}${r.childTokens ? `; child ${r.childTokens}` : ''} | ${esc(r.ground || '·')} · ${esc(r.pad || '·')} | ${r.surfaces.join(', ') || '—'}${r.gated ? ' gated' : ''} | ${r.sites.length} | ${r.verdict} | ${r.slice} | ${esc(r.reason)} |`)
  L.push('')
}

L.push('## Part 2 — the JSX sites, by job', '')
L.push('`copy` is the text right after the tag (string literals kept, code shown as `{…}`). For `<AsyncStatus>` it is the props.', '')
for (const j of JOBS) {
  const list = siteRows.filter((r) => bare(r.job).replace(/^\?$/, '') === j)
  if (!list.length) continue
  L.push(`### ${j || 'no guess'} (${list.length})`, '')
  L.push('| site | class | copy | job | shape | border | surface | verdict | slice | reason |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of list) L.push(`| \`${r.file}:${r.line}\` (${r.key.split('#')[1]}) | \`${esc(r.cls)}\` | ${esc((r.tag === 'AsyncStatus' ? r.props : r.copy).slice(0, 80)) || '—'} | ${r.job} | ${r.shape} | ${r.border} | ${r.surface || '—'}${r.gated ? ' gated' : ''} | ${r.verdict} | ${r.slice} | ${esc(r.reason)} |`)
  L.push('')
}

L.push('## Part 3 — where each selector\'s rules live', '')
L.push('`@` = inside an at-rule; `ctx` = the selector also needs an ancestor class.', '')
for (const r of selRows) L.push(`- \`${r.key}\` — ${r.rules.join(', ')}${r.sites.length ? ` · sites: ${r.sites.join(', ')}` : ' · **no JSX site** (dead, or built at run time)'}`)
L.push('')

L.push('## Part 4 — every dashed rule', '')
L.push(`The issue's rule: dashed means provisional, pencilled in. Doors go solid. Empty states keep a dashed inset. ${dashed.length} rules in ${dashedFiles.size} partials. \`candidate\` names a census selector the rule draws.`, '')
const jobOf = (c) => bare((selRows.find((r) => r.cls === c) || {}).job || '?')
L.push('| rule | selector | declaration | candidate (its job) | meaning |', '| --- | --- | --- | --- | --- |')
for (const d of dashed) L.push(`| ${d.at} | \`${esc(d.sel.slice(0, 90))}\` | \`${esc(d.how.slice(0, 70))}\` | ${d.cand.map((c) => `\`.${c}\` (${jobOf(c)})`).join(' ')} | ${d.cand.length ? d.cand.map(jobOf).join(', ') : d.guess} |`)
L.push('')
L.push('### Where the census disagrees with the dashed rule', '')
L.push('The rule: provisional and empty are dashed; a door is solid; a value mark or a placeholder is not named by the rule.', '')
const dis = []
for (const r of emptySel) if (!/^dashed/.test(r.border) && r.shape !== 'inner line') dis.push(`- \`${r.key}\` is an empty state with border **${r.border}** (${r.verdict}${r.slice ? `, ${r.slice}` : ''}). EmptyState gives it the dashed inset${r.verdict === 'HOLD' ? ' only if the hold is lifted' : ''}.`)
for (const d of dashed) for (const c of d.cand) { const j = jobOf(c); if (!['empty', 'provisional'].includes(j)) dis.push(`- \`.${c}\` (${d.at}) is dashed, but its job is **${j}**: neither provisional nor empty.`) }
for (const d of dashed) if (!d.cand.length && /^door/.test(d.guess)) dis.push(`- \`${d.sel.slice(0, 70)}\` (${d.at}) is dashed and reads as a door (inference from the selector). Doors go solid (#1130's \`Door\`).`)
L.push(...dis, '')

L.push('## Part 5 — the ADR-0084 state renames and EmptyState', '')
L.push('The six state rows that the naming ledger (`docs/design-system-naming.md`) gives to #1132. This census renames nothing. Which of them touch EmptyState:', '')
L.push('| class | ledger target | files (JSX) | census job | touches EmptyState? |', '| --- | --- | --- | --- | --- |')
const STATE_ROWS = [['dh__row--open', '.dh__row.is-open'], ['umptend__row--on', '.umptend__row.is-on'], ['cwb__row--done', '.cwb__row.is-done'], ['posinn__box--empty', '.posinn__box.is-empty'], ['xl-deck--empty', '.xl-deck.is-empty'], ['stampstrip__mount--empty', '.stampstrip__mount.is-empty']]
for (const [c, target] of STATE_ROWS) {
  const files = jsxFiles.filter((f) => new RegExp(`${c.replace(/-/g, '\\-')}(?![a-z0-9-])`).test(read(f))).map((f) => f.replace(/^src\//, ''))
  const row = selRows.find((r) => r.cls === c)
  const job = row ? bare(row.job) : 'not a candidate'
  const touch = job === 'empty' ? `yes: an empty block (${row.verdict})` : row ? `no: a ${job}, a look-alike` : 'no: a row state'
  L.push(`| \`.${c}\` | \`${target}\` | ${files.map((f) => `\`${f}\``).join(', ') || '—'} | ${job} | ${touch} |`)
}
L.push('')

writeFileSync(join(HERE, 'census.md'), L.join('\n'))
const slim = siteRows.map(({ key, line, tag, cls, copy, props, job, verdict, slice, shape, border, tokens, surface, gated }) => ({ key, line, tag, cls, copy, props, job, verdict, slice, shape, border, tokens, surface, gated }))
writeFileSync(join(HERE, 'census.json'), JSON.stringify({ head, selectors: selRows, sites: slim, gateCalls, dashed }, null, 1))
console.log(`selectors ${selRows.length} (empty ${emptySel.length}) · sites ${siteRows.length} (empty ${emptySites.length}) · dashed ${dashed.length} rules / ${dashedFiles.size} partials · unreviewed ${unrev.length}`)
if (stale.length) console.log(`STALE overrides: ${stale.join(' | ')}`)
