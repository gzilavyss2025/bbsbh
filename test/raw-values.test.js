import test from 'node:test'
import assert from 'node:assert/strict'
import { KINDS, countSheet } from '../scripts/check-raw-values.mjs'

// The pure half of scripts/check-raw-values.mjs (#1178). Each case runs the
// sheet through BOTH counting ways, and asserts they agree before it asserts
// the count — a guard whose two ways drift apart fails lint, so a case here
// that lets them drift would pin the wrong behaviour.
const count = (css) => {
  const r = countSheet('x.css', css)
  for (const k of KINDS) assert.deepEqual(r.regex[k], r.chars[k], `the two ways disagree on ${k}`)
  return { ...Object.fromEntries(KINDS.map((k) => [k, r.regex[k].length])), bare: r.bare }
}

test('each kind counts one raw declaration', () => {
  const c = count(`
.a { color: #16222f; }
.b { border-radius: 6px; }
.c { transition: opacity 120ms ease; }
.d { box-shadow: 0 1px 2px rgb(0 0 0 / 0.3); }
`)
  assert.deepEqual(c, { hex: 1, radius: 1, motion: 1, shadow: 1, bare: [] })
})

test('the unit is the declaration, not the literal', () => {
  const c = count('.a { border-radius: 6px 6px 2px 2px; background: linear-gradient(#000, #fff); }')
  assert.equal(c.radius, 1)
  assert.equal(c.hex, 1)
})

test('comment prose never counts', () => {
  const c = count(`
/* was #fff and border-radius: 6px; transition: all 1s; box-shadow: 0 1px red */
.a { color: var(--ink-1); }
`)
  assert.deepEqual(c, { hex: 0, radius: 0, motion: 0, shadow: 0, bare: [] })
})

test('a token read is not raw — including a token whose name ends in a digit (#1156)', () => {
  const c = count(`
.a { border-radius: var(--radius-2); transition: opacity var(--dur-fast) var(--ease-out); }
.b { box-shadow: var(--shadow-card); color: var(--paper-2); }
.c { border-radius: calc(var(--radius-sm) * 2); }
`)
  assert.deepEqual(c, { hex: 0, radius: 0, motion: 0, shadow: 0, bare: [] })
})

test('a var() fallback is reached by its token, so it is not raw', () => {
  const c = count('.a { background: var(--pinstripe-bg, #fff); box-shadow: var(--x, 0 1px 2px rgba(0, 0, 0, .2)); }')
  assert.equal(c.hex, 0)
  assert.equal(c.shadow, 0)
})

test('a zero is "none", not a design value', () => {
  const c = count(`
.a { border-radius: 0; animation-delay: 0s; }
.b { border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
.c { box-shadow: 0 0 0 var(--bw-hair) var(--ink-1); }
`)
  assert.deepEqual(c, { hex: 0, radius: 0, motion: 0, shadow: 0, bare: [] })
})

test('a non-zero figure next to a token still counts', () => {
  const c = count(`
.a { border-radius: calc(var(--radius-sm) - 1px); }
.b { transition: transform var(--dur-fast) ease, opacity .3s; }
.c { box-shadow: inset 2px 0 0 var(--accent-primary); }
`)
  assert.deepEqual(c, { hex: 0, radius: 1, motion: 1, shadow: 1, bare: [] })
})

test('a longhand radius and a motion longhand count; other properties do not', () => {
  const c = count(`
.a { border-top-left-radius: 4px; animation-duration: 1.5s; }
.b { width: 6px; outline-offset: 2px; transform: rotate(3deg); }
`)
  assert.deepEqual(c, { hex: 0, radius: 1, motion: 1, shadow: 0, bare: [] })
})

test('a selector or an at-rule prelude is not a declaration', () => {
  const c = count(`
@media (max-width: 600px) { .a:hover { color: var(--ink-1); } }
#root .b:focus-visible { color: var(--ink-1); }
`)
  assert.deepEqual(c, { hex: 0, radius: 0, motion: 0, shadow: 0, bare: [] })
})

test('the last declaration in a rule counts without its semicolon', () => {
  assert.equal(count('.a { color: #fff }').hex, 1)
})

test('an exemption with a reason removes the declaration, on any line it spans', () => {
  const c = count(`
.a { color: #fff; /* raw-value-exempt: canvas fill */ }
.b {
  background: linear-gradient(
    #000, /* raw-value-exempt: a mask alpha, not a colour */
    transparent
  );
}
`)
  assert.equal(c.hex, 0)
  assert.deepEqual(c.bare, [])
})

test('an exemption with no reason still counts, and is reported', () => {
  const c = count(`
.a { color: #fff; /* raw-value-exempt */ }
.b { color: #000; /* raw-value-exempt: */ }
`)
  assert.equal(c.hex, 2)
  assert.deepEqual(c.bare, ['x.css:2', 'x.css:3'])
})

test('a hit reports the line the declaration starts on', () => {
  const r = countSheet('x.css', '.a {\n  color: var(--ink-1);\n  transition:\n    opacity 200ms;\n}\n')
  assert.deepEqual(r.regex.motion, ['x.css:3'])
})
