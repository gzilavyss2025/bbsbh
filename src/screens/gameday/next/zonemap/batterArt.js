import { isolateFrames } from '../cutscene/ballpark/atlas.js'
import { recolorBatter } from './batterPalette.js'

const BATTER_ART = '/art/gameday/batter-ready.webp'
let source
const palettes = new Map()
function sourceImage() {
  if (!source) source = new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => { source = null; reject(new Error('Could not load batter art')) }
    image.src = BATTER_ART
  })
  return source
}

// Decode once and recolor once per material palette, never during a field frame.
export function prepareBatter(palette) {
  const key = JSON.stringify(palette)
  if (palettes.has(key)) return palettes.get(key)
  const ready = sourceImage().then((source) => {
    const atlas = document.createElement('canvas')
    atlas.width = source.naturalWidth; atlas.height = source.naturalHeight
    const g = atlas.getContext('2d', { willReadFrequently: true })
    g.drawImage(source, 0, 0)
    const image = isolateFrames(g.getImageData(0, 0, atlas.width, atlas.height), 2, 1)
    g.putImageData(recolorBatter(image, palette), 0, 0)
    return atlas
  }).catch((error) => { palettes.delete(key); throw error })
  palettes.set(key, ready)
  if (palettes.size > 8) palettes.delete(palettes.keys().next().value)
  return ready
}
