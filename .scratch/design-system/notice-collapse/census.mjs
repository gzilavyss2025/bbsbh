#!/usr/bin/env node
// Notice census, by JOB not by name (#1132, slice N0). Re-runnable.
//
//   node .scratch/design-system/notice-collapse/census.mjs          # writes census.json + census.md
//   node .scratch/design-system/notice-collapse/census.mjs --dump   # one line per row, no files written
//
// Mirrors ../empty-state-collapse/census.mjs. It fetches nothing (the
// statsapi-client guard walks .scratch). postcss is read from node_modules.
//
// ---------------------------------------------------------------------------
// DEFINITION 1 — a CANDIDATE SELECTOR: a class X that a rule in src/styles/**
// names as the subject of a selector (or the parent in `.X p`) AND is one of:
//   a. RAIL  a base rule that also sets a padding (a box, not a cell divider or a
//            row accent) gives it a left border of 1.5px or more (the issue says
//            3px; `--bw-rule` is 1.5px): `border-left`, `border-inline-start`, the
//            longhand width, or an inset shadow rail (`inset 3px 0 0 <colour>`).
//            Not transparent. A CSS triangle is not a rail. A rail drawn by a
//            pseudo-element is not found (limit; none reached a Notice by hand).
//   b. TINT  a base rule gives a BLOCK (not `display: inline*`, not a capsule:
//            those are Pill's) a tinted ground AND a border AND a padding. A tint
//            is a `color-mix()`, a `-soft` / `-tint` / `-wash` token, an rgba() or
//            a hex; a plain surface or paper token is not.
//   c. NAME  the name carries notice, banner, alert, warning, warn, callout or
//            toast as a whole segment or a segment's prefix or suffix (ADR-0084
//            clause 6: never a bare substring).
//   d. SITE  X is written on a JSX site found by Definition 2.
// One class = one selector row. Style columns come from BASE rules (no @media, no
// ancestor class the selector needs), per property, by specificity then order.
//
// DEFINITION 2 — a JSX SITE, in src/**/*.jsx with JS comments blanked:
//   a. an opening tag whose className holds a class that passes 1a, 1b or 1c;
//   b. a tag with role="alert", "status" or "note", or with aria-live;
//   c. a tag whose className holds `hint--error`;
//   d. an <AsyncStatus …> element (and the AsyncGate(…) calls, counted apart);
//   e. a lower-case tag whose first text holds an error or heads-up phrase;
//   f. a tag the EmptyState census (read with --dump, which writes nothing)
//      classifies `error` or `loading`: its 21 error lines and 15 loading lines.
//      Its 61 `caveat` lines (a `.hint` used as a footnote) do not move: counted;
//   g. a hand-added tag (ADDED below): found by reading, reached by no signal.
// One tag = one site, keyed file#n. A site inside a SMALL site's element folds in.
//
// DEFINITION 3 — the JOB (the machine guesses; overrides.tsv decides): notice (a
// message about the state of the page or the game) · error (a fetch or action
// failed) · loading (HELD: the plain hint or the pencil loader) · empty (EmptyState
// owns it: done) · caveat (a footnote; does not move) · callout (an editorial rule
// or pull quote; NOT the Margin Notes "callouts" of docs/callouts.md) · tape (a
// gradient or hatched band) · card (an actor card with a headshot) · tool (a lab,
// admin or dev page: #1113 Q5) · control · live (a sr-only or count-only region) ·
// other (a pill, divider, heading, chart mark).
// DEFINITION 4 — the columns: shape (rail+tint | rail | tint box | dashed box |
// band | text | box | none) · border (every border the base rule draws) · tint
// (the ground) · tone (the colour family read from the left rule, the border, the
// ground, then the text) · box (padding, margin, font, colour today) · role (the
// site's role attribute) · scope (the four spoiler surfaces and the two scoring
// sheets; `gated` = the file reads revealedThrough or renders a SealBox).
// Verdicts: MIGRATE (a Notice draws it) · HOLD (with a reason) · n/a (not a Notice
// row). A row with no override is UNREVIEWED.
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
// ---------- vocabulary ----------
const WORDS = ['notice', 'banner', 'alert', 'warning', 'warn', 'callout', 'toast']
function noticeWord(cls) {
  for (const seg of cls.split(/__|--|-/).filter(Boolean)) {
    for (const w of WORDS) if (seg === w || seg.startsWith(w) || seg.endsWith(w)) return w
  }
  return null
}
const ERR_PHRASE = /Couldn[’']t|Could not|\bCan[’']t\b|\bCannot\b|[Ff]ailed|Unable|Something went wrong|isn[’']t (available|playable)|not available|Try again|Heads up|^\s*Note:|^\s*Warning/
const BW = { '--bw-hair': 1, '--bw-rule': 1.5, '--bw-heavy': 2 }
const widthPx = (v) => {
  const t = v.match(/var\((--bw-[a-z]+)\)/)
  if (t) return BW[t[1]] ?? null
  const m = v.match(/(\d+(?:\.\d+)?)px/)
  return m ? +m[1] : null
}
// The colour families. A token is read as a ROLE, not a colour name.
const TONE_OF = [
  [/^--(seal|kraft-board|text-on-seal)/, 'SEAL'],
  [/^--(clay|accent-negative)/, 'clay'],
  [/^--(marker)/, 'marker'],
  [/^--(field|accent-positive|accent-link)/, 'field'],
  [/^--(allstar-blue)/, 'allstar-blue'],
  [/^--(award)/, 'award'],
  [/^--(navy|accent-primary|ink-|text-heading|text-on-ink)/, 'navy'],
  [/^--(graphite|rule|border-|paper-|text-|surface-|bg-|band-rule)/, 'neutral'],
]
const toneOfToken = (t) => (TONE_OF.find(([re]) => re.test(t)) || [])[1] || null
const tokensIn = (v) => (v ? [...v.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]) : [])
const isTint = (bg) => !!bg && (/color-mix\(|rgba?\(|#[0-9a-f]{3,8}\b/i.test(bg) || /var\(--[\w-]*-(soft|tint|wash)\b/.test(bg))
const isGradient = (bg) => !!bg && /gradient\(|texture|hatch/i.test(bg)
// ---------- CSS: every rule, in cascade order ----------
const importOrder = [...read('src/index.css').matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)].map((m) => `src/${m[1]}`)
// Notice's own files (N1) are the TARGET, not a candidate.
const TARGET = /^src\/(styles\/system\/notice\.css|components\/ui\/state\/Notice\.jsx|lib\/design\/noticeClass\.js)$/
const cssFiles = walk('src/styles', /\.css$/).filter((f) => !TARGET.test(f))
const orderOf = (f) => { const i = importOrder.indexOf(f); return i < 0 ? 1000 + cssFiles.indexOf(f) : i }
const atChain = (node) => { const o = []; for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') o.unshift(`@${p.name} ${p.params}`); return o }
const rules = []
for (const f of cssFiles) {
  postcss.parse(read(f), { from: f }).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
    const decls = []
    rule.walkDecls((d) => { if (d.parent === rule) decls.push([d.prop, d.value.replace(/\s+/g, ' ').trim()]) })
    rules.push({
      file: f.replace(/^src\/styles\//, ''), line: rule.source.start.line,
      order: orderOf(f) * 100000 + rule.source.start.line,
      selectors: rule.selectors.map((s) => s.replace(/\s+/g, ' ').trim()), decls, at: atChain(rule),
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

// The style of a SET of classes (a site wears several): every base rule whose
// selector classes are all in the set, resolved per property by specificity then
// cascade order. A rule that needs an ancestor class, an at-rule or a pseudo is out.
const STYLE_PROPS = ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-inline-start', 'border-style',
  'background', 'background-color', 'background-image', 'padding', 'padding-block', 'padding-inline', 'margin', 'color', 'fill',
  'font-family', 'font-size', 'font-weight', 'text-transform', 'border-radius', 'box-shadow', 'display',
  'border-left-width', 'border-left-style', 'border-left-color']
function styleOfSet(classes) {
  const allowed = new Set(classes)
  const won = {}; const v = {}
  for (const c of classes) {
    for (const x of subjectRules.get(c) || []) {
      if (x.role !== 'self' || x.r.at.length) continue
      if (classesIn(x.s).some((k) => !allowed.has(k) && !STATE.test(k))) continue
      const sp = specificity(x.s)
      for (const [p, val] of x.r.decls) {
        if (!STYLE_PROPS.includes(p)) continue
        const cur = won[p]
        if (!cur || sp > cur.sp || (sp === cur.sp && x.r.order >= cur.order)) { won[p] = { sp, order: x.r.order }; v[p] = val }
      }
    }
  }
  if (!v['border-left'] && v['border-left-width']) v['border-left'] = `${v['border-left-width']} ${v['border-left-style'] || 'solid'} ${v['border-left-color'] || ''}`.trim()
  return v
}
const styleOf = (c) => styleOfSet([c])
const isTriangleRule = (decls) => decls.some(([p, v]) => /^border-(top|bottom)$/.test(p) && /transparent/.test(v)) || decls.some(([p, v]) => p === 'width' && v === '0')
function leftRule(c, needPad = true) {
  for (const x of subjectRules.get(c) || []) {
    if (x.role !== 'self' || x.r.at.length) continue
    const d = Object.fromEntries(x.r.decls)
    if (needPad && !(d.padding || d['padding-inline'] || d['padding-left'] || d['padding-block'])) continue // a rail on a box, not a divider or a row accent
    let v = d['border-left'] || d['border-inline-start']
    if (!v && d['border-left-width']) v = `${d['border-left-width']} ${d['border-left-style'] || 'solid'} ${d['border-left-color'] || ''}`
    if (v && !/^(0|none)\b/.test(v) && !/transparent/.test(v) && (widthPx(v) ?? 0) >= 1.5 && !isTriangleRule(x.r.decls)) return `border-left: ${tok(v)}`
    const m = (d['box-shadow'] || '').match(/inset\s+(\d+(?:\.\d+)?)px\s+0(?:px)?\s+0(?:px)?\s+([^,]+)/)
    if (m && +m[1] >= 2) return `box-shadow: inset ${m[1]}px ${tok(m[2].trim())}`
  }
  return null
}
const tok = (x) => (x ? x.replace(/var\((--[\w-]+)(,[^)]*)?\)/g, '$1') : '')
function bordersOf(st) {
  const out = []
  const side = (p) => ({ border: 'all', 'border-top': 'T', 'border-bottom': 'B', 'border-left': 'L', 'border-right': 'R', 'border-inline-start': 'L' }[p])
  for (const p of ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-inline-start']) {
    const v = st[p]
    if (!v || /^(0|none)\b/.test(v)) continue
    const w = widthPx(v)
    const style = (v.match(/\b(solid|dashed|dotted|double)\b/) || [])[1] || ''
    const col = tokensIn(v).filter((t) => !t.startsWith('--bw-'))[0] || (v.match(/#[0-9a-f]{3,8}\b/i) || [''])[0]
    out.push(`${side(p)} ${w ?? '?'}px ${style}${col ? ` ${col}` : ''}`.replace(/\s+/g, ' ').trim())
  }
  const sh = (st['box-shadow'] || '').match(/inset\s+(\d+(?:\.\d+)?)px\s+0(?:px)?\s+0(?:px)?\s+([^,]+)/)
  if (sh && +sh[1] >= 2) out.push(`L(shadow) ${sh[1]}px ${tokensIn(sh[2])[0] || sh[2].trim()}`)
  return out.join('; ') || 'none'
}
const groundOf = (st) => tok(st.background || st['background-color'] || st['background-image'] || '')
const hasPad = (st) => !!(st.padding || st['padding-block'] || st['padding-inline'])
function shapeOf(st) {
  const bg = st.background || st['background-color'] || st['background-image'] || ''
  const b = bordersOf(st)
  const rail = /(^|; )L(\(shadow\))? (1\.5|[2-9]|\d\d)(\.\d)?px/.test(b) && !/transparent/.test(b)
  const ground = bg && !/^(none|transparent)$/.test(bg)
  if (isGradient(bg)) return 'band'
  if (rail && isTint(bg)) return 'rail+tint'
  if (rail) return 'rail'
  if (b !== 'none' && /dashed|dotted/.test(b)) return 'dashed box'
  if (b !== 'none' && isTint(bg)) return 'tint box'
  if (b !== 'none' || ground) return ground || b !== 'none' ? 'box' : 'none'
  return st.color ? 'text' : 'none'
}
function toneOf(st) {
  const order = [st['border-left'] || st['border-inline-start'], st.border, st['border-top'], st.background || st['background-color'] || st['background-image'], st.color]
  const fams = []
  for (const v of order) for (const t of tokensIn(v)) { const f = toneOfToken(t); if (f && f !== 'neutral') fams.push(f) }
  if (fams.includes('SEAL')) return 'SEAL'
  if (fams.length) return fams[0]
  return Object.keys(st).length ? 'neutral' : '·'
}
const boxOf = (st) => [
  `pad ${tok(st.padding || st['padding-block'] || '') || '·'}`,
  `mar ${tok(st.margin || '') || '·'}`,
  `font ${[tok(st['font-family']), tok(st['font-size']), tok(st['font-weight'])].map((x) => x || '·').join(' ')}`,
  `color ${tok(st.color || st.fill) || '·'}`,
].join(' · ')
// ---------- hand-added sites (Definition 2g) ----------
// Message-like tags the review found by reading, which no signal above reaches
// (copy built in code, or a name with no notice word). file:line of the opening
// tag. overrides.tsv gives the reason for each.
const ADDED = new Set([
  'components/inning/PregameScoreboard.jsx:145', 'components/inning/PregameScoreboard.jsx:148',
  'screens/expresslane/FilmPane.jsx:32', 'screens/expresslane/ExpressLanePage.jsx:229',
  'screens/expresslane/ExpressLanePage.jsx:270', 'screens/expresslane/ExpressLanePage.jsx:296',
  'components/playerstats/PlayerContractCard.jsx:185', 'screens/admin/ContractIdentityReviewPage.jsx:255',
  'screens/GamePreview.jsx:160',
])
// ---------- the EmptyState census hand-off (Definition 2f) ----------
const ES_CENSUS = join(HERE, '..', 'empty-state-collapse', 'census.mjs')
const esRows = new Map(); let esCaveats = 0
try {
  const out = execSync(`node ${JSON.stringify(ES_CENSUS)} --dump`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  for (const line of out.split('\n')) {
    const c = line.split(' | ')
    if (c[0] !== 'JSX') continue
    const job = c[5].replace(/\?$/, '')
    if (job === 'caveat') esCaveats++
    if (job === 'error' || job === 'loading') esRows.set(`${c[1].split('#')[0]}:${c[2]}`, job)
  }
} catch (e) { console.error(`EmptyState census hand-off failed: ${e.message.split('\n')[0]}`) }
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
  const prefixes = [...new Set(words.filter((c) => /^[a-z][\w-]*-$/i.test(c)))]
  const classes = [...new Set(words.filter((c) => /^[a-z][\w-]*[a-z0-9]$/i.test(c)))]
  return { classes, prefixes, raw: raw.replace(/\s+/g, ' ').trim() }
}
function copyAfter(text, end) {
  const lt = text.indexOf('<', end + 1)
  let s = text.slice(end + 1, lt < 0 ? end + 400 : Math.min(lt, end + 400))
  s = s.replace(/\{([^{}]*)\}/g, (_, inner) => { const lits = [...inner.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]); return lits.length ? lits.join(' / ') : '{…}' })
  return s.replace(/\s+/g, ' ').trim()
}
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
// ---------- candidate selectors (Definition 1 a to c) ----------
const leftOf = new Map(); const candWhy = new Map()
for (const c of subjectRules.keys()) {
  if (STATE.test(c)) continue
  const why = []
  const rail = leftRule(c)
  if (rail) { leftOf.set(c, rail); why.push('rail') }
  const st = styleOf(c)
  const inline = /^inline/.test(st.display || '') || /radius-pill|999|50%/.test(st['border-radius'] || '')
  if (!inline && isTint(st.background || st['background-color']) && bordersOf(st) !== 'none' && hasPad(st)) why.push('tint')
  if (noticeWord(c)) why.push('name')
  if (why.length) candWhy.set(c, why)
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

const jsxFiles = walk('src', /\.jsx$/).filter((f) => !TARGET.test(f))
const FOLD_MAX = 800
const sites = []
for (const f of jsxFiles) {
  const text = stripJs(read(f))
  const file = f.replace(/^src\//, '')
  const gatedFile = /revealedThrough/.test(text) || /<SealBox\b/.test(text)
  let n = 0
  for (const m of text.matchAll(/<([A-Za-z][\w.]*)(?=[\s>/])/g)) {
    const name = m[1]
    const end = tagEnd(text, m.index)
    const open = text.slice(m.index, end + 1)
    const { classes, prefixes, raw: clsRaw } = classAttr(open)
    const copy = copyAfter(text, end)
    const role = (open.match(/\brole=["'](alert|status|note|alertdialog)["']/) || [])[1] || ''
    const live = /\baria-live=/.test(open)
    let why = null
    if (name === 'AsyncStatus') why = 'AsyncStatus'
    else if (classes.includes('hint--error')) why = 'hint--error'
    else if (classes.some((c) => candWhy.has(c) && candWhy.get(c).some((w) => w !== 'tint' || true) && (candWhy.get(c).includes('rail') || candWhy.get(c).includes('name') || candWhy.get(c).includes('tint')))) why = 'class'
    else if (role || live) why = 'role'
    else if (/^[a-z]/.test(name) && ERR_PHRASE.test(copy)) why = 'copy'
    else if (ADDED.has(`${file}:${text.slice(0, m.index).split('\n').length}`)) why = 'added'
    else if (esRows.has(`${file}:${text.slice(0, m.index).split('\n').length}`)) why = `es-${esRows.get(`${file}:${text.slice(0, m.index).split('\n').length}`)}`
    if (!why) continue
    const outer = sites.findLast((s) => s.file === file && m.index < s.close && s.close - s.at < FOLD_MAX)
    if (outer) { outer.inner.push(...classes); continue }
    n++
    const { close } = bodyOf(text, m.index, name)
    let props = ''
    if (name === 'AsyncStatus') {
      props = [...open.matchAll(/(emptyMessage|errorMessage|staleErrorMessage|onRetry)=(\{|"|')/g)].map((x) => x[1]).join(' ')
      const em = open.match(/errorMessage=(?:"([^"]*)"|\{([\s\S]*?)\}\s*(?=\w+=|\/?>))/)
      if (em) props += ` · error: ${(em[1] ?? (em[2] || '').replace(/["'`]/g, '')).replace(/\s+/g, ' ').slice(0, 80)}`
    }
    sites.push({
      key: `${file}#${n}`, file, line: text.slice(0, m.index).split('\n').length, tag: name, why,
      classes, prefixes, clsRaw, copy: copy.slice(0, 110), props, role, live,
      surface: surfaceOf(file), gated: gatedFile, at: m.index, close, inner: [],
    })
  }
}
const gateCalls = []
for (const f of jsxFiles) {
  const text = stripJs(read(f))
  for (const m of text.matchAll(/\bAsyncGate\(\{/g)) gateCalls.push(`${f.replace(/^src\//, '')}:${text.slice(0, m.index).split('\n').length}`)
}
// Definition 1d: a class on a Definition-2 site is a candidate when a rule draws it.
for (const s of sites) for (const c of s.classes) if (subjectRules.has(c) && !STATE.test(c) && !candWhy.has(c)) candWhy.set(c, ['site'])
// ---------- overrides ----------
// overrides.tsv (TAB-separated; # lines are comments):
//   key  job  verdict  slice  shape  tone  reason
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
const OVR = readTsv('overrides.tsv', ['job', 'verdict', 'slice', 'shape', 'tone', 'reason'])
const used = new Set()
// ---------- the machine's job guess ----------
function guessFromCopy(copy) {
  if (/\bLoading\b|^Fetching|^Checking|^Reading the/.test(copy)) return 'loading'
  if (/Couldn|could not|Could not|failed|Failed|Try again|unavailable|error|Unable|Can[’']t/.test(copy)) return 'error'
  if (/^\s*(No|Nothing|None|Not posted)\b/.test(copy)) return 'empty'
  return null
}
function guessFromName(cls) {
  if (/--error|__error/.test(cls)) return 'error'
  if (/^(idlab|colorlab|dlab|admincopy|cwb|iddrawer|bpadmin|idadmin|designlab|lookupdeck|animlab)\b/.test(cls)) return 'tool'
  if (/(-banner)(__|--|$)/.test(cls) && !/asof/.test(cls)) return 'tape'
  if (/__btn|__toggle|__check|__chip|__input|__label$/.test(cls)) return 'control'
  if (/notice|alert|warning|toast/.test(cls)) return 'notice'
  if (/callout|pull|quote/.test(cls)) return 'callout'
  return null
}
function siteJob(s) {
  if (s.tag === 'AsyncStatus') return 'error'
  if (s.classes.includes('hint--error')) return 'error'
  const g = guessFromCopy(s.copy)
  if (g) return g
  if (s.classes.map(guessFromName).find(Boolean)) return s.classes.map(guessFromName).find(Boolean)
  if (s.tag === 'Loader') return 'loading'
  if (s.role === 'status' || s.role === 'alert') return s.classes.includes('sr-only') ? 'live' : null
  return null
}
// ---------- selector rows ----------
const selRows = [...candWhy.keys()].sort().map((c) => {
  const st = styleOf(c)
  const usedBy = sites.filter((s) => s.classes.includes(c) || s.inner.includes(c))
  const reach = subjectRules.get(c) || []
  const jobs = [...new Set(usedBy.map(siteJob).filter(Boolean))]
  const machine = guessFromName(c) || (jobs.length === 1 ? jobs[0] : null)
  const key = `.${c}`
  const o = OVR[key] || {}
  if (OVR[key]) used.add(key)
  const surfaces = [...new Set(usedBy.map((s) => s.surface).filter(Boolean))]
  return {
    key, cls: c, why: candWhy.get(c).join('+'), job: o.job || (machine ? `${machine}?` : '?'),
    verdict: o.verdict || 'UNREVIEWED', slice: o.slice || '', reason: o.reason || '',
    shape: o.shape || shapeOf(st), border: bordersOf(st), tint: groundOf(st), tone: o.tone || toneOf(st), box: boxOf(st),
    roles: [...new Set(usedBy.map((s) => s.role || 'none'))].join('/') || '—',
    rules: [...new Set(reach.map((x) => `${x.r.file}:${x.r.line}${x.r.at.length ? ' @' : ''}${x.ctx.length ? ' ctx' : ''}`))],
    sites: usedBy.map((s) => s.key), surfaces, gated: usedBy.some((s) => s.gated),
  }
})
// ---------- site rows ----------
const siteRows = sites.map(({ close, at, ...s }) => {
  const o = OVR[s.key] || {}
  if (OVR[s.key]) used.add(s.key)
  const machine = siteJob(s)
  const st = styleOfSet(s.classes)
  return {
    ...s, job: o.job || (machine ? `${machine}?` : '?'), verdict: o.verdict || 'UNREVIEWED', slice: o.slice || '', reason: o.reason || '',
    shape: o.shape || shapeOf(st), border: bordersOf(st), tint: groundOf(st), tone: o.tone || toneOf(st), box: boxOf(st),
    cls: s.classes.length || s.prefixes.length ? [...s.classes.map((c) => `.${c}`), ...s.prefixes.map((p) => `.${p}*`)].join(' ') : s.clsRaw ? `{${s.clsRaw.slice(0, 50)}}` : '—',
  }
})
const stale = Object.keys(OVR).filter((k) => !used.has(k))
// ---------- the dashed rules, for the dashed-rule fix ----------
const dashedNotice = []
for (const r of rules) {
  const d = r.decls.filter(([p, v]) => /^(border|outline)/.test(p) && /\b(dashed|dotted)\b/.test(v))
  if (!d.length) continue
  const subjCls = r.selectors.flatMap((s) => classesIn(compounds(s).at(-1) || ''))
  const cand = subjCls.filter((c) => candWhy.has(c))
  if (cand.length) dashedNotice.push({ at: `${r.file}:${r.line}`, sel: r.selectors.join(', '), how: d.map(([p, v]) => `${p}: ${tok(v)}`).join('; '), cand })
}
// ---------- output ----------
if (DUMP) {
  for (const r of selRows) console.log(['SEL', r.key, r.why, r.job, r.verdict, r.slice, r.shape, r.border, r.tone, r.surfaces.join('+'), r.roles, r.sites.length].join(' | '))
  for (const r of siteRows) console.log(['JSX', r.key, r.line, r.tag, r.cls, r.job, r.verdict, r.slice, r.shape, r.tone, r.role || '-', r.surface || '-', r.gated ? 'gated' : '', r.copy.slice(0, 60), r.props].join(' | '))
  if (stale.length) console.log(`STALE overrides: ${stale.join(' | ')}`)
  process.exit(0)
}

const by = (list, f) => { const m = {}; for (const r of list) { const k = f(r); m[k] = (m[k] || 0) + 1 } return m }
const fmtBy = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')
const bare = (j) => j.replace(/\?$/, '')
const esc = (s) => String(s).replace(/\|/g, '\\|')
const head = sh('git rev-parse --short HEAD').trim()
const unrev = [...selRows, ...siteRows].filter((r) => r.verdict === 'UNREVIEWED')
const migSel = selRows.filter((r) => r.verdict === 'MIGRATE')
const migSites = siteRows.filter((r) => r.verdict === 'MIGRATE')
const inScope = siteRows.filter((r) => r.surface)
const leftSel = selRows.filter((r) => leftOf.has(r.cls))
const noPad = [...subjectRules.keys()].filter((c) => !candWhy.has(c) && !STATE.test(c) && leftRule(c, false)).sort()

const L = []
L.push('# Notice census (#1132, slice N0)', '')
L.push(`Generated by \`census.mjs\` on ${new Date().toISOString().slice(0, 10)} from the working tree at ${head}. **Do not hand-edit.** Change \`overrides.tsv\` and re-run \`node .scratch/design-system/notice-collapse/census.mjs\`.`, '')
L.push('The definitions are in the header of `census.mjs`. In short: a **selector** is a class whose base rule draws a left rule of 1.5px or more on a box, a tinted block with a border and a padding, or whose name carries notice, banner, alert, warning, callout or toast, or that sits on a JSX site below. A **JSX site** is a tag with such a class, a tag with `role="alert"`, `"status"` or `"note"` (or `aria-live`), a `.hint--error`, an `<AsyncStatus>`, or a tag whose copy starts like an error. The **job** sorts each one.', '')
L.push('A job with a `?` is the machine\'s guess and was not checked by hand. A job with no `?` comes from `overrides.tsv`.', '')
L.push('## Headline', '')
L.push(`- **${selRows.length} candidate selectors.** By job: ${fmtBy(by(selRows, (r) => bare(r.job)))}. By why: ${fmtBy(by(selRows, (r) => r.why))}.`)
L.push(`- **${leftSel.length} selectors draw a left rule of 1.5px or more on a box** (the issue says six classes draw "a 3px left rule on a tinted inset"). By job: ${fmtBy(by(leftSel, (r) => bare(r.job)))}. With a tint as well: ${leftSel.filter((r) => r.shape === 'rail+tint').length}.`)
L.push(`- **${siteRows.length} JSX sites** in ${new Set(siteRows.map((r) => r.file)).size} files. By job: ${fmtBy(by(siteRows, (r) => bare(r.job)))}.`)
L.push(`- **Verdicts.** Selectors: ${fmtBy(by(selRows, (r) => r.verdict))}. Sites: ${fmtBy(by(siteRows, (r) => r.verdict))}.`)
L.push(`- **Tones in use** (selectors that MIGRATE): ${fmtBy(by(migSel, (r) => r.tone))}. Sites that MIGRATE: ${fmtBy(by(migSites, (r) => r.tone))}.`)
L.push(`- **Shapes today** (selectors that MIGRATE): ${fmtBy(by(migSel, (r) => r.shape))}. Sites that MIGRATE: ${fmtBy(by(migSites, (r) => r.shape))}.`)
L.push(`- **Roles today** (sites that MIGRATE): ${fmtBy(by(migSites, (r) => r.role || 'none'))}.`)
L.push(`- \`<AsyncStatus>\`: **${siteRows.filter((r) => r.tag === 'AsyncStatus').length}** sites. \`AsyncGate(…)\` calls: **${gateCalls.length}**. The EmptyState census's \`caveat\` lines, counted and not listed: **${esCaveats}**.`)
L.push(`- Sites on a spoiler surface: **${inScope.length}** (${fmtBy(by(inScope, (r) => r.surface.split(' ')[0]))}); of the MIGRATE ones: **${migSites.filter((r) => r.surface).length}** (${[...new Set(migSites.filter((r) => r.surface).map((r) => `\`${r.file}\``))].join(', ') || 'none'}). In a file that reads \`revealedThrough\` or renders a \`SealBox\`: **${migSites.filter((r) => r.gated).length}** MIGRATE sites. \`(via X)\` means the page file X imports the component directly.`)
L.push(`- **Dashed rules on a candidate:** ${dashedNotice.length}. Part 4 lists them.`)
if (stale.length) L.push(`- **STALE overrides**: ${stale.join(' | ')}`)
L.push(`- **UNREVIEWED rows: ${unrev.length}**${unrev.length ? ` — ${unrev.slice(0, 40).map((r) => `\`${r.key}\``).join(', ')}${unrev.length > 40 ? ' …' : ''}` : ''}`, '')
L.push('Column key: **why** rail (left rule ≥ 1.5px) · tint (tinted ground + border + padding) · name (notice, banner, …) · site (a JSX site wears it). **shape** rail+tint · rail · tint box · dashed box · band (gradient or hatch) · text (colour only) · box · none. **border** every border the base rule draws (L left, T top, B bottom, R right, all = four sides). **tone** the colour family the row reads (SEAL = a `--seal*` read, which no Notice may do). **box** padding · margin · font · colour. **role** the role attribute on the site. **scope** the spoiler surface (`gated` = the file reads `revealedThrough` or renders a `SealBox`).', '')

const JOBS = ['notice', 'error', 'loading', 'empty', 'caveat', 'callout', 'tape', 'card', 'tool', 'control', 'live', 'other', '']
const jobKey = (r) => bare(r.job).replace(/^\?$/, '')
L.push('## Part 1 — the selectors, by job', '')
for (const j of JOBS) {
  const list = selRows.filter((r) => jobKey(r) === j)
  if (!list.length) continue
  L.push(`### ${j || 'no guess'} (${list.length})`, '')
  L.push('| selector | why | job | shape | border | tint | tone | box | role | scope | sites | verdict | slice | reason |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of list) L.push(`| \`${r.key}\` | ${r.why} | ${r.job} | ${r.shape} | ${esc(r.border)} | ${esc(r.tint.slice(0, 60) || '·')} | ${r.tone} | ${esc(r.box)} | ${r.roles} | ${r.surfaces.join(', ') || '—'}${r.gated ? ' gated' : ''} | ${r.sites.length} | ${r.verdict} | ${r.slice} | ${esc(r.reason)} |`)
  L.push('')
}

L.push('## Part 2 — the JSX sites, by job', '')
L.push('`copy` is the text right after the tag (string literals kept, code shown as `{…}`). For `<AsyncStatus>` it is the props.', '')
for (const j of JOBS) {
  const list = siteRows.filter((r) => jobKey(r) === j)
  if (!list.length) continue
  L.push(`### ${j || 'no guess'} (${list.length})`, '')
  L.push('| site | class | copy | job | shape | border | tone | box | role | scope | verdict | slice | reason |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const r of list) L.push(`| \`${r.file}:${r.line}\` (${r.key.split('#')[1]}) | \`${esc(r.cls)}\` | ${esc((r.tag === 'AsyncStatus' ? r.props : r.copy).slice(0, 80)) || '—'} | ${r.job} | ${r.shape} | ${esc(r.border)} | ${r.tone} | ${esc(r.box)} | ${r.role || '—'} | ${r.surface || '—'}${r.gated ? ' gated' : ''} | ${r.verdict} | ${r.slice} | ${esc(r.reason)} |`)
  L.push('')
}

L.push('## Part 3 — where each selector\'s rules live', '')
L.push('`@` = inside an at-rule; `ctx` = the selector also needs an ancestor class.', '')
for (const r of selRows) L.push(`- \`${r.key}\` — ${r.rules.join(', ')}${r.sites.length ? ` · sites: ${r.sites.join(', ')}` : ' · **no JSX site** (dead, or built at run time)'}`)
L.push('')

L.push('## Part 4 — every dashed rule on a candidate', '')
L.push('Input for the dashed-rule fix (the fourth item of #1132). This census does not decide what dashed means.', '')
L.push('| rule | selector | declaration | candidate (its job) | verdict |', '| --- | --- | --- | --- | --- |')
for (const d of dashedNotice) L.push(`| ${d.at} | \`${esc(d.sel.slice(0, 90))}\` | \`${esc(d.how.slice(0, 80))}\` | ${d.cand.map((c) => `\`.${c}\``).join(' ')} | ${d.cand.map((c) => { const r = selRows.find((x) => x.cls === c); return r ? `${bare(r.job)} · ${r.verdict}` : '?' }).join(', ')} |`)
L.push('')

L.push('## Part 5 — left rules with no padding (listed, not reviewed)', '')
L.push(`${noPad.length} more classes draw a left rule of 1.5px or more on a rule with no padding: a cell divider, a chart gridline, a row accent keyed to the favourite club. None holds text of its own, so none is a Notice candidate. The census lists them so the count of "classes that draw a left rule" is complete.`, '')
L.push(noPad.map((c) => `\`.${c}\``).join(' · '), '')

writeFileSync(join(HERE, 'census.md'), L.join('\n'))
const slim = siteRows.map(({ key, line, tag, cls, copy, props, job, verdict, slice, shape, border, tint, tone, box, role, surface, gated }) => ({ key, line, tag, cls, copy, props, job, verdict, slice, shape, border, tint, tone, box, role, surface, gated }))
writeFileSync(join(HERE, 'census.json'), JSON.stringify({ head, selectors: selRows, sites: slim, gateCalls, dashed: dashedNotice }, null, 1))
console.log(`selectors ${selRows.length} (migrate ${migSel.length}) · sites ${siteRows.length} (migrate ${migSites.length}) · left rules ${leftSel.length} · dashed ${dashedNotice.length} · unreviewed ${unrev.length}`)
if (stale.length) console.log(`STALE overrides: ${stale.join(' | ')}`)
