import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cssPath = resolve('src/index.css')
const css = readFileSync(cssPath, 'utf8')
const errors = []

// This guard is only as good as its target. Split src/index.css into partials
// (or otherwise empty it of rules) and this script would keep exiting 0 while
// checking nothing — and a guard that stops guarding is worse than none,
// because the ✓ still prints and reads as coverage. So assert the target
// actually holds rules, and say what to do when it doesn't.
if (!/\{/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  console.error(
    '\n✗ Typography guard has nothing to check — src/index.css contains zero\n' +
      '  rules. If the stylesheet was split into partials, repoint this script at\n' +
      '  all of them (e.g. every src/styles/*.css) IN THE SAME COMMIT as the\n' +
      '  split. Do not delete this assertion — it exists precisely because a\n' +
      '  vacuous pass still prints ✓.\n'
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

for (const rule of rules) {
  const declarations = new RegExp(`${rule.property}\\s*:\\s*([^;]+);`, 'g')
  for (const match of css.matchAll(declarations)) {
    const value = match[1].trim()
    if (rule.allowed(value)) continue

    const line = css.slice(0, match.index).split('\n').length
    errors.push(
      `src/index.css:${line}: ${rule.property}: ${value}; — ${rule.guidance}`,
    )
  }
}

if (errors.length) {
  console.error('Typography scale guard failed:')
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}

console.log('Typography scale guard passed')
