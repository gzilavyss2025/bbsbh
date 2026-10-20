// d3-geo's geoAlbersUsa().scale(1300).translate([487.5, 305]) without d3-geo (#1526, SPEC
// §9.4). That is the projection of the us-atlas "albers" files, so a point projected here
// lands on the map drawn by gen-where-from-map.mjs. The nightly run has no `npm install`
// step, so it cannot import d3-geo; test/from-project.test.js checks this port against
// d3-geo (a devDependency) on a grid of points.
//
// Three conic equal-area projections share one 975 x 610 canvas: the lower 48, and Alaska
// and Hawaii as insets. A point belongs to the first one whose clip box it lands in.
const RAD = Math.PI / 180
const EPS = 1e-6
const K = 1300
const X = 487.5
const Y = 305

function conic({ parallels: [p0, p1], rotate, center: [cLon, cLat], scale, translate: [tx, ty], extent }) {
  const sy0 = Math.sin(p0 * RAD)
  const n = (sy0 + Math.sin(p1 * RAD)) / 2
  const c = 1 + sy0 * (2 * n - sy0)
  const r0 = Math.sqrt(c) / n
  const raw = (lon, lat) => {
    const r = Math.sqrt(c - 2 * n * Math.sin(lat)) / n
    return [r * Math.sin(lon * n), r0 - r * Math.cos(lon * n)]
  }
  const [cx, cy] = raw(cLon * RAD, cLat * RAD)
  return (lon, lat) => {
    let l = lon * RAD + rotate * RAD
    if (l > Math.PI) l -= 2 * Math.PI
    else if (l < -Math.PI) l += 2 * Math.PI
    const [px, py] = raw(l, lat * RAD)
    const x = tx - scale * cx + scale * px
    const y = ty + scale * cy - scale * py
    const [[x0, y0], [x1, y1]] = extent
    return x >= x0 && x <= x1 && y >= y0 && y <= y1 ? [x, y] : null
  }
}

const lower48 = conic({
  parallels: [29.5, 45.5], rotate: 96, center: [-0.6, 38.7], scale: K, translate: [X, Y],
  extent: [[X - 0.455 * K, Y - 0.238 * K], [X + 0.455 * K, Y + 0.238 * K]],
})
const alaska = conic({
  parallels: [55, 65], rotate: 154, center: [-2, 58.5], scale: K * 0.35, translate: [X - 0.307 * K, Y + 0.201 * K],
  extent: [[X - 0.425 * K + EPS, Y + 0.12 * K + EPS], [X - 0.214 * K - EPS, Y + 0.234 * K - EPS]],
})
const hawaii = conic({
  parallels: [8, 18], rotate: 157, center: [-3, 19.9], scale: K, translate: [X - 0.205 * K, Y + 0.212 * K],
  extent: [[X - 0.214 * K + EPS, Y + 0.166 * K + EPS], [X - 0.115 * K - EPS, Y + 0.234 * K - EPS]],
})

// (lon, lat) -> [x, y] on the 975 x 610 map, rounded to a tenth of a pixel; null when the
// point is on none of the three.
export function albersUsa(lon, lat) {
  const p = lower48(lon, lat) ?? alaska(lon, lat) ?? hawaii(lon, lat)
  return p ? [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] : null
}
