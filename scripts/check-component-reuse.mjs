#!/usr/bin/env node
// A SHAPE may only be drawn once (#1114, ADR-0084 clause 6).
//
// THE PROBLEM THIS EXISTS TO CLOSE. The design system collapsed card, pill, band
// and table shells into shared parts (src/styles/system/). A cleanup decays: an
// agent builds UI at speed with no shared memory, and writes the next shell by
// hand. This guard counts SHAPES, never names. A grep for `card` would pass
// `.rankchip` (the pill recipe, declaration for declaration) and fail
// `.scorecard` (a block of custom properties, no box at all).
//
// Four shapes, counted per rule in src/styles/ (subdirectories included), with
// comments blanked first so prose never counts:
//
//   capsule  border-radius: var(--radius-pill) plus the rule's own font-size
//   sheet    the four-token recipe: --bw-hair border, --radius-md,
//            --surface-card and --shadow-card
//   ledger   the same recipe at --radius-sm with no shadow
//   band     any rule that reads --bar-fill (the club-coloured head)
//
// The canonical drawings live under src/styles/system/ and are skipped. The
// `control` shape of #1114 is not a fifth count, but a control is SKIPPED from the
// four above (see isControl): a tappable rule or a form field is not a card.
//
// THE COUNT IS A RATCHET, not a zero. #1114 asked for a guard that is green on
// the tree after the collapse, with an allowlist. The tree is not at zero, and
// a rule that names 60 survivors as "exempt" guards nothing. So, like
// check-raw-values.mjs, each shape has a budget: it may fall, it may not rise.
// A new shell must use Card, Pill or SectionHead. When a count falls, lower its
// budget in the same PR; the warning prints the number.
//
// A real one-off (the stamp art, the seal, the slate card) opts out with a
// `component-reuse-exempt: <reason>` comment inside the rule. The reason is
// required: a bare marker fails.
//
// Zero deps. Run by `npm run lint`. Unit cases: test/component-reuse.test.js.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Rules outside src/styles/system/ that draw each shape. DOWNWARD ONLY.
// Measured on origin/main at 2324e44b (band 3 less the one in system/), then
// triaged (.scratch/design-system/component-reuse-triage.md): controls skipped by
// the detector, stamp/slate one-offs exempted in place.
export const BUDGETS = { capsule: 6, sheet: 3, ledger: 17, band: 1 }
export const KINDS = Object.keys(BUDGETS)

const FIX = {
  capsule: 'use <Pill> (src/components/ui/control/Pill.jsx)',
  sheet: 'use <Card frame="sheet"> (src/components/ui/frame/Card.jsx)',
  ledger: 'use <Card frame="ledger"> (src/components/ui/frame/Card.jsx)',
  band: 'use <SectionHead look="band"> (src/components/ui/frame/SectionHead.jsx)',
}

const SYSTEM_DIR = 'src/styles/system/'
const EXEMPT = /component-reuse-exempt\b(\s*:\s*[^\s*])?/

const maskComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

