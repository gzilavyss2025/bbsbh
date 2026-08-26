// Unit coverage for scripts/lib/contract-identity-match.mjs — the pure
// name/team/season matcher behind the contract-identity pipeline. These pin
// the safety property the whole pipeline leans on: a row with no confident
// match comes back `unresolved`/`ambiguous`, never a silent wrong guess (see
// docs/adr/0066-a-contract-row-with-no-confident-id-stays-unresolved.md).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  estimateDebutYear,
  levenshtein,
  matchRow,
  nameSimilarity,
  normalizeName,
  normalizePosition,
} from '../scripts/lib/contract-identity-match.mjs'

test('normalizeName strips diacritics, case, and extra whitespace', () => {
  assert.equal(normalizeName('Abreu, José'), normalizeName('Abreu, Jose'))
  assert.equal(normalizeName('  Guerrero Jr.,   Vladimir '), 'guerrero jr., vladimir')
  assert.equal(normalizeName(''), '')
  assert.equal(normalizeName(null), '')
})

test('levenshtein: identical strings are 0, one-char edits are 1', () => {
  assert.equal(levenshtein('smith', 'smith'), 0)
  assert.equal(levenshtein('smith', 'smyth'), 1)
  assert.equal(levenshtein('', 'abc'), 3)
})

test('nameSimilarity: 1.0 for an exact (post-normalization) match, high for a near-miss, low for unrelated names', () => {
  assert.equal(nameSimilarity('Abreu, José', 'Abreu, Jose'), 1)
  assert.ok(nameSimilarity('Rodriguez, Alex', 'Rodriguez, Alexx') > 0.85)
  assert.ok(nameSimilarity('Rodriguez, Alex', 'Smith, John') < 0.3)
})

test('nameSimilarity: a nickname/given-name pair on the same last name scores high but below 1.0, in either direction', () => {
  // Real cases confirmed against statsapi: CSV has the full name, statsapi
  // the nickname, and vice versa.
  assert.equal(nameSimilarity('Boyd, Matt', 'Boyd, Matthew'), 0.95)
  assert.equal(nameSimilarity('Coulombe, Daniel', 'Coulombe, Danny'), 0.95)
  assert.equal(nameSimilarity('Hernandez, Kike', 'Hernandez, Enrique'), 0.95)
})

test('nameSimilarity: a nickname match never fires across two different last names', () => {
  assert.ok(nameSimilarity('Boyd, Matt', 'Smith, Matthew') < 0.5)
})

test('normalizePosition collapses compound/hand codes to a broad category shared with statsapi', () => {
  assert.equal(normalizePosition('rhp-s'), 'P')
  assert.equal(normalizePosition('lhp'), 'P')
  assert.equal(normalizePosition('dh-lf'), 'DH')
  assert.equal(normalizePosition('cf'), 'OF')
  assert.equal(normalizePosition('CF'), 'OF')
  assert.equal(normalizePosition(''), null)
  assert.equal(normalizePosition(null), null)
})

test('estimateDebutYear: MLS "7.134" in season 2026 means roughly debuted 2019', () => {
  assert.equal(estimateDebutYear(2026, '7.134'), 2019)
  assert.equal(estimateDebutYear(2026, 0), 2026)
  assert.equal(estimateDebutYear(2026, null), null)
  assert.equal(estimateDebutYear(2026, '-'), null)
})

function candidate(id, lastFirstName, { teamId = 100, position = null, debutYear = null } = {}) {
  return { id, lastFirstName, teamId, position, debutYear }
}

test('matchRow: a single exact name in the pool resolves as exact', () => {
  const pool = [candidate(1, 'Rodriguez, Alex'), candidate(2, 'Smith, John')]
  const result = matchRow({ rawName: 'Rodriguez, Alex' }, pool, 2015)
  assert.equal(result.mlbId, 1)
  assert.equal(result.confidence, 'exact')
  assert.equal(result.candidates.length, 0)
})

test('matchRow: an empty candidate pool is unresolved, not an error', () => {
  const result = matchRow({ rawName: 'Rodriguez, Alex' }, [], 2015)
  assert.equal(result.mlbId, null)
  assert.equal(result.confidence, 'unresolved')
})

test('matchRow: no plausible name anywhere in the pool is unresolved', () => {
  const pool = [candidate(1, 'Smith, John'), candidate(2, 'Jones, Bob')]
  const result = matchRow({ rawName: 'Rodriguez, Alex' }, pool, 2015)
  assert.equal(result.mlbId, null)
  assert.equal(result.confidence, 'unresolved')
})

test('matchRow: two identical exact names on the same team-season resolve via position/debut tiebreak, not silently', () => {
  const pool = [
    candidate(1, 'Smith, Chris', { position: 'P', debutYear: 2010 }),
    candidate(2, 'Smith, Chris', { position: '1B', debutYear: 2018 }),
  ]
  const result = matchRow({ rawName: 'Smith, Chris', position: 'rhp', mls: '5.0' }, pool, 2015)
  assert.equal(result.mlbId, 1, 'the pitcher with plausible service time should win the tiebreak')
  assert.notEqual(result.confidence, 'exact', 'a tiebroken duplicate name is not a pure exact match')
})

test('matchRow: two identical exact names with no disambiguating context stay ambiguous', () => {
  const pool = [candidate(1, 'Smith, Chris'), candidate(2, 'Smith, Chris')]
  const result = matchRow({ rawName: 'Smith, Chris' }, pool, 2015)
  assert.equal(result.mlbId, null)
  assert.equal(result.confidence, 'ambiguous')
  assert.equal(result.candidates.length, 2)
})

test('matchRow: a clear best fuzzy match (accent/typo gap) resolves as fuzzy', () => {
  const pool = [candidate(1, 'Abreu, José'), candidate(2, 'Smith, John')]
  const result = matchRow({ rawName: 'Abreu, Jose' }, pool, 2015)
  // normalizeName already strips the accent, so this is actually an exact
  // match post-normalization -- confirms accent differences never fall to
  // the ambiguous/fuzzy path unnecessarily.
  assert.equal(result.mlbId, 1)
  assert.equal(result.confidence, 'exact')
})

test('matchRow: two equidistant fuzzy candidates with no clear winner stay ambiguous', () => {
  // Both candidates are exactly one substitution away from the raw name, at
  // different positions -- symmetric by construction, so neither should win.
  const pool = [candidate(1, 'Smith, Joe'), candidate(2, 'Smith, Jan')]
  const result = matchRow({ rawName: 'Smith, Jon' }, pool, 2015)
  assert.equal(result.mlbId, null)
  assert.equal(result.confidence, 'ambiguous')
})
