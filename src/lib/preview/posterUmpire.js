// The umpire card — half the poster's width, and the one block a design pass
// took apart rather than tuned.
//
// It is UmpireTendencies.jsx band for band — identity, the navy "area to
// watch" strip, the five-row zone-lean scale, the 2×2 tiles, the ABS
// challenge figures — at half width.
//
// ONE THING CHANGED, AND ONE THING DELIBERATELY DID NOT. A design critique
// found the 3×3 zone grid sitting in the identity row's spare corner while the
// sentence that reads it ("up and inside to left-handers") sat in a navy band
// two rows below: an illustration and its caption that never touched. The grid
// now lives INSIDE that band, at its left end, which is plainly right.
//
// The same critique wanted the five-band lean scale and the tiles cut, reading
// the boxed rows as radio buttons. They stay. The scale is the one place on the
// whole poster that draws a CONTINUUM instead of printing a number, and it is
// the most distinctive thing on the sheet — the card's height was raised to
// hold it rather than the scale trimmed to fit the card.
//
// Every figure is a season aggregate over FINAL games of ball/strike judgments
// — never a run, hit, or result.
import { FONT } from './posterPaper.js'
import { LEAN_TIERS, LEAN_TIER_LABELS, leanCaretFraction } from '../statTiers.js'
import { caps, line, panel, rect, rule, track } from './posterInk.js'
import { notPosted, openCard, PAD } from './posterCard.js'

const HAND_WORD = { L: 'left-handers', R: 'right-handers' }

// The five-band scale, poles first, with the umpire's own band boxed and the
// caret dropped at his true position inside it. The ramp runs navy (pitcher) to
// kraft amber (hitter) — deliberately NOT the green/clay pair, which means
// good/bad, and neither end of this scale is good or bad.
function drawLeanScale(ctx, x, y, width, lean, palette) {
  track(ctx, caps('Zone lean'), x, y, {
    font: FONT.display(15),
    fill: palette.caption,
    spacing: 1.6,
  })
  const rowH = 17
  const top = y + 10
  const height = rowH * LEAN_TIERS.length
  const rampW = 10

  const ramp = ctx.createLinearGradient(0, top, 0, top + height)
  ramp.addColorStop(0, palette.navy)
  ramp.addColorStop(0.16, palette.navy)
  ramp.addColorStop(0.46, palette.rule)
  ramp.addColorStop(0.72, palette.seal)
  ramp.addColorStop(0.92, palette.marker)
  ramp.addColorStop(1, palette.marker)
  ctx.fillStyle = ramp
  ctx.fillRect(x, top, rampW, height)
  panel(ctx, x, top, rampW, height, { radius: 2, stroke: palette.border, thickness: 1 })

  // The caret sits CLEAR of the ramp, not on it: an ink caret over the navy
  // pole would be invisible.
  const caretY = top + leanCaretFraction(lean.z) * height
  ctx.fillStyle = palette.heading
  ctx.beginPath()
  ctx.moveTo(x + rampW + 5, caretY - 4.5)
  ctx.lineTo(x + rampW + 11, caretY)
  ctx.lineTo(x + rampW + 5, caretY + 4.5)
  ctx.closePath()
  ctx.fill()

  const labelX = x + rampW + 17
  LEAN_TIERS.forEach((tier, i) => {
    const rowY = top + i * rowH
    const on = tier === lean.tier
    if (on) {
      // Two encodings, not one — a paper chip AND an ink keyline, so the band
      // survives greyscale and colour-vision deficiency without leaning on the
      // ramp beside it.
      panel(ctx, labelX - 5, rowY + 1, width - (labelX - x) + 5, rowH - 2, {
        radius: 3,
        fill: palette.inset,
        stroke: palette.heading,
        thickness: 1.5,
      })
    } else if (i > 0) {
      rule(ctx, labelX - 5, rowY, width - (labelX - x) + 5, { fill: palette.ruleGrid })
    }
    track(ctx, caps(LEAN_TIER_LABELS[tier]), labelX, rowY + rowH / 2 + 4, {
      font: FONT.display(14),
      fill: on ? palette.heading : palette.caption,
      spacing: 1.2,
      maxWidth: width - (labelX - x) - 6,
    })
  })
}

