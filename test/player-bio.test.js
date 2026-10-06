// Nickname, education and same-name search rows. The three people and the
// Will Smith search are real captured responses (test/fixtures/player-bio/,
// rebuilt by .scratch/player-bio-fixtures/build-fixtures.mjs). All open
// surfaces: identity facts, never a score.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { educationSummary, personBio, personNickname } from '../src/api/person/identity.js'
import { disambiguateNames, yearsPlayed } from '../src/api/search.js'

const load = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/player-bio/${name}.json`, import.meta.url), 'utf8'))
const yelich = load('yelich')
const gray = load('gray')
const aaron = load('aaron')

test('personNickname reads nickName and trims it', () => {
  assert.equal(personNickname(aaron), "Hammerin' Hank")
  assert.equal(personNickname(yelich), 'Yeli')
  assert.equal(personNickname({ nickName: '  Pickles ' }), 'Pickles')
})

test('personNickname is empty when the record has none', () => {
  assert.equal(personNickname({ id: 1, fullName: 'No Nick' }), '')
  assert.equal(personNickname({ nickName: '   ' }), '')
  assert.equal(personNickname(null), '')
})

test('educationSummary joins high schools then colleges', () => {
  assert.equal(educationSummary(gray), 'Smyrna, Vanderbilt')
})

test('educationSummary handles high school only and Aaron', () => {
  assert.equal(educationSummary(yelich), 'Westlake')
  assert.equal(educationSummary(aaron), 'Allen Institute')
})

test('educationSummary is empty for sparse or missing records', () => {
  assert.equal(educationSummary({}), '')
  assert.equal(educationSummary({ education: {} }), '')
  assert.equal(educationSummary({ education: { colleges: [{}] } }), '')
  assert.equal(educationSummary(null), '')
})

test('personBio carries nickname and education for the header', () => {
  const bio = personBio(gray)
  assert.equal(bio.nickname, 'Pickles')
  assert.equal(bio.education, 'Smyrna, Vanderbilt')
  assert.equal(personBio({ id: 9 }).nickname, '')
  assert.equal(personBio({ id: 9 }).education, '')
})

const smiths = load('search-will-smith')
const rowsOf = (people) =>
  people.map((p) => ({ id: p.id, name: p.fullName, years: yearsPlayed(p) }))

test('yearsPlayed: an active player is open-ended, a retired one is closed', () => {
  const [catcher, pitcher] = smiths
  assert.equal(yearsPlayed(catcher), '2019-')
  assert.equal(yearsPlayed(pitcher), '2012-2024')
})

test('yearsPlayed is empty without a debut, and one year when debut and last match', () => {
  assert.equal(yearsPlayed({ active: true }), '')
  assert.equal(yearsPlayed({ active: false, mlbDebutDate: '1990-04-01', lastPlayedDate: '1990-09-30' }), '1990')
})

test('yearsPlayed ignores lastPlayedDate for an active player, and says nothing for a retired one without it', () => {
  assert.equal(yearsPlayed({ active: true, mlbDebutDate: '2019-05-28', lastPlayedDate: '2026-10-01' }), '2019-')
  assert.equal(yearsPlayed({ active: false, mlbDebutDate: '2012-05-23' }), '')
})

test('educationSummary survives null lists', () => {
  assert.equal(educationSummary({ education: { highschools: null, colleges: [{ name: 'Vanderbilt' }] } }), 'Vanderbilt')
})

test('educationSummary survives a list that is not an array', () => {
  assert.equal(educationSummary({ education: { highschools: { items: [] }, colleges: 'x' } }), '')
  assert.equal(educationSummary({ education: { highschools: [{ name: 'Westlake' }], colleges: {} } }), 'Westlake')
})

test('disambiguateNames keeps years on rows that share a full name', () => {
  const out = disambiguateNames(rowsOf(smiths))
  assert.deepEqual(out.map((r) => r.years), ['2019-', '2012-2024'])
})

test('disambiguateNames compares trimmed, lower-case names', () => {
  const out = disambiguateNames([
    { id: 1, name: 'Will Smith ', years: '2019-' },
    { id: 2, name: 'will smith', years: '2012-2024' },
  ])
  assert.equal(out[0].years, '2019-')
})

test('disambiguateNames blanks years on unique names and leaves input alone', () => {
  const rows = [
    { id: 1, name: 'Aaron Judge', years: '2016-' },
    { id: 2, name: 'Will Smith', years: '2019-' },
    { id: 3, name: 'Will Smith', years: '2012-2024' },
  ]
  const out = disambiguateNames(rows)
  assert.equal(out[0].years, '')
  assert.equal(out[1].years, '2019-')
  assert.equal(rows[0].years, '2016-')
})
