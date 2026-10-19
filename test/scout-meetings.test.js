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
  callOf, gamesOf, meetingFacts, mixRows, nameOf, meetingOrdinal, pitchWalk, playText, resultWord, scoringMark, unseenNote,
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
  // Colour and shape come from pitchMark(code) on the page, so a row carries only its code (#2319, V06).
  assert.deepEqual(rows.map((r) => r.code), ['FF', 'ST', 'FC', 'CU'])
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

test('calls in words, ordinals, and the play text with the batter’s last name in front', () => {
  assert.deepEqual(callOf('swinging_strike_blocked'), { word: 'Swinging strike', tone: 'strike' })
  assert.deepEqual(callOf('hit_into_play'), { word: 'In play', tone: 'play' })
  assert.equal(callOf('some_new_call').word, 'Some new call')
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(meetingOrdinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  assert.equal(playText(PAS.at(-1).description, 'Jackson Chourio', 'Chourio'), 'Chourio grounds out, shortstop Jose Iglesias to first baseman Luis Arraez.')
  assert.equal(playText('Wild pitch.', 'Jackson Chourio', 'Chourio'), 'Wild pitch.')
})

test('scoringMark: the fielders the play text names, in order; the result code when it names none (V05)', () => {
  // The three real plate appearances: a 6-3 groundout, a lineout to center, a lineout to short
  // whose text goes on to a throwing error (the error is a second sentence, not part of the mark).
  assert.deepEqual(Object.fromEntries(PAS.map((pa) => [pa.inning, scoringMark(pa)])), { 1: '6-3', 3: 'L8', 5: 'L6' })
  const mark = (event, bbType, description = '') => scoringMark({ event, bbType, description })
  assert.equal(mark('field_out', 'fly_ball', 'A flies out to left fielder B.'), 'F7')
  assert.equal(mark('field_out', 'popup', 'A pops out to second baseman B.'), 'P4')
  assert.equal(mark('field_out', 'ground_ball', 'A grounds out to first baseman B.'), '3U')
  assert.equal(mark('grounded_into_double_play', 'ground_ball', 'A grounds into a double play, shortstop B to second baseman C to first baseman D.'), '6-4-3')
  assert.equal(mark('field_out', 'ground_ball', 'Bobby Witt Jr. grounds out, third baseman B to first baseman C.'), '5-3')
  assert.equal(mark('field_error', 'ground_ball', 'A reaches on a fielding error by third baseman B.'), 'E5')
  assert.equal(mark('force_out', 'ground_ball', 'A grounds into a force out, shortstop B to second baseman C.'), 'FC')
  assert.equal(mark('sac_fly', 'fly_ball', 'A hits a sacrifice fly to center fielder B.'), 'SF8')
  // A hit, a walk and a strikeout have no fielder's mark: the result code.
  assert.equal(mark('single', 'line_drive', 'A singles on a line drive to right fielder B.'), '1B')
  assert.equal(mark('strikeout'), 'K')
  // An out whose text names no fielder falls back to the result code, never a blank.
  assert.equal(mark('field_out', 'ground_ball', ''), 'GO')
})

test('resultWord: the result in words for the scorebook cell (V05)', () => {
  assert.deepEqual(PAS.map(resultWord), ['Lineout', 'Lineout', 'Groundout'])
  assert.deepEqual(
    [['single'], ['strikeout'], ['home_run'], ['walk'], ['force_out'], ['field_out', 'fly_ball'], ['field_out', 'popup'], ['field_out']].map(([event, bbType]) => resultWord({ event, bbType })),
    ['Single', 'Strikeout', 'Home run', 'Walk', 'Force out', 'Flyout', 'Popout', 'Out'],
  )
})
