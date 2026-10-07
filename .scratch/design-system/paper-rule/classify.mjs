// Reads census-raw.json (+ the outside consumers) and writes census.csv.
// Usage: node .scratch/design-system/paper-rule/classify.mjs   (run census.mjs first)
import { readFileSync, writeFileSync } from 'node:fs'
const D = '.scratch/design-system/paper-rule/'
const raw = JSON.parse(readFileSync(D + 'census-raw.json', 'utf8')).map((r) => ({ ...r, scope: 'styles' }))

// Outside src/styles/: parse the two CSS files the same way, hand-list the JSX reads.
const cssReads = (file, scope) => {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
  const out = []
  for (const m of css.matchAll(/var\(\s*(--(?:paper-\d+|rule(?:-[a-z0-9-]+)?))\s*[,)]/g)) {
    const pre = css.slice(0, m.index)
    const cut = Math.max(pre.lastIndexOf(';'), pre.lastIndexOf('{'), pre.lastIndexOf('}'))
    const pm = pre.slice(cut + 1).match(/([\w-]+)\s*:/)
    let depth = 0, i
    for (i = m.index; i >= 0; i--) { if (css[i] === '}') depth++; else if (css[i] === '{') { if (depth === 0) break; depth-- } }
    const start = Math.max(css.lastIndexOf('}', i), css.lastIndexOf('{', i - 1), css.lastIndexOf(';', i)) + 1
    out.push({ file, line: pre.split('\n').length, selector: css.slice(start, i).replace(/\s+/g, ' ').trim(),
      property: pm ? pm[1] : '', token: m[1], value: css.slice(cut + 1).split(/[;}]/)[0].replace(/\s+/g, ' ').trim(), scope })
  }
  return out
}
const jsx = [
  ['src/components/scoring/BaseoutDiamond.jsx', 28, 'BaseoutDiamond (off base)', 'fill', '--paper-2'],
  ['src/components/scoring/BaseoutDiamond.jsx', 29, 'BaseoutDiamond (off base)', 'stroke', '--rule'],
  ['src/components/scoring/BaseoutDiamond.jsx', 38, 'BaseoutDiamond', 'stroke', '--rule'],
  ['src/components/scoring/PlayDiamond.jsx', 137, 'PlayDiamond', 'stroke', '--rule'],
  ['src/components/scoring/PlayDiamond.jsx', 176, 'PlayDiamond (scored)', 'stroke', '--paper-2'],
  ['src/components/scoring/BaseState.jsx', 30, 'BaseState (filled)', 'fill', '--paper-3'],
  ['src/components/scoring/BaseState.jsx', 31, 'BaseState', 'stroke', '--paper-3'],
  ['src/components/page-turn/PageCurlOverlay.jsx', 63, 'PageCurlOverlay backside', 'fill', '--paper-1'],
].map(([file, line, selector, property, token]) => ({ file, line, selector, property, token, value: '', scope: 'outside-jsx' }))
const poster = [39, 40, 41, 42, 48, 49, 50].map((line) => {
  const t = readFileSync('src/lib/preview/posterPaper.js', 'utf8').split('\n')[line - 1].match(/'(--[\w-]+)'/)[1]
  return { file: 'src/lib/preview/posterPaper.js', line, selector: 'TOKEN_OF map (runtime :root read)', property: 'getPropertyValue', token: t, value: '', scope: 'outside-exempt' }
})
const rows = [
  ...raw,
  ...cssReads('src/tokens/effects.css', 'outside-css').filter((r) => /^--(paper|rule)/.test(r.token)),
  ...cssReads('public/learn.css', 'outside-learn').filter((r) => r.property && !/^--paper-\d$|^--rule/.test(r.property)),
  ...jsx,
  ...poster,
]

