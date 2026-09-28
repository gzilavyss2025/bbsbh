// Test 4 of #1227 (build prompt traps 4 and 5): placeholder clubs are empty
// slots, and a Wild Card series feeds the Division Series the placeholder's
// club pair names, then the one its club id names. Never by slot letter:
// in 2026, NL Wild Card 'A' (PHI @ ATL) feeds NLDS 'B', and 'B' (CHC @ SD)
// feeds NLDS 'A'. The AL crosses the same way.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { skeleton } from './fixtures.js'

const CUTOFF = '2026-09-29'
const b2026 = () => deriveBracket(skeleton(2026), [], CUTOFF)

const abbrs = (series) => series.slots.map((slot) => slot.club?.abbreviation ?? null)
const byKey = (bracket, key) => bracket.series.find((s) => s.key === key)
const wcWith = (bracket, league, abbr) =>
  bracket.leagues[league].wildcard.find((s) => s.slots.some((slot) => slot.club?.abbreviation === abbr))
const dsWithBye = (bracket, league, abbr) =>
  bracket.leagues[league].division.find((s) => s.slots.some((slot) => slot.bye && slot.club?.abbreviation === abbr))

// Every club object anywhere in the derived bracket.
function allClubs(bracket) {
  const out = [...bracket.leagues.AL.byes, ...bracket.leagues.NL.byes]
  if (bracket.champion) out.push(bracket.champion)
  for (const s of bracket.series) {
    for (const slot of s.slots) if (slot.club) out.push(slot.club)
    if (s.winner) out.push(s.winner)
    if (s.eliminated) out.push(s.eliminated)
  }
  return out
}

test('test 4: 2026 NL Wild Card PHI @ ATL feeds the Division Series LAD waits in', () => {
  const b = b2026()
  const wc = wcWith(b, 'NL', 'PHI')
  assert.deepEqual(abbrs(wc), ['PHI', 'ATL'])
  const ds = dsWithBye(b, 'NL', 'LAD')
  assert.equal(wc.feeds, ds.key)
  // The NLDS the schedule names 'B'. The link above came from the pair, not the letter.
  assert.match(ds.label, /NLDS 'B'/)
  assert.deepEqual(abbrs(ds), [null, 'LAD'])
  assert.equal(ds.slots[0].from, wc.key)
  assert.equal(ds.slots[1].bye, true)
})

test('test 4: 2026 NL Wild Card CHC @ SD feeds the Division Series MIL waits in', () => {
  const b = b2026()
  const wc = wcWith(b, 'NL', 'CHC')
  assert.deepEqual(abbrs(wc), ['CHC', 'SD'])
  const ds = dsWithBye(b, 'NL', 'MIL')
  assert.equal(wc.feeds, ds.key)
  assert.match(ds.label, /NLDS 'A'/)
  assert.equal(ds.slots[0].from, wc.key)
})

test('test 4: 2026 AL wiring — CWS @ HOU feeds CLE, BOS @ NYY feeds TB', () => {
  const b = b2026()
  assert.equal(wcWith(b, 'AL', 'HOU').feeds, dsWithBye(b, 'AL', 'CLE').key)
  assert.equal(wcWith(b, 'AL', 'NYY').feeds, dsWithBye(b, 'AL', 'TB').key)
  assert.deepEqual(b.leagues.AL.byes.map((c) => c.abbreviation).sort(), ['CLE', 'TB'])
  assert.deepEqual(b.leagues.NL.byes.map((c) => c.abbreviation).sort(), ['LAD', 'MIL'])
})

test('test 4: the wiring does not change when the slot letters are swapped', () => {
  const swapped = skeleton(2026).map((row) => ({
    ...row,
    description: row.description.replace(/'A'|'B'/g, (m) => (m === "'A'" ? "'B'" : "'A'")),
  }))
  const b = deriveBracket(swapped, [], CUTOFF)
  assert.equal(wcWith(b, 'NL', 'PHI').feeds, dsWithBye(b, 'NL', 'LAD').key)
  assert.equal(wcWith(b, 'NL', 'CHC').feeds, dsWithBye(b, 'NL', 'MIL').key)
})

test('test 4: placeholders (5528 HOU/CWS, 5513 AL Higher Seed, 2711, …) are never a club', () => {
  const b = b2026()
  const ids = allClubs(b).map((c) => c.id)
  for (const placeholder of [5528, 5529, 5532, 5533, 5513, 5517, 5521, 5525, 2710, 2711]) {
    assert.ok(!ids.includes(placeholder), `placeholder ${placeholder} leaked into the bracket as a club`)
  }
  for (const c of allClubs(b)) {
    assert.ok(!c.name.includes('/') && !/Seed/.test(c.name), `${c.name} is a placeholder`)
  }
  // LCS and World Series slots are empty, fed by the round before.
  for (const league of ['AL', 'NL']) {
    const lcs = b.leagues[league].lcs
    assert.deepEqual(abbrs(lcs), [null, null])
    assert.deepEqual(
      lcs.slots.map((slot) => slot.from).sort(),
      b.leagues[league].division.map((s) => s.key).sort(),
    )
    for (const ds of b.leagues[league].division) assert.equal(ds.feeds, lcs.key)
    assert.equal(lcs.feeds, b.worldSeries.key)
  }
  assert.deepEqual(abbrs(b.worldSeries), [null, null])
  assert.deepEqual(
    b.worldSeries.slots.map((slot) => slot.from),
    [b.leagues.AL.lcs.key, b.leagues.NL.lcs.key],
  )
  assert.equal(b.champion, null)
})

