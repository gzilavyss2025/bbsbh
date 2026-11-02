// Unit coverage for the wire's fact templates (src/api/transactions/templates.js)
// and the facts they read (src/api/transactions/playerFacts.js): which player a
// folded story's note is about, and the sentences each template writes. The
// fixtures are cut down from real /people records checked in the Wire Lab
// (/wire-lab) on 2026-11-02; each names the player it came from.
import assert from 'node:assert/strict'
import test from 'node:test'
import { shapeFacts, shapeMinors } from '../src/api/transactions/playerFacts.js'
import { cutStory, dealPhrase, freeAgentStory, seasonSentence, subjectsOf } from '../src/api/transactions/templates.js'

// The minimum facts a template reads, with overrides.
const facts = (over = {}) => ({
  id: 1,
  age: 35,
  lastName: 'Suárez',
  pitcher: false,
  debut: '2014-06-04',
  season: 2026,
  seasonLine: { games: 125, avg: '.212', hr: 26 },
  seasonClubs: [],
  careerLine: { games: 1755, avg: '.244', hr: 351 },
  seasons: 13,
  years: [],
  clubs: [
    { teamId: 116, from: 2014, to: 2014 },
    { teamId: 113, from: 2015, to: 2021 },
    { teamId: 136, from: 2022, to: 2023 },
    { teamId: 109, from: 2024, to: 2025 },
    { teamId: 136, from: 2025, to: 2025 },
    { teamId: 113, from: 2026, to: 2026 },
  ],
  arrivals: [],
  arrival: null,
  contract: { terms: '1 y/$15M (26)+27 m opt', options: null },
  minors: null,
  prospect: null,
  injured: null,
  ...over,
})

test('a busy day: each player gets the template for his own part of the sentence', () => {
  const story = {
    cutline: [
      { text: 'Activated RHP ' }, { text: 'Kochanowicz', playerId: 1 },
      { text: ' from the 60-day injured list; selected the contract of LHP ' }, { text: 'Pinazzi', playerId: 2 },
      { text: '; RHP ' }, { text: 'Stephenson', playerId: 3 }, { text: ' elected free agency; designated LHP ' },
      { text: 'Lovelady', playerId: 4 }, { text: ' for assignment.' },
    ],
  }
  assert.deepEqual(subjectsOf(story).map((s) => s.template), ['fallback', 'fallback', 'free-agency', 'cut'])
})

test("a minor-league signing and a trade's two sides read their own templates", () => {
  const signing = { cutline: [{ text: 'Signed free agent C ' }, { text: 'Adams', playerId: 1 }, { text: ' to a minor league contract.' }] }
  assert.equal(subjectsOf(signing)[0].template, 'minor-deal')
  const trade = { cutline: [{ text: 'Acquired RHP ' }, { text: 'Rayo', playerId: 1 }, { text: ' from the Athletics for LF ' }, { text: 'Eaton', playerId: 2 }, { text: '.' }] }
  assert.deepEqual(subjectsOf(trade).map((s) => s.template), ['trade', 'trade'])
})

test("Cot's deal terms read as words, and a deal with no dollars says nothing", () => {
  assert.equal(dealPhrase('6 y/$50M (20-25)+26-27 opts'), 'six-year, $50 million')
  assert.equal(dealPhrase('1 y (26)'), null)
})

test("a free agent's note: the season and deal, then his debut and every club with its years", () => {
  assert.equal(
    freeAgentStory(facts()),
    'The 35-year-old hit .212 with 26 homers in 125 games for the Reds in 2026, on a one-year, $15 million deal. ' +
      'Suárez made his major league debut in 2014 and has played 13 seasons for the Tigers (2014), Reds (2015-21, 2026), Mariners (2022-23, 2025) and Diamondbacks (2024-25).',
  )
})

test('a thin big-league season leads with the minors only when he played more games there', () => {
  const minors = { team: 'Syracuse Mets', level: ['Triple-A'], line: { games: 98, avg: '.278', hr: 5 } }
  const thin = facts({ age: 28, seasonLine: { games: 9, avg: '.091', hr: 0 }, clubs: [{ teamId: 121, from: 2026, to: 2026 }], minors })
  assert.equal(
    seasonSentence(thin),
    'The 28-year-old spent most of 2026 in Triple-A with the Syracuse Mets, hitting .278 with 5 homers, and played 9 games for the Mets.',
  )
  // A rehab stint: fewer games down there than up top.
  const rehab = facts({ seasonLine: { games: 9, avg: '.091', hr: 0 }, clubs: [{ teamId: 121, from: 2026, to: 2026 }], minors: { ...minors, line: { games: 2, avg: '.250', hr: 0 } } })
  assert.equal(seasonSentence(rehab), 'The 35-year-old hit .091 with no homers in 9 games for the Mets in 2026.')
})