const BORDERISH = /^(border|outline|box-shadow|background|--table-pin)/
const MARKISH = /^(color|fill|stroke|stop-color)$/
const g = (r) => `${r.selector} ${r.property}`
function classify(r) {
  const { token: t, property: p, selector: s, value: v } = r
  const base = { alias: 'none', role: '', repl: '', conf: 'ask' }
  if (r.scope === 'outside-exempt')
    return { alias: 'none', role: 'runtime read of the primitive tier (alias would return the string "var(...)")', repl: '(keep; exempt from the rule)', conf: 'sure' }
  const learn = r.scope === 'outside-learn'
  const mix = /color-mix|gradient/.test(v)
  if (t === '--paper-3') {
    const alias = '--surface-inset'
    if (MARKISH.test(p) || /^border-(top|bottom)$/.test(p) && /tri/.test(s) || /^border$/.test(p) && /::before/.test(s))
      return { alias, role: 'bright mark or text on a dark fill (alias names a surface)', repl: alias, conf: 'likely' }
    if (mix) return { alias, role: 'bright inset inside a tint or gradient', repl: alias, conf: 'likely' }
    return { alias, role: 'inset surface (brightest paper)', repl: alias, conf: 'sure' }
  }
  if (t === '--rule-soft' || t === '--rule') {
    const alias = t === '--rule' ? '--border-rule' : '--border-hairline'
    if (MARKISH.test(p)) return { alias, role: 'faint mark or text (alias names a border)', repl: alias, conf: 'likely' }
    if (mix) return { alias, role: 'rule inside a gradient', repl: alias, conf: 'likely' }
    return { alias, role: t === '--rule' ? 'table or card rule' : 'hairline rule', repl: alias, conf: 'sure' }
  }
  if (t === '--rule-grid') {
    let role, conf = 'ask'
    if (/gradient/.test(v) || /body$/.test(s) && /gradient/.test(v)) role = 'graph-paper grid lines'
    else if (/^(border|outline)/.test(p) || p === 'box-shadow' || /::after$/.test(s) && /roundlabel/.test(s)) role = 'faint row or cell separator'
    else if (/:hover|:active/.test(s)) role = 'hover or press wash'
    else if (/barcell|trendstrip|statusmeter|pillars|yrange|rungbar|progress/.test(s)) role = 'meter or bar track'
    else if (/--ps-faint/.test(p)) role = 'print-sheet faint line'
    else if (/pscene/.test(s)) role = 'scene fill (pitcher scene)'
    else role = 'other'
    return { alias: 'none', role, repl: '(new token, see proposal)', conf }
  }
  if (t === '--paper-0') {
    if (p === 'color') return { alias: '--bg-canvas', role: 'text on a dark badge (paper-0 differs from --text-on-ink)', repl: '--text-on-ink would move the colour; keep a canvas name?', conf: 'ask' }
    return { alias: '--bg-canvas', role: /dot/.test(s) ? 'ring gap on a dot (page ground)' : 'ground of a hole in a chip', repl: '--bg-canvas', conf: 'likely' }
  }
  if (t === '--paper-2') {
    if (/clerk|album/.test(s)) return base
    if (/^color$/.test(p) || /loader__(scoreboard|colhead|num|team|scor)/.test(s) && /color-mix/.test(v))
      return { alias: '--text-on-ink', role: 'text or line on a dark band', repl: '--text-on-ink', conf: /color-mix/.test(v) ? 'likely' : 'sure' }
    if (/ticker/.test(s)) return { alias: '--surface-card', role: 'blend of card and inset', repl: '--surface-card', conf: 'ask' }
    if (/contractcard__frame/.test(s)) return { alias: '--surface-card', role: 'card frame gradient stop', repl: '--surface-card', conf: 'likely' }
    if (/color-mix/.test(v)) return { alias: '--surface-card', role: 'card tinted by a state colour', repl: '--surface-card', conf: 'likely' }
    if (/outdot|tallyLogobox/.test(s)) return { alias: '--surface-card', role: 'small dot or logo tile on card paper', repl: '--surface-card', conf: 'likely' }
    return { alias: '--surface-card', role: 'card surface', repl: '--surface-card', conf: 'sure' }
  }
  if (t === '--paper-1') {
    const pg = '--bg-page'
    if (/jsx$/.test(r.file)) return { alias: 'none', role: 'back of a turning page', repl: pg, conf: 'ask' }
    if (/tint, var/.test(v)) return { alias: 'none', role: 'logo tile ground (no club tint)', repl: pg, conf: 'ask' }
    if (/contractcard__frame/.test(s)) return { alias: 'none', role: 'card frame gradient stop', repl: pg, conf: 'ask' }
    if (/45deg/.test(v)) return { alias: 'none', role: 'transparency checkerboard', repl: '(own token? see proposal)', conf: 'ask' }
    if (/box-shadow/.test(p)) return { alias: 'none', role: 'gap in a selection ring', repl: pg, conf: 'ask' }
    if (/hover/.test(s) && !/--table-pin/.test(p) && !/dh__row/.test(s)) return { alias: 'none', role: 'hover wash on a row or button', repl: pg, conf: 'likely' }
    if (/abs__detail|dh__(row--open|drawerrow)/.test(s)) return { alias: 'none', role: 'open row or drawer ground', repl: pg, conf: 'likely' }
    if (/wpapreview|idlab__section|recolorsource|recolorpreview|monoinkart/.test(s)) return { alias: 'none', role: 'preview well or panel ground', repl: pg, conf: 'likely' }
    if (/slider-thumb|range-thumb/.test(s)) return { alias: 'none', role: 'slider thumb fill', repl: pg, conf: 'ask' }
    if (p === 'color') return { alias: 'none', role: 'text on a dark band (paper-1 differs from --text-on-ink)', repl: '(ask)', conf: 'ask' }
    return { alias: 'none', role: 'chip, badge or small fill darker than its card', repl: pg, conf: 'likely' }
  }
  return base
}

