// THE FORMER TEAMMATES CARD'S ROWS (teammateCrossroads). One row per shared
// club: the club in the middle, each of tonight's clubs' players on its own
// side. A tie made only on one of tonight's two clubs ("he used to play here")
// is a 'former' row holding just the player who LEFT — not a wall of the
// faces he played with there.
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
  assert.equal(yankees.club.teamId, HOME)
  assert.deepEqual(ids(yankees.away), [ikf.id])
  assert.deepEqual(yankees.seasons, [2022, 2023], 'seasons are the union across his mates')
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

// A FARM CLUB of tonight's club is a 'former' tie too (#1319): the shard's
// club entry carries `orgId`, its season-accurate parent org.
const farm = (teamId, teamName, seasons, level, orgId) => ({ ...club(teamId, teamName, seasons, level), orgId })
const scranton = (seasons, level = 'AAA') => farm(531, 'Scranton/Wilkes-Barre RailRiders', seasons, level, HOME)
const worcester = farm(533, 'Worcester Red Sox', [2022], 'AAA', AWAY)
const names = { [AWAY]: 'Boston Red Sox', [HOME]: 'New York Yankees' }

test('a farm-club tie is a former row under the parent, for the player who left that org', () => {
  const { former, elsewhere } = teammateCrossroads([pair(whitlock, volpe, [scranton([2019])])], AWAY, HOME, undefined, names)
  assert.deepEqual(elsewhere, [], 'no elsewhere row for a farm club of tonight’s club')
  assert.equal(former.length, 1)
  assert.equal(former[0].club.teamId, HOME, 'keyed by the parent, so the logo is the Yankees’')
  assert.deepEqual(ids(former[0].away), [whitlock.id], 'Whitlock left the Yankees system')
  assert.deepEqual(former[0].home, [])
})

test('the player who left is found by org, from either side', () => {
  const { former } = teammateCrossroads([pair(story, cole, [worcester])], AWAY, HOME, undefined, names)
  assert.equal(former[0].club.teamId, AWAY)
  assert.deepEqual(ids(former[0].home), [cole.id], 'Cole left the Red Sox system')
  assert.deepEqual(former[0].away, [])
})

test('an MLB year and a farm year in the same org show the player once, seasons merged', () => {
  const both = [club(HOME, 'New York Yankees', [2021], 'MLB'), scranton([2019, 2020])]
  const { former, elsewhere } = teammateCrossroads([pair(whitlock, volpe, both)], AWAY, HOME, undefined, names)
  assert.deepEqual(elsewhere, [])
  assert.equal(former.length, 1, 'one row for the parent, not one per club')
  assert.deepEqual(ids(former[0].away), [whitlock.id])
  assert.deepEqual(former[0].seasons, [2019, 2020, 2021])
})

test('a row of only minor-league stints reads “<club> system”, at the highest minor level shared', () => {
  const minors = [scranton([2018], 'AA'), scranton([2019], 'AAA')]
  const { former } = teammateCrossroads([pair(whitlock, volpe, minors)], AWAY, HOME, undefined, names)
  assert.equal(former[0].club.teamName, 'New York Yankees system')
  assert.equal(former[0].club.level, 'AAA')
})

test('a row with any MLB stint keeps the plain club name and MLB', () => {
  const both = [club(HOME, 'New York Yankees', [2021], 'MLB'), scranton([2019])]
  const { former } = teammateCrossroads([pair(whitlock, volpe, both)], AWAY, HOME, undefined, names)
  assert.equal(former[0].club.teamName, 'New York Yankees')
  assert.equal(former[0].club.level, 'MLB')
})

test('a row whose stints are merged across pairs still reads MLB when one pair had an MLB year', () => {
  const ties = [
    pair(whitlock, volpe, [scranton([2019])], 30),
    pair(rafaela, sanchez, [club(HOME, 'New York Yankees', [2024], 'MLB')], 20),
  ]
  const { former } = teammateCrossroads(ties, AWAY, HOME, undefined, names)
  assert.equal(former.length, 1)
  assert.equal(former[0].club.level, 'MLB')
  assert.deepEqual(ids(former[0].away), [whitlock.id, rafaela.id])
})

test('a missing team name falls back to the shared club’s own name', () => {
  const { former } = teammateCrossroads([pair(whitlock, volpe, [scranton([2019])])], AWAY, HOME)
  assert.equal(former[0].club.teamName, 'Scranton/Wilkes-Barre RailRiders')
  assert.equal(former[0].club.level, 'AAA')
})

test('a shard with no orgId files a farm club under elsewhere, as before', () => {
  const bare = { ...scranton([2019]) }
  delete bare.orgId
  const { former, elsewhere } = teammateCrossroads([pair(whitlock, volpe, [bare])], AWAY, HOME, undefined, names)
  assert.deepEqual(former, [])
  assert.equal(elsewhere.length, 1)
  assert.equal(elsewhere[0].club.teamId, 531)
  assert.equal(elsewhere[0].club.teamName, 'Scranton/Wilkes-Barre RailRiders')
})

test('a farm club of a THIRD org still files under elsewhere', () => {
  const phillies = farm(1234, 'Lehigh Valley IronPigs', [2019], 'AAA', 143)
  const { former, elsewhere } = teammateCrossroads([pair(story, mcmahon, [phillies])], AWAY, HOME, undefined, names)
  assert.deepEqual(former, [])
  assert.equal(elsewhere[0].club.teamId, 1234)
  assert.deepEqual(ids(elsewhere[0].away), [story.id])
  assert.deepEqual(ids(elsewhere[0].home), [mcmahon.id])
})

test('a farm-club tie whose player who left starts lifts its former row to the top', () => {
  const ties = [
    pair(ikf, sanchez, [club(HOME, 'New York Yankees', [2022])], 90),
    pair(story, cole, [worcester], 5),
  ]
  const { former } = teammateCrossroads(ties, AWAY, HOME, new Set([cole.id]), names)
  assert.equal(former[0].club.teamId, AWAY, 'Cole starts and left the Red Sox system; Kiner-Falefa does not start')
  assert.equal(former[0].tonight, true)
  assert.equal(former[0].home[0].starting, true)
  assert.equal(former[1].tonight, false)
})

test('on a MiLB matchup, tonight’s own club reads as itself, never as a “system”', () => {
  // Nashville (AAA, Brewers org) vs Iowa (AAA, Cubs org). The shared club IS
  // tonight's club, and a MiLB club has no farm system of its own.
  const NASHVILLE = 556
  const IOWA = 451
  const milbNames = { [NASHVILLE]: 'Sounds', [IOWA]: 'Cubs' }
  const left = player(20, 'Left Nashville', IOWA)
  const stayed = player(21, 'Still a Sound', NASHVILLE)
  const sounds = farm(NASHVILLE, 'Nashville Sounds', [2025], 'AAA', 158)
  const { former } = teammateCrossroads([pair(left, stayed, [sounds])], NASHVILLE, IOWA, undefined, milbNames)
  assert.equal(former.length, 1)
  assert.equal(former[0].club.teamId, NASHVILLE)
  assert.equal(former[0].club.teamName, 'Sounds')
  assert.equal(former[0].club.level, 'AAA')
  assert.deepEqual(ids(former[0].home), [left.id])
})
