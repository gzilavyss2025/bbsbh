// The chrome every block on the poster is drawn inside — one card shape, one
// masthead, one "nothing here yet" line.
//
// Pulled out of posterBlocks.js when that file passed the 600-line cap
// (ADR-0038) and the umpire card moved to its own module: both files draw
// cards, and a second copy of this is exactly the drift the split exists to
// prevent.
import { FONT } from './posterPaper.js'
import { caps, masthead, panel, track } from './posterInk.js'

// Every card's inner gutter. The complaint this fixes is real and worth
// stating: content flush to a card's left border reads as a layout bug, and on
// the away half it was the poster's own outer edge.
export const PAD = 18

// A card: hairline panel on card paper, its masthead across the top. `bar` is
// posterArt's barFor — a club's own colours and knockout, or null for the
// default navy chrome. Returns the y the masthead ends at, which is what every
// caller measures its own content from.
export function openCard(ctx, box, { title, aside = '', bar = null, palette }) {
  panel(ctx, box.x, box.y, box.width, box.height, {
    radius: 12,
    fill: palette.card,
    stroke: palette.border,
    thickness: 1.5,
  })
  ctx.save()
  panel(ctx, box.x, box.y, box.width, box.height, { radius: 12 })
  ctx.clip()
  const barBottom = masthead(ctx, box.x, box.y, box.width, {
    title,
    aside,
    palette,
    theme: bar?.theme ?? null,
    mark: bar?.mark ?? null,
    reinkMark: bar?.reink !== false,
  })
  ctx.restore()
  return barBottom
}

export function notPosted(ctx, x, y, width, palette, text) {
  track(ctx, caps(text), x + width / 2, y, {
    font: FONT.display(22),
    fill: palette.caption,
    spacing: 2,
    align: 'center',
    maxWidth: width - 24,
  })
}
