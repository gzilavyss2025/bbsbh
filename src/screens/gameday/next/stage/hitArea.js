// Clip padded targets at the midpoint between sprites, so an overlapping button never
// steals a neighboring player's center on a small field. Points are local to the target.
export function spriteHitArea(sprite, sprites, size, scale = 1) {
  const half = size / 2
  let polygon = [[0, 0], [size, 0], [size, size], [0, size]]
  for (const other of sprites) {
    if (other.key === sprite.key) continue
    const dx = (other.x - sprite.x) * scale, dy = (other.y - sprite.y) * scale
    if (!dx && !dy) continue
    const distance = (p) => (p[0] - half) * dx + (p[1] - half) * dy - (dx * dx + dy * dy) / 2
    const next = []
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b)
      if (da <= 0) next.push(a)
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db)
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    }
    polygon = next
  }
  return polygon
}
