// The status banners' text and rules (src/screens/player/statusBanners.js), shared by both player pages.
import test from 'node:test'
import assert from 'node:assert/strict'
import { statusBannersView } from '../src/screens/player/statusBanners.js'

const texts = (core) => statusBannersView(core).map((b) => b.text)

test('a plain player has no banner', () => {
  assert.deepEqual(statusBannersView({ currentYear: 2026 }), [])
})

test('an All-Star wears the year', () => {
  assert.deepEqual(texts({ isAllStar: true, currentYear: 2026 }), ['2026 All-Star'])
})

test('a rehabber on the IL gets both banners, rehab first, with the affiliate and the day count', () => {
  const core = { onRehab: true, rehab: { name: 'Nashville Sounds' }, onIL: true, il: { days: 15 } }
  assert.deepEqual(texts(core), ['Rehab Assignment · Nashville Sounds', 'Injured List · 15-Day'])
})

test('no affiliate or day count, no dangling dot', () => {
  assert.deepEqual(texts({ onRehab: true, onIL: true, il: {} }), ['Rehab Assignment', 'Injured List'])
})

test("today's probable starter wears neither the rehab nor the IL banner", () => {
  assert.deepEqual(texts({ onRehab: true, onIL: true, startingToday: true }), [])
})

test('last played shows the year', () => {
  assert.deepEqual(texts({ lastPlayedYear: 2020 }), ['Last played in 2020'])
})
