import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LEAGUE_MINIMUM_USD,
  MIN_POOL,
  computePayRanks,
  largestSplit,
  positionGroup,
  positionGroups,
  rankingSalaryUsd,
} from '../scripts/lib/contract-pay-rank.mjs'

const MIN_2026 = LEAGUE_MINIMUM_USD[2026]

// ---------------------------------------------------------------------------
// largestSplit — a traded pitcher's combined row, not the sum of his club rows
// ---------------------------------------------------------------------------

test('largestSplit takes the combined row for a mid-season trade', () => {
  // The shape statsapi actually returns for a traded pitcher: a combined row
  // carrying numTeams, plus one row per club. Summing would say 34 games.
  const splits = [
    { numTeams: 2, stat: { gamesPlayed: 17, gamesStarted: 17 } },
    { team: { id: 1 }, stat: { gamesPlayed: 15, gamesStarted: 15 } },
    { team: { id: 2 }, stat: { gamesPlayed: 2, gamesStarted: 2 } },
  ]
  assert.deepEqual(largestSplit(splits), { games: 17, starts: 17 })
})

test('largestSplit handles the ordinary one-club shape and the empty one', () => {
  assert.deepEqual(largestSplit([{ stat: { gamesPlayed: 25, gamesStarted: 25 } }]), { games: 25, starts: 25 })
  assert.equal(largestSplit([]), null)
  assert.equal(largestSplit(undefined), null)
})

// ---------------------------------------------------------------------------
// positionGroup
// ---------------------------------------------------------------------------

test('a pitcher is split into SP or RP by his share of starts', () => {
  assert.equal(positionGroup({ position: 'P', season: { games: 25, starts: 25 } }), 'SP')
  assert.equal(positionGroup({ position: 'P', season: { games: 60, starts: 0 } }), 'RP')
  // Exactly at the 40% threshold counts as a starter (judgement call 1).
  assert.equal(positionGroup({ position: 'P', season: { games: 20, starts: 8 } }), 'SP')
  // A long reliever below it does not.
  assert.equal(positionGroup({ position: 'P', season: { games: 20, starts: 7 } }), 'RP')
})

test('a pitcher who has not appeared this season falls back to his career share', () => {
  const injuredStarter = { position: 'P', season: { games: 0, starts: 0 }, career: { games: 310, starts: 310 } }
  assert.equal(positionGroup(injuredStarter), 'SP')
})

test('a pitcher with no appearances at all is left unranked, not filed as a reliever', () => {
  // The failure this guards: a signed-but-never-pitched arm silently joining
  // the 532-strong reliever pool and being told he is the 400th best paid.
  assert.equal(positionGroup({ position: 'P', season: null, career: null }), null)
  assert.equal(positionGroup({ position: 'P', season: { games: 0, starts: 0 }, career: { games: 0, starts: 0 } }), null)
})

test('every outfield tag collapses into one OF pool', () => {
  for (const tag of ['LF', 'CF', 'RF', 'OF']) {
    assert.equal(positionGroup({ position: tag }), 'OF')
  }
})

test('other positions pass through, and an unknown position is unranked', () => {
  for (const tag of ['C', '1B', '2B', '3B', 'SS', 'DH']) {
    assert.equal(positionGroup({ position: tag }), tag)
  }
  assert.equal(positionGroup({ position: null }), null)
  assert.equal(positionGroup(undefined), null)
})

// ---------------------------------------------------------------------------
// rankingSalaryUsd
// ---------------------------------------------------------------------------

test('a prorated part-season figure is lifted to the league minimum', () => {
  // A September call-up's real feed value. Ranked as-is he is the worst paid
  // player in baseball, which is false — he is on a minimum-rate deal.
  assert.equal(rankingSalaryUsd(14625, MIN_2026), MIN_2026)
  assert.equal(rankingSalaryUsd(63600, MIN_2026), MIN_2026)
})

test('a salary at or above the minimum is ranked as itself', () => {
  assert.equal(rankingSalaryUsd(MIN_2026, MIN_2026), MIN_2026)
  assert.equal(rankingSalaryUsd(24571429, MIN_2026), 24571429)
})

