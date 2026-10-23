import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spotlightUrl } from '../../src/api/postseason/worldseries/spotlightPool.js'

// The spotlight pool's reads are club-wide and cutoff-gated: each ends the day before the slate date.

const q = (url) => new URL(url, 'https://x.test').searchParams

test('cutoff: every spotlight read ends the day before the slate date and starts the season', () => {
  for (const [group, type] of [['hitting', 'R'], ['pitching', 'P'], ['pitching', 'R']]) {
    const p = q(spotlightUrl(group, type, 139, '2026-10-27'))
    assert.equal(p.get('endDate'), '2026-10-26')
    assert.equal(p.get('startDate'), '2026-01-01')
    assert.equal(p.get('stats'), 'byDateRange')
    assert.equal(p.get('gameType'), type)
    assert.equal(p.get('group'), group)
    assert.equal(p.get('teamId'), '139')
    assert.equal(p.get('playerPool'), 'ALL')
  }
})

test('cutoff: a spotlight read never asks for the season or career total', () => {
  assert.doesNotMatch(spotlightUrl('hitting', 'R', 158, '2026-10-23'), /stats=(season|career)/)
})
