#!/usr/bin/env node
// A raw value may only ever SHRINK.
//
// THE PROBLEM THIS EXISTS TO CLOSE (#1178). The tokens exist — colour in
// tokens/colors.css, --radius-* in tokens/spacing.css, --dur-* and --shadow-*
// in tokens/effects.css — but many rules still write the value out by hand. A
// raw value is a value that a token change does not reach. When the request is
// "rounder cards" or "slower motion", those rules stay behind, and nobody finds
// them until a screenshot looks wrong.
//
// Four kinds are counted over src/styles/, subdirectories included. The unit is
// the DECLARATION, not the literal: `border-radius: 6px 6px 0 0` is one rule
// reading no token, and it is one edit to fix.
//
//   hex       any declaration whose value holds a colour hex (#fff, #16222f)
//   radius    a border-radius (or a border-*-*-radius longhand) with a non-zero
//             length (6px, 50%) in it
//   motion    a transition / animation (or its -duration / -delay longhand)
//             with a non-zero time (120ms, .3s) in it
//   shadow    a box-shadow with a non-zero length or a colour in it. A ring
//             built as `0 0 0 var(--bw-hair) var(--ink)` reads a token for
//             every value that can change, so it does not count
//
// Two things are NOT raw, on purpose:
//   - Anything inside var( ). A fallback like var(--pinstripe-bg, #fff) is
//     reached by the token it names, and test/css-tokens.test.js already fails
//     a var(--token) that no sheet defines, so a fallback cannot hide a value.
//   - A zero. `border-radius: 0` and `0s` are "none", not a design value that a
//     token governs.
//
// The count is a RATCHET: it may fall, it may not rise. A new rule must read a
// token. When a count falls, lower its budget in the same PR — the warning below
// prints the number. Each collapse PR (#1131, #1113, #1132) lowers the budget
// for the families it touches; what remains after that is one sweep PR.
//
// A real one-off (the stamp art, the scorecard grid, a #fff canvas fill) opts
// out with a `raw-value-exempt: <reason>` comment on any line of the
// declaration. The reason is required: a bare marker fails.
//
// EVERY COUNT IS TAKEN TWICE, TWO WAYS. #1156 found a guard whose `[a-z-]`
// class counted zero reads of tokens whose names end in a digit, and printed
// its tick anyway. So a regex pass and a character scanner count each kind
// independently, and the guard fails if they disagree. Neither is trusted
// alone.
//
// Padding and gap are ADR-0085's guard, not this one. #1156 guards a rule that
// reads the WRONG token; this guards a rule that reads NO token. #1114 guards
// card and pill SHAPE; this guards VALUES.
//
// Zero deps. Run by `npm run lint`.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Declarations under src/styles/ that read a raw value, per kind. DOWNWARD ONLY.
// Measured on origin/main at ffd91507a, the day this guard landed.
//
// These are lower than #1178's table (123 / 132 / 71 / 23), and the table is not
// wrong so much as counting something else. It came from line greps over the
// raw text: the hex figure counted comment prose (about 90 of the ~150 hex
// strings under src/styles/ sit in comments) and var() fallbacks; the radius
// figure counted `border-radius: 0` and zero corners; the motion figure counted
// lines, not declarations, and zero times. The shadow figure goes the other way
// (this guard counts more) and its method could not be reproduced; every one of
// the 45 here carries a non-zero offset or a colour outside var( ). This guard
// counts declarations, with comments blanked, var( ) contents skipped and zeros
// ignored — see the header.
export const BUDGETS = {
  hex: 26,
  radius: 83,
  motion: 63,
  shadow: 44,
}

export const KINDS = Object.keys(BUDGETS)

const EXEMPT = /raw-value-exempt\b(\s*:\s*[^\s*])?/

// Blank out /* ... */ comments while keeping every newline and every line's
// length, so offsets and line numbers stay exact. Comment prose never counts.
export const maskComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

// ─── Way one: regular expressions ────────────────────────────────────────────

