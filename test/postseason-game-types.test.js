import test from 'node:test'
import assert from 'node:assert/strict'
import { POSTSEASON_GAME_TYPES, scopeOfGameType } from '../scripts/lib/records/postseason.mjs'

test('POSTSEASON_GAME_TYPES: the four rounds, never the umbrella P or the All-Star A', () => {
  assert.equal(POSTSEASON_GAME_TYPES, 'F,D,L,W')
})

test('scopeOfGameType: every postseason round is P', () => {
  for (const t of POSTSEASON_GAME_TYPES.split(',')) assert.equal(scopeOfGameType(t), 'P', t)
})

test('scopeOfGameType: R is R; the All-Star code, the umbrella P and unknown codes are R', () => {
  for (const t of ['R', 'A', 'P', 'S', 'E', '', undefined, null]) assert.equal(scopeOfGameType(t), 'R', String(t))
})
