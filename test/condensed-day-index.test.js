// Coverage for the per-day condensed-game index's generation-side policy
// (scripts/lib/highlights.mjs): which content item becomes a day file's entry
// for a game, and what gets stored about it.
//
// This is the piece that decides what the home slate's revealed result cards
// render, so a regression here ships a wrong poster — or worse, a title with a
// score in it — to the app's most spoiler-sensitive surface.
//
// Fixtures shaped from real items in gamePk 824403's content package
// (NYM@CLE, 2026-08-04), read 2026-08-06.
import assert from 'node:assert/strict'
import test from 'node:test'
import { condensedEntry } from '../scripts/lib/highlights.mjs'

const tax = (values) => values.map((value) => ({ type: 'taxonomy', value }))
const cuts = [
  { aspectRatio: '16:9', width: 1920, src: 'https://img.mlbstatic.com/wide.jpg' },
  { aspectRatio: '16:9', width: 640, src: 'https://img.mlbstatic.com/640.jpg' },
  { aspectRatio: '4:3', width: 800, src: 'https://img.mlbstatic.com/tall.jpg' },
]

const condensed = {
  id: 'condensed-game-nym-cle-8-4-26',
  title: 'Condensed Game: NYM@CLE - 8/4/26',
  duration: '00:12:20',
  keywordsAll: tax(['condensed-game', 'vod']),
  image: { cuts },
  playbacks: [
    { name: 'hlsCloud', url: 'https://cuts.mlb.com/x.m3u8' },
    { name: 'mp4Avc', url: 'https://cuts.mlb.com/x.mp4' },
  ],
}
// The recap sits in the same package and is NOT interchangeable: its title
// carries the final score.
const recap = {
  id: 'luis-torrens-four-rbis-fuels-mets-6-2-win',
  title: "Luis Torrens' four RBIs fuels Mets' 6-2 win",
  duration: '00:03:15',
  keywordsAll: tax(['game-recap', 'vod']),
  image: { cuts },
  playbacks: [{ name: 'mp4Avc', url: 'https://cuts.mlb.com/recap.mp4' }],
}
const clip = {
  id: 'carson-benges-solo-home-run',
  title: "Carson Benge's solo home run (12)",
  keywordsAll: tax(['highlight', 'hitting']),
  image: { cuts },
  playbacks: [{ name: 'mp4Avc', url: 'https://cuts.mlb.com/clip.mp4' }],
}

test('condensedEntry stores what the card needs to render AND to play', () => {
  const entry = condensedEntry([clip, recap, condensed])
  assert.equal(entry.id, condensed.id)
  assert.equal(entry.title, condensed.title)
  assert.equal(entry.duration, '00:12:20')
  // The smallest 16:9 cut at least 640 wide — a card thumbnail wants neither
  // end of MLB's ~20-width ladder.
  assert.equal(entry.poster, 'https://img.mlbstatic.com/640.jpg')
  // Already resolved, so the reader re-derives nothing and a tap needs no
  // network at all.
  assert.deepEqual(entry.playbacks, {
    hls: 'https://cuts.mlb.com/x.m3u8',
    mp4: 'https://cuts.mlb.com/x.mp4',
  })
})

// The whole reason a score-carrying title never reaches a slate card: the
// recap is never mistaken for the condensed cut, even when it is the only
// long-form video in the package.
test('condensedEntry never falls back to the recap', () => {
  assert.equal(condensedEntry([clip, recap]), null)
})

test('condensedEntry is null when there is nothing to play', () => {
  assert.equal(condensedEntry([]), null)
  assert.equal(condensedEntry(undefined), null)
  // Tagged condensed but with no playable rendition — a poster with no video
  // behind it would be a card that dead-ends on tap.
  assert.equal(condensedEntry([{ ...condensed, playbacks: [] }]), null)
})

// A game whose condensed cut carries no usable still still plays; the card's
// own render is what decides how to cope with a missing poster.
test('condensedEntry tolerates a missing image', () => {
  const entry = condensedEntry([{ ...condensed, image: null }])
  assert.equal(entry.poster, null)
  assert.equal(entry.playbacks.mp4, 'https://cuts.mlb.com/x.mp4')
})
