// The defense cards draw the fielders on the park the game is played in. The spot table and the
// window it is cropped to are pure modules (lib/ballpark/layout/defenseWindow.js, parkWindow.js) shared by the
// lineup page's FieldCard and the innings page's Field tab.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DEFENSE_SPOTS } from '../src/lib/ballpark/layout/defenseWindow.js'
import { parkWindow } from '../src/lib/ballpark/layout/parkWindow.js'
import { allBallparkLayouts, resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { buildFieldGeometry, diagramInput, VIEWBOX } from '../src/lib/ballpark/ballparkGeometry.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const topOf = (w) => Number(w.viewBox.split(' ')[1])

test('every park: spots sit inside the window, and no distance sign is cropped', () => {
  for (const layout of allBallparkLayouts()) {
    const w = parkWindow(layout)
    const top = topOf(w)
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

test('Dodger Stadium trims more sky than Comerica, whose sign draws high', () => {
  const dodgers = parkWindow(resolveBallparkLayout({ venueId: 22, gameDate: '2026-10-15' }))
  assert.equal(dodgers.aspectRatio, `${VIEWBOX.w} / ${VIEWBOX.h - topOf(dodgers)}`)
  const comerica = parkWindow(resolveBallparkLayout({ venueId: 2394, gameDate: '2026-10-15' }))
  assert.ok(topOf(comerica) < topOf(dodgers))
})

test('both cards read the one spot table', () => {
  assert.match(read('screens/lineup/next/cards/FieldCard.jsx'), /DEFENSE_SPOTS/)
  assert.match(read('components/scoring/DefenseDiamond.jsx'), /DEFENSE_SPOTS/)
  assert.doesNotMatch(read('components/scoring/DefenseDiamond.jsx'), /const PARK_SPOTS/)
})
