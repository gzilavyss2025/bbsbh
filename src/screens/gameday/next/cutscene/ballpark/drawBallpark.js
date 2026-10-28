import { HOME_RUN, momentAt } from './choreography.js'
import { HOME_RUN_ART } from './assets.js'
import { ballAt } from './flight.js'
import { drawEffects, hopOffset } from './effects.js'

export const WIDTH = 768
export const HEIGHT = 432

export function drawBallpark(g, art, time, { track = HOME_RUN, still = false, colors } = {}) {
  const m = momentAt(time, track)
  g.clearRect(0, 0, WIDTH, HEIGHT)
  g.imageSmoothingEnabled = false
  // A tiny finite camera approach; the body motion comes from the atlas, never
  // a scale wobble or crossfade between whole images. Reduced motion fixes it.
  const push = still ? 1 : Math.min(1, m.t / 1.7)
  const zoom = 1 + 0.016 * (1 - (1 - push) ** 3)
  g.drawImage(art.stadium, -(WIDTH * (zoom - 1)) / 2, -(HEIGHT * (zoom - 1)) / 2, WIDTH * zoom, HEIGHT * zoom)
  drawEffects(g, m.t, track, { ...colors, ...art.palette })
  const ball = ballAt(m.t, track.flight)
  if (ball) {
    const bx = Math.round(ball.x * WIDTH), by = Math.round(ball.y * HEIGHT)
    g.fillStyle = colors.outline
    g.fillRect(bx - 4, by - 2, 9, 5); g.fillRect(bx - 2, by - 4, 5, 9)
    g.fillStyle = colors.chalk
    g.fillRect(bx - 3, by - 1, 7, 3); g.fillRect(bx - 1, by - 3, 3, 7)
  }
  const character = art.character ?? HOME_RUN_ART
  const cellW = art.atlas.width / character.columns, cellH = art.atlas.height / character.rows
  const height = character.height, width = height * cellW / cellH
  const x = Math.round(WIDTH * character.centerX - width / 2), y = character.top + hopOffset(m.t, track.hop)
  g.drawImage(art.atlas, (m.frame % character.columns) * cellW, Math.floor(m.frame / character.columns) * cellH, cellW, cellH, x, y, width, height)
  return m
}
