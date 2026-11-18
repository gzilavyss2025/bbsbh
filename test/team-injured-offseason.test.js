// The injured list is an in-season list: clubs reinstate 60-day IL players to the 40-man
// within days of the World Series, but statsapi can keep reporting them as D60 for weeks
// (the Brewers' Zerpa, Fitzpatrick and Priester still read D60 on 2026-11-18).
import assert from 'node:assert/strict'
import test from 'node:test'
import { injuredShown } from '../src/screens/team/data/shared.js'

const list = [{ id: 1, ilLabel: '60' }]

test('in season, the injured list shows as the feed has it', () => {
  assert.deepEqual(injuredShown(list, false), list)
})

test('once the club\'s season is over, there is no injured list', () => {
  assert.deepEqual(injuredShown(list, true), [])
})
