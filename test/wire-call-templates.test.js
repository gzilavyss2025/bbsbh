// Unit coverage for the wire's call-up, demotion, arrival and retirement notes
// (src/api/transactions/templates.js) and the trips they read
// (src/api/transactions/playerFacts.js). Row shapes are cut down from real
// /transactions rows: Randy Dobnak's recall (2026-07-01), Jose Cuas's
// selection, the Blue Jays' 60-day transfer of Ryan Burr, and the Pioneer
// League and American Association arrivals sampled 2026-11-03.
import assert from 'node:assert/strict'
import test from 'node:test'
import { lastAffiliated, lastGameOf, shapeFacts } from '../src/api/transactions/playerFacts.js'
import { arrivalStory, callStory, callUpSentence, factLines, injuredStory, retiredStory, subjectsOf } from '../src/api/transactions/templates.js'

const clause = (before, after = '.') => ({ cutline: [{ text: before }, { text: 'Dobnak', playerId: 1 }, { text: after }] })
const templateOf = (story) => subjectsOf(story)[0].template

test('each kind of call, arrival and exit reads its own template', () => {
  assert.equal(templateOf(clause('Recalled RHP ', ' from Omaha Storm Chasers.')), 'recall')
  assert.equal(templateOf(clause('Optioned RHP ', ' to Omaha Storm Chasers.')), 'option')
  assert.equal(templateOf(clause('Selected the contract of RHP ', ' from Omaha Storm Chasers.')), 'selected')
  assert.equal(templateOf(clause('Transferred RHP ', ' from the 15-day injured list to the 60-day injured list.')), 'il-placed')
  assert.equal(templateOf(clause('Obtained RHP ', ' from Glacier Range Riders.')), 'arrival')
  assert.equal(templateOf(clause('Purchased OF ', ' from Lake Country DockHounds.')), 'arrival')
  assert.equal(templateOf(clause('Acquired LHP ', ' from the Kansas City Monarchs of the American Association.')), 'arrival')
  assert.equal(templateOf(clause('3B ', ' retired.')), 'retired')
  // A trade still reads as one: it names what went the other way.
  assert.equal(templateOf(clause('Acquired RHP ', ' from the Tampa Bay Rays for cash.')), 'trade')
})

// Dobnak's 2026 as /people's transactions hydrate files it, plus two later trips.
const row = (date, typeCode, fromId, toId, description = '') => ({ date, typeCode, fromTeam: fromId ? { id: fromId } : undefined, toTeam: toId ? { id: toId } : undefined, description })
const person = {
  id: 1,
  fullName: 'Randy Dobnak',
  lastName: 'Dobnak',
  primaryPosition: { code: '1' },
  mlbDebutDate: '2019-08-09',
  transactions: [
    row('2026-06-17', 'TR', 136, 118),
    row('2026-07-01', 'CU', 541, 118),
    row('2026-07-13', 'OPT', 118, 541),
    row('2026-08-02', 'CU', 541, 118),
    row('2026-08-05', 'OPT', 118, 541),
    row('2026-09-01', 'SE', 541, 118),
  ],
}

test('his big-league trips this season, up and back down, oldest first', () => {
  const f = shapeFacts(person, { season: 2026, teamId: 118 })
  assert.deepEqual(f.calls, [
    { up: '2026-07-01', down: '2026-07-13' },
    { up: '2026-08-02', down: '2026-08-05' },
    { up: '2026-09-01', down: null },
  ])
})

const facts = (over = {}) => ({
  ...shapeFacts(person, { season: 2026, teamId: 118 }),
  age: 31,
  contract: { options: 1 },
  ...over,
})

test('a recall: his minor-league form before it, then which trip up it is', () => {
  const callLine = { level: ['Triple-A'], team: null, line: { games: 15, era: '4.35', ip: '62.0' } }
  assert.equal(
    callStory(facts({ callLine }), { kind: 'recall', moveDate: '2026-08-02' }),
    'Dobnak posted a 4.35 ERA over 62.0 innings in 15 games in Triple-A in 2026 before the call. It is his second trip up this season; the last lasted 12 days.',
  )
  assert.equal(callStory(facts(), { kind: 'recall', moveDate: '2026-07-01' }), 'It is his first trip up this season.')
})

