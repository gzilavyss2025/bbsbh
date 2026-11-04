import test from 'node:test'
import assert from 'node:assert/strict'
import { prefetchLinks } from '../src/lib/react/prefetch.js'

test('prefetchLinks reads the build meta: css as style, the rest as script', () => {
  assert.deepEqual(prefetchLinks('/assets/GameView-a.js /assets/GameView-b.css'), [
    { href: '/assets/GameView-a.js', as: 'script' },
    { href: '/assets/GameView-b.css', as: 'style' },
  ])
})

test('prefetchLinks is empty with no meta (dev)', () => {
  assert.deepEqual(prefetchLinks(undefined), [])
  assert.deepEqual(prefetchLinks(''), [])
})
