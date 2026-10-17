import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReel, roadHereGames } from '../../src/lib/postseason/worldseries/reel.js'

const SLATE = '2026-10-27'
const img = (id) => ({ templateUrl: `https://img.mlbstatic.com/mlb-images/image/upload/t_16x9/t_w1280/mlb/${id}.jpg`, cuts: [] })
// A raw content item. taxonomy 'highlight' is the kind selectGameClips keeps.
const clip = (id, headline, extra = {}) => ({
  id,
  headline,
  date: `2026-10-2${id}T01:00:00Z`,
  duration: '00:00:30',
  image: img(`clip${id}`),
  keywordsAll: [{ type: 'taxonomy', value: 'highlight' }],
  ...extra,
})
const condensed = (id) => clip(id, 'Condensed Game: LAD@TOR', { keywordsAll: [{ type: 'taxonomy', value: 'condensed-game' }] })
const photo = (id, extra = {}) => ({ id: `mlb/${id}.jpg`, original: `https://x/${id}`, thumb: `https://x/t${id}`, kind: 'photographer', headline: `Photo ${id}`, ...extra })
const game = (gamePk, gameNumber, date, clips, photos = []) => ({ gamePk, gameNumber, date, tag: `G${gameNumber}`, filter: `G${gameNumber}`, clips, photos })

test('cutoff: a game dated on the slate date (even Final) never appears', () => {
  const reel = buildReel([game(1, 1, '2026-10-24', [clip(1, 'A')]), game(3, 3, SLATE, [clip(3, 'Leak')])], { slateDate: SLATE })
  assert.deepEqual(reel.map((c) => c.title), ['A'])
})

test('newest game first', () => {
  const reel = buildReel([game(1, 1, '2026-10-24', [clip(1, 'A')]), game(2, 2, '2026-10-25', [clip(2, 'B')])], { slateDate: SLATE })
  assert.deepEqual(reel.map((c) => c.gamePk), [2, 1])
})

test('the Game N highlights recap leads its game; the condensed game is dropped', () => {
  const clips = [clip(1, 'Homer'), condensed(2), clip(3, 'Game 2 highlights'), clip(4, 'Double')]
  const reel = buildReel([game(2, 2, '2026-10-25', clips)], { slateDate: SLATE })
  assert.deepEqual(reel.map((c) => c.title), ['Game 2 highlights', 'Homer', 'Double'])
})

test('clips and photos mix in feed order after the recap', () => {
  const reel = buildReel([game(2, 2, '2026-10-25', [clip(1, 'C1'), clip(2, 'C2')], [photo('p1'), photo('p2')])], { slateDate: SLATE })
  assert.deepEqual(reel.map((c) => c.title), ['C1', 'Photo p1', 'C2', 'Photo p2'])
  assert.deepEqual(reel.map((c) => c.kind), ['clip', 'photo', 'clip', 'photo'])
})

test('a photo whose image id is already a clip thumbnail is dropped', () => {
  const clips = [clip(1, 'C1')] // thumbnail id: mlb/clip1.jpg
  const reel = buildReel([game(2, 2, '2026-10-25', clips, [photo('clip1'), photo('other')])], { slateDate: SLATE })
  assert.deepEqual(reel.map((c) => c.title), ['C1', 'Photo other'])
})

test('only photographer stills are kept; at most 6 items per game', () => {
  const clips = Array.from({ length: 5 }, (_, i) => clip(i + 1, `C${i + 1}`))
  const photos = [photo('a'), photo('b'), photo('c', { kind: 'graphic' })]
  const reel = buildReel([game(2, 2, '2026-10-25', clips, photos)], { slateDate: SLATE })
  assert.equal(reel.length, 6)
  assert.ok(!reel.some((c) => c.title === 'Photo c'))
})

test('an empty reel is an empty list, never a placeholder', () => {
  assert.deepEqual(buildReel([game(2, 2, '2026-10-25', [], [])], { slateDate: SLATE }), [])
  assert.deepEqual(buildReel([], { slateDate: SLATE }), [])
})

test('Road here takes the last 2 LCS games before the slate date, per club', () => {
  const lcs = (n, date) => ({ gamePk: n, gameNumber: n, date })
  const out = roadHereGames(
    [
      { clubId: 119, abbr: 'LAD', round: 'NLCS', games: [lcs(1, '2026-10-12'), lcs(2, '2026-10-13'), lcs(3, '2026-10-15'), lcs(4, SLATE)] },
      { clubId: 141, abbr: 'TOR', round: 'ALCS', games: [lcs(11, '2026-10-14'), lcs(12, '2026-10-16')] },
    ],
    SLATE,
  )
  assert.deepEqual(out.map((g) => g.gamePk).sort((a, b) => a - b), [2, 3, 11, 12])
  assert.equal(out.find((g) => g.gamePk === 3).tag, 'NLCS G3')
  assert.equal(out.find((g) => g.gamePk === 3).filter, 'LAD')
})
