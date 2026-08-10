import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { groupMilestoneRows } from '../src/api/milestones.js'
import { dedupeRosterEntries } from '../scripts/lib/roster.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const watch = JSON.parse(readFileSync(join(ROOT, 'public/data/milestones.json'), 'utf8'))

const row = (playerId, teamId, stat, threshold) => ({
  playerId,
  playerName: 'Player',
  teamId,
  teamName: 'Club',
  position: 'P',
  stat,
  threshold,
  value: 1145,
  remaining: threshold - 1145,
})

// --- the generator's half -----------------------------------------------------
// A traded player really is listed on both clubs' fullRoster, both rows
// reading Active (2026-08-09: Jameson Taillon, Cubs and Blue Jays at once).
// currentTeam is the only field that says which listing is the live one.
test('a player on two clubs’ rosters is kept once, under his current club', () => {
  const entries = [
    { teamId: 112, person: { id: 592791, currentTeam: { id: 141 } } },
    { teamId: 141, person: { id: 592791, currentTeam: { id: 141 } } },
  ]
  const kept = dedupeRosterEntries(entries)
  assert.equal(kept.length, 1)
  assert.equal(kept[0].teamId, 141)
})

test('the current club wins whichever roster came back first', () => {
  const entries = [
    { teamId: 141, person: { id: 592791, currentTeam: { id: 141 } } },
    { teamId: 112, person: { id: 592791, currentTeam: { id: 141 } } },
  ]
  assert.equal(dedupeRosterEntries(entries)[0].teamId, 141)
})

// Losing the chase entirely would be a worse failure than showing a stale
// club badge, so an unresolvable pair keeps one row rather than none.
test('a player whose current club matches neither listing is still kept once', () => {
  const entries = [
    { teamId: 112, person: { id: 592791 } },
    { teamId: 141, person: { id: 592791 } },
  ]
  const kept = dedupeRosterEntries(entries)
  assert.equal(kept.length, 1)
  assert.equal(kept[0].teamId, 112)
})

test('dedupeRosterEntries leaves ordinary rosters untouched and drops id-less rows', () => {
  const entries = [
    { teamId: 158, person: { id: 1 } },
    { teamId: 158, person: { id: 2 } },
    { teamId: 112, person: {} },
  ]
  assert.deepEqual(
    dedupeRosterEntries(entries).map((e) => e.person.id),
    [1, 2],
  )
})

// --- the render's half --------------------------------------------------------
test('groupMilestoneRows folds a player’s chases into one card', () => {
  const groups = groupMilestoneRows([
    row(1, 158, 'hits', 3000),
    row(2, 112, 'wins', 100),
    row(1, 158, 'doubles', 500),
  ])
  assert.deepEqual(groups.map((g) => g.playerId), [1, 2])
  assert.deepEqual(groups[0].milestones.map((m) => m.stat), ['hits', 'doubles'])
})

// The duplicate this page actually hit: same stat, same threshold, two clubs.
// Rendered under a duplicate React key, which is unsupported reconciliation —
// and drawn as two identical lines in one card.
test('groupMilestoneRows draws a chase listed under two clubs only once', () => {
  const groups = groupMilestoneRows([
    row(592791, 112, 'strikeOuts', 1500),
    row(592791, 141, 'strikeOuts', 1500),
    row(592791, 112, 'wins', 100),
    row(592791, 141, 'wins', 100),
  ])
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].milestones.map((m) => `${m.stat}-${m.threshold}`), [
    'strikeOuts-1500',
    'wins-100',
  ])
})

test('groupMilestoneRows leaves no bookkeeping on the groups it returns', () => {
  const [group] = groupMilestoneRows([row(1, 158, 'hits', 3000)])
  assert.deepEqual(Object.keys(group).sort(), [
    'milestones',
    'playerId',
    'playerName',
    'position',
    'teamId',
    'teamName',
  ])
})

test('groupMilestoneRows survives an absent list', () => {
  assert.deepEqual(groupMilestoneRows(undefined), [])
  assert.deepEqual(groupMilestoneRows([]), [])
})

// --- the committed file -------------------------------------------------------
// The page renders one card per player and one line per (stat, threshold), so
// a repeated pair in the data is a doubled line however carefully the render
// behaves. Assert on what ships, not only on the pure functions.
test('the committed milestone file lists each chase once', () => {
  const counts = new Map()
  for (const r of watch.players ?? []) {
    const key = `${r.playerId}|${r.stat}|${r.threshold}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const repeated = [...counts].filter(([, n]) => n > 1).map(([k]) => k)
  assert.deepEqual(repeated, [], `chases listed more than once: ${repeated.join(', ')}`)
})

test('the committed milestone file files each player under one club', () => {
  const clubs = new Map()
  for (const r of watch.players ?? []) {
    if (!clubs.has(r.playerId)) clubs.set(r.playerId, new Set())
    clubs.get(r.playerId).add(r.teamId)
  }
  const split = [...clubs].filter(([, s]) => s.size > 1).map(([id]) => id)
  assert.deepEqual(split, [], `players filed under more than one club: ${split.join(', ')}`)
})
