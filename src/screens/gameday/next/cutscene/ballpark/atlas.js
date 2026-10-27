// Isolate the connected character in every atlas cell before material mapping.
export function isolateFrames(image, columns, rows) {
  const { width, height, data } = image
  const w = width / columns, h = height / rows
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) throw new Error('Atlas must divide into whole cells')
  const size = w * h, labels = new Uint32Array(size), queue = new Uint32Array(size)
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    labels.fill(0)
    const alphaAt = (i) => (((row * h + Math.floor(i / w)) * width + col * w + i % w) * 4 + 3)
    let label = 0, largest = 0, best = 0
    for (let seed = 0; seed < size; seed++) {
      if (labels[seed] || data[alphaAt(seed)] < 32) continue
      label++
      let head = 0, tail = 1
      queue[0] = seed; labels[seed] = label
      while (head < tail) {
        const cell = queue[head++], x = cell % w, y = Math.floor(cell / w)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const next = ny * w + nx
          if (!labels[next] && data[alphaAt(next)] >= 32) {
            labels[next] = label; queue[tail++] = next
          }
        }
      }
      if (tail > largest) { largest = tail; best = label }
    }
    for (let i = 0; i < size; i++) if (!best || labels[i] !== best) data[alphaAt(i)] = 0
  }
  return image
}