// No day count: a trip can hold a stint on the injured list (Gilbert, 2026).
test('an option: how the stint went, then his options', () => {
  const stintLine = { games: 6, era: '5.40', ip: '10.0' }
  assert.equal(
    callStory(facts({ stintLine }), { kind: 'option', moveDate: '2026-07-13' }),
    'Dobnak posted a 5.40 ERA over 10.0 innings in 6 games before the move. He has one minor-league option left.',
  )
  assert.equal(
    callStory(facts({ stintLine: { games: 0 }, contract: { options: 0 } }), { kind: 'option', moveDate: '2026-08-05' }),
    'Dobnak did not get into a game on this trip. He is out of minor-league options.',
  )
})

// Brandon Sproat, Brewers, optioned Aug. 4, 2026 after a start on Aug. 3: his
// last game, then his big-league season to that day.
test('an option after a while up: his last game, then his season to date', () => {
  const lastGame = { date: '2026-08-03', oppId: 134, line: { ip: '3.0', er: 4 } }
  const seasonToDate = { games: 22, era: '5.12', ip: '89.2' }
  assert.equal(
    callStory(facts({ lastName: 'Sproat', lastGame, seasonToDate, stintLine: { games: 22, era: '5.12', ip: '89.2' } }), { kind: 'option', moveDate: '2026-08-04' }),
    'Sproat last pitched Aug. 3 against the Pirates, allowing 4 earned runs over 3 innings. He posted a 5.12 ERA over 89.2 innings in 22 games this season before the move. He has one minor-league option left.',
  )
  // A hitter's last game reads as a box line, and one run reads as one.
  const hitter = facts({ lastName: 'Lockridge', pitcher: false, lastGame: { date: '2026-08-18', oppId: 112, line: { ab: 4, h: 1, hr: 0 } }, seasonToDate: { games: 40, avg: '.231', hr: 3 } })
  assert.equal(
    callStory(hitter, { kind: 'option', moveDate: '2026-08-19' }),
    'Lockridge last played Aug. 18 against the Cubs, going 1-for-4. He hit .231 with 3 homers in 40 games this season before the move. He has one minor-league option left.',
  )
  // Garrett Stallings, Aug. 3: three scoreless innings.
  const clean = facts({ lastName: 'Stallings', lastGame: { date: '2026-08-03', oppId: 134, line: { ip: '3.0', er: 0 } }, seasonToDate: { games: 4, era: '0.00', ip: '8.0' } })
  assert.match(callStory(clean, { kind: 'option', moveDate: '2026-08-04' }), /^Stallings last pitched Aug. 3 against the Pirates, going 3 innings without an earned run./)
  // Jared Koenig, July 12: five runs and no outs.
  const rough = facts({ lastName: 'Koenig', lastGame: { date: '2026-07-12', oppId: 134, line: { ip: '0.0', er: 5 } }, seasonToDate: { games: 9, era: '9.00', ip: '7.0' } })
  assert.match(callStory(rough, { kind: 'option', moveDate: '2026-07-17' }), /^Koenig last pitched July 12 against the Pirates, allowing 5 earned runs without retiring a batter./)
})

test('a selected contract: a first call-up says so, with where he came from', () => {
  const callLine = { level: ['Double-A', 'Triple-A'], team: null, line: { games: 88, avg: '.301', hr: 14 } }
  const debutant = facts({
    pitcher: false,
    debut: null,
    lastName: 'Cuas',
    prospect: { rank: 8, teamId: 118 },
    draft: { teamId: 118, year: 2022, round: 3, pick: null, school: 'Duke' },
    arrivals: [],
    callLine,
  })
  assert.equal(
    callStory(debutant, { kind: 'selected', moveDate: '2026-09-01' }),
    "It is his first call to the majors. The 31-year-old, the Royals' No. 8 prospect, hit .301 with 14 homers in 88 games across Double-A and Triple-A in 2026 before the call. Cuas was the Royals' 3rd-round pick out of Duke in 2022.",
  )
  // A big leaguer's selection is a trip up like any other.
  assert.equal(callStory(facts(), { kind: 'selected', moveDate: '2026-09-01' }), 'It is his third trip up this season; the last lasted 3 days.')
})

