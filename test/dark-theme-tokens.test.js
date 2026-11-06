// ADR-0130 item 12: the dark block is written twice (the attribute, and the media query),
// because CSS cannot put both in one selector list. The two copies must never drift.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/tokens/colors.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const decls = (block) => block.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean)

test('the media-query dark block repeats the data-theme dark block exactly', () => {
  const attr = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1]
  const media = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)?.[1]
  assert.ok(attr && media, 'both dark blocks exist')
  assert.deepEqual(decls(media), decls(attr))
})

// The seal reads the same in both themes (ADR-0130 item 4, ADR-0083): kraft and its ink are never redefined at night.
test('the dark block leaves the seal and its ink alone', () => {
  const attr = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)[1]
  assert.doesNotMatch(attr, /--(seal|text-on-seal)/)
})
