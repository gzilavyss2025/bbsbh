// THE FORMER TEAMMATES CARD'S OLD-CLUB SPLIT. A tie whose only shared club is
// one of tonight's two clubs just says "he used to play here" — it moves out of
// the card grid into a one-line-per-player list, so the grid keeps only the
// ties made on a third club.
import assert from 'node:assert/strict'
import test from 'node:test'
import { splitOldClubTies } from '../src/api/formerTeammates.js'

const AWAY = 111
const HOME = 147
const club = (teamId, teamName, seasons, level = 'MLB') => ({ teamId, teamName, level, seasons })
const player = (id, name, pos = 'P') => ({ id, name, pos })
const pair = (a, b, clubs, score = 50) => ({ a, b, clubs, score })

const sanchez = player(1, 'Ali Sánchez', 'C')
const whitlock = player(2, 'Garrett Whitlock')
const rafaela = player(3, 'Ceddanne Rafaela', 'CF')
const ikf = player(4, 'Isiah Kiner-Falefa', '2B')
const cole = player(5, 'Gerrit Cole')
const story = player(6, 'Trevor Story', 'SS')
const mcmahon = player(7, 'Ryan McMahon', '3B')

test('a tie made on a third club stays a card', () => {
  const rockies = pair(story, mcmahon, [club(115, 'Colorado Rockies', [2017, 2021])], 107)
  const { pairs, oldClub } = splitOldClubTies([rockies], AWAY, HOME)
  assert.deepEqual(pairs, [rockies])
  assert.deepEqual(oldClub, [])
})

test('a tie made only on tonight’s club becomes one line for the player who left it', () => {
  // `a` is the away player, `b` the home player. Sánchez (home) played for the
  // away club; Kiner-Falefa (away) played for the home club.
  const ties = [
    pair(whitlock, sanchez, [club(AWAY, 'Boston Red Sox', [2025])], 40),
    pair(rafaela, sanchez, [club(AWAY, 'Boston Red Sox', [2025])], 45),
    pair(ikf, cole, [club(HOME, 'New York Yankees', [2022, 2023])], 30),
  ]
  const { pairs, oldClub } = splitOldClubTies(ties, AWAY, HOME)
  assert.deepEqual(pairs, [])
  assert.equal(oldClub.length, 2, 'one line per player, however many mates')
  const [first, second] = oldClub
  assert.equal(first.player.id, sanchez.id, 'ranked by best score')
  assert.equal(first.rosterTeamId, HOME)
  assert.equal(first.club.teamId, AWAY)
  assert.deepEqual(first.seasons, [2025])
  assert.equal(first.mates, 2)
  assert.equal(second.player.id, ikf.id)
  assert.equal(second.rosterTeamId, AWAY)
  assert.equal(second.club.teamId, HOME)
  assert.deepEqual(second.seasons, [2022, 2023])
})

test('a tie with both kinds of club keeps the card and drops the old-club half', () => {
  const both = pair(
    story,
    mcmahon,
    [club(115, 'Colorado Rockies', [2017]), club(HOME, 'New York Yankees', [2024])],
    80,
  )
  const { pairs, oldClub } = splitOldClubTies([both], AWAY, HOME)
  assert.equal(pairs.length, 1)
  assert.deepEqual(
    pairs[0].clubs.map((c) => c.teamId),
    [115],
  )
  assert.deepEqual(oldClub, [])
})

test('the old-club seasons are the union across every mate', () => {
  const ties = [
    pair(ikf, cole, [club(HOME, 'New York Yankees', [2022])]),
    pair(ikf, player(8, 'Anthony Volpe', 'SS'), [club(HOME, 'New York Yankees', [2023])]),
  ]
  const { oldClub } = splitOldClubTies(ties, AWAY, HOME)
  assert.equal(oldClub.length, 1)
  assert.deepEqual(oldClub[0].seasons, [2022, 2023])
})

test('nothing in, nothing out', () => {
  assert.deepEqual(splitOldClubTies([], AWAY, HOME), { pairs: [], oldClub: [] })
  assert.deepEqual(splitOldClubTies(undefined, AWAY, HOME), { pairs: [], oldClub: [] })
})