test('a retirement: the whole career in a sentence', () => {
  const longoria = {
    lastName: 'Longoria',
    pitcher: false,
    debut: '2008-04-12',
    seasons: 16,
    careerLine: { games: 2000, avg: '.264', hr: 342 },
    clubs: [
      { teamId: 139, from: 2008, to: 2017 },
      { teamId: 137, from: 2018, to: 2022 },
      { teamId: 109, from: 2023, to: 2023 },
    ],
  }
  assert.equal(
    retiredStory(longoria),
    'Longoria played 16 seasons in the majors for the Rays (2008-17), Giants (2018-22) and Diamondbacks (2023), hitting .264 with 342 homers in 2,000 games.',
  )
  assert.equal(retiredStory({ ...longoria, debut: null, careerLine: null }), null)
})

test('an arrival from independent ball: where from, and his last affiliated season', () => {
  const base = { age: 27, lastName: 'Schafer', pitcher: true, debut: null, careerLine: null, draft: null }
  const arrival = { how: 'purchase', fromName: 'Glacier Range Riders' }
  assert.equal(
    arrivalStory({ ...base, arrival, affiliated: { season: 2024, level: 'Double-A' } }),
    'The 27-year-old comes from the Glacier Range Riders, outside affiliated ball. His last season in affiliated ball was 2024, in Double-A.',
  )
  assert.equal(arrivalStory({ ...base, arrival, affiliated: null }), 'The 27-year-old comes from the Glacier Range Riders, outside affiliated ball.')
  // No fact line for a move the note can't speak to.
  assert.deepEqual(factLines('arrival', { ...base, arrival: null, affiliated: null }), [])
})

test('a transfer to the 60-day list files into the stint already open', () => {
  const burr = {
    id: 2,
    lastName: 'Burr',
    primaryPosition: { code: '1' },
    transactions: [
      { date: '2026-05-02', effectiveDate: '2026-04-30', typeCode: 'SC', toTeam: { id: 141 }, description: 'Toronto Blue Jays placed RHP Ryan Burr on the 15-day injured list retroactive to April 30, 2026. Right shoulder strain.' },
      { date: '2026-06-10', typeCode: 'SC', toTeam: { id: 141 }, description: 'Toronto Blue Jays transferred RHP Ryan Burr from the 15-day injured list to the 60-day injured list.' },
    ],
  }
  const f = shapeFacts(burr, { season: 2026, teamId: 141 })
  assert.deepEqual(f.stints[0].filings, ['2026-05-02', '2026-06-10'])
  assert.equal(f.injured, 'long')
})

test('a trade with nothing named in return is still a trade, not an arrival', () => {
  // Jojo Ingrassia, Aug. 2026: the partner is a linked big-league club.
  const story = { cutline: [{ text: 'Acquired LHP ' }, { text: 'Ingrassia', playerId: 1 }, { text: ' from the ' }, { text: 'Boston Red Sox', teamId: 111 }, { text: '.' }] }
  assert.equal(templateOf(story), 'trade')
  // And an arrival note needs a purchase behind it.
  assert.equal(arrivalStory({ age: 24, arrival: { how: 'trade', fromName: 'Boston Red Sox' } }), null)
})

test("an arrival's last affiliated season is one before the year he arrived", () => {
  const rows = [{ season: 2026, level: 'A+' }, { season: 2024, level: 'AA' }]
  assert.deepEqual(lastAffiliated(rows, '2026-08-02'), { season: 2024, level: 'Double-A' })
  assert.equal(lastAffiliated([{ season: 2026, level: 'A+' }], '2026-08-02'), null)
})

test('traded while injured: the note says whose list he went on, and the trade', () => {
  // JoJo Romero, 2026: on the Cardinals' list July 14, traded and re-placed by the Brewers Aug. 3.
  const romero = {
    id: 3,
    lastName: 'Romero',
    primaryPosition: { code: '1' },
    transactions: [
      { date: '2026-07-17', effectiveDate: '2026-07-14', typeCode: 'SC', toTeam: { id: 138 }, description: 'St. Louis Cardinals placed LHP JoJo Romero on the 15-day injured list retroactive to July 14, 2026.' },
      { date: '2026-08-03', typeCode: 'SC', toTeam: { id: 158 }, description: 'Milwaukee Brewers placed LHP JoJo Romero on the 15-day injured list.' },
      { date: '2026-08-03', typeCode: 'TR', fromTeam: { id: 138 }, toTeam: { id: 158 }, description: 'St. Louis Cardinals traded RHP Dustin May and LHP JoJo Romero to Milwaukee Brewers for OF Alexander Frias and OF Josiah Ragsdale.' },
    ],
  }
  const f = shapeFacts(romero, { season: 2026, teamId: 158 })
  f.stint = f.stints[0]
  assert.equal(
    injuredStory(f, { placed: true, moveDate: '2026-08-03', clause: 'Placed LHP Romero on the 15-day injured list.' }),
    "He went on the Cardinals' injured list July 14 and came over in the Aug. 3 trade.",
  )
})

