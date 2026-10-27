// Shared decode + material recolour, cached outside React. No pixel work in the
// animation loop. Cream cloth and cool stadium highlights stay neutral; only
// the authored navy equipment and gold piping take the two kit colours.
const decoded = new Map()
const palettes = new Map()
export const STADIUM_URL = '/art/ballpark/night.png'
export const ATLAS_URL = '/art/ballpark/home-run.png'
export const HOME_RUN_ART = { url: ATLAS_URL, columns: 4, rows: 3, height: 420, centerX: 0.62, top: 12 }

function loadImage(url) {
  if (!decoded.has(url)) {
    const ready = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => { decoded.delete(url); reject(new Error(`Could not load celebration art: ${url}`)) }
      img.src = url
    })
    decoded.set(url, ready)
  }
  return decoded.get(url)
}

function rgb(css) {
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  g.canvas.width = g.canvas.height = 1
  g.fillStyle = css
  g.fillRect(0, 0, 1, 1)
  return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3)
}

export function prepareArt(helmet, trim, character = HOME_RUN_ART, backdrop = STADIUM_URL) {
  const key = `${JSON.stringify(character)}:${backdrop}:${helmet}:${trim}`
  if (palettes.has(key)) return palettes.get(key)
  const ready = Promise.all([loadImage(character.url), loadImage(backdrop)]).then(([source, stadium]) => {
    const atlas = document.createElement('canvas')
    atlas.width = source.naturalWidth
    atlas.height = source.naturalHeight
    const g = atlas.getContext('2d', { willReadFrequently: true })
    g.drawImage(source, 0, 0)
    const image = g.getImageData(0, 0, atlas.width, atlas.height)
    const kit = rgb(helmet), piping = rgb(trim), p = image.data
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 16) continue
      const r = p[i], gr = p[i + 1], b = p[i + 2]
      const equipment = b > r * 1.25 && b > gr * 1.04 && b < 155
      const gold = r > gr * 1.12 && gr > b * 1.35 && r > 85 && b < 115
      if (!equipment && !gold) continue
      const target = equipment ? kit : piping
      const light = equipment ? Math.max(r, gr, b) / 90 : Math.max(r, gr, b) / 195
      for (let c = 0; c < 3; c++) p[i + c] = Math.min(255, target[c] * Math.min(1, light) + Math.max(0, light - 1) * 105)
    }
    g.putImageData(image, 0, 0)
    return { atlas, stadium, character }
  }).catch((error) => { palettes.delete(key); throw error })
  palettes.set(key, ready)
  // A bounded palette cache: frame strips share these surfaces, not copies.
  if (palettes.size > 8) palettes.delete(palettes.keys().next().value)
  return ready
}