test('a missing salary or missing minimum yields no ranking salary', () => {
  assert.equal(rankingSalaryUsd(null, MIN_2026), null)
  assert.equal(rankingSalaryUsd(undefined, MIN_2026), null)
  assert.equal(rankingSalaryUsd(1000000, undefined), null)
})

// ---------------------------------------------------------------------------
// computePayRanks
// ---------------------------------------------------------------------------

// A pool of MIN_POOL starters on descending salaries, ids '1'..'10'.
function starterPool(salaries) {
  const records = {}
  const meta = new Map()
  salaries.forEach((salaryUsd, i) => {
    const id = String(i + 1)
    records[id] = { salaryUsd }
    meta.set(id, { position: 'P', season: { games: 30, starts: 30 } })
  })
  return { records, meta }
}

test('ranks a pool highest paid first', () => {
  const { records, meta } = starterPool([9e6, 8e6, 7e6, 6e6, 5e6, 4e6, 3e6, 2e6, 1e6, 9e5])
  const ranks = computePayRanks(records, meta, 2026)
  assert.equal(ranks.size, 10)
  assert.equal(ranks.get('1').rank, 1)
  assert.equal(ranks.get('1').of, 10)
  assert.equal(ranks.get('1').pos, 'SP')
  assert.equal(ranks.get('10').rank, 10)
})

test('a tie band shares the first rank and the band width is skipped after it', () => {
  // Standard competition ranking: 1, 2, 2, 2, 5 — not 1, 2, 2, 2, 3.
  const { records, meta } = starterPool([9e6, 8e6, 8e6, 8e6, 5e6, 4e6, 3e6, 2e6, 1e6, 9e5])
  const ranks = computePayRanks(records, meta, 2026)
  assert.equal(ranks.get('1').rank, 1)
  assert.equal(ranks.get('2').rank, 2)
  assert.equal(ranks.get('3').rank, 2)
  assert.equal(ranks.get('4').rank, 2)
  assert.equal(ranks.get('5').rank, 5)
  assert.equal(ranks.get('2').tied, true)
  assert.equal(ranks.get('1').tied, false)
})

test('everyone on a prorated or minimum salary lands in one tied band flagged onMinimum', () => {
  const { records, meta } = starterPool([9e6, 8e6, 7e6, 6e6, 5e6, MIN_2026, 500000, 63600, 14625, 700000])
  const ranks = computePayRanks(records, meta, 2026)
  const band = ['6', '7', '8', '9', '10']
  for (const id of band) {
    assert.equal(ranks.get(id).onMinimum, true, `${id} should be in the minimum band`)
    assert.equal(ranks.get(id).rank, 6, `${id} should share the band's first rank`)
  }
  assert.equal(ranks.get('5').onMinimum, false)
})

test('fractionBelow runs 1 at the top of the pool to 0 at the bottom', () => {
  const { records, meta } = starterPool([9e6, 8e6, 7e6, 6e6, 5e6, 4e6, 3e6, 2e6, 1e6, 9e5])
  const ranks = computePayRanks(records, meta, 2026)
  assert.equal(ranks.get('1').fractionBelow, 1)
  assert.equal(ranks.get('10').fractionBelow, 0)
})

test('a pool below MIN_POOL is not ranked at all', () => {
  const records = {}
  const meta = new Map()
  for (let i = 0; i < MIN_POOL - 1; i++) {
    records[String(i)] = { salaryUsd: 5e6 + i }
    meta.set(String(i), { position: 'C' })
  }
  assert.equal(computePayRanks(records, meta, 2026).size, 0)
})

test('pools are independent — a catcher is not ranked against starters', () => {
  const { records, meta } = starterPool(Array.from({ length: 10 }, (_, i) => 9e6 - i * 1e5))
  for (let i = 0; i < MIN_POOL; i++) {
    const id = `c${i}`
    records[id] = { salaryUsd: 1e6 - i }
    meta.set(id, { position: 'C' })
  }
  const ranks = computePayRanks(records, meta, 2026)
  assert.equal(ranks.get('c0').pos, 'C')
  assert.equal(ranks.get('c0').rank, 1)
  assert.equal(ranks.get('c0').of, 10)
  assert.equal(ranks.get('1').of, 10)
})