test('a doubleheader call-up reads as the 27th man, up and back down', () => {
  // Jason Alexander, Astros: recalled for the April 30, 2026 doubleheader, optioned May 1.
  const f = { lastName: 'Alexander', season: 2026, extraMan: { event: null }, calls: [{ up: '2026-04-30', down: '2026-05-01' }], contract: { options: 1 } }
  assert.equal(callStory(f, { kind: 'recall', moveDate: '2026-04-30' }), 'Alexander came up as the 27th man for the doubleheader and went back down May 1.')
  assert.equal(
    callStory(f, { kind: 'option', moveDate: '2026-05-01' }),
    'Alexander goes back down after serving as the 27th man in the April 30 doubleheader.',
  )
})

test('a special-event call-up names the event', () => {
  // Bo Naylor, Brewers: recalled for the Little League Classic, Aug. 23, 2026; optioned Aug. 24.
  const f = { lastName: 'Naylor', season: 2026, extraMan: { event: 'MLB Little League Classic in Williamsport, PA' }, calls: [{ up: '2026-08-23', down: '2026-08-24' }] }
  assert.equal(callStory(f, { kind: 'recall', moveDate: '2026-08-23' }), 'Naylor came up as the 27th man for the MLB Little League Classic in Williamsport, PA, and went back down Aug. 24.')
  assert.equal(callStory(f, { kind: 'option', moveDate: '2026-08-24' }), 'Naylor goes back down after serving as the 27th man at the MLB Little League Classic in Williamsport, PA.')
})

test('his last game is the last log row before the move', () => {
  // Brandon Sproat's 2026 game log (687075), trimmed: the Aug. 3 start.
  const log = [
    { date: '2026-07-28', opponent: { id: 112 }, stat: { inningsPitched: '5.0', earnedRuns: 2 } },
    { date: '2026-08-03', team: { id: 158 }, opponent: { id: 134 }, stat: { inningsPitched: '3.0', earnedRuns: 4 } },
    { date: '2026-08-20', opponent: { id: 113 }, stat: { inningsPitched: '1.0', earnedRuns: 0 } },
  ]
  assert.deepEqual(lastGameOf(log, '2026-08-04', true, 158), { date: '2026-08-03', oppId: 134, line: { ip: '3.0', er: 4 } })
  assert.equal(lastGameOf([], '2026-08-04', true), null)
  // Codi Heuer, optioned by the Brewers Aug. 2 after a trade: his last game was
  // for Cleveland, so the Brewers' note has none to tell.
  const cle = [{ date: '2026-07-18', team: { id: 114 }, opponent: { id: 134 }, stat: { inningsPitched: '1.2', earnedRuns: 0 } }]
  assert.equal(lastGameOf(cle, '2026-08-02', true, 158), null)
})

test('a call-up beside a placement gets his minor-league line in one sentence', () => {
  // Blake Perkins, recalled July 18, 2026 when Sal Frelick went on the injured list.
  const callLine = { level: ['Triple-A'], team: 'Nashville Sounds', line: { games: 40, avg: '.270', hr: 6 } }
  assert.equal(
    callUpSentence({ lastName: 'Perkins', pitcher: false, season: 2026, callLine }),
    'Perkins hit .270 with 6 homers in 40 games in Triple-A with the Nashville Sounds in 2026 before the call.',
  )
  assert.equal(callUpSentence({ lastName: 'Perkins', season: 2026, callLine: null }), null)
  // He had been shuttling: big-league games too, so the sentence holds both.
  const callMlbLine = { games: 40, avg: '.250', hr: 2 }
  assert.equal(
    callUpSentence({ lastName: 'Perkins', pitcher: false, season: 2026, callLine, callMlbLine }),
    'Perkins has split 2026 between the Nashville Sounds (.270 with 6 homers in 40 games) and the majors (.250 with 2 homers in 40 games) before the call.',
  )
  const arm = { lastName: 'Gasser', pitcher: true, season: 2026, callLine: { level: ['Triple-A'], team: null, line: { games: 12, era: '3.10', ip: '58.0' } }, callMlbLine: { games: 5, era: '6.00', ip: '18.0' } }
  assert.equal(callUpSentence(arm), 'Gasser has split 2026 between Triple-A (a 3.10 ERA in 12 games) and the majors (a 6.00 ERA in 5 games) before the call.')
})