// Ruled 2×2, label over figure — the card's own arrangement. Four across would
// squeeze every label below anything in the type scale.
function drawTiles(ctx, x, y, width, tiles, palette) {
  const colW = width / 2
  const rowH = 46
  tiles.forEach((t, i) => {
    const tx = x + (i % 2) * colW
    const ty = y + Math.floor(i / 2) * rowH
    rule(ctx, tx, ty, colW, { fill: palette.hairline })
    if (i % 2 === 0) {
      ctx.fillStyle = palette.hairline
      ctx.fillRect(tx + colW - 1, ty, 1, rowH)
    }
    track(ctx, caps(t.label), tx + colW / 2, ty + 18, {
      font: FONT.display(13),
      fill: palette.caption,
      spacing: 1.3,
      align: 'center',
      maxWidth: colW - 8,
    })
    ctx.font = FONT.mono(21)
    const valueWidth = ctx.measureText(String(t.value)).width
    let supWidth = 0
    if (t.sup) {
      ctx.font = FONT.mono(12)
      supWidth = ctx.measureText(t.sup).width
    }
    const startX = tx + colW / 2 - (valueWidth + supWidth) / 2
    line(ctx, String(t.value), startX, ty + 41, { font: FONT.mono(21), fill: palette.heading })
    if (t.sup) {
      line(ctx, t.sup, startX + valueWidth + 2, ty + 41, { font: FONT.mono(12), fill: palette.caption })
    }
  })
}

// The 3×3 grid. A cell is OUTLINED in clay where this umpire's misses cluster
// above the league's for that cell, heavier the further above — the rest is
// reference lines. It does not shade all nine; `over` is a miss share, not a
// strike-call rate, and shading it as if it were says something untrue.
const OVER_FLOOR = 0.02
const OVER_FULL = 0.1

function drawZoneMap(ctx, x, y, w, h, cells, palette) {
  const cw = w / 3
  const ch = h / 3
  for (let i = 0; i < 9; i += 1) {
    const cell = cells?.[i]
    if (!cell || cell.over <= OVER_FLOOR) continue
    const weight = Math.min(1, (cell.over - OVER_FLOOR) / (OVER_FULL - OVER_FLOOR))
    ctx.strokeStyle = palette.negative
    ctx.lineWidth = 1.5 + weight * 2
    const cx = x + (i % 3) * cw
    const cy = y + Math.floor(i / 3) * ch
    ctx.strokeRect(cx + 2, cy + 2, cw - 4, ch - 4)
  }
  ctx.strokeStyle = palette.hairline
  ctx.lineWidth = 1
  for (let i = 1; i < 3; i += 1) {
    ctx.beginPath()
    ctx.moveTo(x + i * cw, y)
    ctx.lineTo(x + i * cw, y + h)
    ctx.moveTo(x, y + i * ch)
    ctx.lineTo(x + w, y + i * ch)
    ctx.stroke()
  }
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1.5
  ctx.strokeRect(x, y, w, h)
}

// The card's one ink anchor: a solid navy band carrying the grid at its left
// end and the phrase that reads it immediately to the right. The map gets a
// paper plate behind it or the navy swallows every low-contrast line in it.
function drawWatchBand(ctx, x, y, width, height, plate, palette) {
  rect(ctx, x, y, width, height, palette.navy)
  let bodyX = x + 14
  if (plate.zoneCells) {
    const map = height - 22
    rect(ctx, x + 12, y + 11, map + 8, map + 8, palette.inset)
    drawZoneMap(ctx, x + 16, y + 15, map, map, plate.zoneCells, palette)
    bodyX = x + 12 + map + 24
  }
  const bodyWidth = x + width - 14 - bodyX
  track(ctx, caps('Area to watch'), bodyX, y + 24, {
    font: FONT.display(15),
    fill: palette.rule,
    spacing: 1.6,
    maxWidth: bodyWidth,
  })
  const hand = plate.watch?.hand ? ` to ${HAND_WORD[plate.watch.hand]}` : ''
  const text = plate.watch?.phrase ? `${plate.watch.phrase}${hand}` : 'No clear tendency'
  track(ctx, caps(text), bodyX, y + 50, {
    font: FONT.display(23),
    fill: plate.watch?.phrase ? palette.onInk : palette.rule,
    spacing: 0.8,
    maxWidth: bodyWidth,
  })
}

