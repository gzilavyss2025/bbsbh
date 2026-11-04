// Unit coverage for the wire's fact templates (src/api/transactions/templates.js)
// and the facts they read (src/api/transactions/playerFacts.js): which player a
// folded story's note is about, and the sentences each template writes. The
// fixtures are cut down from real /people records checked in the Wire Lab
// (/wire-lab) on 2026-11-02; each names the player it came from.
import assert from 'node:assert/strict'
import test from 'node:test'
import { shapeFacts, shapeMinors, shapeScopeRows, tradedFor } from '../src/api/transactions/playerFacts.js'
import { cutStory, dealPhrase, draftSentence, freeAgentStory, injuredStory, seasonSentence, subjectsOf } from '../src/api/transactions/templates.js'

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
  assert.deepEqual(subjectsOf(story).map((s) => s.template), ['il-activated', 'selected', 'free-agency', 'cut'])
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
      'Suárez has played 13 seasons for the Tigers (2014), Reds (2015-21, 2026), Mariners (2022-23, 2025) and Diamondbacks (2024-25).',
  )
})

test('a thin big-league season leads with the minors only when he played more games there', () => {
  const minors = { team: 'Syracuse Mets', level: ['Triple-A'], line: { games: 98, avg: '.278', hr: 5 } }
  const thin = facts({ age: 28, seasonLine: { games: 9, avg: '.091', hr: 0 }, clubs: [{ teamId: 121, from: 2026, to: 2026 }], minors })
  assert.equal(
    seasonSentence(thin),
    'Suárez, 28, spent most of 2026 in Triple-A with the Syracuse Mets, hitting .278 with five homers, and played nine games for the Mets.',
  )
  // A rehab stint: fewer games down there than up top.
  const rehab = facts({ seasonLine: { games: 9, avg: '.091', hr: 0 }, clubs: [{ teamId: 121, from: 2026, to: 2026 }], minors: { ...minors, line: { games: 2, avg: '.250', hr: 0 } } })
  assert.equal(seasonSentence(rehab), 'Suárez, 35, hit .091 with no homers in nine games for the Mets in 2026.')
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
      'Heuer has a 3.76 ERA over 105.1 innings in 97 big-league games, eight of them in 2026. ' +
      'The move opens a 40-man spot; he stays in the organization. He has three options left.',
  )
})

test('a waiver claim skips how he arrived: the move already says it', () => {
  const claim = facts({ arrival: { how: 'waiver claim', date: '2026-10-29', teamId: 120, fromTeamId: 137 } })
  assert.match(cutStory(claim, { moveDate: '2026-10-29', clause: 'Claimed RHP Braxton Roxby off waivers.' }), /^Suárez, 35, is a \.244 hitter/)
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
    'Robinson, 23, posted a 5.74 ERA over 106.2 innings in 25 games across Single-A, High-A and Double-A in 2026.',
  )
})

