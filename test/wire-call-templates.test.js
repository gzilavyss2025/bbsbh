// Unit coverage for the wire's call-up, demotion, arrival and retirement notes
// (src/api/transactions/templates.js) and the trips they read
// (src/api/transactions/playerFacts.js). Row shapes are cut down from real
// /transactions rows: Randy Dobnak's recall (2026-07-01), Jose Cuas's
// selection, the Blue Jays' 60-day transfer of Ryan Burr, and the Pioneer
// League and American Association arrivals sampled 2026-11-03.
import assert from 'node:assert/strict'
import test from 'node:test'
import { lastAffiliated, shapeFacts } from '../src/api/transactions/playerFacts.js'
import { arrivalStory, callStory, factLines, retiredStory, subjectsOf } from '../src/api/transactions/templates.js'

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
