// The Matchup Scout's Meetings tab (#1490): the facts row, the mix bars, the
// grouping and the pitch walk the modal steps through.
//
// Fixture: the real Savant CSV for Chourio (694192) vs Pivetta (601713),
// captured 2026-10-05 with the page's own request:
//   curl -sS "$(node -e "import('./src/api/scout/headToHead.js').then(m=>console.log(m.savantUrl(694192,601713,'2026-10-05')))")" \
//     -o test/fixtures/scout/chourio-pivetta.csv
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseSavantRows, plateAppearances } from '../src/api/scout/headToHead.js'
import {
  callOf, gamesOf, meetingFacts, mixRows, nameOf, ordinal, pitchWalk, playText, unseenNote,
} from '../src/screens/scout/meetings/meetings.js'

const CSV = readFileSync(new URL('./fixtures/scout/chourio-pivetta.csv', import.meta.url), 'utf8')
const PAS = plateAppearances(parseSavantRows(CSV))
const PAIR = JSON.parse(readFileSync(new URL('./fixtures/scout/pair-601713-694192.json', import.meta.url), 'utf8'))
const board = {
  types: PAIR.types,
  all: PAIR.pmap.ALL,
  byType: Object.fromEntries(PAIR.types.map((t) => [t.code, PAIR.pmap[t.code]])),
}

test('the facts row: 0-for-3, 12 pitches, and contact quality on the three balls in play', () => {
  const f = meetingFacts(PAS)
  assert.deepEqual([f.h, f.ab, f.pa, f.pitches], [0, 3, 3, 12])
  // 95.0, 105.2 and 100.8 mph; fouls are not balls in play.
  assert.equal(f.avgExit.toFixed(1), '100.3')
  assert.equal(f.xwobaContact.toFixed(3), '0.543')
  assert.deepEqual(meetingFacts([]), { h: 0, ab: 0, pa: 0, pitches: 0, avgExit: null, xwobaContact: null })
})

test('the mix: the meeting against 2026 to righties, full names, and the pitch he never saw', () => {
  const rows = mixRows(PAS, board)
  assert.deepEqual(rows.map((r) => [r.name, r.meet, r.season]), [
    ['Fastball', 58, 49],
    ['Sweeper', 25, 23],
    ['Cutter', 0, 17],
    ['Curveball', 17, 9],
  ])
  assert.ok(rows.every((r) => !/^[A-Z]{2}$/.test(r.name)))
  // The cutter shares the fastball's family colour, so it takes the stripe.
  assert.deepEqual(rows.map((r) => r.shade), [0, 0, 1, 1])
  assert.equal(
    unseenNote(rows, { hitter: 'Chourio', pitcher: 'Pivetta' }, 'righties', ['2025']),
    'Chourio saw no cutters in 2025. Pivetta now throws it 17% of the time to righties.',
  )
  assert.equal(unseenNote(rows.filter((r) => r.code !== 'FC'), { hitter: 'A', pitcher: 'B' }, 'righties', ['2025']), null)
})

test('a pitch he no longer throws still gets a full name', () => {
  assert.equal(nameOf('SL', board), 'Slider')
  assert.equal(nameOf('FF', board), 'Fastball')
})

test('games newest first; inside a game the plate appearances run in order', () => {
  const games = gamesOf(PAS)
  assert.equal(games.length, 1)
  assert.deepEqual(games[0].pas.map((pa) => pa.inning), [1, 3, 5])
  const two = gamesOf([...PAS, { ...PAS[0], gamePk: 1, date: '2026-05-01', key: 'x', atBat: 4 }])
  assert.deepEqual(two.map((g) => g.date), ['2026-05-01', '2025-09-22'])
})

test('the walk counts the list, in the order it draws: 1 of 12 is the first pitch of the 1st inning', () => {
  const walk = pitchWalk(gamesOf(PAS))
  assert.equal(walk.length, 12)
  assert.deepEqual([walk[0].pa.inning, walk[0].k, walk[0].of, walk[0].pitch.code], [1, 1, 3, 'FF'])
  assert.deepEqual([walk[11].pa.inning, walk[11].k, walk[11].of, walk[11].pitch.call], [5, 4, 4, 'hit_into_play'])
})

test('calls in words, ordinals, and the play text without the batter’s name', () => {
  assert.deepEqual(callOf('swinging_strike_blocked'), { word: 'Swinging strike', tone: 'strike' })
  assert.deepEqual(callOf('hit_into_play'), { word: 'In play', tone: 'play' })
  assert.equal(callOf('some_new_call').word, 'Some new call')
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  assert.equal(playText(PAS.at(-1).description, 'Jackson Chourio'), 'grounds out, shortstop Jose Iglesias to first baseman Luis Arraez.')
  assert.equal(playText('Wild pitch.', 'Jackson Chourio'), 'Wild pitch.')
})