// The card's ABS band, compressed to one ruled line: label left, the umpire's
// pair and the league baseline right — the same three figures the real card
// spends a sub-table and a footnote on, which the poster has no room for.
// Challenge counts are ball/strike JUDGMENT challenges and their outcomes,
// never a run or result. Skipped entirely on a row set swept before the
// challenge schema shipped, same as the card.
function drawChallengeLine(ctx, x, y, width, plate, palette) {
  if (plate.challenges?.perGame == null) return
  rule(ctx, x, y, width, { fill: palette.hairline })
  track(ctx, caps('ABS challenges'), x, y + 17, {
    font: FONT.display(13),
    fill: palette.caption,
    spacing: 1.3,
  })
  const parts = [`${plate.challenges.perGame.toFixed(1)}/GM`]
  if (plate.challenges.overturnRate != null) parts.push(`${pct(plate.challenges.overturnRate)} OVERTURNED`)
  if (plate.leagueChallenges?.overturnRate != null) parts.push(`LG ${pct(plate.leagueChallenges.overturnRate)}`)
  line(ctx, parts.join(' · '), x + width, y + 17, {
    font: FONT.mono(14),
    fill: palette.heading,
    align: 'right',
    maxWidth: width - 150,
  })
}

export function drawUmpireCard(ctx, box, model, palette) {
  const plate = model.plate
  const barBottom = openCard(ctx, box, {
    title: 'Umpire tendencies',
    aside: plate?.year ? String(plate.year) : '',
    palette,
  })
  const top = barBottom + 14
  const inner = { x: box.x + PAD, width: box.width - PAD * 2 }

  if (!plate) {
    notPosted(ctx, box.x, top + 70, box.width, palette, 'Crew not posted yet')
    return
  }

  // Identity: the home-plate mark means "this man was behind the plate", which
  // is what the band is about — deliberately not a league crest.
  const plateSize = 28
  const s = plateSize / 20
  ctx.fillStyle = palette.navy
  ctx.beginPath()
  ctx.moveTo(inner.x + 3 * s, top + 2 * s)
  ctx.lineTo(inner.x + 17 * s, top + 2 * s)
  ctx.lineTo(inner.x + 17 * s, top + 9 * s)
  ctx.lineTo(inner.x + 10 * s, top + 15 * s)
  ctx.lineTo(inner.x + 3 * s, top + 9 * s)
  ctx.closePath()
  ctx.fill()

  const [first, ...rest] = (plate.name || '').split(' ')
  const last = rest.join(' ')
  const whoX = inner.x + plateSize + 10
  const whoWidth = inner.width - (whoX - inner.x)
  if (last) {
    track(ctx, caps(first), whoX, top + 10, {
      font: FONT.display(15),
      fill: palette.caption,
      spacing: 1.6,
      maxWidth: whoWidth,
    })
  }
  track(ctx, caps(last || first), whoX, top + 38, {
    font: FONT.display(31),
    fill: palette.heading,
    spacing: 1.2,
    maxWidth: whoWidth,
  })

  if (plate.accuracy == null) {
    notPosted(ctx, box.x, top + 88, box.width, palette, 'No scored games on file')
    return
  }

  const games = plate.gameCount
  line(
    ctx,
    [
      `${games} ${games === 1 ? 'game' : 'games'}`,
      plate.plateCount > 0 ? `${plate.plateCount} behind the plate` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    whoX,
    top + 56,
    { font: FONT.mono(13), fill: palette.caption, maxWidth: whoWidth },
  )

  // The band and the lean/tiles pairing sit a few px higher than they once
  // did, and the band lost 6px of height: the room this buys at the foot is
  // where the ABS challenge line lives, inside the same fixed block height.
  drawWatchBand(ctx, box.x + 1, top + 64, box.width - 2, 68, plate, palette)

  // The scale on the left, the quotable numbers on the right — the pairing the
  // real card makes, at half its width.
  const leanW = 208
  const tilesX = inner.x + leanW + 16
  if (plate.lean) drawLeanScale(ctx, inner.x, top + 148, leanW, plate.lean, palette)
  drawTiles(ctx, tilesX, top + 142, inner.x + inner.width - tilesX, umpireTiles(plate), palette)

  drawChallengeLine(ctx, inner.x, top + 246, inner.width, plate, palette)
}

function umpireTiles(plate) {
  return [
    { label: 'Accuracy', value: pct(plate.accuracy) },
    plate.rank
      ? { label: 'Rank', value: plate.rank.rank, sup: `/${plate.rank.total}` }
      : { label: 'Called', value: plate.called?.toLocaleString() ?? '—' },
    { label: 'Consistency', value: pct(plate.consistency) },
    { label: 'Run impact/gm', value: runs(plate.favorPerGame) },
  ]
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const runs = (v) => (v == null ? '—' : v.toFixed(1))
