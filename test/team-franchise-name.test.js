// The favor meter's caption ("Missed calls have added +0.3 runs for …") names a
// club by its PLACE name, since every MLB nickname is plural and would need an
// article the copy can't add rule-free (see selectTeamMeta's comment). That name
// has to be the one the club is actually called by — the "Colorado" of Colorado
// Rockies — not the city it plays in, which for a state/region-named club or a
// club playing outside its namesake city is a different word entirely.
// statsapi carries both: `locationName` is the host city (Denver, Bronx,
// Anaheim), `franchiseName` is the club's own place name (Colorado, New York,
// Los Angeles). Reading the wrong one printed "for Denver" on a Rockies game.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectTeamMeta } from '../src/api/select.js'

// Shape mirrors a real feed: gameData.teams carries the full team object, and
// liveData.boxscore.teams[side].team repeats it (both verified July 2026).
function feedWith(awayTeam, homeTeam) {
  return {
    gameData: { teams: { away: awayTeam, home: homeTeam } },
    liveData: { boxscore: { teams: { away: { team: awayTeam }, home: { team: homeTeam } } } },
  }
}

const ROCKIES = {
  id: 115,
  name: 'Colorado Rockies',
  teamName: 'Rockies',
  clubName: 'Rockies',
  locationName: 'Denver',
  franchiseName: 'Colorado',
  abbreviation: 'COL',
}
const BREWERS = {
  id: 158,
  name: 'Milwaukee Brewers',
  teamName: 'Brewers',
  clubName: 'Brewers',
  locationName: 'Milwaukee',
  franchiseName: 'Milwaukee',
  abbreviation: 'MIL',
}

test('franchiseName is the club-name place, not the host city', () => {
  const feed = feedWith(ROCKIES, BREWERS)
  // The bug: locationName reads "Denver", which is not part of the club's name.
  assert.equal(selectTeamMeta(feed, 'away').franchiseName, 'Colorado')
  // Unaffected for a club whose city and franchise name agree — the control.
  assert.equal(selectTeamMeta(feed, 'home').franchiseName, 'Milwaukee')
})

test('franchiseName + clubName reassemble the full team name', () => {
  // The invariant behind the field choice, checked on the divergent cases:
  // franchiseName is exactly `name` minus the nickname.
  const cases = [
    ROCKIES,
    BREWERS,
    { name: 'New York Yankees', clubName: 'Yankees', locationName: 'Bronx', franchiseName: 'New York' },
    { name: 'Los Angeles Angels', clubName: 'Angels', locationName: 'Anaheim', franchiseName: 'Los Angeles' },
    { name: 'Iowa Cubs', clubName: 'Cubs', locationName: 'Des Moines', franchiseName: 'Iowa' },
  ]
  for (const team of cases) {
    const meta = selectTeamMeta(feedWith(team, team), 'away')
    assert.equal(`${meta.franchiseName} ${meta.clubName}`, team.name)
  }
})

test('a feed missing franchiseName falls back to locationName, then name', () => {
  // MiLB feeds are thin (root CLAUDE.md's degradation rule): a club that posts
  // only locationName still gets a usable place name rather than an empty one.
  const partial = { name: 'Beloit Sky Carp', clubName: 'Sky Carp', locationName: 'Beloit' }
  assert.equal(selectTeamMeta(feedWith(partial, partial), 'home').franchiseName, 'Beloit')

  const nameOnly = { name: 'Somerset Patriots' }
  assert.equal(selectTeamMeta(feedWith(nameOnly, nameOnly), 'home').franchiseName, 'Somerset Patriots')
})
