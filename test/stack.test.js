// The stack's contract, asserted from the stylesheet text, the source tree and
// the pure class helper (#1180). Each of these would fail silently otherwise —
// lint green, the page rendering, only a screenshot noticing:
//
//   1. THE SLOT. system/stack.css loads before 06, so a block that keeps its
//      own gap or alignment still wins on order. It sits ahead of the section
//      head, because the head, the card and 06 are pinned as adjacent imports.
//   2. ONE BASE, ONE CLASS. Exactly one .stack base rule, and every rule in the
//      file is a single class, so no rule outweighs a block's namespace.
//   3. THE GAPS. Each gap name reads its own token, and `section` reads
//      --space-section, which is the 16px step today.
//   4. THE HELPER. Unknown gaps and elements are refused, not drawn as
//      something else; a list gets its reset as a modifier.
//   5. NO IMPORTS. Stack may render inside a SealBox reveal, so it imports no
//      api/ module and no stamp module.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { walk, toPosix } from '../scripts/lib/walk.mjs'
import { GAPS, STACK_TAGS, stackClassName } from '../src/lib/design/stackClass.js'
import { stripComments, ruleBody } from './helpers/css.js'
import { defineMigrationTests } from './helpers/layoutMigration.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')
const stackCss = () => stripComments(readFileSync(join(STYLES, 'system/stack.css'), 'utf8'))

// ---- 1. the slot ----

test('system/stack.css is imported before 06, and does not split the head, card and 06', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const head = imports.indexOf('system/section-head.css')
  const stack = imports.indexOf('system/stack.css')
  const six = imports.indexOf('06-loader-and-cards.css')
  assert.ok(stack !== -1, 'index.css should import system/stack.css')
  assert.ok(stack < head, 'stack.css should sit ahead of the section head')
  assert.ok(stack < six, 'stack.css must load before 06')
})

// ---- 2. one base, one class ----

test('.stack is a column with one gap, and no other stylesheet draws it', () => {
  const base = ruleBody(stackCss(), '.stack')
  assert.ok(base, 'stack.css should have a .stack base rule')
  assert.match(base, /display:\s*flex/)
  assert.match(base, /flex-direction:\s*column/)
  assert.match(base, /gap:\s*var\(--stack-gap\)/)
  for (const f of walk(STYLES, { exts: ['.css'] })) {
    if (toPosix(f).endsWith('system/stack.css')) continue
    const css = stripComments(readFileSync(f, 'utf8'))
    assert.equal(ruleBody(css, '.stack'), null, `${f} should not redraw .stack`)
  }
})

test('every selector in stack.css is a single class', () => {
  const selectors = stackCss()
    .replace(/\{[^}]*\}/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  assert.ok(selectors.length >= 7, 'stack.css should hold the base, five gaps and the list reset')
  for (const s of selectors) assert.match(s, /^\.stack(--[a-z]+)?$/, `"${s}" should be one stack class`)
})

// ---- 3. the gaps ----

test('each gap reads its own step, and section reads --space-section', () => {
  const css = stackCss()
  const expected = {
    tight: '--space-1',
    snug: '--space-2',
    base: '--space-3',
    loose: '--space-4',
    section: '--space-section',
  }
  assert.deepEqual(Object.keys(expected), GAPS)
  for (const [gap, token] of Object.entries(expected)) {
    const body = ruleBody(css, `.stack--${gap}`)
    assert.ok(body, `.stack--${gap} should exist`)
    assert.match(body, new RegExp(`--stack-gap:\\s*var\\(${token}\\)`), `.stack--${gap} should read ${token}`)
  }
})

test('--space-section is the 16px step today, in the layout tokens', () => {
  const tokens = stripComments(readFileSync(join(SRC, 'tokens/layout.css'), 'utf8'))
  assert.match(tokens, /--space-section:\s*var\(--space-4\)\s*;/)
})

// ---- 4. the helper ----

test('the default is the base gap on a div', () => {
  assert.equal(stackClassName(), 'stack stack--base')
})

test('every gap names its own class, and a namespace follows', () => {
  for (const gap of GAPS) assert.equal(stackClassName({ gap, className: 'chal' }), `stack stack--${gap} chal`)
})

