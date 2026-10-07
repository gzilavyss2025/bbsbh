import assert from 'node:assert/strict'
import test from 'node:test'
import { groupNotesBySubject } from '../src/components/inning/marginNoteGroups.js'
import { buildMatchupNotes } from '../src/api/matchup/notes.js'

// The live "?" headshot (issue #1446's trace): a Margin Notes card for a
// matchup note — Tatis against May — drew <Headshot> with no personId, no name
// and no team, which can only ever land on the "?" monogram. Matchup, arsenal
// and team-level notes name no one subject, so their card must draw no avatar
// at all (BetweenInnings already does the same).

const LEAGUE = {
  bat: { hardHit: { m: 37.2, sd: 9.6 } },
  pit: { hardHit: { m: 38.2, sd: 5.1 } },
}
const matchup = buildMatchupNotes({
  data: {
    season: 2026,
    league: LEAGUE,
    bat: { 1: { hardHit: 54, pa: 500 } },
    pit: { 2: { hardHit: 46, pa: 500 } },
  },
  batter: { id: 1, first: 'Fernando', last: 'Tatis' },
  pitcher: { id: 2, first: 'Dustin', last: 'May' },
})

test('the fixture really is a matchup note with no subject', () => {
  assert.equal(matchup.length, 1)
  assert.equal(matchup[0].personId, undefined)
})

test('a subject-less note gets a card with no avatar', () => {
  const [g] = groupNotesBySubject(matchup)
  assert.equal(g.hasSubject, false)
})

test('a pitcher note keeps its avatar, and his notes fold into one card', () => {
  const groups = groupNotesBySubject([
    { personId: 9, side: 'home', text: 'a', dedupeKey: 'a-9' },
    ...matchup,
    { personId: 9, side: 'home', text: 'b', dedupeKey: 'b-9' },
  ])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].hasSubject, true)
  assert.equal(groups[0].notes.length, 2)
  assert.equal(groups[1].hasSubject, false)
})
