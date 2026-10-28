import { batterPalette } from '../../zonemap/batterPalette.js'
import { prepareBatter } from '../../zonemap/batterArt.js'
import { materialFor } from '../../cutscene/ballpark/materials.js'

let source
const kits = new Map()
function runnerSource() {
  if (!source) source = new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => { source = null; reject(new Error('Could not load runner art')) }
    image.src = '/art/gameday/runners-ready.webp'
  })
  return source
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
function runnerKit(image, palette) {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
  const g = canvas.getContext('2d', { willReadFrequently: true })
  g.drawImage(image, 0, 0)
  const frame = g.getImageData(0, 0, canvas.width, canvas.height), p = frame.data
  const navy = rgb(palette.equipment), gold = rgb(palette.trim)
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 16) continue
    const [r, gr, b] = [p[i], p[i + 1], p[i + 2]], material = materialFor(r, gr, b)
    // The source's navy cloth and equipment share the club primary. Cream and skin stay neutral.
    const target = material === 'equipment' ? navy : material === 'trim' ? gold : null
    if (!target) continue
    const light = Math.max(r, gr, b) / (material === 'equipment' ? 90 : 195)
    for (let c = 0; c < 3; c++) p[i + c] = Math.min(255, target[c] * Math.min(1, light) + Math.max(0, light - 1) * 105)
  }
  g.putImageData(frame, 0, 0)
  return canvas
}

// One decode per source and one preparation per club palette, never during a frame.
export function preparePlayers(teamId) {
  const palette = batterPalette(teamId), key = JSON.stringify(palette)
  if (kits.has(key)) return kits.get(key)
  const ready = Promise.all([prepareBatter(palette), runnerSource()])
    .then(([batter, runner]) => ({ batter, runner: runnerKit(runner, palette) }))
    .catch((error) => { kits.delete(key); throw error })
  kits.set(key, ready)
  if (kits.size > 8) kits.delete(kits.keys().next().value)
  return ready
}

export function paintPlayers(g, sprites, art, width, side) {
  const height = Math.round(Math.max(28, Math.min(40, width * .25)))
  for (const player of sprites) {
    const isBatter = player.key === 'batter', atlas = isBatter ? art.batter : art.runner
    const frameWidth = atlas.width / (isBatter ? 2 : 3)
    const pose = isBatter ? (side === 'L' ? 1 : 0) : player.pose
    const w = frameWidth / atlas.height * height
    g.save()
    g.imageSmoothingEnabled = true
    g.translate(player.x, player.feet)
    if (!isBatter && player.flip) g.scale(-1, 1)
    g.drawImage(atlas, pose * frameWidth, 0, frameWidth, atlas.height, -w / 2, -height, w, height)
    g.restore()
    player.y = player.feet - height / 2
  }
}
