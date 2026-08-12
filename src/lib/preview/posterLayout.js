// Where every block of the poster sits — pure arithmetic, no canvas, so the
// composition is unit-testable (test/poster-layout.test.js) instead of being
// discovered by looking at a PNG.
//
// THE SIZE IS CHOSEN FOR X. A single image posted to X renders uncropped in the
// timeline down to a 3:4 portrait; taller than that and the timeline crops it,
// so the fold lands somewhere the composition never planned for. 1200 × 1600 is
// that ratio at a resolution that stays crisp on a desktop timeline, and it is
// the tallest frame the whole poster is guaranteed to survive in. Companion
// plates (a post may carry four images) are the SAME frame — a set that changes
// shape halfway through reads as a mistake.
//
// HOW THE STACK WORKS. Each block declares a natural height. Blocks the user
// turned off are dropped, the survivors are stacked in fixed order, and
// whatever height is left over is shared out as extra gap between them — so a
// two-block poster breathes instead of leaving a third of the frame blank. The
// head block never stretches: it is a photograph, and letting it grow would
// change the crop rather than the spacing.
// THE VERTICAL BUDGET IS TIGHT, AND THAT IS THE DESIGN. All three blocks plus
// the head have to live inside 1600px, so the numbers below were solved
// together rather than picked one at a time: head 560 + footer 60 leaves 980,
// the three blocks take 895, and the remaining 85 is the four gaps. Change one
// and test/poster-layout.test.js fails on the one that no longer fits — which
// is the point of pinning it there rather than eyeballing a PNG.
export const POSTER = {
  width: 1200,
  height: 1600,
  margin: 56,
  // The head's photograph, full-bleed to the poster's edges. This is a FLOOR,
  // not a fixed height — see headStretch.
  headHeight: 560,
  // How much of the leftover room the head may take when blocks are switched
  // off. A poster with only the pitchers on it has ~700px spare, and spreading
  // all of that into gaps just makes a sheet of blank paper with a card
  // floating in it. The ballpark photograph is the one element that gets
  // BETTER with more room, so it absorbs the slack first and the rest of the
  // stack is then centred in what is left.
  headStretch: 340,
  // Smallest gap between two stacked blocks; anything spare is added to this.
  gap: 20,
  maxGap: 96,
  footerHeight: 60,
}

// Natural heights, in stack order. `arms` and `zone` are fixed; `cards` grows
// with the longer of the two batting orders so a poster with no lineups posted
// yet doesn't reserve nine empty rows.
export const BLOCK_HEIGHT = {
  arms: 252,
  cards: 407,
  zone: 236,
}

export const BLOCK_ORDER = ['arms', 'cards', 'zone']

// The batting-order grid: masthead, then the club heading and its rule, then
// the rows. LINEUP_CHROME is measured from drawCards' own offsets (46 masthead
// + 44 to the heading baseline + 24 to the first row), so the two cannot drift.
export const LINEUP_ROW = 31
const LINEUP_CHROME = 46 + 44 + 24

export function cardsHeight(rowCount) {
  const rows = Math.max(1, Math.min(9, rowCount || 0))
  return LINEUP_CHROME + rows * LINEUP_ROW + 14
}

// Stack the enabled blocks and hand back a y/height for each.
//
// `enabled` is a set-like of block keys; `heights` may override any natural
// height (the cards block passes its measured one). Returns
// `{ head, blocks: [{ key, y, height }], footerY, gap }`.
export function posterLayout(enabled, heights = {}) {
  const keys = BLOCK_ORDER.filter((k) => enabled?.has?.(k) ?? enabled?.[k])
  const natural = keys.map((k) => heights[k] ?? BLOCK_HEIGHT[k])
  const total = natural.reduce((a, b) => a + b, 0)

  const bottom = POSTER.height - POSTER.footerHeight
  const fullRoom = bottom - POSTER.headHeight
  const slots = keys.length + 1

  // 1. The head grows into whatever the stack doesn't need, up to headStretch.
  const slack = fullRoom - total - POSTER.gap * slots
  const stretch = Math.min(POSTER.headStretch, Math.max(0, slack))
  const headHeight = POSTER.headHeight + stretch

  // 2. The gap is then whatever still fits, clamped.
  const room = bottom - headHeight
  const gap = clamp((room - total) / Math.max(1, slots), POSTER.gap, POSTER.maxGap)

  // 3. The stack is CENTRED in what is left rather than hung from the top, so
  //    the space above the first block matches the space under the last one.
  const used = total + gap * Math.max(0, keys.length - 1)
  let y = headHeight + Math.max(0, (room - used) / 2)
  const blocks = keys.map((key, i) => {
    const height = natural[i]
    const placed = { key, y, height }
    y += height + gap
    return placed
  })

  return {
    head: { y: 0, height: headHeight, stretch },
    blocks,
    footerY: bottom,
    gap,
    // True when the enabled blocks simply don't fit — the caller warns rather
    // than painting them off the bottom edge.
    overflows: total + POSTER.gap * slots > fullRoom,
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// The poster's content column: full width minus the page margins.
export function contentBox() {
  return { x: POSTER.margin, width: POSTER.width - POSTER.margin * 2 }
}

// Two equal columns inside the content box, with a gutter — the shape both the
// Arms block and the Batting order block use, away left and home right.
export function columns(gutter = 32) {
  const { x, width } = contentBox()
  const colWidth = (width - gutter) / 2
  return [
    { x, width: colWidth },
    { x: x + colWidth + gutter, width: colWidth },
  ]
}
