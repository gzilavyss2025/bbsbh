// THE AGE NOTE (issue #1078) — the arithmetic behind the minor levels'
// notebook note, and the committed files it is drawn from.
//
// Three of these pin decisions that a generator run's console output would show
// as plausible numbers even when they are wrong: a player who moved between two
// clubs in the same league, an age taken on the wrong day of the year, and an
// average of ages that quietly dropped the players it could not date.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ageOnJune30,
  averageAge,
  combineByPlayer,
  sortByAge,
} from '../scripts/lib/youngest-regulars.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function split(id, name, teamId, teamName, pa) {
  return { player: { id, fullName: name }, team: { id: teamId, name: teamName }, stat: { plateAppearances: pa } }
}

test('a player who moved clubs inside the league is one row, not two half-rows', () => {
  const combined = combineByPlayer([
    split(1, 'Moved Midseason', 10, 'First Club', 140),
    split(1, 'Moved Midseason', 20, 'Second Club', 180),
    split(2, 'Stayed Put', 10, 'First Club', 400),
  ])
  const moved = combined.find((p) => p.id === 1)
  // 320 clears the 250 floor; neither half of him does, and a per-split floor
  // would have dropped a regular from the note and from its average.
  assert.equal(moved.pa, 320)
  // He is shown under the club he took the most plate appearances for.
  assert.equal(moved.teamId, 20)
  assert.equal(moved.teamName, 'Second Club')
  assert.equal(combined.length, 2)
  assert.deepEqual(combineByPlayer(null), [])
})

test('a season age is taken on June 30, not today', () => {
  // Verified against statsapi's own integer `age` on a season stat line, which
  // matched this reading for every player checked — including two born in
  // August, whose age TODAY is already a year higher than their season age.
  assert.equal(ageOnJune30('2004-08-18', 2026), 21.9)
  assert.equal(ageOnJune30('2005-02-19', 2026), 21.4)
  assert.equal(ageOnJune30('1992-11-28', 2026), 33.6)
  // The same player, a season earlier, is a year younger. Nothing here reads
  // the clock.
  assert.equal(ageOnJune30('2005-02-19', 2025), 20.4)
  assert.equal(ageOnJune30('', 2026), null)
  assert.equal(ageOnJune30('2005-2-19', 2026), null)
  assert.equal(ageOnJune30('2005-02-19', null), null)
  // A birth date after the season would be a data error, never a negative age.
  assert.equal(ageOnJune30('2030-02-19', 2026), null)
})

test('the league average is taken over the players who HAVE an age', () => {
  const players = [{ age: 20 }, { age: 22 }, { age: 24 }, { age: null }, {}]
  assert.equal(averageAge(players), 22)
  assert.equal(averageAge([]), null)
  assert.equal(averageAge(null), null)
})

test('youngest first, and a tie goes to the man who played more of the season', () => {
  const players = [
    { name: 'Older', age: 22.4, pa: 500 },
    { name: 'Young B', age: 19.8, pa: 300 },
    { name: 'Young A', age: 19.8, pa: 420 },
  ]
  assert.deepEqual(
    sortByAge(players).map((p) => p.name),
    ['Young A', 'Young B', 'Older'],
  )
  assert.deepEqual(sortByAge(null), [])
})

// The committed files, checked for the two things the note asserts on screen:
// that every league's figures are its own, and that the note's population is
// large enough for the average to mean anything.
test('every committed level ships leagues whose figures stand on real populations', () => {
  const dir = join(ROOT, 'public', 'data', 'youngest-regulars')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  assert.ok(files.length > 0, 'no levels are committed')

  for (const file of files) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    assert.equal(doc.sportId, Number(file.replace('.json', '')))
    assert.equal(typeof doc.season, 'number')
    assert.equal(doc.regularPa, 250)
    assert.ok(doc.leagues.length > 0, `${file} ships no league`)

    const seenLeagues = new Set()
    for (const league of doc.leagues) {
      assert.ok(!seenLeagues.has(league.leagueId), `${file} repeats league ${league.leagueId}`)
      seenLeagues.add(league.leagueId)
      // research.md §7's floor for any claim about a player's standing in a
      // population. Below it the average is an average of almost nobody.
      assert.ok(league.regulars >= 20, `${file} ${league.name} has ${league.regulars} regulars`)
      assert.ok(league.regulars <= league.hitters, `${file} ${league.name} has more regulars than hitters`)
      assert.ok(league.averageAge > 15 && league.averageAge < 40, `${file} ${league.name} average ${league.averageAge}`)
      assert.ok(league.orgIds.length > 0, `${file} ${league.name} names no organisation`)
      assert.ok(league.players.length > 0, `${file} ${league.name} lists nobody`)

      let last = -Infinity
      for (const player of league.players) {
        assert.ok(player.age >= last, `${file} ${league.name} is not sorted youngest first`)
        last = player.age
        assert.ok(player.pa >= doc.regularPa, `${file} ${player.name} is under the floor at ${player.pa} PA`)
        for (const key of Object.keys(player)) {
          assert.ok(
            ['id', 'name', 'teamId', 'teamName', 'orgId', 'orgName', 'pa', 'age'].includes(key),
            `${file} player carries an unexpected field: ${key}`,
          )
        }
      }
      // The youngest man in a league is younger than his league. If he were
      // not, the average and the list would be drawn from different pools.
      assert.ok(
        league.players[0].age < league.averageAge,
        `${file} ${league.name}: the youngest regular is not below the average`,
      )
    }
  }
})
