// The ground under the strike zone: the two batter's boxes, in the SAME ground geometry the
// at-bat replay draws (lib/pitcherCard/scene.js, `stage()`), so the zone's chalk and the
// replay's cannot drift into two different batter's boxes.
//
// The replay's camera is low, so its plate and boxes are tall; the zone plot is a flat plot of
// feet and has a short strip of ground under it. So the scene's shapes are scaled to the zone's
// plate width across, and by `kv` (< 1) down: the same fan of chalk lines, squeezed to fit.
// Pure: no React, no feed.
import { stage } from '../pitcherCard/scene.js'

const S = stage()
const FRONT_CX = S.front.x + S.front.w / 2
const PLATE_TOP = S.plate[0][1]

// Each batter's box as an SVG `points` string. `cx` is the plate's centre, `plateTop` the y of
// its flat front edge, `zw` the plate's width, all in the plot's own px.
export function groundBoxes(cx, plateTop, zw, kv = 0.35) {
  const k = zw / S.front.w
  return S.boxes.map((box) =>
    box.map(([x, y]) => `${(cx + (x - FRONT_CX) * k).toFixed(1)},${(plateTop + (y - PLATE_TOP) * kv).toFixed(1)}`).join(' '),
  )
}
