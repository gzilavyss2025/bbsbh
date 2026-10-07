// The lab's "Trim and clear background" step for dropped era art. Pure pixel
// math on RGBA bytes, so the browser's canvas only supplies and takes back the
// pixels (screens/identity-lab/editors/EraRow.jsx) and the unit suite can run
// it in plain Node.
//
// Two things, in order:
//   1. CLEAR. A raster logo usually arrives on white. Near-white pixels
//      connected to the image's EDGE become transparent, found by flood fill, so
//      white INSIDE the mark (a ring's centre, a letter's counter) stays opaque.
//      A picture that already has transparent edge pixels is left alone.
//   2. TRIM. Crop to the box around what is left, plus a small transparent
//      margin so a tile's scale math has room.
//
// Returns { data, width, height }, or null when nothing but background is left.

const ALPHA_VISIBLE = 8

function isNearWhite(data, i, tolerance) {
  const floor = 255 - tolerance
  return data[i + 3] > 0 && data[i] >= floor && data[i + 1] >= floor && data[i + 2] >= floor
}

function clearEdgeWhite(data, width, height, tolerance) {
  const seen = new Uint8Array(width * height)
  const stack = []
  const push = (x, y) => {
    const at = y * width + x
    if (seen[at] || !isNearWhite(data, at * 4, tolerance)) return
    seen[at] = 1
    stack.push(at)
  }
  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }
  while (stack.length) {
    const at = stack.pop()
    data[at * 4 + 3] = 0
    const x = at % width
    const y = (at - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }
}

function hasTransparentEdge(data, width, height) {
  for (let x = 0; x < width; x++) {
    if (data[x * 4 + 3] < 255 || data[((height - 1) * width + x) * 4 + 3] < 255) return true
  }
  for (let y = 0; y < height; y++) {
    if (data[y * width * 4 + 3] < 255 || data[(y * width + width - 1) * 4 + 3] < 255) return true
  }
  return false
}

export function trimAndClear(image, { padding = 2, tolerance = 24 } = {}) {
  const { width, height } = image
  const data = new Uint8ClampedArray(image.data)
  if (!hasTransparentEdge(data, width, height)) clearEdgeWhite(data, width, height, tolerance)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_VISIBLE) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null

  const outW = maxX - minX + 1 + padding * 2
  const outH = maxY - minY + 1 + padding * 2
  const out = new Uint8ClampedArray(outW * outH * 4)
  for (let y = minY; y <= maxY; y++) {
    const from = (y * width + minX) * 4
    out.set(data.subarray(from, from + (maxX - minX + 1) * 4), ((y - minY + padding) * outW + padding) * 4)
  }
  return { data: out, width: outW, height: outH }
}
