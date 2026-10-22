import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchSeasonAward, loadSeasonAwards, awardsSeasonInPlay } from '../src/api/awardsHistory.js'

const row = { id: 592450, nameFirstLast: 'Aaron Judge', primaryPosition: { abbreviation: 'OF' } }
const announced = { awards: [{ player: row, team: { id: 147 } }] }
// getJson's own failure text for a non-2xx.
const notFound = () => Promise.reject(new Error('MLB API 404 for /api/v1/awards/ALMVP/recipients?season=2026'))

test('a 404 reads as "not announced yet", not an error', async () => {
  assert.deepEqual(await fetchSeasonAward('ALMVP', 2026, notFound), { status: 'pending', recipients: [] })
})

test('a 500 is an error, not "not announced"', async () => {
  const get = () => Promise.reject(new Error('MLB API 500 for /x'))
  assert.equal((await fetchSeasonAward('ALMVP', 2026, get)).status, 'error')
})

test('an announced award carries its winner, league and team', async () => {
  const r = await fetchSeasonAward('ALMVP', 2025, async () => announced)
  assert.equal(r.status, 'announced')
  assert.deepEqual(r.recipients[0], {
    league: 'AL', playerId: 592450, name: 'Aaron Judge', teamId: 147, teamName: r.recipients[0].teamName, position: 'OF',
  })
})

test('an empty 200 is pending', async () => {
  assert.equal((await fetchSeasonAward('ALMVP', 2026, async () => ({ awards: [] }))).status, 'pending')
})

test('loadSeasonAwards groups AL/NL into one family; one failure stays in its cell', async () => {
  const get = async (path) => {
    if (path.includes('/ALMVP/')) return announced
    if (path.includes('/NLCY/')) throw new Error('MLB API 500')
    return notFound()
  }
  const families = await loadSeasonAwards(2026, get)
  const mvp = families.find((f) => f.label === 'MVP')
  assert.deepEqual(mvp.awards.map((a) => [a.id, a.status]), [['ALMVP', 'announced'], ['NLMVP', 'pending']])
  assert.equal(families.find((f) => f.label === 'Cy Young').awards[1].status, 'error')
  assert.ok(!families.some((f) => f.label === 'All-Star'))
})

test('the block runs October through February only', () => {
  assert.equal(awardsSeasonInPlay(new Date(2026, 9, 22)), 2026)
  assert.equal(awardsSeasonInPlay(new Date(2027, 0, 15)), 2026)
  assert.equal(awardsSeasonInPlay(new Date(2026, 6, 4)), null)
})