test('a season with no known league minimum ranks nobody', () => {
  // Judgement call 5: the minimum is a CBA figure the feed does not carry, so
  // an unseeded season must degrade to no rank rather than guess one.
  const { records, meta } = starterPool([9e6, 8e6, 7e6, 6e6, 5e6, 4e6, 3e6, 2e6, 1e6, 9e5])
  assert.equal(computePayRanks(records, meta, 2099).size, 0)
})

test('a player with no salary is skipped without breaking the pool', () => {
  const { records, meta } = starterPool([9e6, 8e6, 7e6, 6e6, 5e6, 4e6, 3e6, 2e6, 1e6, 9e5])
  records['11'] = { salaryUsd: null }
  meta.set('11', { position: 'P', season: { games: 30, starts: 30 } })
  const ranks = computePayRanks(records, meta, 2026)
  assert.equal(ranks.has('11'), false)
  assert.equal(ranks.get('1').of, 10)
})

test('a swingman is ranked against starters, not relievers', () => {
  // Erick Fedde's real 2026 line: 12 starts in 27 appearances, against 155
  // career starts in 192 games. At a half-the-appearances threshold he landed
  // in the 478-strong reliever pool, which prices his deal against the wrong
  // market entirely.
  assert.equal(positionGroup({ position: 'P', season: { games: 27, starts: 12 } }), 'SP')
  // A reliever who made a couple of spot starts still belongs in the pen.
  assert.equal(positionGroup({ position: 'P', season: { games: 60, starts: 2 } }), 'RP')
})

test('a two-way player belongs to both a hitting and a pitching pool', () => {
  // 'TWP' is a pool of one, and it holds the most discussed contract in the
  // sport — leaving it unranked is the most visible hole the table could have.
  // Ranking him against only one side is a choice with no right answer, so he
  // is ranked in both, hitting first (judgement call 6).
  assert.deepEqual(positionGroups({ position: 'TWP', season: { games: 14, starts: 14 } }), ['DH', 'SP'])
  assert.deepEqual(positionGroups({ position: 'TWP', season: { games: 40, starts: 0 } }), ['DH', 'RP'])
  // No pitching line at all leaves him a hitter only, rather than guessing.
  assert.deepEqual(positionGroups({ position: 'TWP', season: null, career: null }), ['DH'])
  // The primary pool is the hitting one.
  assert.equal(positionGroup({ position: 'TWP', season: { games: 14, starts: 14 } }), 'DH')
})

test('an ordinary player belongs to exactly one pool', () => {
  assert.deepEqual(positionGroups({ position: 'CF' }), ['OF'])
  assert.deepEqual(positionGroups({ position: 'P', season: { games: 30, starts: 30 } }), ['SP'])
  assert.deepEqual(positionGroups({ position: null }), [])
})

test('a two-way player carries both ranks, hitting primary and pitching in `also`', () => {
  const records = {}
  const meta = new Map()
  for (let i = 0; i < MIN_POOL; i++) {
    records[`dh${i}`] = { salaryUsd: 30e6 - i * 1e6 }
    meta.set(`dh${i}`, { position: 'DH' })
    records[`sp${i}`] = { salaryUsd: 40e6 - i * 1e6 }
    meta.set(`sp${i}`, { position: 'P', season: { games: 30, starts: 30 } })
  }
  records.ohtani = { salaryUsd: 28e6 }
  meta.set('ohtani', { position: 'TWP', season: { games: 14, starts: 14 } })

  const ranks = computePayRanks(records, meta, 2026)
  const twoWay = ranks.get('ohtani')
  assert.equal(twoWay.pos, 'DH')
  assert.equal(twoWay.also.length, 1)
  assert.equal(twoWay.also[0].pos, 'SP')
  // He is a real member of both pools, so both denominators include him.
  assert.equal(twoWay.of, MIN_POOL + 1)
  assert.equal(twoWay.also[0].of, MIN_POOL + 1)
  // And he displaces the players he outearns in each.
  assert.equal(ranks.get('dh0').of, MIN_POOL + 1)
  assert.equal(ranks.get('sp0').rank, 1)
  // Everyone else carries no `also` at all, so the shards stay small.
  assert.equal(ranks.get('dh0').also, undefined)
})
