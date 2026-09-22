// Counts direct reads of the primitive colour tier in src/styles/, two
// independent ways, and prints a sample of what matched.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

const files = []
;(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.css')) files.push(p.split(sep).join('/'))
  }
})('src/styles')

const blank = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))

// --- METHOD A: var(--token) occurrences, token name allowed digits ---------
const A = /var\(\s*(--(?:paper-\d+|rule(?:-[a-z0-9-]+)?))\s*[,)]/g
const byToken = {}
const byFile = {}
const samples = {}
let aTotal = 0
for (const f of files) {
  const css = blank(readFileSync(f, 'utf8'))
  for (const m of css.matchAll(A)) {
    aTotal += 1
    byToken[m[1]] = (byToken[m[1]] || 0) + 1
    byFile[f] = (byFile[f] || 0) + 1
    const line = css.slice(0, m.index).split('\n').length
    ;(samples[m[1]] ??= []).push(`${f.replace('src/styles/', '')}:${line}`)
  }
}

// --- METHOD B: split the file on `var(` and read the head of each piece ----
let bPaper = 0
let bRule = 0
for (const f of files) {
  const parts = blank(readFileSync(f, 'utf8')).split('var(')
  for (const p of parts.slice(1)) {
    const name = p.trim().split(/[,)\s]/)[0]
    if (/^--paper-\d+$/.test(name)) bPaper += 1
    else if (/^--rule(-[a-z0-9-]+)?$/.test(name)) bRule += 1
  }
}

const paperA = Object.entries(byToken).filter(([k]) => k.startsWith('--paper-'))
const ruleA = Object.entries(byToken).filter(([k]) => k.startsWith('--rule'))
const sum = (rows) => rows.reduce((n, [, v]) => n + v, 0)

console.log('METHOD A (var(--token) occurrences)')
console.log(`  --paper-N total : ${sum(paperA)}`)
for (const [k, v] of paperA.sort((a, b) => b[1] - a[1])) console.log(`      ${k.padEnd(14)} ${v}`)
console.log(`  --rule*  total : ${sum(ruleA)}`)
for (const [k, v] of ruleA.sort((a, b) => b[1] - a[1])) console.log(`      ${k.padEnd(14)} ${v}`)
console.log(`  GRAND TOTAL     : ${aTotal}   across ${Object.keys(byFile).length} partials`)

console.log('\nMETHOD B (split on `var(`, independent parse)')
console.log(`  --paper-N total : ${bPaper}`)
console.log(`  --rule*  total : ${bRule}`)
console.log(`  GRAND TOTAL     : ${bPaper + bRule}`)
console.log(`  agrees with A   : ${bPaper === sum(paperA) && bRule === sum(ruleA)}`)

console.log('\nSAMPLE — first 3 sites per token')
for (const k of Object.keys(samples).sort()) console.log(`  ${k.padEnd(14)} ${samples[k].slice(0, 3).join('  ')}`)

// --- the alias tier, so the issue can say which primitives have a name -----
const tokens = readFileSync('src/tokens/colors.css', 'utf8')
console.log('\nALIASES POINTING AT THE PRIMITIVE TIER (src/tokens/colors.css)')
for (const m of tokens.matchAll(/(--[\w-]+)\s*:\s*var\(\s*(--(?:paper-\d+|rule(?:-[a-z0-9-]+)?))\s*\)/g)) {
  console.log(`  ${m[1].padEnd(20)} -> ${m[2]}`)
}
