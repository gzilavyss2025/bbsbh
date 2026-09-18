// THE PICKED-GAME CARD'S POOL (issue #1077) — the two halves of it that can be
// wrong without anyone noticing: which games the generator offers, and what the
// card is allowed to say about one.
//
// The last test in this file is the one that matters most. It reads the pools
// that are actually committed and asserts that no score, no run total, no
// winner and no inning count is in them — because this is the first static
// dataset in the repo built OUT of finished games, and the spoiler rule here is
// a property of the FILE rather than of a SealBox. A generator that started
// storing `linescore` would break nothing, render nothing and spoil everything.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { movedUpIds, poolSeasonFor, reasonFacts, selectPool } from '../scripts/lib/milb-pool.mjs'
import { pickGame, poolGamePath, reasonLine, seedFrom } from '../src/api/milbPool.js'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Two clubs, a date, a park. The shape the generator writes, minus the reason
// facts each test supplies for itself.
function game(pk, away, home, extra = {}) {
  return {
    pk,
    date: '2026-07-05',
    venue: 'Nymeo Field',
    away: { id: away, name: `Club ${away}`, abbr: `A${away}`, org: 121, orgName: 'New York Mets' },
    home: { id: home, name: `Club ${home}`, abbr: `H${home}`, org: 110, orgName: 'Baltimore Orioles' },
    why: { ranked: 0, reached: 0, up: 0 },
    ...extra,
  }
}

// A schedule row, as the generator's selection sees it.
function row(pk, away, home, date = '2026-05-01') {
  return { gamePk: pk, officialDate: date, teams: { away: { team: { id: away } }, home: { team: { id: home } } } }
}

test('the pool is drawn from the season that is OVER, never the one being played', () => {
  // September: the level's own winter has opened, and the season it ended is
  // the one to deal from.
  assert.equal(poolSeasonFor({ seasonEnded: 2026 }, 2026), 2026)
  // January: still that winter. levelOffseasonPhase already names 2026 here,
  // and the pool must not roll over to a season nobody has played — the empty
  // board #1122 fixed in gen-minors-leaders.mjs is the same trap one file over.
  assert.equal(poolSeasonFor({ seasonEnded: 2026 }, 2027), 2026)
  // Mid-season: no phase at all. The finished season is last year's.
  assert.equal(poolSeasonFor(null, 2026), 2025)
})

test('a club cannot take more than its share of the pool', () => {
  // One club (7) in every game. Without the cap it would be in all twenty.
  const rows = []
  for (let i = 0; i < 20; i++) rows.push(row(800 + i, 7, 100 + i))
  const picked = selectPool(rows, { sportId: 13, season: 2026, cap: 4, max: 50 })
  assert.equal(picked.length, 4)
})

test('the same season deals the same pool twice, and a different level a different one', () => {
  const rows = []
  for (let i = 0; i < 40; i++) rows.push(row(900 + i, 200 + i, 300 + i))
  const a = selectPool(rows, { sportId: 13, season: 2026, cap: 12, max: 10 })
  const b = selectPool(rows, { sportId: 13, season: 2026, cap: 12, max: 10 })
  const other = selectPool(rows, { sportId: 12, season: 2026, cap: 12, max: 10 })
  assert.deepEqual(a.map((g) => g.gamePk), b.map((g) => g.gamePk))
  assert.notDeepEqual(a.map((g) => g.gamePk), other.map((g) => g.gamePk))
})

test('a row with no date or no club id is not offered', () => {
  const rows = [
    row(1, 10, 20),
    { gamePk: 2, teams: { away: { team: { id: 10 } }, home: { team: { id: 30 } } } },
    { gamePk: 3, officialDate: '2026-05-01', teams: { away: {}, home: { team: { id: 30 } } } },
  ]
  const picked = selectPool(rows, { sportId: 13, season: 2026, cap: 12, max: 10 })
  assert.deepEqual(picked.map((g) => g.gamePk), [1])
})

test('moved up means the season ENDED higher, not that it touched two levels', () => {
  const board = {
    avg: [
      { id: 1, fromLevel: 13, toLevel: 11 }, // A+ to AAA — up
      { id: 2, fromLevel: 11, toLevel: 13 }, // AAA to A+ — down
      { id: 3, fromLevel: 12, toLevel: 12 }, // stayed
      { id: 4, fromLevel: 14 }, // a board that cannot say
    ],
    ops: [{ id: 1, fromLevel: 13, toLevel: 11 }], // the same player, another category
  }
  assert.deepEqual([...movedUpIds(board)], [1])
  assert.deepEqual([...movedUpIds(null)], [])
})

test('the reason facts count careers, and the top name is the best rank in the game', () => {
  const prospects = {
    players: [
      { playerId: 10, name: 'Second Best', rank: 40 },
      { playerId: 11, name: 'Best In Baseball', rank: 3 },
      { playerId: 99, name: 'Not In This Game', rank: 1 },
    ],
    orgProspects: [{ playerId: 12 }, { playerId: 10 }, { playerId: 98 }],
  }
  const facts = reasonFacts([10, 11, 12, 13], {
    prospects,
    movers: new Set([13, 97]),
    alumni: new Set([13]),
    staleMovers: false,
  })
  assert.deepEqual(facts, {
    top: { id: 11, name: 'Best In Baseball', rank: 3 },
    // 10 and 11 off the national board, 12 off an org board. Counted once each.
    ranked: 3,
    reached: 1,
    up: 1,
  })
})

test('a promotions board from another season is not counted into an older game', () => {
  const facts = reasonFacts([13], {
    prospects: {},
    movers: new Set([13]),
    alumni: new Set(),
    staleMovers: true,
  })
  assert.equal(facts.up, 0)
})

