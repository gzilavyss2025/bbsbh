// Split --fs-caption by the JOB EACH RULE DOES, not by its name.
//
// 793 declarations set font-size: var(--fs-caption) across three type faces.
// The face decides the destination:
//   display -> --fs-label  (12px)  labels, pills, table heads
//   mono    -> --fs-cell   (11px)  figures; same size, its own name
//   body/read running copy -> --fs-small (13px)
//   everything else        -> stays --fs-caption, unchanged and unrisked
//
// FACE comes from the same rule where it is stated, and from the BROWSER where
// it is inherited (.scratch/design-system/prB/probe.mjs walks 50+ routes and
// reads what actually rendered). :root sets --font-body, so an unresolved rule
// is body-face by default -- but "body-face" is not enough to move it, because
// a rule that never rendered might sit inside a mono table, and +1px there
// breaks a column. Those stay put. This sweep only moves what it can show.
//
// RUNNING COPY vs TOKEN, for the body/read rules, is decided by EVIDENCE first:
// the longest text the probe ever saw that rule render. >= 25 characters is a
// sentence; under that is a name, a position, a count. Only where nothing ever
// rendered does the selector's role-suffix decide.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const COPY_SUFFIX = /(note|notice|caption|blurb|fineprint|gloss|sub|subnote|foot|hint|desc|prose|source|details|rulehead|callout|warn|waiting|reactiontext|what|basis|floor|statline|prov|scopenote)$/i
const MIN_SENTENCE = 25

const rendered = new Map()
for (const f of ['rendered-11px.json', 'rendered-11px-2.json']) {
  let rows = []
  try { rows = JSON.parse(readFileSync(`.scratch/design-system/prB/${f}`, 'utf8')) } catch { continue }
  for (const r of rows) for (const c of r.cls.split(/\s+/)) {
    if (!c) continue
    const prev = rendered.get(c)
    if (!prev || r.maxLen > prev.maxLen) rendered.set(c, { face: r.face, maxLen: r.maxLen, txt: r.txt })
  }
}

const files = []
;(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.css')) files.push(p) } })('src/styles')

const FAM = (v) => v.includes('--font-display') ? 'display' : v.includes('--font-mono') ? 'mono'
  : v.includes('--font-read') ? 'read' : v.includes('--font-body') ? 'body' : 'other'

const decisions = []
let changedFiles = 0

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  // Blank out comments (same length, so every offset below stays true).
  const masked = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))

  // Index every rule: selector, body span. Two passes so a family stated on the
  // same selector elsewhere in the file is available to a rule that omits it.
  const rules = []
  const famBySel = new Map()
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(masked))) {
    const sel = m[1].trim().replace(/\s+/g, ' ')
    if (!sel || sel.startsWith('@')) continue
    const bodyStart = m.index + m[0].indexOf('{') + 1
    rules.push({ sel, body: m[2], bodyStart })
    const f = m[2].match(/font-family\s*:\s*([^;]+);/)
    if (f) for (const s of sel.split(',')) famBySel.set(s.trim(), FAM(f[1]))
  }

  const edits = []
  for (const r of rules) {
    const fsDecl = /font-size\s*:\s*var\(--fs-caption\)/.exec(r.body)
    if (!fsDecl) continue

    // --- face ---
    let face = null, how = null
    const own = r.body.match(/font-family\s*:\s*([^;]+);/)
    if (own) { face = FAM(own[1]); how = 'same rule' }
    if (!face) for (const s of r.sel.split(',')) {
      const k = s.trim(); if (famBySel.has(k)) { face = famBySel.get(k); how = 'same selector'; break }
    }
    // --- the browser, for anything that inherits its face ---
    let seen = null
    for (const s of r.sel.split(',')) {
      const last = (s.trim().split(/[\s>+~]/).pop() || '')
      for (const c of last.split(/[.:]/).filter(Boolean)) if (rendered.has(c)) { seen = rendered.get(c); break }
      if (seen) break
    }
    if (!face && seen) { face = seen.face; how = 'rendered' }

    // --- destination ---
    let to = null, why = null
    if (face === 'display') { to = '--fs-label'; why = 'display face -> the label role, 12px' }
    else if (face === 'mono') { to = '--fs-cell'; why = 'mono face -> figures, 11px, unchanged' }
    else if (face === 'body' || face === 'read') {
      const isCopy = seen ? seen.maxLen >= MIN_SENTENCE
        : COPY_SUFFIX.test((r.sel.split(',')[0] || '').trim().split(/[\s>+~]/).pop().replace(/^[.#]/, '').split(/[.:]/)[0])
      if (isCopy) { to = '--fs-small'; why = seen ? `running copy — rendered ${seen.maxLen} chars` : 'running copy — role name' }
      else { to = null; why = seen ? `token — rendered ${seen.maxLen} chars` : 'token — role name' }
    } else { to = null; why = `face unresolved (${face || 'none'}) — never rendered, left at 11px` }

    const line = raw.slice(0, r.bodyStart + fsDecl.index).split('\n').length
    decisions.push({ file: file.split(String.fromCharCode(92)).join('/'), line, sel: r.sel.slice(0, 60), face: face || 'unknown', how: how || '-', to: to || '--fs-caption (kept)', why })
    if (to) edits.push({ at: r.bodyStart + fsDecl.index, len: fsDecl[0].length, to: `font-size: var(${to})` })
  }

  if (!edits.length) continue
  edits.sort((a, b) => b.at - a.at)
  let out = raw
  for (const e of edits) out = out.slice(0, e.at) + e.to + out.slice(e.at + e.len)
  writeFileSync(file, out)
  changedFiles++
}

const by = {}
for (const d of decisions) by[d.to] = (by[d.to] || 0) + 1
console.log(`${decisions.length} --fs-caption declarations, ${changedFiles} files rewritten\n`)
console.log('destinations:', by)
writeFileSync('.scratch/design-system/prB/decisions.json', JSON.stringify(decisions, null, 1))
