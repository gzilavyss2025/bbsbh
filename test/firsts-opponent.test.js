// The Firsts card's opponent: the id the logo is drawn from, plus the abbreviation and name.
import test from 'node:test'
import assert from 'node:assert/strict'
import { firstOpponent } from '../src/api/player/history.js'

const g = { awayId: 108, homeId: 158, awayAbbr: 'LAA', homeAbbr: 'MIL' }

test('a home first: the opponent is the away club', () => {
  const o = firstOpponent({ isHome: true }, g)
  assert.equal(o.oppId, 108)
  assert.equal(o.oppAbbr, 'LAA')
  assert.equal(o.oppName, 'Los Angeles Angels')
})

test('an away first: the opponent is the home club', () => {
  const o = firstOpponent({ isHome: false }, g)
  assert.equal(o.oppId, 158)
  assert.equal(o.oppAbbr, 'MIL')
  assert.equal(o.oppName, 'Milwaukee Brewers')
})

test('no boxscore link: no id, an empty abbreviation and a null name', () => {
  assert.deepEqual(firstOpponent({ isHome: true }, undefined), { oppId: null, oppAbbr: '', oppName: null })
})