test('test 4: a placeholder with no feeder to wire it to is still an empty slot, never a club', () => {
  // A partial schedule answer: the Wild Card rows are missing, so the
  // Division Series placeholders have nothing to wire to.
  const b = deriveBracket(
    skeleton(2026).filter((row) => row.gameType !== 'F'),
    [],
    CUTOFF,
  )
  const ids = allClubs(b).map((c) => c.id)
  for (const placeholder of [5528, 5529, 5532, 5533, 5513, 5517, 5521, 5525, 2710, 2711]) {
    assert.ok(!ids.includes(placeholder), `placeholder ${placeholder} leaked into the bracket as a club`)
  }
  assert.deepEqual(abbrs(b.leagues.NL.division.find((s) => abbrs(s).includes('LAD'))), [null, 'LAD'])
})

test('test 4: every 2026 series is 0-0 heading into the first day, and the Wild Card plays Game 1', () => {
  const b = b2026()
  for (const s of b.series) {
    assert.deepEqual(
      s.slots.map((slot) => slot.wins),
      [0, 0],
    )
    assert.equal(s.decided, false)
  }
  for (const s of [...b.leagues.AL.wildcard, ...b.leagues.NL.wildcard]) {
    assert.equal(s.playsOnCutoff, true)
    assert.equal(s.cutoffGame.gameNumber, 1)
    assert.equal(s.bestOf, 3)
  }
  assert.equal(b.leagues.AL.division[0].bestOf, 5)
  assert.equal(b.leagues.AL.lcs.bestOf, 7)
  assert.equal(b.worldSeries.bestOf, 7)
})

test('series id: {year}-{roundKey}-{Game 1 away id}-{Game 1 home id}, only when both clubs are known', () => {
  const b = b2026()
  assert.equal(wcWith(b, 'NL', 'PHI').id, '2026-wildcard-143-144')
  assert.equal(wcWith(b, 'AL', 'HOU').id, '2026-wildcard-145-117')
  for (const s of b.series.filter((x) => x.round !== 'wildcard')) assert.equal(s.id, null)

  // The same id the history generator gave 2025's series.
  const b25 = deriveBracket(skeleton(2025), [], '2025-12-31')
  const ids = new Set(b25.series.map((s) => s.id))
  assert.ok(ids.has('2025-wildcard-116-114'))
})

// A club that wins its Wild Card series shows in its Division Series slot the
// day after. The schedule turns the placeholder into that club as soon as the
// series ends, so the skeleton on the clinching day already names it. The
// derivation must not trust that: the slot is filled from the results.
test('a Wild Card winner fills its Division Series slot only from results before the cutoff', () => {
  const resolved = skeleton(2026).map((row) => {
    const swap = (club) => (club.id === 5532 ? { id: 143, name: 'Philadelphia Phillies', abbreviation: 'PHI', leagueId: 104 } : club)
    return { ...row, away: swap(row.away), home: swap(row.home) }
  })
  const g1 = { gamePk: 849845, officialDate: '2026-09-29', resumeGameDate: null, final: true, winnerId: 143 }
  const g2 = { gamePk: 849841, officialDate: '2026-09-30', resumeGameDate: null, final: true, winnerId: 143 }

  // Heading into 09-30: PHI leads 1-0; the resolved skeleton must not place PHI.
  const mid = deriveBracket(resolved, [g1], '2026-09-30')
  const ds = dsWithBye(mid, 'NL', 'LAD')
  assert.deepEqual(abbrs(ds), [null, 'LAD'])
  assert.equal(wcWith(mid, 'NL', 'PHI').feeds, ds.key, 'wired by club id once the placeholder is gone')

  // Heading into 10-01 (PHI clinched on 09-30): the slot shows PHI.
  const after = deriveBracket(resolved, [g1, g2], '2026-10-01')
  assert.deepEqual(abbrs(dsWithBye(after, 'NL', 'LAD')), ['PHI', 'LAD'])
  assert.equal(dsWithBye(after, 'NL', 'LAD').id, '2026-division-143-119')
  assert.equal(wcWith(after, 'NL', 'PHI').eliminated.abbreviation, 'ATL')

  // Same results, placeholder skeleton: PHI is placed through the club pair.
  const viaPair = deriveBracket(skeleton(2026), [g1, g2], '2026-10-01')
  assert.deepEqual(abbrs(dsWithBye(viaPair, 'NL', 'LAD')), ['PHI', 'LAD'])
  assert.equal(dsWithBye(viaPair, 'NL', 'LAD').id, null, "the schedule's Game 1 row still names the placeholder")
  assert.equal(byKey(viaPair, wcWith(viaPair, 'NL', 'PHI').feeds).key, dsWithBye(viaPair, 'NL', 'LAD').key)
})
