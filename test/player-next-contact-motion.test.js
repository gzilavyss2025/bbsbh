import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

// The Contact card's motion (#2073, slices 17a and 17b). Read from the source text, the way
// notice-n5.test.js reads its sheets.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = stripComments(read('src/styles/player-next/batter/contact.css'))
const JSX = read('src/screens/player/next/modules/contact/ContactModule.jsx')
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('a dot scales from its own centre', () => {
  const b = ruleBody(CSS, '.fcontact__dot')
  assert.equal(decl(b, 'transform-box'), 'fill-box')
  assert.equal(decl(b, 'transform-origin'), 'center')
})

test('the dots drop in: 460ms on --ease-stamp, staggered over 620ms by the per-dot fraction', () => {
  const b = ruleBody(CSS, '.fcontact__dots--play .fcontact__dot')
  assert.equal(decl(b, 'animation'), 'fcontact-drop-a calc(var(--dur-unfold) * 1.15) var(--ease-stamp) backwards')
  assert.equal(decl(b, 'animation-delay'), 'calc(var(--fcontact-f, 0) * var(--dur-unfold) * 1.55)')
})

test('the b class runs a twin keyframe, so a pick restarts the drop with no remount', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dots--b .fcontact__dot'), 'animation-name'), 'fcontact-drop-b')
  for (const k of ['fcontact-drop-a', 'fcontact-drop-b']) {
    const m = CSS.match(new RegExp(`@keyframes ${k}\\s*\\{\\s*from\\s*\\{([^}]*)\\}`))
    assert.ok(m, `${k} exists`)
    assert.equal(decl(m[1], 'opacity'), '0')
    assert.equal(decl(m[1], 'transform'), 'scale(2.4)')
  }
})

test('before the field is in view, the dots wait unseen', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dots--wait .fcontact__dot'), 'opacity'), '0')
})

test('reduced motion: no drop', () => {
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.fcontact__dots--play \.fcontact__dot\s*\{\s*animation: none;?\s*\}/)
})

test('the module gates the drop on first view and swaps a/b on each view or type pick', () => {
  assert.match(JSX, /useInViewOnce\(viewKey\(bio\.id, 'contact'\)\)/)
  assert.match(JSX, /phase === 'wait'/)
  assert.match(JSX, /fcontact__dots--\$\{gen % 2 \? 'b' : 'a'\}/)
  assert.match(JSX, /'--fcontact-f'/)
  assert.match(JSX, /const pick = \(set, v\) => \{ set\(v\); setSel\(null\); setGen\(\(g\) => g \+ 1\) \}/)
})

test('the ball-type pick is a MenuRail; the six averages are its panel', () => {
  assert.match(JSX, /import \{ MenuRail \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/control\/MenuRail\.jsx'/)
  assert.match(JSX, /<MenuRail\s+label="Batted ball type"/)
  assert.match(JSX, /backLabel="All batted balls"/)
  assert.match(JSX, /onPick=\{\(k\) => pick\(setType, k\)\}/)
  assert.doesNotMatch(JSX, /Highlight one kind of ball/)
  for (const k of ['Avg exit velo', 'Hard hit', 'Barrels', 'Avg launch angle', 'Avg distance', 'Avg xBA']) {
    assert.ok(JSX.includes(`'${k}'`), k)
  }
  assert.match(JSX, /<BattedBallMix battedBall=\{\{ rows: mix \}\} \/>/)
})