test("a ranked prospect's rank follows his age", () => {
  const ranked = facts({ age: 19, seasonLine: null, minors: { team: 'Biloxi Shuckers', level: ['Double-A'], line: { games: 120, avg: '.271', hr: 14 } }, prospect: { rank: 1, teamId: null } })
  assert.match(seasonSentence(ranked), /^Suárez, 19, MLB's No\. 1 prospect, hit \.271/)
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

test('the sheet lists a season’s clubs newest first', () => {
  // Jonathan Ornelas, 2026: the Athletics, then the Brewers. The feed lists a
  // season's clubs in the order he played for them.
  const person = {
    id: 666135,
    primaryPosition: { code: '6' },
    stats: [
      {
        group: { displayName: 'hitting' },
        type: { displayName: 'yearByYear' },
        splits: [
          { season: '2025', team: { id: 140, name: 'Rangers' }, stat: { gamesPlayed: 4 } },
          { season: '2026', team: { id: 133, name: 'Athletics' }, stat: { gamesPlayed: 6 } },
          { season: '2026', team: { id: 158, name: 'Brewers' }, stat: { gamesPlayed: 3 } },
          { season: '2026', stat: { gamesPlayed: 9 } },
        ],
      },
    ],
  }
  const f = shapeFacts(person, { season: 2026 })
  assert.deepEqual(f.rows.map((r) => r.teamId), [158, 133, 140])
})

// Adley Rutschman's 2026 (668939): three stints, the third filed twice when the
// Orioles traded him to the Red Sox mid-stint.
const il = (date, effective, text) => ({ typeCode: 'SC', date, effectiveDate: effective, description: text })
const rutschman = {
  id: 668939,
  lastName: 'Rutschman',
  primaryPosition: { code: '2' },
  stats: [],
  transactions: [
    il('2026-04-11', '2026-04-11', 'Baltimore Orioles placed C Adley Rutschman on the 10-day injured list. Left ankle inflammation.'),
    il('2026-04-21', '2026-04-21', 'Baltimore Orioles activated C Adley Rutschman from the 10-day injured list.'),
    il('2026-06-20', '2026-06-19', 'Baltimore Orioles placed C Adley Rutschman on the 7-day injured list retroactive to June 19, 2026. Concussion.'),
    il('2026-06-28', '2026-06-28', 'Baltimore Orioles activated C Adley Rutschman from the 7-day injured list.'),
    il('2026-07-20', '2026-07-19', 'Baltimore Orioles placed C Adley Rutschman on the 10-day injured list retroactive to July 19, 2026. Left wrist inflammation.'),
    il('2026-08-03', '2026-08-03', 'Boston Red Sox placed C Adley Rutschman on the 10-day injured list. Left wrist inflammation.'),
    il('2026-08-11', '2026-08-11', 'Boston Red Sox activated C Adley Rutschman from the 10-day injured list.'),
  ],
}

test('a stint filed again by a new club is one stint, from its retroactive start', () => {
  const f = shapeFacts(rutschman, { season: 2026 })
  assert.deepEqual(f.stints.map((x) => [x.from, x.to]), [['2026-04-11', '2026-04-21'], ['2026-06-19', '2026-06-28'], ['2026-07-19', '2026-08-11']])
  assert.equal(f.stints[1].injury, 'Concussion')
})

test('an IL placement: which stint it is, the one before, and how he was hitting', () => {
  const f = shapeFacts(rutschman, { season: 2026 })
  const placed = { ...f, stint: f.stints[2], beforeLine: { games: 67, avg: '.251', hr: 8 } }
  assert.equal(
    injuredStory(placed, { placed: true }),
    "Rutschman was hitting .251 with eight homers in 67 games. It is his third injured-list stint this season; he missed nine days from June 19 (concussion).",
  )
})

test('an IL activation: the time he missed, from the stint he came off', () => {
  const f = shapeFacts(rutschman, { season: 2026 })
  const back = { ...f, stint: f.stints[1], beforeLine: null }
  assert.equal(injuredStory(back, { placed: false }), 'Rutschman missed nine days (concussion), his second stint this season.')
})

// Code review, 2026-11-02: six bugs, each pinned before its fix.

test('arrivals are read in date order, whatever order the feed returns them in', () => {
  const tr = (date, to, from) => ({ typeCode: 'TR', date, toTeam: { id: to }, fromTeam: { id: from }, description: 'traded' })
  // Codi Heuer's August, listed newest first.
  const person = { id: 1, primaryPosition: { code: '1' }, stats: [], transactions: [tr('2026-08-03', 110, 158), tr('2026-08-01', 158, 114)] }
  const f = shapeFacts(person, { season: 2026 })
  assert.equal(f.arrival.teamId, 110)
  assert.deepEqual(f.arrivals.map((a) => a.date), ['2026-08-01', '2026-08-03'])
})

test("a farm club's own injured list is not a big-league stint", () => {
  const sc = (date, team, text) => ({ typeCode: 'SC', date, effectiveDate: date, toTeam: { id: team }, description: text })
  const person = {
    id: 2,
    primaryPosition: { code: '1' },
    stats: [],
    transactions: [
      sc('2026-05-01', 552, 'Syracuse Mets placed RHP X on the 7-day injured list.'),
      sc('2026-07-01', 121, 'New York Mets placed RHP X on the 15-day injured list. Right elbow strain.'),
      sc('2026-07-20', 121, 'New York Mets activated RHP X from the 15-day injured list.'),
    ],
  }
  const f = shapeFacts(person, { season: 2026 })
  assert.deepEqual(f.stints.map((x) => [x.from, x.to]), [['2026-07-01', '2026-07-20']])
})

test("the Minors view's total is the season's Minors row, not a level's subtotal", () => {
  const career = [
    { sport: { abbreviation: 'AA' }, stat: { gamesPitched: 11, inningsPitched: '44.2' } },
    { sport: { abbreviation: 'Minors' }, stat: { gamesPitched: 25, inningsPitched: '106.2' } },
  ]
  assert.equal(shapeScopeRows([], career, true).total.ip, '106.2')
})

test('a minor-league hitter with no homers reads "no homers"', () => {
  const f = facts({ age: 26, seasonLine: null, minors: { team: 'Syracuse Mets', level: ['Triple-A'], line: { games: 80, avg: '.231', hr: 0 } }, clubs: [] })
  const thin = facts({ seasonLine: { games: 3, avg: '.100', hr: 0 }, clubs: [{ teamId: 121, from: 2026, to: 2026 }], minors: { team: 'Syracuse Mets', level: ['Triple-A'], line: { games: 80, avg: '.231', hr: 0 } } })
  assert.match(seasonSentence(thin), /hitting \.231 with no homers/)
  assert.match(seasonSentence(f), /hit \.231 with no homers/)
})

test('an outright of a player with no career line on file does not throw', () => {
  assert.doesNotThrow(() => cutStory(facts({ careerLine: null }), { clause: 'Sent X outright.' }))
})

test('a Rule 5 pick and a purchased contract say how he really arrived', () => {
  const r5 = facts({ arrival: { how: 'Rule 5 draft', date: '2025-12-10', teamId: 146, fromTeamId: 147 } })
  assert.match(cutStory(r5, { moveDate: '2026-10-30', clause: 'Sent X outright.' }), /^Suárez, 35, was a Rule 5 pick by the Marlins from the Yankees in December 2025\./)
  const bought = facts({ arrival: { how: 'purchase', date: '2026-06-02', teamId: 146, fromTeamId: 147 } })
  assert.match(cutStory(bought, { moveDate: '2026-10-30', clause: 'Sent X outright.' }), /^Suárez, 35, was bought by the Marlins from the Yankees on June 2\./)
})

// The More card's additions, 2026-11-02.

test('a trade names who he went for, from the other side of the deal', () => {
  const giolito = 'Chicago White Sox traded RHP Lucas Giolito and RHP Reynaldo López to Los Angeles Angels for C Edgar Quero and LHP Ky Bush.'
  assert.equal(tradedFor(giolito, 'Ky Bush'), 'Lucas Giolito and Reynaldo López')
  assert.equal(tradedFor(giolito, 'Lucas Giolito'), 'Edgar Quero and Ky Bush')
  const rosario = 'Cleveland Guardians traded SS Amed Rosario to Los Angeles Dodgers for RHP Noah Syndergaard and cash.'
  assert.equal(tradedFor(rosario, 'Amed Rosario'), 'Noah Syndergaard and cash')
  assert.equal(tradedFor('Some row with no trade in it.', 'Ky Bush'), null)
})

test('the draft read is the one he signed out of, the latest, with its overall pick', () => {
  // Ky Bush: a Royals 40th-rounder out of high school in 2018, signed as the Angels' 2nd-rounder in 2021.
  const person = {
    id: 681066,
    primaryPosition: { code: '1' },
    stats: [],
    drafts: [
      { year: '2021', pickRound: '2', pickNumber: 45, team: { id: 108 }, school: { name: "St. Mary's College" } },
      { year: '2018', pickRound: '40', pickNumber: 1202, team: { id: 118 }, school: { name: 'Fremont HS' } },
    ],
  }
  const f = shapeFacts(person, { season: 2026 })
  assert.equal(f.draft.year, 2021)
  assert.equal(draftSentence(f), "The Angels drafted him out of St. Mary's College in the second round (45th overall) in 2021.")
  assert.equal(draftSentence({ draft: null }), null)
})

test('a competitive-balance pick names its round, never "NaNth"', () => {
  // Logan Driscoll (Padres, 2019): the feed's pickRound is "CB-B", not a number.
  const f = { draft: { teamId: 135, year: 2019, round: 'CB-B', pick: 73, school: 'George Mason' } }
  assert.equal(draftSentence(f), 'The Padres drafted him out of George Mason in Competitive Balance Round B (73rd overall) in 2019.')
})

test("a first IL trip of the season reads his earlier seasons' trips instead", () => {
  const person = {
    ...rutschman,
    transactions: [
      il('2025-05-01', '2025-05-01', 'Baltimore Orioles placed C Adley Rutschman on the 10-day injured list. Left oblique strain.'),
      il('2025-06-10', '2025-06-10', 'Baltimore Orioles activated C Adley Rutschman from the 10-day injured list.'),
      il('2026-04-11', '2026-04-11', 'Baltimore Orioles placed C Adley Rutschman on the 10-day injured list. Left ankle inflammation.'),
    ],
  }
  const f = shapeFacts(person, { season: 2026 })
  assert.equal(f.stints.length, 1)
  const placed = { ...f, stint: f.stints[0], beforeLine: { games: 10, avg: '.300', hr: 2 } }
  assert.equal(
    injuredStory(placed, { placed: true }),
    'Rutschman was hitting .300 with two homers in 10 games. He missed 40 days (left oblique strain) in 2025.',
  )
})

test("a stint filed again names his first filing, and its injury only when the move's words leave it out", () => {
  const f = shapeFacts(rutschman, { season: 2026 })
  const placed = { ...f, stint: f.stints[2], beforeLine: null }
  const note = injuredStory(placed, { placed: true, moveDate: '2026-08-03', clause: 'Placed C Adley Rutschman on the 10-day injured list' })
  assert.match(note, /^He first went on the list July 19 \(left wrist inflammation\)\./)
  const named = injuredStory(placed, { placed: true, moveDate: '2026-08-03', clause: 'Placed C Adley Rutschman on the 10-day injured list (left wrist inflammation)' })
  assert.match(named, /^He first went on the list July 19\./)
})

test("a trade's note is his line up to the deal, for the club he left", () => {
  const f = facts({
    rows: [
      { season: 2026, teamId: 111, line: {} },
      { season: 2026, teamId: 110, line: {} },
    ],
    trade: { line: { games: 67, avg: '.251', hr: 8 }, fromTeamId: 110, toTeamId: 111 },
  })
  assert.equal(seasonSentence(f), 'Suárez, 35, was hitting .251 with eight homers in 67 games for the Orioles.')
  // Two clubs before the deal: the line is his, not one club's.
  const two = { ...f, rows: [...f.rows, { season: 2026, teamId: 121, line: {} }] }
  assert.equal(seasonSentence(two), 'Suárez, 35, was hitting .251 with eight homers in 67 games.')
})

test('a draft round reads the same wherever a note says it', async () => {
  // Both draft phrasings share these, so a "CB-B" pick never reads "NaNth".
  const { pickPhrase, roundPhrase } = await import('../src/api/transactions/voice.js')
  assert.equal(roundPhrase('2'), 'the second round')
  assert.equal(roundPhrase('11'), 'the 11th round')
  assert.equal(roundPhrase('CB-B'), 'Competitive Balance Round B')
  assert.equal(roundPhrase('?'), null)
  assert.equal(pickPhrase('11'), '11th-round pick')
  assert.equal(pickPhrase('CB-A'), 'competitive-balance pick')
  assert.equal(pickPhrase(null), 'draft pick')
})

test('a mid-season activation with no games yet says what he missed, not that he did not play', () => {
  const f = shapeFacts(rutschman, { season: 2026 })
  // Dated to the day before the move, his season line is empty for a stint from Opening Day.
  const back = { ...f, stint: { ...f.stints[0], from: '2026-03-26', to: '2026-06-10' }, stints: [f.stints[0]], seasonLine: { games: 0 }, beforeLine: null }
  assert.doesNotMatch(injuredStory(back, { placed: false, moveDate: '2026-06-10' }), /did not play/)
})

test('an activation after a stint that ate the season says he did not play', () => {
  const f = shapeFacts(rutschman, { season: 2026 })
  const back = { ...f, stint: { ...f.stints[0], from: '2026-03-26', to: '2026-11-02' }, stints: [f.stints[0]], seasonLine: { games: 0 }, beforeLine: null }
  assert.match(injuredStory(back, { placed: false, moveDate: '2026-11-02' }), /^Rutschman did not play in 2026/)
})
