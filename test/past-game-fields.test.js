// REGRESSION GUARD on PAST_GAME_FEED_FIELDS (game.js) — the `fields=`
// allowlist usePastGameSignals prunes the past-game feed with. Same rationale
// as test/winprob.test.js's guard on WIN_PROB_FIELDS: statsapi's filter is
// name-based at every depth, so a name missing from the list arrives
// `undefined` and blanks its surface (a flip-card back, a slate pill, the
// postseason series page) with no error anywhere. The full-vs-pruned output
// equivalence was verified against live 2026-07-30 finals (selectBoxscore,
// computePlayOfTheGame, and classifyGameCards outputs deep-equal, ~800 KB ->
// ~200 KB per game); this test pins the list against the drift that would
// quietly undo that.
//
// If you add a NEW feed read to boxscore.js / pitchers.js / dayHighlights.js
// / GameResultFace, add its key names (every level of the path) to
// PAST_GAME_FEED_FIELDS *and* to the read-set below.
import assert from 'node:assert/strict'
import test from 'node:test'
import { PAST_GAME_FEED_FIELDS, fetchGameFeed } from '../src/api/game.js'

// The signals path's read-set, one entry per dereferenced path — parent and
// leaf names both, since `fields=` needs every level present.
const REQUIRED = {
  'mergeFeedDiff / cache sanity': ['gamePk'],
  'gameData team identity (boxscore.js teamLine, dayHighlights teamsOf)': [
    'gameData', 'teams', 'away', 'home', 'id', 'name', 'teamName', 'clubName', 'abbreviation',
  ],
  'gameData.players bio fields (select.js personNameParts, boxscore.js firstLast)': [
    'players', 'fullName', 'boxscoreName', 'lastFirstName', 'lastName', 'firstName',
    'useName', 'primaryNumber', 'pitchHand', 'code', 'jerseyNumber',
  ],
  'gameData.gameInfo / venue (boxscore.js gameTimes)': [
    'gameInfo', 'gameDurationMinutes', 'delayDurationMinutes', 'venue', 'timeZone', 'tz',
  ],
  'liveData.decisions (boxscore.js decisionName)': ['liveData', 'decisions', 'winner', 'loser', 'save'],
  'boxscore info/note rows (umpires, first pitch, WP/HBP splits, footnotes)': [
    'boxscore', 'info', 'label', 'value', 'title', 'fieldList', 'note', 'team',
  ],
  'boxscore player rows (battingRows, pitchingRows, dayHighlights scanners)': [
    'person', 'battingOrder', 'position', 'allPositions', 'pitchers',
    'stats', 'seasonStats', 'teamStats', 'batting', 'pitching',
  ],
  'batting stat leaves': [
    'atBats', 'runs', 'hits', 'rbi', 'baseOnBalls', 'strikeOuts',
    'homeRuns', 'triples', 'doubles', 'stolenBases', 'avg',
  ],
  'pitching stat leaves (computePitcherLines, performanceScore)': [
    'inningsPitched', 'earnedRuns', 'numberOfPitches', 'pitchesThrown',
    'battersFaced', 'wins', 'losses', 'saves',
  ],
  'linescore (revealInning/revealTotals)': ['linescore', 'innings', 'num', 'errors', 'leftOnBase'],
  'plays walk (computePitcherLines, triplePlaySignal)': [
    'plays', 'allPlays', 'about', 'inning', 'halfInning', 'endTime',
    'result', 'type', 'eventType', 'event', 'description',
    'matchup', 'pitcher', 'playEvents', 'isPitch',
    'runners', 'details', 'isScoringEvent', 'responsiblePitcher', 'earned',
    'movement', 'end', 'count', 'outs',
  ],
}

test('PAST_GAME_FEED_FIELDS covers every field the signals path reads', () => {
  const present = new Set(PAST_GAME_FEED_FIELDS)
  for (const [why, names] of Object.entries(REQUIRED)) {
    for (const field of names) {
      assert.ok(present.has(field), `missing "${field}" (${why})`)
    }
  }
})

test('fetchGameFeed appends fields= only when asked', async () => {
  // Intercept getJson's fetch to inspect the URL it builds; no network.
  const urls = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    return { ok: true, json: async () => ({}) }
  }
  try {
    await fetchGameFeed(12345)
    await fetchGameFeed(12345, { fields: ['a', 'b'] })
    await fetchGameFeed(12345, { fields: 'a,b' })
  } finally {
    globalThis.fetch = realFetch
  }
  assert.ok(urls[0].endsWith('/feed/live'), `no-fields URL unchanged, got ${urls[0]}`)
  assert.ok(urls[1].endsWith('/feed/live?fields=a,b'), `array joins, got ${urls[1]}`)
  assert.ok(urls[2].endsWith('/feed/live?fields=a,b'), `string passes through, got ${urls[2]}`)
})