// Remove var( ... ) with up to two levels of nested parentheses inside it —
// var(--x, rgba(0, 0, 0, .2)) and var(--a, var(--b, #fff)). Way two counts
// depth properly, so anything deeper shows up as a disagreement, not a miss.
const VAR_CALL = /var\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g
const stripVarsRe = (v) => {
  let prev
  do {
    prev = v
    v = v.replace(VAR_CALL, ' ')
  } while (v !== prev)
  return v.replace(/!important/gi, ' ')
}

const HEX_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i
// A number WITH a unit (6px, 50%, .5em). A bare number is a calc() multiplier,
// never a length on its own, so `calc(var(--radius-sm) * 2)` reads a token.
const LENGTH_RE = /(?<![\w.#-])-?(\d*\.\d+|\d+)[a-z%]+(?![\w.])/gi
const TIME_RE = /(?<![\w.#-])(\d*\.\d+|\d+)(ms|s)(?![\w-])/gi

const nonZero = (re, v) => [...v.matchAll(re)].some((m) => Number(m[1]) !== 0)

const TESTS_RE = {
  hex: (prop, v) => HEX_RE.test(v),
  radius: (prop, v) => /^border(-[a-z]+-[a-z]+)?-radius$/.test(prop) && nonZero(LENGTH_RE, v),
  motion: (prop, v) =>
    /^(transition|animation)(-duration|-delay)?$/.test(prop) && nonZero(TIME_RE, v),
  shadow: (prop, v) =>
    prop === 'box-shadow' &&
    (HEX_RE.test(v) || /\b(rgba?|hsla?|color-mix|oklch)\(/i.test(v) || nonZero(LENGTH_RE, v)),
}

// A declaration is a property, a colon, and a value up to ; { or }. The
// property may be a custom property (--card-edge: #fff counts as hex).
const DECL_RE = /(?<![\w.#:-])(-{0,2}[a-z][a-z0-9-]*)\s*:\s*([^;{}]*)/gi

function declarationsRe(masked) {
  const out = []
  for (const m of masked.matchAll(DECL_RE)) {
    // A selector like `a:hover {` also looks like `prop: value` up to the brace.
    // A declaration ends at ; or }, never at {.
    const end = m.index + m[0].length
    if (masked[end] === '{') continue
    out.push({ prop: m[1].toLowerCase(), value: m[2], start: m.index, end })
  }
  return out
}

export function scanRegex(masked) {
  const found = Object.fromEntries(KINDS.map((k) => [k, []]))
  for (const d of declarationsRe(masked)) {
    const v = stripVarsRe(d.value)
    for (const k of KINDS) if (TESTS_RE[k](d.prop, v)) found[k].push(d)
  }
  return found
}

// ─── Way two: a character scanner, no regular expressions ────────────────────

const isDigit = (c) => c >= '0' && c <= '9'
const isHexChar = (c) => isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
const isWordChar = (c) =>
  isDigit(c) || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '-' || c === '_'

// Split the sheet on ; { } — a piece that ends in { is a selector or an
// at-rule prelude; a piece that ends in ; or } and has a colon is a declaration.
function declarationsChars(masked) {
  const out = []
  let start = 0
  let depth = 0 // parentheses, so a ; inside url( ) cannot end a declaration
  for (let i = 0; i <= masked.length; i++) {
    const c = masked[i]
    if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    const boundary = i === masked.length || (depth === 0 && (c === ';' || c === '{' || c === '}'))
    if (!boundary) continue
    const piece = masked.slice(start, i)
    if (c !== '{') {
      const colon = piece.indexOf(':')
      if (colon > 0) {
        let s = 0
        while (s < colon && ' \t\r\n'.includes(piece[s])) s++
        const prop = piece.slice(s, colon).trim().toLowerCase()
        let ok = prop.length > 0
        for (const ch of prop) if (!isWordChar(ch)) ok = false
        if (ok) {
          let v = colon + 1
          while (v < piece.length && ' \t\r\n'.includes(piece[v])) v++
          out.push({ prop, value: piece.slice(v), start: start + s, end: i })
        }
      }
    }
    start = i + 1
  }
  return out
}

// Blank every var( ... ), however deep, by counting parentheses.
function stripVarsChars(v) {
  let out = ''
  for (let i = 0; i < v.length; i++) {
    if (v.startsWith('var(', i) && !isWordChar(v[i - 1] ?? ' ')) {
      let depth = 0
      let j = i + 3
      for (; j < v.length; j++) {
        if (v[j] === '(') depth++
        else if (v[j] === ')' && --depth === 0) break
      }
      out += ' '
      i = j
    } else out += v[i]
  }
  return out.split('!important').join(' ').split('!IMPORTANT').join(' ')
}

// Every word in a value, split on the characters that separate CSS tokens.
function words(v) {
  const out = []
  let w = ''
  for (const c of v) {
    if (' \t\r\n,()/'.includes(c)) {
      if (w) out.push(w)
      w = ''
    } else w += c
  }
  if (w) out.push(w)
  return out
}

// A leading number, and what follows it: '120ms' -> [120, 'ms'].
function number(w) {
  let i = w[0] === '-' || w[0] === '+' ? 1 : 0
  const from = i
  let digits = 0
  while (i < w.length && (isDigit(w[i]) || w[i] === '.')) {
    if (isDigit(w[i])) digits++
    i++
  }
  if (!digits) return null
  return [Number(w.slice(from, i)), w.slice(i).toLowerCase()]
}

const isHexWord = (w) => {
  if (w[0] !== '#' || ![4, 5, 7, 9].includes(w.length)) return false
  for (const c of w.slice(1)) if (!isHexChar(c)) return false
  return true
}

const isRadiusProp = (p) => {
  if (p === 'border-radius') return true
  const parts = p.split('-')
  return parts.length === 4 && parts[0] === 'border' && parts[3] === 'radius'
}
const isMotionProp = (p) => {
  for (const base of ['transition', 'animation']) {
    if (p === base || p === `${base}-duration` || p === `${base}-delay`) return true
  }
  return false
}
const hasColourFn = (v) => {
  const low = v.toLowerCase()
  for (const fn of ['rgb(', 'rgba(', 'hsl(', 'hsla(', 'color-mix(', 'oklch(']) {
    let at = low.indexOf(fn)
    while (at !== -1) {
      if (!isWordChar(low[at - 1] ?? ' ')) return true
      at = low.indexOf(fn, at + 1)
    }
  }
  return false
}

const TESTS_CHARS = {
  hex: (prop, ws) => ws.some(isHexWord),
  radius: (prop, ws) =>
    isRadiusProp(prop) && ws.some((w) => {
      const n = number(w)
      return n && n[0] !== 0 && n[1] !== ''
    }),
  motion: (prop, ws) =>
    isMotionProp(prop) && ws.some((w) => {
      const n = number(w)
      return n && n[0] !== 0 && (n[1] === 'ms' || n[1] === 's')
    }),
  shadow: (prop, ws, v) =>
    prop === 'box-shadow' &&
    (hasColourFn(v) || ws.some((w) => {
      if (isHexWord(w)) return true
      const n = number(w)
      return n && n[0] !== 0 && n[1] !== ''
    })),
}

export function scanChars(masked) {
  const found = Object.fromEntries(KINDS.map((k) => [k, []]))
  for (const d of declarationsChars(masked)) {
    const v = stripVarsChars(d.value)
    const ws = words(v)
    for (const k of KINDS) if (TESTS_CHARS[k](d.prop, ws, v)) found[k].push(d)
  }
  return found
}

// ─── Both ways, one sheet ────────────────────────────────────────────────────

// Count one sheet both ways. Returns, per kind, the counted hits from each way,
// plus any exempt marker that gives no reason.
export function countSheet(rel, raw) {
  const masked = maskComments(raw)
  const lines = raw.split('\n')
  const lineAt = (i) => masked.slice(0, i).split('\n').length
  const bare = []
  const tally = (found) => {
    const out = {}
    for (const k of KINDS) {
      out[k] = []
      for (const d of found[k]) {
        const first = lineAt(d.start)
        const last = lineAt(d.end)
        const span = lines.slice(first - 1, last).join('\n')
        const mark = span.match(EXEMPT)
        if (mark && mark[1]) continue
        if (mark) bare.push(`${rel}:${first}`)
        out[k].push(`${rel}:${first}`)
      }
    }
    return out
  }
  const regex = tally(scanRegex(masked))
  const chars = tally(scanChars(masked))
  return { regex, chars, bare: [...new Set(bare)] }
}

export function listSheets(dir, prefix = 'src/styles/') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return listSheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css') ? [{ rel: `${prefix}${f}`, raw: readFileSync(abs, 'utf8') }] : []
  })
}

function main() {
  const sheets = listSheets(join(ROOT, 'src/styles')).sort((a, b) => a.rel.localeCompare(b.rel))

  // A guard that stops guarding still prints its tick, which reads as coverage.
  // Count first (check-focus-ring.mjs's guard): if the partials ever move or
  // empty out, fail here and repoint this script IN THE SAME COMMIT.
  const rules = sheets.reduce((n, s) => n + (maskComments(s.raw).match(/\{/g) || []).length, 0)
  if (sheets.length < 50 || rules < 1000) {
    console.error(
      `\n✗ Raw-value guard has nothing to check — found ${sheets.length} sheet(s) and ${rules} rule(s)\n` +
        '  under src/styles/. If the stylesheets moved, repoint this script in the same\n' +
        '  commit as the move. Do not delete this assertion — a vacuous pass still prints ✓.\n',
    )
    process.exit(1)
  }

  const regex = Object.fromEntries(KINDS.map((k) => [k, []]))
  const chars = Object.fromEntries(KINDS.map((k) => [k, []]))
  const bare = []
  for (const { rel, raw } of sheets) {
    const r = countSheet(rel, raw)
    for (const k of KINDS) {
      regex[k].push(...r.regex[k])
      chars[k].push(...r.chars[k])
    }
    bare.push(...r.bare)
  }

  const problems = []
  const warnings = []

  for (const k of KINDS) {
    const a = regex[k]
    const b = chars[k]
    if (a.length !== b.length || a.some((h, i) => h !== b[i])) {
      const onlyA = a.filter((h) => !b.includes(h))
      const onlyB = b.filter((h) => !a.includes(h))
      problems.push(
        `${k}: the two ways disagree — the regex pass counts ${a.length}, the character scanner\n` +
          `    counts ${b.length}. One of them has stopped seeing something. Fix the scanner that is\n` +
          '    wrong; never raise a budget to match either number.\n' +
          onlyA.slice(0, 5).map((h) => `      regex only:   ${h}\n`).join('') +
          onlyB.slice(0, 5).map((h) => `      scanner only: ${h}\n`).join(''),
      )
      continue
    }
    const n = a.length
    const budget = BUDGETS[k]
    if (n > budget) {
      problems.push(
        `${k}: ${n} declarations read a raw value, against a budget of ${budget}.\n` +
          '    New code must read a token. The newest are the ones to look at:\n' +
          a.slice(-(n - budget)).map((h) => `      ${h}\n`).join(''),
      )
    } else if (n < budget) {
      warnings.push(
        `${k}: down to ${n}, under its budget of ${budget}. That is the good direction —\n` +
          `    now bank it: set BUDGETS.${k} to ${n} in scripts/check-raw-values.mjs, in this same PR.\n`,
      )
    }
  }

  for (const at of bare) {
    problems.push(`${at}: a raw-value-exempt marker with no reason. Write raw-value-exempt: <why>.\n`)
  }

  if (warnings.length) {
    console.warn('\n⚠ Raw values went DOWN — lower the budget so the ratchet holds the gain:\n')
    for (const w of warnings) console.warn(`  ${w}`)
  }

  if (problems.length) {
    console.error('\n✗ Raw values are growing back — a rule wrote a value a token already holds.\n')
    console.error('  Tokens: colour in src/tokens/colors.css, --radius-* in spacing.css,')
    console.error('  --dur-* / --ease-* / --shadow-* in effects.css. A real one-off takes a')
    console.error('  `raw-value-exempt: <reason>` comment on the line.\n')
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }

  const held = KINDS.map((k) => `${k} ${regex[k].length}/${BUDGETS[k]}`).join(', ')
  console.log(`✓ Raw values hold — ${held}, each counted two ways across ${sheets.length} sheets.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
