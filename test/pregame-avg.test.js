// preGameAvg (src/api/boxscore.js) — the scorebug's fallback batter line
// before he's had a revealed plate appearance THIS game. The whole point is
// that `seasonStats.batting.avg` updates DURING the game, so a batter who
// already went 2-for-3 tonight has that baked into what reads as "season"
// AVG — this must recover the number as it stood BEFORE tonight's game by
// subtracting today's own line from the season line.
import assert from 'node:assert/strict'
import test from 'node:test'
import { preGameAvg } from '../src/api/boxscore.js'

test('subtracts tonight\'s own line out of the season line', () => {
  // Season .300 (60-for-200) INCLUDES a 2-for-4 tonight — pre-game he stood
  // at 58-for-196, not .300.
  const boxPlayer = {
    seasonStats: { batting: { atBats: 200, hits: 60 } },
    stats: { batting: { atBats: 4, hits: 2 } },
  }
  const preGame = 58 / 196
  assert.equal(preGameAvg(boxPlayer), preGame.toFixed(3).replace(/^0\./, '.'))
  // Sanity: this must NOT equal the raw (spoiler-leaking) season figure.
  assert.notEqual(preGameAvg(boxPlayer), (60 / 200).toFixed(3).replace(/^0\./, '.'))
})

test('a batter with no revealed at-bat yet this game reads his plain season AVG', () => {
  const boxPlayer = {
    seasonStats: { batting: { atBats: 150, hits: 45 } },
    stats: { batting: { atBats: 0, hits: 0 } },
  }
  assert.equal(preGameAvg(boxPlayer), (45 / 150).toFixed(3).replace(/^0\./, '.'))
})

test('no season at-bats on record at all falls back to the dash placeholder', () => {
  assert.equal(preGameAvg({}), '.---')
  assert.equal(
    preGameAvg({ seasonStats: { batting: { atBats: 3, hits: 1 } }, stats: { batting: { atBats: 3, hits: 1 } } }),
    '.---',
  )
})
