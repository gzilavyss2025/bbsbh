import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cssPath = resolve('src/index.css')
const css = readFileSync(cssPath, 'utf8')
const errors = []

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
