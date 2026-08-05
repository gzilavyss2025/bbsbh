import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Every component rule lives in src/styles/*.css — the partials src/index.css
// @imports in order. Read the DIRECTORY rather than a fixed list so a new
// partial is covered the moment it exists.
const stylesDir = resolve('src/styles')
const sheets = readdirSync(stylesDir)
  .filter((f) => f.endsWith('.css'))
  .sort()
  .map((f) => ({ rel: `src/styles/${f}`, css: readFileSync(join(stylesDir, f), 'utf8') }))
const errors = []

// This guard is only as good as its target. If the partials move again — or a
// refactor empties them — this script would keep exiting 0 while checking
// nothing, and a guard that stops guarding is worse than none, because the ✓
// still prints and reads as coverage. So assert there is real CSS to scan.
const totalRules = sheets.reduce(
  (n, s) => n + (s.css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\{/g) || []).length,
  0,
)
if (!sheets.length || totalRules === 0) {
  console.error(
    '\n✗ Typography guard has nothing to check — src/styles/ holds no CSS rules\n' +
      '  (found ' + sheets.length + ' sheet(s), ' + totalRules + ' rule(s)). If the stylesheets moved,\n' +
      '  repoint this script IN THE SAME COMMIT as the move. Do not delete this\n' +
      '  assertion — it exists precisely because a vacuous pass still prints ✓.\n'
  )
  process.exit(1)
}

const rules = [
  {
    property: 'font-size',
    allowed: (value) =>
      value.startsWith('var(') ||
      value.startsWith('clamp(') ||
      /^-?[0-9]+(?:\.[0-9]+)?em$/.test(value),
    guidance: 'use a semantic --fs-* token (relative em and responsive clamp values are allowed)',
  },
  {
    property: 'font-weight',
    allowed: (value) => value.startsWith('var(') || value === 'inherit',
    guidance: 'use a semantic --w-* token',
  },
  {
    property: 'line-height',
    allowed: (value) => value.startsWith('var('),
    guidance: 'use a semantic --lh-* token',
  },
  {
    property: 'letter-spacing',
    allowed: (value) => value.startsWith('var('),
    guidance: 'use a semantic --ls-* token',
  },
]

for (const { rel, css } of sheets) {
  for (const rule of rules) {
    const declarations = new RegExp(`${rule.property}\\s*:\\s*([^;]+);`, 'g')
    for (const match of css.matchAll(declarations)) {
      const value = match[1].trim()
      if (rule.allowed(value)) continue

      const line = css.slice(0, match.index).split('\n').length
      errors.push(`${rel}:${line}: ${rule.property}: ${value}; — ${rule.guidance}`)
    }
  }
}

if (errors.length) {
  console.error('Typography scale guard failed:')
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}

console.log('Typography scale guard passed')