test('an outright: how he got here, his career line, then what the move means', () => {
  const heuer = facts({
    age: 30,
    lastName: 'Heuer',
    pitcher: true,
    seasonLine: { games: 8, starts: 0, era: '4.66', ip: '9.2' },
    careerLine: { games: 97, starts: 0, era: '3.76', ip: '105.1' },
    clubs: [{ teamId: 114, from: 2026, to: 2026 }],
    arrival: { how: 'trade', date: '2026-08-03', teamId: 110, fromTeamId: 158 },
    arrivals: [
      { how: 'trade', date: '2026-08-01', teamId: 158, fromTeamId: 114 },
      { how: 'trade', date: '2026-08-03', teamId: 110, fromTeamId: 158 },
    ],
    contract: { terms: '1 y (26)', options: 3 },
  })
  assert.equal(
    cutStory(heuer, { moveDate: '2026-10-31', clause: 'Sent RHP Codi Heuer outright to Norfolk Tides.' }),
    'The 30-year-old came to the Orioles from the Brewers in an Aug. 3 trade, two days after Milwaukee got him from Cleveland. ' +
      'Heuer has a 3.76 ERA over 105.1 innings in 97 big-league games, 8 of them in 2026. ' +
      'The move clears a 40-man roster spot, and he stays in the organization. He has three minor-league options left.',
  )
})

test('a waiver claim skips how he arrived: the move already says it', () => {
  const claim = facts({ arrival: { how: 'waiver claim', date: '2026-10-29', teamId: 120, fromTeamId: 137 } })
  assert.match(cutStory(claim, { moveDate: '2026-10-29', clause: 'Claimed RHP Braxton Roxby off waivers.' }), /^The 35-year-old is a \.244 hitter/)
})

test("a minor leaguer's trade note: his whole season, then where he came from", () => {
  const robinson = facts({
    age: 23,
    lastName: 'Robinson',
    pitcher: true,
    debut: null,
    seasonLine: null,
    seasons: 0,
    clubs: [],
    contract: null,
    minors: { team: null, level: ['Single-A', 'High-A', 'Double-A'], line: { games: 25, era: '5.74', ip: '106.2' } },
    draft: { teamId: 133, year: 2024, round: '11', school: 'Texas Tech' },
    arrivals: [
      { how: 'signing', date: '2024-07-25', teamId: 133, fromTeamId: null },
      { how: 'trade', date: '2026-05-16', teamId: 134, fromTeamId: 133 },
      { how: 'trade', date: '2026-08-03', teamId: 108, fromTeamId: 134 },
    ],
  })
  assert.equal(
    seasonSentence(robinson),
    'The 23-year-old posted a 5.74 ERA over 106.2 innings in 25 games across Single-A, High-A and Double-A in 2026.',
  )
})

test("a ranked prospect's rank follows his age", () => {
  const ranked = facts({ age: 19, seasonLine: null, minors: { team: 'Biloxi Shuckers', level: ['Double-A'], line: { games: 120, avg: '.271', hr: 14 } }, prospect: { rank: 1, teamId: null } })
  assert.match(seasonSentence(ranked), /^The 19-year-old, MLB's No\. 1 prospect, hit \.271/)
})

test('the minors read: the "Minors" row is the season, not the first level\'s subtotal', () => {
  // Kyle Robinson (701836), 2026: a subtotal per level, then the season total.
  const splits = [
    { sport: { abbreviation: 'AA' }, stat: { gamesPitched: 11, inningsPitched: '44.2', era: '8.26' } },
    { team: { id: 452, name: 'Altoona Curve' }, sport: { abbreviation: 'AA' }, stat: { gamesPitched: 5 } },
    { team: { id: 3, name: 'Greensboro Grasshoppers' }, sport: { abbreviation: 'A+' }, stat: { gamesPitched: 7 } },
    { team: { id: 4, name: 'Bradenton Marauders' }, sport: { abbreviation: 'A' }, stat: { gamesPitched: 1 } },
    { sport: { abbreviation: 'Minors' }, stat: { gamesPitched: 25, inningsPitched: '106.2', era: '5.74' } },
  ]
  const m = shapeMinors(splits, true)
  assert.equal(m.line.ip, '106.2')
  assert.deepEqual(m.level, ['Single-A', 'High-A', 'Double-A'])
})

test('a split season merges each club into its own runs of years', () => {
  // Sammy Peralta: 2025 Angels, 2026 Rockies then Angels, listed out of order.
  const person = {
    id: 9,
    primaryPosition: { code: '1' },
    stats: [
      {
        group: { displayName: 'pitching' },
        type: { displayName: 'yearByYear' },
        splits: [
          { season: '2025', team: { id: 108, name: 'Angels' }, stat: { gamesPitched: 30 } },
          { season: '2026', team: { id: 108, name: 'Angels' }, stat: { gamesPitched: 14 } },
          { season: '2026', team: { id: 115, name: 'Rockies' }, stat: { gamesPitched: 2 } },
          { season: '2026', stat: { gamesPitched: 16 } },
        ],
      },
    ],
  }
  const f = shapeFacts(person, { season: 2026 })
  assert.match(freeAgentStory({ ...f, age: 28, lastName: 'Peralta', debut: '2025-04-01' }), /Angels \(2025-26\) and Rockies \(2026\)/)
})