// Innermost rules: a selector list, then a body with no nested braces. Leaf
// rules inside @media are found; the outer at-rule is not.
const RULE_RE = /([^{}]*)\{([^{}]*)\}/g
const decl = (body, prop) =>
  new RegExp(`(?<![\\w-])${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1] ?? ''

const SHAPES = {
  capsule: (body) => /var\(--radius-pill\)/.test(decl(body, 'border-radius')) && !!decl(body, 'font-size'),
  sheet: (body) =>
    /var\(--radius-md\)/.test(decl(body, 'border-radius')) &&
    /var\(--bw-hair\)/.test(body) &&
    /var\(--surface-card\)/.test(body) &&
    /var\(--shadow-card\)/.test(body),
  ledger: (body) =>
    /var\(--radius-sm\)/.test(decl(body, 'border-radius')) &&
    /var\(--bw-hair\)/.test(body) &&
    /var\(--surface-card\)/.test(body) &&
    !/shadow/.test(body),
  band: (body) => /var\(--bar-fill\b/.test(body),
}

// A CONTROL is not a card shell, whatever its border looks like. The ledger recipe
// is also what every input, select and tappable tile wears, so the guard skips a
// rule that is one: an input/select/textarea/button element, a class that ends
// `btn`, `input` or `select` after `__`, a body that says `cursor: pointer`
// (tappable), or one that says `resize:` (a textarea). Those belong to the Button
// and input work (#1174), not to Card, Pill or SectionHead. Triage and data:
// .scratch/design-system/component-reuse-triage.md. A name that only CONTAINS the
// word (`.buttonbar`, `.selection`) is not a control.
const CONTROL_SELECTOR = /(?:^|[\s>+~,])(?:input|select|textarea|button)(?![\w-])|__[\w-]*?(?:btn|input|select)(?![a-z0-9])/
const isControl = (selector, body) =>
  CONTROL_SELECTOR.test(selector) || /(?<![\w-])cursor\s*:\s*pointer\b/.test(body) || /(?<![\w-])resize\s*:/.test(body)

// One sheet: the hits per shape as `file:line selector`, plus any exempt marker
// that gives no reason. Canonical sheets under system/ return no hits.
export function scanSheet(rel, raw) {
  const hits = Object.fromEntries(KINDS.map((k) => [k, []]))
  const bare = []
  if (rel.startsWith(SYSTEM_DIR)) return { hits, bare }
  const css = maskComments(raw)
  const lineAt = (i) => css.slice(0, i).split('\n').length
  for (const m of css.matchAll(RULE_RE)) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    if (isControl(selector, m[2])) continue
    const found = KINDS.filter((k) => SHAPES[k](m[2]))
    if (!found.length) continue
    const start = m.index + m[0].length - m[0].trimStart().length
    const line = lineAt(start)
    const span = raw.slice(m.index, m.index + m[0].length)
    const mark = span.match(EXEMPT)
    if (mark && !mark[1]) bare.push(`${rel}:${line}`)
    if (mark && mark[1]) continue
    for (const k of found) hits[k].push(`${rel}:${line} ${selector}`)
  }
  return { hits, bare }
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

  // A guard that stops guarding still prints its tick. Count first: if the
  // partials move or empty out, fail here and repoint this script in the same
  // commit as the move (check-focus-ring.mjs does the same).
  const rules = sheets.reduce((n, s) => n + (maskComments(s.raw).match(/\{/g) || []).length, 0)
  if (sheets.length < 50 || rules < 1000) {
    console.error(
      `\n✗ Component-reuse guard has nothing to check — found ${sheets.length} sheet(s) and ${rules} rule(s)\n` +
        '  under src/styles/. If the stylesheets moved, repoint this script in the same\n' +
        '  commit as the move. Do not delete this assertion — a vacuous pass still prints ✓.\n',
    )
    process.exit(1)
  }

  // The detector must also recognise the canonical drawings, or it is blind.
  // Scan system/ with the skip lifted by renaming the path, and require the
  // shapes the shared parts draw.
  const system = sheets.filter((s) => s.rel.startsWith(SYSTEM_DIR))
  const seen = Object.fromEntries(KINDS.map((k) => [k, 0]))
  for (const { rel, raw } of system) {
    const r = scanSheet(rel.replace(SYSTEM_DIR, 'src/styles/'), raw)
    for (const k of KINDS) seen[k] += r.hits[k].length
  }
  const blind = ['capsule', 'sheet', 'band'].filter((k) => !seen[k])
  if (blind.length) {
    console.error(
      `\n✗ Component-reuse guard is blind — it finds no ${blind.join(', ')} in src/styles/system/,\n` +
        '  where the shared parts draw them. A token or a selector moved and the detector did not.\n',
    )
    process.exit(1)
  }

  const hits = Object.fromEntries(KINDS.map((k) => [k, []]))
  const bare = []
  for (const { rel, raw } of sheets) {
    const r = scanSheet(rel, raw)
    for (const k of KINDS) hits[k].push(...r.hits[k])
    bare.push(...r.bare)
  }

  const problems = bare.map(
    (at) => `${at}: a component-reuse-exempt marker with no reason. Write component-reuse-exempt: <why>.\n`,
  )
  const warnings = []
  for (const k of KINDS) {
    const n = hits[k].length
    if (n > BUDGETS[k]) {
      problems.push(
        `${k}: ${n} rules draw it outside src/styles/system/, against a budget of ${BUDGETS[k]}. ${FIX[k]}.\n` +
          '    The last ones in sheet order, one of which is yours:\n' +
          hits[k].slice(-(n - BUDGETS[k])).map((h) => `      ${h}\n`).join(''),
      )
    } else if (n < BUDGETS[k]) {
      warnings.push(
        `${k}: down to ${n}, under its budget of ${BUDGETS[k]}. Bank it: set BUDGETS.${k} to ${n}\n` +
          '    in scripts/check-component-reuse.mjs, in this same PR.\n',
      )
    }
  }

  if (warnings.length) {
    console.warn('\n⚠ Hand-drawn shapes went DOWN — lower the budget so the ratchet holds the gain:\n')
    for (const w of warnings) console.warn(`  ${w}`)
  }
  if (problems.length) {
    console.error('\n✗ A shape was drawn by hand — a shared part already draws it.\n')
    console.error('  A real one-off takes a `component-reuse-exempt: <reason>` comment inside the rule.\n')
    for (const p of problems) console.error(`  ${p}`)
    process.exit(1)
  }
  console.log(
    `✓ Component reuse holds — ${KINDS.map((k) => `${k} ${hits[k].length}/${BUDGETS[k]}`).join(', ')} across ${sheets.length} sheets.`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