test('the reason line names a player before it counts one, and says nothing when it has nothing', () => {
  assert.equal(
    reasonLine({ top: { name: 'Jesús Made', rank: 1 }, ranked: 6, reached: 2, up: 4 }),
    'Jesús Made played in this game, No. 1 on the national prospect board.',
  )
  assert.equal(reasonLine({ ranked: 6, reached: 2, up: 4 }), '2 players in this game reached the majors.')
  assert.equal(reasonLine({ ranked: 6, reached: 0, up: 4 }), '6 ranked prospects played in this game.')
  assert.equal(
    reasonLine({ ranked: 0, reached: 0, up: 4 }),
    '4 players in this game finished the season at a higher level.',
  )
  assert.equal(reasonLine({ ranked: 1, reached: 0, up: 0 }), 'One ranked prospect played in this game.')
  // An older season's pool watches its prospects graduate off the board. No
  // line at all is the honest answer, and the card drops it rather than
  // inventing one.
  assert.equal(reasonLine({ ranked: 0, reached: 0, up: 0 }), null)
  assert.equal(reasonLine(null), null)
})

test('one day deals one game, and "another game" walks the same deck', () => {
  const games = [game(1, 10, 20), game(2, 30, 40), game(3, 50, 60), game(4, 70, 80)]
  const seed = seedFrom('2026-10-12|13')
  const first = pickGame(games, { seed, step: 0 })
  // Same day, same level, same answer — a re-render (or StrictMode's second
  // mount) must not deal a new game under the reader.
  assert.equal(pickGame(games, { seed, step: 0 }).game.pk, first.game.pk)
  const second = pickGame(games, { seed, step: 1 })
  assert.notEqual(second.game.pk, first.game.pk)
  // Tomorrow is a different deck.
  assert.notEqual(pickGame(games, { seed: seedFrom('2026-10-13|13'), step: 0 }).game, undefined)
  // Walking past the end comes back round rather than running out.
  assert.equal(pickGame(games, { seed, step: 4 }).game.pk, first.game.pk)
})

test('a game this device has already opened is not offered as a sealed one', () => {
  const games = [game(1, 10, 20), game(2, 30, 40), game(3, 50, 60)]
  const seed = seedFrom('2026-10-12|13')
  const started = new Set([1, 3])
  for (let step = 0; step < 6; step++) {
    const picked = pickGame(games, { seed, step, isStarted: (pk) => started.has(pk) })
    assert.equal(picked.game.pk, 2)
    assert.equal(picked.started, false)
  }
  // A reader who has opened every game in the pool still gets an offer — it
  // just stops claiming to be a fresh seal.
  const all = pickGame(games, { seed, step: 0, isStarted: () => true })
  assert.equal(all.started, true)
  assert.ok(all.game.pk)
})

test('an empty or malformed pool offers nothing rather than a broken card', () => {
  assert.equal(pickGame([], {}), null)
  assert.equal(pickGame(undefined, {}), null)
  assert.equal(pickGame([{ pk: 1 }], {}), null)
  assert.equal(pickGame([{ pk: 1, date: '2026-07-05', away: {}, home: {} }], {}), null)
})

test('the card links to the game at the address the slate would build', () => {
  assert.equal(poolGamePath(game(1, 10, 20)), '/07052026/a10h20/lineup1')
  // The second game of a doubleheader keeps its own address.
  assert.equal(poolGamePath(game(1, 10, 20, { g: 2 })), '/07052026/a10h20-2/lineup1')
})

// THE SPOILER INVARIANT, on the files that actually ship.
//
// Every other guard in this repo checks a MODULE's classification or a
// component's shape. This one checks the bytes: the pool is the first static
// dataset built by walking finished games, and the only thing standing between
// it and a spoiler is which fields the generator chose to copy. So the test
// reads what is committed and refuses anything that could carry a result —
// including an inning count, which is a spoiler in its own right (ADR-0008:
// extra innings are never shown up front).
test('no committed pool carries anything that could say how a game went', () => {
  const dir = join(ROOT, 'public', 'data', 'milb-pool')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  assert.ok(files.length > 0, 'no pools are committed')

  const BANNED = /^(runs|score|scores|winner|loser|isTie|innings|scheduledInnings|currentInning|linescore|decisions|result|status)$/i
  const CLUB_KEYS = ['id', 'name', 'abbr', 'org', 'orgName']

  for (const file of files) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    assert.equal(doc.sportId, Number(file.replace('.json', '')))
    assert.equal(typeof doc.season, 'number')
    assert.ok(doc.games.length > 0, `${file} has no games`)
    assert.equal(new Set(doc.games.map((g) => g.pk)).size, doc.games.length, `${file} repeats a game`)

    for (const entry of doc.games) {
      // The allowed vocabulary, stated positively: anything a future edit adds
      // has to be added here too, which is the point.
      for (const key of Object.keys(entry)) {
        assert.ok(
          ['pk', 'date', 'g', 'venue', 'away', 'home', 'why'].includes(key),
          `${file} game ${entry.pk} carries an unexpected field: ${key}`,
        )
      }
      for (const side of ['away', 'home']) {
        for (const key of Object.keys(entry[side])) {
          assert.ok(CLUB_KEYS.includes(key), `${file} ${side} carries ${key}`)
        }
      }
      for (const key of Object.keys(entry.why)) {
        assert.ok(['top', 'ranked', 'reached', 'up'].includes(key), `${file} why carries ${key}`)
      }
    }

    // And the same question asked of every key at every depth, in case the
    // shape above is the thing that changes.
    const walk = (node, path) => {
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`))
      if (!node || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node)) {
        assert.ok(!BANNED.test(key), `${file} carries a result-bearing key at ${path}.${key}`)
        walk(value, `${path}.${key}`)
      }
    }
    walk(doc, file)
  }
})
