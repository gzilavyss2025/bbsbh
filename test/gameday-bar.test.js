// Gameday's bar (src/screens/gameday/next/GamedayNextPage.jsx). Two rules the old innings bar
// kept and the swap first dropped (#2568 review):
//
// 1. The advance HOLDS with aria-disabled, never the native `disabled` (ADR-0046). For the
//    ~700 ms the closing rule draws, and through the step hold, the forward action waits; any
//    tap ends that sequence early (useFocusMode's interrupt). A natively disabled button
//    dispatches no pointer events, so a thumb on it would neither advance nor cut the hold
//    short. The click is guarded instead.
// 2. The live edge (ADR-0055) is announced politely: a role="status" aria-live="polite" region
//    that says "Caught up — waiting on the next batter", mounted before it has anything to say
//    so the change is read out.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/screens/gameday/next/GamedayNextPage.jsx', import.meta.url), 'utf8')
const advance = page.slice(page.indexOf('className="gdnext__advance"') - 120, page.indexOf('{advance.label}'))

test('the advance holds with aria-disabled and a guarded click, never the native disabled', () => {
  assert.ok(advance.includes('gdnext__advance'), 'the advance is in GamedayNextPage')
  assert.doesNotMatch(advance, /\sdisabled=\{/)
  assert.match(advance, /aria-disabled=\{advance\.disabled \|\| undefined\}/)
  assert.match(advance, /onClick=\{\(\) => !advance\.disabled && advance\.onClick\(\)\}/)
})

test('the live edge is announced in a polite status region that is always mounted', () => {
  assert.match(page, /<p className="sr-only" role="status" aria-live="polite">\{advance\.caughtUp \? 'Caught up — waiting on the next batter' : ''\}<\/p>/)
})
