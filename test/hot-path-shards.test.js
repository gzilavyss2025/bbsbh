import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { matchupKey } from '../src/api/formerTeammates.js'
import { warShardKey } from '../src/api/war.js'

// Datasets a hot surface reads, each split from one league-wide file into the
// record its reader actually wants. What these tests hold is the JOIN: a shard
// is only useful if the reader can compute its name from what it already knows
// (a matchup's two team ids, a club id, a personId, the gamePk on screen).

const dir = (name) => new URL(`../public/data/${name}/`, import.meta.url)
const list = (name) => readdirSync(dir(name)).filter((f) => f.endsWith('.json'))
const read = (name, f) => JSON.parse(readFileSync(new URL(f, dir(name)), 'utf8'))

test('a former-teammates shard is named by the key its reader builds', () => {
  const files = list('former-teammates')
  assert.ok(files.length > 20, `only ${files.length} matchups on file`)
  for (const f of files) {
    const { matchup } = read('former-teammates', f)
    const { teamA, teamB } = matchup
    // The reader computes this name from the two clubs in the game, in either
    // order. If the generator filed it under anything else, the card silently
    // never appears.
    assert.equal(`${matchupKey(teamA, teamB)}.json`, f, `${f}: filed under the wrong key`)
    assert.equal(matchupKey(teamB, teamA), matchupKey(teamA, teamB), 'key must be order-free')
  }
})

test('a game-notes shard is one club, named for its team id', () => {
  const files = list('game-notes')
  assert.ok(files.length >= 30, `only ${files.length} clubs on file`)
  for (const f of files) {
    const shard = read('game-notes', f)
    assert.equal(String(shard.teamId), f.replace('.json', ''), `${f}: id does not match its name`)
    assert.ok(Array.isArray(shard.notes) && shard.notes.length, `${f}: no notes`)
  }
})

test('every war-history player sits in the bucket his reader will ask for', () => {
  const files = list('war-history')
  assert.equal(files.length, 100, 'expected 100 buckets')
  for (const f of files) {
    const shard = read('war-history', f)
    const bucket = f.replace('.json', '')
    for (const group of ['bat', 'pit']) {
      for (const [id, byYear] of Object.entries(shard[group] ?? {})) {
        assert.equal(warShardKey(id), bucket, `${f}: player ${id} is in the wrong bucket`)
        // Player-keyed, then season — the pivot is the whole point. A
        // season-keyed leftover would read as a career of one number.
        for (const season of Object.keys(byYear)) {
          assert.match(season, /^(19|20)\d{2}$/, `${f}: ${id} has a non-season key ${season}`)
        }
      }
    }
  }
})

test('a callouts shard is one game, filed under its slate date', () => {
  const root = dir('callouts')
  const dates = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  assert.ok(dates.length, 'no callouts dates on file')
  for (const d of dates) {
    assert.match(d, /^\d{8}$/, `${d}: not an MMDDYYYY date directory`)
    const sub = new URL(`${d}/`, root)
    const files = readdirSync(sub).filter((f) => f.endsWith('.json'))
    assert.ok(files.length, `${d}: no games`)
    for (const f of files) {
      const bundle = JSON.parse(readFileSync(new URL(f, sub), 'utf8'))
      // The reader names the file from the gamePk it is already looking at
      // (api/callouts.js). A bundle filed under any other name is a note that
      // can never be found — or worse, found on the wrong game.
      assert.equal(String(bundle.gamePk), f.replace('.json', ''), `${d}/${f}: wrong gamePk`)
      const [mm, dd, yyyy] = [d.slice(0, 2), d.slice(2, 4), d.slice(4)]
      assert.equal(bundle.date, `${yyyy}-${mm}-${dd}`, `${d}/${f}: filed under the wrong date`)
      assert.ok(bundle.away?.teamId && bundle.home?.teamId, `${d}/${f}: no clubs`)
    }
  }
})

test('a team-transactions shard is one club in one season, and every club has one', () => {
  const root = dir('team-transactions')
  const seasons = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  assert.ok(seasons.length, 'no team-transactions seasons on file')
  for (const s of seasons) {
    const sub = new URL(`${s}/`, root)
    const files = readdirSync(sub).filter((f) => f.endsWith('.json'))
    const index = JSON.parse(readFileSync(new URL('index.json', sub), 'utf8'))
    // Every org gets a file, even one with nothing to report — that is what
    // lets the reader treat a 404 as "no such season" and stop paging, rather
    // than as "quiet club" and stop a season early.
    assert.equal(files.length, index.teamIds.length + 1, `${s}: a club is missing a file`)
    for (const teamId of index.teamIds) {
      const shard = JSON.parse(readFileSync(new URL(`${teamId}.json`, sub), 'utf8'))
      assert.equal(shard.teamId, teamId, `${s}/${teamId}.json: id does not match its name`)
      assert.equal(String(shard.season), s, `${s}/${teamId}.json: wrong season`)
      assert.ok(Array.isArray(shard.days), `${s}/${teamId}.json: no days array`)
    }
  }
})

test('no shard set is large enough to be worth loading whole', () => {
  // Each of these replaced a file its reader pulled in full on a hot path:
  // former-teammates 546 KB per game view, game-notes 541 KB per lineup page,
  // war-history 416 KB per player page, callouts 780 KB per lineup page,
  // team-transactions 1.7 MB per team page.
  for (const [name, ceiling] of [
    ['former-teammates', 40],
    ['game-notes', 60],
    ['war-history', 40],
  ]) {
    const largest = Math.max(...list(name).map((f) => statSync(new URL(f, dir(name))).size))
    assert.ok(largest < ceiling * 1024, `${name}: largest shard is ${Math.round(largest / 1024)} KB`)
  }
  for (const [name, ceiling] of [
    ['callouts', 40],
    ['team-transactions', 200],
  ]) {
    const root = dir(name)
    let largest = 0
    for (const d of readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const sub = new URL(`${d.name}/`, root)
      for (const f of readdirSync(sub).filter((n) => n.endsWith('.json'))) {
        largest = Math.max(largest, statSync(new URL(f, sub)).size)
      }
    }
    assert.ok(largest < ceiling * 1024, `${name}: largest shard is ${Math.round(largest / 1024)} KB`)
  }
})
