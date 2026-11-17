// Wild Rides' drawing constants and small formatters, shared by the page, the ride and the field.
export const W = 600
export const H = 260
// Room around the plot so a swing on the first or last play (a walk-off), its dot and number, never clips.
export const PX = 16
export const PY = 26

export const pathOf = (line, w, h, n = line.length) =>
  line
    .slice(0, n)
    .map((y, k) => `${k ? 'L' : 'M'}${((k * w) / (line.length - 1)).toFixed(1)},${((1 - y / 100) * h).toFixed(1)}`)
    .join('')
export const monthDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
// 2026-08-06 -> 8/6/26
export const shortDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${+m}/${+d}/${y.slice(2)}`
}
