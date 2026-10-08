// The quiet design flag (.claude/hooks/design-work-flag.mjs). These pin which edited
// files count as design work, and where the flag file goes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isDesignPath, flagFileFor } from '../.claude/hooks/design-work-flag.mjs'

test('CSS under src, UI primitives and the design lab count as design work', () => {
  for (const p of [
    'src/styles/12-sealbox.css',
    'src/tokens/colors.css',
    'src/components/ui/control/Button.jsx',
    'src/screens/designlab/index.jsx',
    'C:\\Users\\gzilavy\\bbsbh\\src\\styles\\01-base.css',
    'C:/Users/gzilavy/bbsbh-wt/src/components/ui/Card.jsx',
    '/home/user/bbsbh/src/styles/system/button.css',
  ]) assert.equal(isDesignPath(p), true, p)
})

test('data, logic, docs and tests do not', () => {
  for (const p of [
    'src/api/linescore.js',
    'src/screens/TeamPage.jsx',
    'src/components/SealBox.jsx',
    'docs/design-system-naming.md',
    'scripts/check-typography.mjs',
    'test/design-work-flag-hook.test.js',
    'public/data/logos/mono/158.svg',
    '',
    undefined,
    42,
  ]) assert.equal(isDesignPath(p), false, String(p))
})

test('the flag file is keyed on the session and is safe to build from input', () => {
  const home = path.join('h', 'me')
  assert.equal(flagFileFor('abc-123_X', home), path.join(home, '.claude', 'rung-flags', 'abc-123_X.json'))
  assert.equal(flagFileFor('../../evil', home), path.join(home, '.claude', 'rung-flags', 'evil.json'))
  assert.equal(flagFileFor(undefined, home), path.join(home, '.claude', 'rung-flags', 'any.json'))
})

// The status line that reads the flag (.claude/statusline-rung.mjs).
import { rungFor, designFlag, render } from '../.claude/statusline-rung.mjs'

test('model id and effort map to the ladder rung', () => {
  const rung = (id, effort) => rungFor(id, '', effort).rung
  assert.equal(rung('claude-haiku-4-5'), 1)
  // Haiku 5.5 takes an effort setting but stays on rung 1 at every level.
  assert.deepEqual(
    [undefined, 'low', 'medium', 'high', 'xhigh', 'max'].map((e) => rung('claude-haiku-5-5', e)),
    [1, 1, 1, 1, 1, 1],
  )
  assert.deepEqual(
    ['low', 'medium', 'high', 'xhigh', 'max'].map((e) => rung('claude-sonnet-5-5', e)),
    [2, 3, 4, 5, 5],
  )
  assert.deepEqual(
    ['low', 'medium', 'high', 'xhigh', 'max'].map((e) => rung('claude-opus-5-5', e)),
    [6, 6, 7, 8, 9],
  )
  assert.equal(rung('claude-fable-5-1', 'high'), 10)
})

test('a model off the ladder, or a missing effort, gets no rung', () => {
  assert.equal(rungFor('claude-opus-4-8', 'Opus 4.8', 'xhigh').rung, null)
  assert.equal(rungFor('claude-sonnet-5', '', 'high').rung, null)
  assert.equal(rungFor('claude-sonnet-5-5', '', undefined).rung, null)
  assert.equal(rungFor(undefined, 'Mystery', 'high').label, 'Mystery')
})

test('the flag turns amber only on a fresh design flag and an extreme rung', () => {
  assert.equal(designFlag(2, true), 'low for design')
  assert.equal(designFlag(1, true), 'low for design')
  assert.equal(designFlag(9, true), 'more than design needs')
  assert.equal(designFlag(10, true), 'more than design needs')
  for (const r of [3, 4, 5, 6, 7, 8]) assert.equal(designFlag(r, true), '', `rung ${r}`)
  assert.equal(designFlag(2, false), '', 'no flag, no warning')
  assert.equal(designFlag(null, true), '', 'off the ladder, no warning')
})

test('render keeps the folder, context and rate limits, and never throws on empty input', () => {
  const line = render({
    cwd: 'C:/x',
    model: { id: 'claude-sonnet-5-5' },
    effort: { level: 'medium' },
    context_window: { used_percentage: 12.4 },
    rate_limits: { five_hour: { used_percentage: 20 }, seven_day: { used_percentage: 41 } },
  }, false)
  assert.match(line, /^PS C:\/x \| Sonnet 5\.5 medium r3 /)
  assert.match(line, /ctx 12%/)
  assert.match(line, /5h 20% \/ 7d 41%/)
  assert.doesNotMatch(line, /\x1b\[33m/)
  assert.ok(render({}, false).length > 0)
  assert.match(render({ model: { id: 'claude-sonnet-5-5' }, effort: { level: 'low' } }, true), /\x1b\[33m.*low for design/)
})

// The hook runs the file as a script, so the main-module guard must match a POSIX path
// (`file:///${argv[1]}` builds four slashes there and the line printed nothing).
test('run as a script, the status line prints its line', () => {
  const script = fileURLToPath(new URL('../.claude/statusline-rung.mjs', import.meta.url))
  const out = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ cwd: '/x', model: { id: 'claude-sonnet-5-5' }, effort: { level: 'medium' } }),
    encoding: 'utf8',
  }).stdout
  assert.match(out, /Sonnet 5\.5 medium r3/)
})
