// lib/gamecard/paintGameCard.js's pure half (#2969 slice 5): the PNG's layout and file name.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardLayout, cardFilename, CARD_W, SCALE } from '../src/lib/gamecard/paintGameCard.js'

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