// Easton McGee, traded by the Brewers to the Royals for cash, July 14, 2026.
test('a player sold for cash: his whole time with the club, worded three ways', () => {
  const base = {
    lastName: 'McGee',
    pitcher: true,
    season: 2026,
    clubs: [{ teamId: 139, from: 2022, to: 2022 }, { teamId: 158, from: 2025, to: 2026 }],
    clubTotals: { 158: { games: 9, era: '1.80', ip: '15.0' } },
  }
  const ctx = { teamId: 158, moveDate: '2026-07-14' }
  const lines = [0, 1, 2].map((n) => factLines('sold', { ...base, id: n }, ctx)[0])
  assert.deepEqual(lines, [
    'McGee had been with the Brewers since 2025, and in that time he posted a 1.80 ERA over 15.0 innings in 9 games for them.',
    'McGee joined the Brewers in 2025 and posted a 1.80 ERA over 15.0 innings in 9 games for them.',
    'McGee leaves the Brewers after two seasons, in which he posted a 1.80 ERA over 15.0 innings in 9 games for them.',
  ])
  // No games for the club at all: his tenure alone.
  assert.equal(factLines('sold', { ...base, id: 0, clubTotals: {} }, ctx)[0], 'McGee had been with the Brewers since 2025.')
  assert.equal(templateOf(clause('Traded RHP ', ' to the Kansas City Royals for cash.')), 'sold')
})

test('a club total adds up his seasons with that club, from the stint he left', () => {
  const person = {
    id: 1,
    primaryPosition: { code: '1' },
    stats: [
      {
        group: { displayName: 'pitching' },
        type: { displayName: 'yearByYear' },
        splits: [
          { season: '2022', team: { id: 158 }, stat: { gamesPitched: 4, inningsPitched: '6.0', earnedRuns: 6 } },
          { season: '2023', team: { id: 139 }, stat: { gamesPitched: 2, inningsPitched: '3.0', earnedRuns: 1 } },
          { season: '2025', team: { id: 158 }, stat: { gamesPitched: 3, inningsPitched: '9.0', earnedRuns: 3 } },
          { season: '2026', team: { id: 158 }, stat: { gamesPitched: 6, inningsPitched: '5.2', earnedRuns: 0 } },
        ],
      },
    ],
  }
  // 2025-26 only: 14.2 innings (44 outs), 3 earned runs.
  assert.deepEqual(shapeFacts(person, { season: 2026 }).clubTotals[158], { games: 9, era: '1.84', ip: '14.2' })
})

test('a last outing writes its thirds of an inning as a scorer would', () => {
  const at = (ip, er) => callStory(facts({ lastName: 'Koenig', lastGame: { date: '2026-07-12', oppId: 134, line: { ip, er } }, seasonToDate: { games: 9, era: '9.00', ip: '7.0' } }), { kind: 'option', moveDate: '2026-07-17' })
  assert.match(at('0.1', 2), /allowing 2 earned runs over 1\/3 of an inning\./)
  assert.match(at('0.2', 0), /going 2\/3 of an inning without an earned run\./)
  assert.match(at('1.0', 1), /allowing 1 earned run over 1 inning\./)
  assert.match(at('2.1', 3), /allowing 3 earned runs over 2 1\/3 innings\./)
})

test('a cash deal reads the same with the club leading the clause', () => {
  // The league wire's sentence can open with the club that made the move.
  assert.equal(templateOf(clause('Milwaukee Brewers traded RHP ', ' to the Kansas City Royals for cash.')), 'sold')
})
