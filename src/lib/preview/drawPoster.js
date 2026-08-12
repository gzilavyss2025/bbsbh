// Paint one game-preview poster onto a canvas.
//
// This is the single entry point: the screen hands it a model
// (api/gamePreview.js), the art it has loaded, and which blocks are on; it
// returns nothing and touches nothing else. Keeping the whole paint in one
// synchronous pass matters for the export — toBlob() must run against a
// FINISHED canvas, and an await between two draw calls is how you end up
// saving a half-painted poster.
//
// The canvas is sized in CSS pixels at POSTER.width × POSTER.height and the
// element is then scaled DOWN by CSS to fit the page. It is not scaled by
// devicePixelRatio: the export is a fixed-size PNG for X (1200 × 1600), not a
// screen surface, so its pixel dimensions are part of the deliverable rather
// than a function of whose monitor painted it.
import { drawArms, drawCards, drawFooter, drawUmpireRow } from './posterBlocks.js'
import { drawHead } from './posterHead.js'
import { contentBox, POSTER, posterLayout } from './posterLayout.js'
import { posterPalette } from './posterPaper.js'
import { grid, rect } from './posterInk.js'

const PAINTERS = {
  arms: drawArms,
  cards: drawCards,
  zone: drawUmpireRow,
}

export function drawPoster(canvas, model, art = {}, options = {}) {
  if (!canvas || !model) return
  const { enabled = new Set(['arms', 'cards', 'zone']), heights = {} } = options
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = POSTER.width
  canvas.height = POSTER.height
  const palette = posterPalette()

  // The sheet itself, then a graph-paper grid under everything — the scorebook
  // page the whole app is printed on. Drawn before the head, which paints its
  // photograph over the top of it.
  rect(ctx, 0, 0, POSTER.width, POSTER.height, palette.canvas)
  grid(ctx, 0, POSTER.height, palette)

  // The layout is solved BEFORE the head is painted: how tall the head gets
  // depends on how many blocks are switched on (POSTER.headStretch).
  const layout = posterLayout(enabled, heights)
  drawHead(ctx, model, art, palette, layout.head)

  const { x, width } = contentBox()
  for (const block of layout.blocks) {
    const painter = PAINTERS[block.key]
    if (painter) painter(ctx, { x, y: block.y, width, height: block.height }, model, art, palette)
  }

  drawFooter(ctx, layout.footerY, model, palette)
}

// The finished canvas as a PNG File, ready for navigator.share() or an object
// URL. Rejects — rather than resolving null — when the canvas is tainted, so
// the caller can say so instead of showing a Save button that does nothing.
export function posterFile(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('poster: canvas produced no blob'))
          return
        }
        resolve(new File([blob], filename, { type: 'image/png' }))
      }, 'image/png')
    } catch (err) {
      // SecurityError: something CORS-less got drawn. posterImages.js exists to
      // make this unreachable; if it fires, an image source was added that
      // bypassed it.
      reject(err)
    }
  })
}