test('an unknown gap or element is refused', () => {
  assert.throws(() => stackClassName({ gap: 'huge' }), /unknown gap "huge"/)
  assert.throws(() => stackClassName({ gap: '8' }), /unknown gap/)
  assert.throws(() => stackClassName({ as: 'span' }), /unknown element "span"/)
})

test('a list gets the reset modifier and nothing else does', () => {
  for (const as of STACK_TAGS) {
    const list = stackClassName({ as }).includes('stack--list')
    assert.equal(list, as === 'ul' || as === 'ol', `${as}`)
  }
})

// ---- 5. no imports ----

test('Stack and its helper import no api/ or stamp module', () => {
  for (const rel of ['components/ui/layout/Stack.jsx', 'lib/design/stackClass.js']) {
    const text = readFileSync(join(SRC, rel), 'utf8')
    const imports = [...text.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    for (const spec of imports) {
      assert.ok(!/\/api\//.test(spec), `${rel} imports ${spec}`)
      assert.ok(!/stamp/i.test(spec), `${rel} imports ${spec}`)
    }
  }
})

// ---- 6. slices S14 to S16 (#1180) ----
// Rules moved onto <Stack> keep their own padding, margin or frame, and nothing that
// draws the column or the gap, in any stylesheet. Every JSX site of the class is a
// <Stack> with the gap the old rule wrote (base is the default). The checks are in
// test/helpers/layoutMigration.js. A rule deleted whole keeps the `file` that held it.
const STACK = {
  component: 'Stack',
  sheet: 'system/stack.css',
  props: ['gap'],
  defaults: { gap: 'base' },
  closed: false,
  allowDefault: true, // gap="base" is the default, and a site may spell it out
}

// S14: nine one-class column rules.
const S14 = {
  fhist__span: { jsx: 'screens/team/modules/ballpark/FranchiseHistory.jsx', file: '57a-franchise-history.css', gap: 'tight', keeps: ['flex'] },
  fhist__parks: { jsx: 'screens/team/modules/ballpark/FranchiseHistory.jsx', file: '57a-franchise-history.css', gap: 'base' },
  fhist__parkline: { jsx: 'screens/team/modules/ballpark/FranchiseHistory.jsx', file: '57a-franchise-history.css', gap: 'tight' },
  scout__game: { jsx: 'screens/scout/meetings/MeetingsPanel.jsx', file: 'scout/meetings.css', gap: 'snug' },
  scout__pa: { jsx: 'screens/scout/meetings/MeetingsPanel.jsx', file: 'scout/meetings.css', gap: 'snug' },
  introsheet__step2: { jsx: 'components/account/AccountPitch.jsx', file: '56-my-tally-intro.css', gap: 'loose' },
  introsheet__confirm: { jsx: 'components/account/AccountPitch.jsx', file: '56-my-tally-intro.css', gap: 'base' },
  psrace__leagues: { jsx: 'screens/PostseasonRacePage.jsx', file: '70-postseason-race.css', gap: 'loose' },
  staffgrid: { jsx: 'components/workload/StaffGrid.jsx', file: '76-workload-marks.css', gap: 'snug' },
}

const S15 = {
  trrank__detail: { file: 'situational-records/66a-detail.css', gap: 'loose', sites: 2 },
  'standings-ctrl': { file: '30-standings.css', gap: 'snug' },
  coachtree__node: { file: '39-manager-page.css', gap: 'tight' },
}

// S16: `.colorlab__logodrop` keeps its align-items, flex and max-width.
// `.lookupdeck__field` has five sites, and four also carry `--compact`.
const S16 = {
  colorlab__row: { file: '15-team-color-lab.css', gap: 'snug' },
  colorlab__logodrop: { file: '15-team-color-lab.css', gap: 'snug', keeps: ['align-items', 'flex', 'max-width'] },
  lookupdeck__field: { file: '74a-contract-lookup.css', gap: 'tight', sites: 5 },
}

for (const [slice, rows] of Object.entries({ S14, S15, S16 })) defineMigrationTests(`stack ${slice}`, STACK, rows)
