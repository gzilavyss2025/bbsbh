// The umpire card — components/umpire/UmpireTendencies.jsx, painted into half
// the poster's width.
//
// Split out of posterBlocks.js when that file passed the 600-line cap
// (ADR-0038): this is one self-contained card with five parts of its own (the
// lean scale, the zone map, the watch band, the tiles, the identity), and it
// shares nothing with the pitcher/batting-order cards but their chrome.
import { LEAN_TIERS, LEAN_TIER_LABELS, leanCaretFraction } from '../statTiers.js'
import { FONT } from './posterPaper.js'
import { caps, line, panel, rect, rule, track } from './posterInk.js'
import { openCard, notPosted, PAD } from './posterCard.js'

// The card from components/umpire/UmpireTendencies.jsx, painted into HALF the
// poster's width — the same bands in the same order (identity, area to watch,
// zone lean, tiles), folded so the row it used to own whole can carry a second
// card beside it.
//
// The register is LABELS AND NUMBERS, which is that card's own rule: no
// sentences, nothing that needs explaining. Every figure is a season aggregate
// over FINAL games of ball/strike judgments — never a run, hit, or result.
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
  const rowH = 18
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

// The 3x3 grid. A cell is OUTLINED in clay where this umpire's misses cluster
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

// A solid navy panel: the card's one concrete "where" earns its second ink
// anchor. Text only — the zone map moved up beside the identity, where the
// card had empty width going spare, so the phrase gets the whole band instead
// of competing with a grid for it.
function drawWatchBand(ctx, x, y, width, height, plate, palette) {
  rect(ctx, x, y, width, height, palette.navy)
  const bodyWidth = width - 26
  track(ctx, caps('Area to watch'), x + 13, y + 20, {
    font: FONT.display(15),
    fill: palette.rule,
    spacing: 1.6,
    maxWidth: bodyWidth,
  })
  const hand = plate.watch?.hand ? ` to ${HAND_WORD[plate.watch.hand]}` : ''
  const text = plate.watch?.phrase ? `${plate.watch.phrase}${hand}` : 'No clear tendency'
  track(ctx, caps(text), x + 13, y + 44, {
    font: FONT.display(22),
    fill: plate.watch?.phrase ? palette.onInk : palette.rule,
    spacing: 0.8,
    maxWidth: bodyWidth,
  })
}

// Ruled 2x2, label over figure — the card's own arrangement. Four across would
// squeeze every label below anything in the type scale.
function drawTiles(ctx, x, y, width, tiles, palette) {
  const colW = width / 2
  const rowH = 52
  tiles.forEach((t, i) => {
    const tx = x + (i % 2) * colW
    const ty = y + Math.floor(i / 2) * rowH
    rule(ctx, tx, ty, colW, { fill: palette.hairline })
    if (i % 2 === 0) {
      ctx.fillStyle = palette.hairline
      ctx.fillRect(tx + colW - 1, ty, 1, rowH)
    }
    track(ctx, caps(t.label), tx + colW / 2, ty + 20, {
      font: FONT.display(14),
      fill: palette.caption,
      spacing: 1.3,
      align: 'center',
      maxWidth: colW - 8,
    })
    ctx.font = FONT.mono(23)
    const valueWidth = ctx.measureText(String(t.value)).width
    let supWidth = 0
    if (t.sup) {
      ctx.font = FONT.mono(13)
      supWidth = ctx.measureText(t.sup).width
    }
    const startX = tx + colW / 2 - (valueWidth + supWidth) / 2
    line(ctx, String(t.value), startX, ty + 46, { font: FONT.mono(23), fill: palette.heading })
    if (t.sup) line(ctx, t.sup, startX + valueWidth + 2, ty + 46, { font: FONT.mono(13), fill: palette.caption })
  })
}

// Half the poster's width — `box` is already the narrowed card.
export function drawUmpireCard(ctx, box, model, palette) {
  const plate = model.plate
  const barBottom = openCard(ctx, box, {
    title: 'Umpire tendencies',
    aside: plate?.year ? String(plate.year) : '',
    palette,
  })
  const top = barBottom + 12
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
  ctx.moveTo(inner.x + 3 * s, top + 4 * s)
  ctx.lineTo(inner.x + 17 * s, top + 4 * s)
  ctx.lineTo(inner.x + 17 * s, top + 11 * s)
  ctx.lineTo(inner.x + 10 * s, top + 17 * s)
  ctx.lineTo(inner.x + 3 * s, top + 11 * s)
  ctx.closePath()
  ctx.fill()

  // The 3x3 grid rides the identity row's spare width rather than the navy
  // band's, which it used to share with the phrase.
  if (plate.zoneCells) {
    const mapW = 54
    const mapH = 58
    const plateX = inner.x + inner.width - mapW - 8
    rect(ctx, plateX - 4, top - 2, mapW + 8, mapH + 8, palette.inset)
    drawZoneMap(ctx, plateX, top + 2, mapW, mapH, plate.zoneCells, palette)
  }

  const [first, ...rest] = (plate.name || '').split(' ')
  const last = rest.join(' ')
  const whoX = inner.x + plateSize + 10
  const whoWidth = inner.width - (whoX - inner.x) - (plate.zoneCells ? 74 : 0)
  if (last) {
    track(ctx, caps(first), whoX, top + 12, {
      font: FONT.display(15),
      fill: palette.caption,
      spacing: 1.6,
      maxWidth: whoWidth,
    })
  }
  track(ctx, caps(last || first), whoX, top + 38, {
    font: FONT.display(30),
    fill: palette.heading,
    spacing: 1.2,
    maxWidth: whoWidth,
  })

  if (plate.accuracy == null) {
    notPosted(ctx, box.x, top + 88, box.width, palette, 'No scored games on file')
    return
  }

  const games = plate.gameCount
  const sub = [
    `${games} ${games === 1 ? 'game' : 'games'}`,
    plate.plateCount > 0 ? `${plate.plateCount} behind the plate` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  line(ctx, sub, whoX, top + 56, { font: FONT.mono(13), fill: palette.caption, maxWidth: whoWidth })

  drawWatchBand(ctx, box.x + 1, top + 66, box.width - 2, 56, plate, palette)

  // Two sub-columns under the band: the five-band scale on the left, the
  // quotable numbers on the right — the same pairing the card makes, at half
  // the width.
  const leanW = 208
  const tilesX = inner.x + leanW + 16
  if (plate.lean) drawLeanScale(ctx, inner.x, top + 136, leanW, plate.lean, palette)
  drawTiles(ctx, tilesX, top + 130, inner.x + inner.width - tilesX, umpireTiles(plate), palette)
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
