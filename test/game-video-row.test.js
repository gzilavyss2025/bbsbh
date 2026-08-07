// Coverage for the box score's video row selectors (src/api/highlights.js):
// picking MLB's condensed game out of the content package, ordering this
// game's own reel, and formatting a runtime for the kraft tab. These feed
// GameVideoRow.jsx, which renders inside the box score's seal.
//
// Fixtures are shaped from REAL live `content` items — gamePk 824403
// (NYM@CLE, 2026-08-04), read 2026-08-06. That game's package held 40 items:
// one condensed game (00:12:20), one recap, 19 eligible per-play clips, and
// the usual interviews/data-viz/field-view remainder.
import assert from 'node:assert/strict'
import test from 'node:test'
import { formatClipDuration, selectCondensedGame, selectGameClips } from '../src/api/highlights.js'

const kw = (taxonomy) => taxonomy.map((value) => ({ type: 'taxonomy', value }))

const condensed = {
  id: 'condensed-game-nym-cle-8-4-26',
  title: 'Condensed Game: NYM@CLE - 8/4/26',
  duration: '00:12:20',
  date: '2026-08-05T02:25:58.853Z',
  keywordsAll: kw(['international-feed', 'condensed-game', 'vod', 'alexa']),
}
const recap = {
  id: 'luis-torrens-four-rbis-fuels-mets-6-2-win',
  title: "Luis Torrens' four RBIs fuels Mets' 6-2 win",
  duration: '00:03:15',
  date: '2026-08-05T02:31:56.014Z',
  keywordsAll: kw(['game-recap', 'apple-news', 'vod']),
}
const clip = (id, date, taxonomy = ['highlight', 'hitting']) => ({
  id,
  title: id,
  date,
  keywordsAll: kw(taxonomy),
})

// Real per-play clips, in the order the feed itself returned them — which is
// NOT the order they happened.
const kwan = clip('steven-kwans-terrific-running-catch', '2026-08-04T22:42:38.242Z', ['highlight', 'defense'])
const benge = clip('carson-benges-solo-home-run', '2026-08-05T00:44:33.05Z')
const bichette = clip('bo-bichettes-solo-home-run', '2026-08-04T23:21:36.286Z')

test('selectCondensedGame finds the condensed cut and nothing else', () => {
  assert.equal(selectCondensedGame([recap, benge, condensed, kwan]), condensed)
  // The recap is a different feed with a score in its title — never a
  // stand-in for the condensed game.
  assert.equal(selectCondensedGame([recap, benge, kwan]), null)
})

// A live game (clips, no condensed cut yet — it posts ~30 min after the final
// out) and MiLB (no content package at all) are both routine, not edges.
test('selectCondensedGame degrades to null rather than throwing', () => {
  assert.equal(selectCondensedGame([]), null)
  assert.equal(selectCondensedGame(undefined), null)
  assert.equal(selectCondensedGame([{}, { keywordsAll: null }]), null)
})

test('selectGameClips returns eligible per-play clips oldest first', () => {
  const clips = selectGameClips([benge, condensed, kwan, recap, bichette])
  assert.deepEqual(
    clips.map((c) => c.id),
    [kwan.id, bichette.id, benge.id],
  )
})

// The condensed game and the recap both carry tags in NON_PLAY_TAXONOMY, so
// the reel can never swallow the 12-minute cut sitting beside it.
test('selectGameClips excludes the condensed game, the recap, and non-play content', () => {
  const interview = clip('mets-manager-on-the-win', '2026-08-05T01:00:00Z', ['highlight', 'interview'])
  const absReview = clip('abs-challenge-overturned', '2026-08-04T23:00:00Z', ['highlight', 'abs'])
  const untagged = clip('some-b-roll', '2026-08-04T23:00:00Z', ['vod'])
  const clips = selectGameClips([condensed, recap, interview, absReview, untagged, benge])
  assert.deepEqual(
    clips.map((c) => c.id),
    [benge.id],
  )
})

test('selectGameClips degrades to an empty list', () => {
  assert.deepEqual(selectGameClips(undefined), [])
  assert.deepEqual(selectGameClips([]), [])
})

test('formatClipDuration renders the runtime the kraft tab says out loud', () => {
  assert.equal(formatClipDuration('00:12:20'), '12:20')
  assert.equal(formatClipDuration('00:03:15'), '3:15')
  assert.equal(formatClipDuration('00:00:07'), '0:07')
  assert.equal(formatClipDuration('01:02:03'), '1:02:03')
})

// A missing or malformed value drops the parenthetical entirely — the tab
// still reads "CONDENSED GAME" rather than "CONDENSED GAME (undefined)".
test('formatClipDuration returns an empty string it cannot parse', () => {
  assert.equal(formatClipDuration(undefined), '')
  assert.equal(formatClipDuration(''), '')
  assert.equal(formatClipDuration('12:20'), '')
  assert.equal(formatClipDuration('ab:cd:ef'), '')
})
