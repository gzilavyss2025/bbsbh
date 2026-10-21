// The defense cards draw the fielders on the park the game is played in. The spot table and the
// window it is cropped to are one pure module (lib/ballpark/layout/defenseWindow.js) shared by the
// lineup page's FieldCard and the innings page's Field tab.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DEFENSE_SPOTS, defenseWindow } from '../src/lib/ballpark/layout/defenseWindow.js'
import { allBallparkLayouts, resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { buildFieldGeometry, diagramInput, PLOT_SKY_CROP, VIEWBOX } from '../src/lib/ballpark/ballparkGeometry.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const topOf = (w) => Number(w.viewBox.split(' ')[1])

test('every park: spots sit inside the window, and no distance sign is cropped', () => {
  for (const layout of allBallparkLayouts()) {
    const w = defenseWindow(layout)
    const top = topOf(w)
    // Each park's own trim (parkWindow.js, Gary 2026-10-21): no longer capped at 72.
    assert.ok(top >= 0 && top < VIEWBOX.h / 2, `crop ${top}`)
    for (const [pos, xy] of Object.entries(DEFENSE_SPOTS)) {
      const { left, top: t } = w.percent(xy)
      assert.ok(left > 10 && left < 90, `${pos} left ${left}`)
      assert.ok(t > 5 && t < 95, `${pos} top ${t}`)
    }
    for (const l of buildFieldGeometry(diagramInput(layout)).labels) {
      assert.ok(l.y - 10 >= top, `sign at y ${l.y} cut by a window starting at ${top}`)
    }
  }
})

test('Dodger Stadium trims past the old 72 cap; a deep-sign park keeps its sign in view', () => {
  const dodgers = defenseWindow(resolveBallparkLayout({ venueId: 22, gameDate: '2026-10-15' }))
  assert.ok(topOf(dodgers) > 72, `Dodger Stadium starts at ${topOf(dodgers)}`)
  assert.equal(dodgers.aspectRatio, `${VIEWBOX.w} / ${VIEWBOX.h - topOf(dodgers)}`)
  const comerica = defenseWindow(resolveBallparkLayout({ venueId: 2394, gameDate: '2026-10-15' }))
  assert.ok(topOf(comerica) < topOf(dodgers))
})

test('both cards read the one spot table', () => {
  assert.match(read('screens/lineup/next/cards/FieldCard.jsx'), /DEFENSE_SPOTS/)
  assert.match(read('components/scoring/DefenseDiamond.jsx'), /DEFENSE_SPOTS/)
  assert.doesNotMatch(read('components/scoring/DefenseDiamond.jsx'), /const PARK_SPOTS/)
})
