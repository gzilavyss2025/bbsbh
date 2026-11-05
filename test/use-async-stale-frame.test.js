// #2925: on the render where its deps change, useAsync must answer the pending shape for
// the NEW deps, never the previous run's { loading: false, data }. The stale frame let
// GameSelect's resume gate open for one render (#2914) and let useOffseason save the old
// key's rows under the new key (PR #2924). Mounted through createRoot on a stub container,
// as reveal-progress-game-switch.test.js does, because the reset lives in an effect.
import assert from 'node:assert/strict'
import test from 'node:test'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useAsync } from '../src/hooks/useAsync.js'

function mount() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.window = Object.assign(new EventTarget(), { HTMLIFrameElement: class {} })
  const doc = { nodeType: 9, nodeName: '#document', addEventListener() {}, removeEventListener() {} }
  const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', ownerDocument: doc, addEventListener() {}, removeEventListener() {} }
  doc.documentElement = container
  const root = createRoot(container)
  const frames = []
  let last
  function Probe({ id }) {
    last = useAsync(async () => `data:${id}`, [id])
    frames.push({ id, loading: last.loading, data: last.data, error: last.error })
    return null
  }
  return {
    frames,
    current: () => last,
    render: (id) => act(async () => root.render(createElement(Probe, { id }))),
    run: (fn) => act(async () => fn()),
    done: async () => {
      await act(async () => root.unmount())
      delete globalThis.window
    },
  }
}

test('the first render under new deps is pending, not the previous run', async () => {
  const p = mount()
  await p.render('A')
  assert.equal(p.current().data, 'data:A')
  p.frames.length = 0
  await p.render('B')
  assert.deepEqual(p.frames[0], { id: 'B', loading: true, data: null, error: null })
  assert.ok(p.frames.every((f) => f.data !== 'data:A'), 'no frame under B carries A\'s data')
  assert.equal(p.current().data, 'data:B')
  assert.equal(p.current().loading, false)
  await p.done()
})

test('reload keeps the loaded data while it refetches (stale-while-revalidate)', async () => {
  const p = mount()
  await p.render('A')
  p.frames.length = 0
  await p.run(() => p.current().reload())
  assert.ok(p.frames.length > 0)
  assert.ok(p.frames.every((f) => f.data === 'data:A'), 'reload never blanks the data')
  await p.done()
})
