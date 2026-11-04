// The hover card's chunk loads on the first hover target, not with the first load (#2897).
// Tests cannot import .jsx, so these read the source.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

test('the gate renders the lazy card only after the store first has an id', () => {
  const gate = read('components/player/LazyPlayerHoverCard.jsx')
  assert.match(gate, /lazyNamed\(\(\) => import\('\.\/PlayerHoverCard\.jsx'\), 'PlayerHoverCard'\)/)
  assert.match(gate, /if \(id != null && !seen\) setSeen\(true\)/)
  assert.match(gate, /return seen \? \(/)
})

test('App.jsx mounts the gate and imports neither the card nor the headshot log statically', () => {
  const app = read('App.jsx')
  assert.doesNotMatch(app, /^import .*(player\/PlayerHoverCard\.jsx|HeadshotLogPanel)/m)
  assert.match(app, /<LazyPlayerHoverCard \/>/)
})
