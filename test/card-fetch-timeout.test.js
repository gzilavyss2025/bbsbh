// The link-preview fetch guard (api/_lib/cards.js getJson). A statsapi call
// that never answers must end the card build within the guard's budget and
// leave buildCard returning null, so the caller keeps the static default card.
// The caller never reads the abort error's type, only that the build ends.
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCard } from '../api/_lib/cards.js'

test('a statsapi call that hangs is cut off and the card build resolves null', async (t) => {
  let signal = null
  // A real hung socket keeps the event loop alive. AbortSignal.timeout's own
  // timer does not, so stand in for the socket.
  const socket = setInterval(() => {}, 1000)
  t.mock.method(globalThis, 'fetch', (_url, init) =>
    new Promise((_resolve, reject) => {
      signal = init?.signal ?? null
      signal?.addEventListener('abort', () => reject(signal.reason))
    }))
  try {
    const started = Date.now()
    const card = await buildCard(new URLSearchParams({ route: 'team', id: '158' }), 'https://example.test')
    assert.equal(card, null)
    assert.ok(signal, 'the fetch was given an abort signal')
    const elapsed = Date.now() - started
    assert.ok(elapsed >= 3500 && elapsed < 6000, `cut off near the 4s budget, took ${elapsed}ms`)
  } finally {
    clearInterval(socket)
  }
})

test('a statsapi call that answers in time builds the card', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ teams: [{ id: 158, name: 'Milwaukee Brewers', sport: { id: 1 }, league: { name: 'National League' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
  const card = await buildCard(new URLSearchParams({ route: 'team', id: '158' }), 'https://example.test')
  assert.equal(card.image, 'https://example.test/og-image.png')
  assert.match(card.title, /Milwaukee Brewers/)
})
