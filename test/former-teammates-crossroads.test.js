// THE FORMER TEAMMATES CARD'S ROWS (teammateCrossroads). One row per shared
// club: the club in the middle, each of tonight's clubs' players on its own
// side. A tie made only on one of tonight's two clubs ("he used to play here")
// is a 'former' row holding just the player who LEFT, with a count of the
// players he played with there — not a wall of their faces.
import assert from 'node:assert/strict'
import test from 'node:test'
import { formerTeammatePairs, teammateCrossroads } from '../src/api/formerTeammates.js'

const AWAY = 111
const HOME = 147
const club = (teamId, teamName, seasons, level = 'MLB') => ({ teamId, teamName, level, seasons })
const player = (id, name, teamId, pos = 'P') => ({ id, name, pos, teamId })
const pair = (a, b, clubs, score = 50) => ({ a, b, clubs, score })

// Now on the away club (Red Sox) ...
const whitlock = player(2, 'Garrett Whitlock', AWAY)
const rafaela = player(3, 'Ceddanne Rafaela', AWAY, 'CF')
const ikf = player(4, 'Isiah Kiner-Falefa', AWAY, '2B')
const story = player(6, 'Trevor Story', AWAY, 'SS')
const contreras = player(9, 'Willson Contreras', AWAY, '1B')
const gray = player(10, 'Sonny Gray', AWAY)
// ... and on the home club (Yankees).
const sanchez = player(1, 'Ali Sánchez', HOME, 'C')
const cole = player(5, 'Gerrit Cole', HOME)
const mcmahon = player(7, 'Ryan McMahon', HOME, '3B')
const volpe = player(8, 'Anthony Volpe', HOME, 'SS')
const goldschmidt = player(11, 'Paul Goldschmidt', HOME, '1B')

const ids = (list) => list.map((p) => p.id)

test('a tie made on a third club is an elsewhere row, one player on each side', () => {
  const rockies = pair(story, mcmahon, [club(115, 'Colorado Rockies', [2017, 2021])], 107)
  const { former, elsewhere } = teammateCrossroads([rockies], AWAY, HOME)
  assert.deepEqual(former, [])
  assert.equal(elsewhere.length, 1)
  assert.equal(elsewhere[0].club.teamId, 115)
  assert.deepEqual(ids(elsewhere[0].away), [story.id])
  assert.deepEqual(ids(elsewhere[0].home), [mcmahon.id])
  assert.deepEqual(elsewhere[0].seasons, [2017, 2021])
})

test('every pair on the same third club shares one row', () => {
  const cardinals = club(138, 'St. Louis Cardinals', [2023, 2024])
  const { elsewhere } = teammateCrossroads(
    [pair(contreras, goldschmidt, [cardinals], 99), pair(gray, goldschmidt, [cardinals], 60)],
    AWAY,
    HOME,
  )
  assert.equal(elsewhere.length, 1)
  assert.deepEqual(ids(elsewhere[0].away), [contreras.id, gray.id], 'best score first')
  assert.deepEqual(ids(elsewhere[0].home), [goldschmidt.id], 'a player shows once per row')
  assert.equal(elsewhere[0].score, 99)
})

test('a tie made only on tonight’s club is a former row for the player who left it', () => {
  const ties = [
    pair(whitlock, sanchez, [club(AWAY, 'Boston Red Sox', [2025])], 40),
    pair(rafaela, sanchez, [club(AWAY, 'Boston Red Sox', [2025])], 45),
    pair(ikf, cole, [club(HOME, 'New York Yankees', [2022])], 30),
    pair(ikf, volpe, [club(HOME, 'New York Yankees', [2023])], 20),
  ]
  const { former, elsewhere } = teammateCrossroads(ties, AWAY, HOME)
  assert.deepEqual(elsewhere, [])
  assert.equal(former.length, 2)
  const [redSox, yankees] = former
  assert.equal(redSox.club.teamId, AWAY)
  assert.deepEqual(ids(redSox.home), [sanchez.id], 'Sánchez left the Red Sox; he sits on the Yankees side')
  assert.deepEqual(redSox.away, [], 'no wall of the Red Sox he played with')
  assert.equal(redSox.mates, 2)
  assert.equal(yankees.club.teamId, HOME)
  assert.deepEqual(ids(yankees.away), [ikf.id])
  assert.deepEqual(yankees.seasons, [2022, 2023], 'seasons are the union across his mates')
  assert.equal(yankees.mates, 2)
})

test('a pair that shares a third club and tonight’s club files under the third club only', () => {
  const both = pair(story, mcmahon, [club(115, 'Colorado Rockies', [2017]), club(HOME, 'New York Yankees', [2024])])
  const { former, elsewhere } = teammateCrossroads([both], AWAY, HOME)
  assert.deepEqual(former, [])
  assert.deepEqual(
    elsewhere.map((r) => r.club.teamId),
    [115],
  )
})

test('a row that plays out tonight is pinned first, and its starters are marked', () => {
  const ties = [
    pair(story, mcmahon, [club(115, 'Colorado Rockies', [2019])], 100),
    pair(contreras, goldschmidt, [club(138, 'St. Louis Cardinals', [2023])], 10),
    pair(whitlock, sanchez, [club(AWAY, 'Boston Red Sox', [2025])], 90),
    pair(ikf, cole, [club(HOME, 'New York Yankees', [2022])], 5),
  ]
  const starting = new Set([contreras.id, goldschmidt.id, ikf.id, story.id])
  const { former, elsewhere } = teammateCrossroads(ties, AWAY, HOME, starting)
  assert.equal(elsewhere[0].club.teamId, 138, 'both Cardinals start; one Rockie does not')
  assert.equal(elsewhere[0].tonight, true)
  assert.equal(elsewhere[1].tonight, false, 'one starter on one side is not a pair playing tonight')
  assert.equal(elsewhere[1].away[0].starting, true)
  assert.equal(former[0].club.teamId, HOME, 'Kiner-Falefa starts; Sánchez does not')
  assert.equal(former[0].tonight, true)
})

test('nothing in, nothing out', () => {
  assert.deepEqual(teammateCrossroads([], AWAY, HOME), { former: [], elsewhere: [] })
  assert.deepEqual(teammateCrossroads(undefined, AWAY, HOME), { former: [], elsewhere: [] })
})

// A shard is filed under the ascending-id key, and the generator's 3-day
// window lets a LATER game in the other park overwrite it — so the shard's
// `teamA` (whose players are the `a`s) can be tonight's HOME club. The row
// must still name the player who left, read from the shard's own
// teamA/teamB, never from tonight's away/home.
test('a shard stored the other way round still names the player who left', () => {
  const bare = ({ id, name, pos }) => ({ id, name, pos })
  const data = {
    matchups: {
      [`${AWAY}-${HOME}`]: {
        teamA: HOME,
        teamB: AWAY,
        kind: 'teammates',
        rows: [
          // a = Sánchez (on HOME), b = Whitlock (on AWAY); they shared AWAY '25.
          { a: bare(sanchez), b: bare(whitlock), score: 40, shared: [club(AWAY, 'Boston Red Sox', [2025])] },
        ],
      },
    },
  }
  const pairs = formerTeammatePairs(data, AWAY, HOME)
  assert.equal(pairs[0].a.teamId, HOME)
  assert.equal(pairs[0].b.teamId, AWAY)
  const { former } = teammateCrossroads(pairs, AWAY, HOME)
  assert.equal(former.length, 1)
  assert.deepEqual(ids(former[0].home), [sanchez.id], 'Sánchez left the Red Sox; Whitlock is still one')
  assert.deepEqual(former[0].away, [])
})