// --- Gary's answers (2026-10-07). Decision 4 groups are PROPOSALS until he picks names. ---
const D4 = (r) => {
  const { token: t, property: p, selector: s, file, line } = r
  const f = file.replace('src/styles/', '')
  if (t === '--paper-3' && (p === 'color' || (p === 'fill' && /strikezone__num/.test(s)) || (/^border-(top|bottom)$/.test(p) && /gamehud__tri/.test(s))))
    return ['text-on-ink-bright', '--text-on-ink-bright (new, = --paper-3)']
  if (t === '--rule-soft' && p === 'color' && /scorebookstory|abouthero__kicker/.test(s)) return ['text-on-ink-faint', '--text-on-ink-faint (new, = --rule-soft)']
  if (t === '--rule' && p === 'color' && /umptend/.test(s)) return ['text-on-ink-faint?', '--text-on-ink-faint (colour moves) or keep --border-rule']
  if (p === 'color' && /aboutstory__n|payboard__rank|pgame__dot/.test(s)) return ['ghost-alias', 'alias (decorative text on paper, no AA pair)']
  if (t === '--paper-3' && p === 'stroke' && /pip__tick|bpdiagram__line|hitchart__h|bflight__h/.test(s)) return ['mark-halo', '--mark-halo (new, = --paper-3)']
  if (/^(stroke|fill|stop-color)$/.test(p)) return ['art-alias', 'alias (ball and diagram art)']
  return ['surface-alias', 'alias (surface or border inside a gradient or ring)']
}
function decided(r) {
  const o = { ...r }
  const sureIt = (repl) => { o.repl = repl; o.conf = 'sure'; o.role += ' [decided]' }
  if (r.scope === 'outside-learn') { o.alias = 'none in learn.css'; o.repl = '(exempt, decision 5)'; o.conf = 'sure'; return o }
  if (r.token === '--rule-grid') return (sureIt('--border-grid (new)'), o)
  if (r.token === '--paper-1') return (/text on a dark band/.test(r.role) ? (sureIt('--bg-canvas'), o) : (sureIt('--bg-page'), o))
  if (r.token === '--paper-0') return (/text on a dark badge/.test(r.role) ? (sureIt('--bg-canvas'), o) : (sureIt('--bg-page'), o))
  if (r.token === '--paper-2' && /ticker/.test(r.selector)) return (sureIt('--surface-card'), o)
  if (['--paper-3', '--rule', '--rule-soft'].includes(r.token) && r.conf === 'likely') {
    const [g] = D4(r); o.group = g
    const ALIAS = { '--paper-3': '--surface-inset', '--rule-soft': '--border-hairline', '--rule': '--border-rule' }
    o.repl = g === 'text-on-ink-bright' ? '--text-on-ink-bright (new)' : g === 'text-on-ink-faint' ? '--text-on-ink-soft (new)'
      : g === 'text-on-ink-faint?' ? '--text-on-ink-dim (new)' : ALIAS[r.token]
    o.group = g === 'text-on-ink-faint' ? 'text-on-ink-soft' : g === 'text-on-ink-faint?' ? 'text-on-ink-dim' : g
    o.conf = 'sure'; o.role += ' [decided 4]'; return o
  }
  return o
}
const q = (x) => `"${String(x).replace(/"/g, '""')}"`
const hdr = ['scope', 'file', 'line', 'selector', 'property', 'token', 'alias_it_could_use', 'role', 'proposed_replacement', 'confidence', 'decision4_group']
const out = [hdr.join(',')]
const done0 = rows.map((r) => ({ ...r, ...(() => { const c = classify(r); return { alias: c.alias, role: c.role, repl: c.repl, conf: c.conf } })() }))
const done = done0.map(decided)
// learn.css own definitions are excluded above (property filter). Learn reads: aliases do not exist there.
for (const r of done) {
    out.push([r.scope, r.file, r.line, q(r.selector), r.property, r.token, r.alias, q(r.role), q(r.repl), r.conf, r.group || ''].join(','))
}
writeFileSync(D + 'census.csv', out.join('\n') + '\n')
const tally = {}
for (const r of done.filter((x) => x.scope === 'styles')) {
  const k = `${r.token} | ${r.conf}`; tally[k] = (tally[k] || 0) + 1
  const k2 = `${r.token} | ${r.role}`; tally[k2] = (tally[k2] || 0) + 1
}
console.log(done.length, 'rows;', done.filter((x) => x.scope === 'styles').length, 'in src/styles')
console.log(Object.entries(tally).sort().map(([k, v]) => `${v}\t${k}`).join('\n'))
console.log(JSON.stringify(done.reduce((a, r) => ((a[r.scope] = (a[r.scope] || 0) + 1), a), {})))
