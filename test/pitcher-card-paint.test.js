// lib/gamecard/paintGameCard.js's pure half (#2969 slice 5): the PNG's layout and file name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardLayout, cardFilename, coverRect, CARD_W, SCALE } from '../src/lib/gamecard/paintGameCard.js'

test('blocks stack top to bottom with no gap or overlap, and the height is their sum', () => {
  const L = cardLayout({ mixRows: 5, hasPlots: true })
  const order = ['band', 'hero', 'trio', 'mix', 'plots', 'foot']
  let y = 0
  for (const name of order) {
    assert.equal(L.blocks[name].y, y, name)
    y += L.blocks[name].h
  }
  assert.equal(L.height, y)
  assert.equal(L.width, CARD_W)
})

test('each pitch type adds one mix row; no mix and no plots drop their blocks', () => {
  const a = cardLayout({ mixRows: 2, hasPlots: true })
  const b = cardLayout({ mixRows: 3, hasPlots: true })
  assert.equal(b.height - a.height, b.blocks.mix.h - a.blocks.mix.h)
  const bare = cardLayout({ mixRows: 0, hasPlots: false })
  assert.equal(bare.blocks.mix, undefined)
  assert.equal(bare.blocks.plots, undefined)
  assert.equal(bare.blocks.foot.y + bare.blocks.foot.h, bare.height)
})

test('the plots keep the on-screen 120×140 aspect and the image is 1080 px wide', () => {
  const L = cardLayout({ mixRows: 1, hasPlots: true })
  assert.ok(Math.abs(L.plot.h / L.plot.w - 140 / 120) < 1e-9)
  assert.equal(CARD_W * SCALE, 1080)
})

test('file name: the pitcher and the date, accents and spaces folded', () => {
  assert.equal(cardFilename('Yoshinobu Yamamoto', '2025-11-01'), 'yoshinobu-yamamoto-2025-11-01-game-card.png')
  assert.equal(cardFilename('Seranthony Domínguez', ''), 'seranthony-dominguez-game-card.png')
  assert.equal(cardFilename('', null), 'pitcher-game-card.png')
})

test('a five-pitch card is no taller than 9:16, so it fits a phone story without a crop', () => {
  const L = cardLayout({ mixRows: 5, hasPlots: true })
  assert.ok(L.height / L.width <= 16 / 9, `${L.width}x${L.height}`)
})

test("headshot: cropped to fill its box at the photo's own proportions, never stretched", () => {
  // A square silo into a 96x112 slot: scale to the height, trim the sides evenly.
  const r = coverRect(360, 360, 96, 112)
  assert.ok(Math.abs(r.sw / r.sh - 96 / 112) < 1e-9)
  assert.equal(r.sh, 360)
  assert.equal(r.sx, (360 - r.sw) / 2)
  assert.equal(r.sy, 0)
  // A tall photo keeps its full width and its top (the face), trimming the bottom.
  const t = coverRect(320, 480, 96, 112)
  assert.equal(t.sw, 320)
  assert.equal(t.sx, 0)
  assert.equal(t.sy, 0)
  assert.ok(Math.abs(t.sw / t.sh - 96 / 112) < 1e-9)
})
