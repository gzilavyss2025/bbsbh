// Slice 20b (#2073): the Season WAR button says when its dialog is open, the Season
// link and × have focus rings, and the Contract history fold has a turning chevron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles/player-next/both', rel)))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

test('season: the WAR button carries aria-expanded for its open dialog', () => {
  const s = src('screens/player/next/modules/season/index.jsx')
  assert.match(s, /openKey=\{open\?\.key\}/)
  assert.match(s, /function YearTable\(\{[^}]*openKey \}\)/)
  assert.match(s, /aria-expanded=\{openKey === r\.key\}/)
})

test('season.css: the open WAR keeps the tint; the link and the × have rings', () => {
  const c = css('season.css')
  assert.match(c, /\.seasonmod__war\[aria-expanded='true'\] \{\s*background: var\(--surface-stamped-tint\);/)
  assert.equal(decl(ruleBody(c, '.seasonmod__link:focus-visible') ?? '', 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
  assert.equal(decl(ruleBody(c, '.seasonmod__x:focus-visible') ?? '', 'outline'), 'var(--bw-heavy) solid var(--focus-ring-band)')
})

test('contract: the summary holds the chevron after the sub line', () => {
  const s = src('screens/player/next/modules/contract/index.jsx')
  assert.match(s, /<span className="cnext__histend">\s*<span className="cnext__histsub">/)
  assert.match(s, /<svg className="cnext__chev"[^>]*aria-hidden="true">\s*<path d="M2 5l5 5 5-5"/)
})

test('contract.css: no marker, a turning chevron on the stamp curve, a hover, reduced motion', () => {
  const c = css('contract.css')
  assert.equal(decl(ruleBody(c, '.cnext__hist > summary'), 'list-style'), 'none')
  assert.equal(decl(ruleBody(c, '.cnext__hist > summary::-webkit-details-marker'), 'display'), 'none')
  assert.equal(decl(ruleBody(c, '.cnext__chev'), 'transition'), 'transform var(--dur-fast) var(--ease-stamp)')
  assert.equal(decl(ruleBody(c, '.cnext__hist[open] .cnext__chev'), 'transform'), 'rotate(180deg)')
  assert.match(c, /\.cnext__hist:not\(\[open\]\) > summary:hover \{\s*background: var\(--surface-inset\);/)
  assert.match(c, /@media \(prefers-reduced-motion: reduce\) \{\s*\.cnext__chev \{\s*transition: none;/)
})
