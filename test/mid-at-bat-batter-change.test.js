// A batter replaced mid-count does not always lose the plate appearance. Rule
// 9.15(b): when he leaves with two strikes and the substitute completes the
// strikeout, the strikeout and the time at bat are charged to the batter who
// LEFT (every other ending is charged to the substitute). MLB reports the
// split by leaving `matchup.batter` on the substitute while
// `result.description` and the boxscore line both name the man who left.
//
// The feed used to card every plate appearance under `matchup.batter`, which
// put the substitute's name, number, position and headshot over the other
// man's strikeout — and trimLeadingName, handed a name the sentence does not
// begin with, fell back to the untrimmed sentence, so ONE card printed both
// names contradicting each other:
//
//   GARCIA, EDUARDO  PH        <- header, from matchup.batter
//   K
//   "Jett Williams strikes out on a foul tip."   <- MLB's own description
//
// Real shape, gamePk 816170 (Nashville Sounds @ Memphis Redbirds, 2026-08-08),
// top of the 1st, atBatIndex 1: Jett Williams fouls to 2-2, takes an injury
// delay, Eduardo Garcia finishes the at-bat on a foul tip, and Williams' own
// boxscore line reads 0-1 | K. The same shape appears in gamePk 816859's top 5
// and gamePk 816035's bottom 3 — the only three of eleven mid-at-bat batter
// substitutions in an 854-game sweep whose description named the replaced man,
// and all three strikeouts, exactly as the rule predicts.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

// Rewrite top 1's last plate appearance (batter #4, a strikeout) into the real
// shape: five pitches to #4, a pinch-hitter (#10) announced at 2-2, then the
// pitch that ends it — with `matchup.batter` on the substitute and the
// description naming the man he replaced, exactly as the feed reports it.
function feedWithMidAtBatChange({ description = 'Dan Diaz strikes out on a foul tip.' } = {}) {
  const feed = buildFeed()
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.matchup.batter.id === 4,
  )
  play.matchup.batter.id = 10
  play.result.description = description
  play.playEvents = [
    { isPitch: true, pitchNumber: 1, details: { call: { code: 'F' } } },
    { isPitch: true, pitchNumber: 2, details: { call: { code: 'B' } } },
    { isPitch: true, pitchNumber: 3, details: { call: { code: 'B' } } },
    { isPitch: true, pitchNumber: 4, details: { call: { code: 'F' } } },
    { isPitch: true, pitchNumber: 5, details: { call: { code: 'F' } } },
    { details: { eventType: 'game_advisory', description: 'Injury Delay.' }, player: { id: 4 } },
    {
      details: {
        eventType: 'offensive_substitution',
        description: 'Offensive Substitution: Pinch-hitter Jim Judge replaces Dan Diaz.',
      },
      position: { abbreviation: 'PH' },
      player: { id: 10 },
      replacedPlayer: { id: 4 },
    },
    { isPitch: true, pitchNumber: 6, details: { call: { code: 'T' } } },
  ]
  // `runners[]` keeps speaking the FINISHER's id on such a play — the card
  // moves, the bookkeeping does not.
  play.runners = [
    {
      details: { runner: { id: 10 }, event: 'Strikeout', eventType: 'strikeout' },
      movement: { start: null, end: null, outBase: '1B', isOut: true, outNumber: 3 },
      credits: [{ position: { code: '2' }, credit: 'f_putout' }],
    },
  ]
  return feed
}

const atBats = (entries) => entries.filter((e) => e.kind === 'atbat')
const textOf = (e) => (e.descSegments ?? []).map((s) => s.text).join('')

test('a strikeout completed by a pinch-hitter is carded to the batter who left', () => {
  const entries = computeHalfInningFeed(feedWithMidAtBatChange(), 1, 'top', 'away')
  const card = atBats(entries).at(-1)

  // #4 (Dan Diaz) left at 2-2; #10 (Jim Judge) finished it. The card belongs
  // to Diaz — his name, his id, his fielding position, his headshot.
  assert.equal(card.batterId, 4)
  assert.equal(card.batter.id, 4)
  assert.equal(card.batter.fullName, 'Dan Diaz')

  // Still his own strikeout, and still the half's third out.
  assert.equal(card.code, 'K')
  assert.equal(card.outNumber, 3)
})

test("the description is trimmed against the credited batter, so one card never shows two names", () => {
  const entries = computeHalfInningFeed(feedWithMidAtBatChange(), 1, 'top', 'away')
  const card = atBats(entries).at(-1)

  // The leading name is stripped because it MATCHES the card's own batter.
  // Carded under the substitute this read "Dan Diaz strikes out on a foul tip."
  // beneath a header saying JUDGE.
  assert.equal(textOf(card), 'Strikes out on a foul tip.')
  assert.ok(!textOf(card).includes('Dan Diaz'))
  assert.ok(!textOf(card).includes('Jim Judge'))
})

test('the substitute still gets his own "now batting" notice, before the card', () => {
  const entries = computeHalfInningFeed(feedWithMidAtBatChange(), 1, 'top', 'away')
  const notice = entries.findIndex((e) => e.eventType === 'pinch_hitting')
  const card = entries.findIndex((e) => e.kind === 'atbat' && e.batterId === 4)

  // Re-owning the card must not swallow the announcement that explains it:
  // the reader still sees who came in, and sees it before the result.
  assert.ok(notice !== -1)
  assert.equal(entries[notice].playerId, 10)
  assert.ok(notice < card)
})

test('a substitute who finishes the at-bat any OTHER way keeps the card', () => {
  // Rule 9.15(b) charges the plate appearance back only on a strikeout. Eight
  // of the eleven mid-at-bat substitutions in the sweep ended some other way
  // (a walk, a sac fly, a lineout) and are charged to the substitute — the
  // description names HIM, and the card must stay his.
  const feed = feedWithMidAtBatChange({ description: 'Jim Judge walks.' })
  const play = feed.liveData.plays.allPlays.find(
    (p) => p.about.inning === 1 && p.about.halfInning === 'top' && p.matchup.batter.id === 10,
  )
  play.result.eventType = 'walk'
  play.runners = [
    {
      details: { runner: { id: 10 }, event: 'Walk', eventType: 'walk' },
      movement: { start: null, end: '1B', outBase: null, isOut: false, outNumber: null },
    },
  ]

  const card = atBats(computeHalfInningFeed(feed, 1, 'top', 'away')).at(-1)
  assert.equal(card.batterId, 10)
  assert.equal(card.code, 'BB')
  assert.equal(textOf(card), 'Walks.')
})

test('an ordinary plate appearance is untouched by the credited-batter lookup', () => {
  // No offensive substitution in the play at all — every card stays on
  // matchup.batter, which is the overwhelmingly common case.
  const entries = atBats(computeHalfInningFeed(buildFeed(), 1, 'top', 'away'))
  assert.deepEqual(
    entries.map((e) => e.batterId),
    [1, 2, 3, 4],
  )
})
