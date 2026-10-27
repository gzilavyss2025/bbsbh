import { HOME_RUN, momentAt } from './choreography.js'
import { HOME_RUN_ART } from './assets.js'

export const WIDTH = 768
export const HEIGHT = 432

export function drawBallpark(g, art, time, { track = HOME_RUN, still = false } = {}) {
  const m = momentAt(time, track)
  g.clearRect(0, 0, WIDTH, HEIGHT)
  g.imageSmoothingEnabled = false
  // A tiny finite camera approach; the body motion comes from the atlas, never
  // a scale wobble or crossfade between whole images. Reduced motion fixes it.
  const push = still ? 1 : Math.min(1, m.t / 1.7)
  const zoom = 1 + 0.016 * (1 - (1 - push) ** 3)
  g.drawImage(art.stadium, -(WIDTH * (zoom - 1)) / 2, -(HEIGHT * (zoom - 1)) / 2, WIDTH * zoom, HEIGHT * zoom)
  const character = art.character ?? HOME_RUN_ART
  const cellW = art.atlas.width / character.columns, cellH = art.atlas.height / character.rows
  const height = character.height, width = height * cellW / cellH
  const x = Math.round(WIDTH * character.centerX - width / 2), y = character.top
  g.drawImage(art.atlas, (m.frame % character.columns) * cellW, Math.floor(m.frame / character.columns) * cellH, cellW, cellH, x, y, width, height)
  return m
}
