// The poster's three body blocks, each modelled on the pre-game surface it
// comes from rather than invented here.
//
//   STARTING PITCHERS — two cards, one per club, each wearing that club's own
//                       bar and knockout mark. The single most useful thing on
//                       a pre-game screen, which is why TeamInfo leads with it.
//   BATTING ORDER     — two cards again: order, face, full name, position, and
//                       the broadcast stat line.
//   UMPIRE & RECORDS  — the UmpireTendencies card (posterUmpire.js) beside the
//                       situational records both clubs carry into tonight.
//
// TWO CARDS, NOT ONE CARD WITH TWO COLUMNS. A club-coloured bar is only
// legitimate on a surface that IDENTIFIES that club (ADR-0030), and a single
// card holding both clubs identifies neither — there is nowhere honest to put
// the colour. Splitting them is what earns each half its own bar and mark, and
// it also gives each club's content its own padded box instead of one of them
// starting hard against the outer border.
//
// Every block degrades the way the rest of the app does: no lineup posted, no
// probable named, a MiLB umpire the nightly accuracy sweep never reaches — each
// draws its own line rather than an empty grid or a crash.
import { FONT } from './posterPaper.js'
import { caps, clip, contain, line, panel, rect, rule, track } from './posterInk.js'
import { lineupShotKey } from './posterArt.js'
import { notPosted, openCard, PAD } from './posterCard.js'
import { drawUmpireCard } from './posterUmpire.js'
import { columns, contentBox, LINEUP_ROW } from './posterLayout.js'

// ─────────────────────────────────────────────────────── starting pitchers ──
function drawStarterCard(ctx, box, starter, shot, bar, palette) {
  // No club abbreviation beside the mark: the knockout already says whose card
  // this is, and printing "MIL" next to the Brewers' own logo is the same fact
  // twice — the naming rule the rest of the app keeps.
  const barBottom = openCard(ctx, box, { title: 'Starting pitcher', bar, palette })
  const top = barBottom + 16
  const left = box.x + PAD

  if (!starter) {
    notPosted(ctx, box.x, top + 62, box.width, palette, 'Not announced')
    return
  }

  const shotSize = 88
  if (shot) {
    ctx.save()
    panel(ctx, left, top, shotSize, shotSize, { radius: 48, fill: palette.inset })
    ctx.clip()
    contain(ctx, shot, left, top, shotSize, shotSize, { scale: 1.06 })
    ctx.restore()
    panel(ctx, left, top, shotSize, shotSize, { radius: 48, stroke: palette.border, thickness: 1.5 })
  }
  const textX = left + shotSize + 16
  const textWidth = box.x + box.width - PAD - textX

  track(ctx, caps(starter.name), textX, top + 28, {
    font: FONT.display(29),
    fill: palette.heading,
    spacing: 1,
    maxWidth: textWidth,
  })
  const badges = [starter.jersey ? `#${starter.jersey}` : '', starter.hand].filter(Boolean).join('  ·  ')
  track(ctx, caps(badges), textX, top + 54, {
    font: FONT.display(20),
    fill: palette.caption,
    spacing: 2,
    maxWidth: textWidth,
  })
  const stats = [
    starter.era && `${starter.era} ERA`,
    starter.record,
    starter.strikeOuts && `${starter.strikeOuts} K`,
    starter.innings && `${starter.innings} IP`,
  ].filter(Boolean)
  line(ctx, stats.join(' · ') || 'Season line not posted', textX, top + 82, {
    font: FONT.mono(17),
    fill: palette.body,
    maxWidth: textWidth,
  })

  const g = starter.lastGame
  if (!g) return
  ctx.save()
  ctx.setLineDash([2, 4])
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, top + 102)
  ctx.lineTo(box.x + box.width - PAD, top + 102)
  ctx.stroke()
  ctx.restore()

  const where = g.opponent ? `${g.home ? 'vs' : '@'} ${g.opponent}` : ''
  const labelWidth = track(ctx, caps(`Last ${where}`.trim()), left, top + 126, {
    font: FONT.display(18),
    fill: palette.caption,
    spacing: 1.6,
    maxWidth: box.width * 0.42,
  })
  const last = [
    g.inningsPitched && `${g.inningsPitched} IP`,
    g.hits != null && `${g.hits} H`,
    g.earnedRuns != null && `${g.earnedRuns} ER`,
    g.strikeOuts != null && `${g.strikeOuts} K`,
  ]
    .filter(Boolean)
    .join(' · ')
  line(ctx, last, left + labelWidth + 12, top + 126, {
    font: FONT.mono(17),
    fill: palette.muted,
    maxWidth: box.x + box.width - PAD - (left + labelWidth + 12),
  })
}

export function drawArms(ctx, box, model, art, palette) {
  const [left, right] = columns(28)
  const shape = (col) => ({ x: col.x, y: box.y, width: col.width, height: box.height })
  drawStarterCard(ctx, shape(left), model.starters.away, art.awayShot, art.awayBar, palette)
  drawStarterCard(ctx, shape(right), model.starters.home, art.homeShot, art.homeBar, palette)
}

// ────────────────────────────────────────────────────────────── the cards ──
// A row is: order, face, full name, position, season line. Every column is
// LEFT-ALIGNED off a fixed x — a card is read DOWN a column, and ragged-right
// numbers make that a hunt.
//
// THE STAT LINE IS THE BROADCAST SET, not the raw slash: `.278 · 17 HR · 48
// RBI`, which is what a lower-third shows when a hitter comes up. Three facts
// anyone reads at a glance, and — the reason it is three and not four — they
// fit next to a full name without either column truncating. OPS, OBP and SLG
// are all on the model (`batting.ops`/`.obp`/`.slg`) for a one-line swap, but
// adding a fourth term pushed the line past the column at every font size worth
// printing, and a stat that ends in "…" is worse than a stat that isn't there.
//
// All of it is a SEASON aggregate, which is an open surface (ADR-0034) — a stat
// line is not a score, and gating one is the mistake that ADR undid.
const COL = { order: PAD - 6, shot: PAD + 14, name: PAD + 56, position: 286, stats: 330 }
const SHOT = 30

function battingLine(b) {
  if (!b) return ''
  return [
    b.avg,
    b.homeRuns != null ? `${b.homeRuns} HR` : '',
    b.rbi != null ? `${b.rbi} RBI` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

// The face, cropped to a circle. A hitter with no photo on file gets his
// initials on a paper disc rather than a hole in the column — the same
// monogram-behind-a-fallback rule components/Headshot.jsx keeps.
function drawFace(ctx, x, y, size, img, name, palette) {
  ctx.save()
  panel(ctx, x, y, size, size, { radius: size / 2, fill: palette.inset })
  ctx.clip()
  if (img) {
    contain(ctx, img, x, y, size, size, { scale: 1.08 })
  } else {
    const initials = String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
    line(ctx, caps(initials), x + size / 2, y + size * 0.68, {
      font: FONT.display(Math.round(size * 0.5)),
      fill: palette.caption,
      align: 'center',
    })
  }
  ctx.restore()
  panel(ctx, x, y, size, size, { radius: size / 2, stroke: palette.border, thickness: 1 })
}

function drawOrderCard(ctx, box, side, lineup, bar, art, palette) {
  const barBottom = openCard(ctx, box, { title: 'Batting order', bar, palette })
  const top = barBottom + 10

  if (!lineup.length) {
    notPosted(ctx, box.x, top + 84, box.width, palette, 'Not posted yet')
    track(ctx, caps('Posts close to first pitch'), box.x + box.width / 2, top + 114, {
      font: FONT.display(18),
      fill: palette.caption,
      spacing: 1.4,
      align: 'center',
      maxWidth: box.width - 24,
    })
    return
  }

  // Nine rows, always — cardsHeight() sized the block for exactly this many, so
  // the two must not each work it out separately. They did once, disagreed by
  // one, and the ninth hitter silently vanished off every poster.
  lineup.slice(0, 9).forEach((p, i) => {
    const y = top + i * LINEUP_ROW
    if (i % 2 === 0) rect(ctx, box.x + 1, y, box.width - 2, LINEUP_ROW, palette.inset)
    const baseline = y + LINEUP_ROW / 2 + 7
    line(ctx, String(p.order), box.x + COL.order, baseline, {
      font: FONT.mono(16),
      fill: palette.caption,
    })
    drawFace(
      ctx,
      box.x + COL.shot,
      y + (LINEUP_ROW - SHOT) / 2,
      SHOT,
      art[lineupShotKey(side, p.order)],
      p.name,
      palette,
    )
    ctx.font = FONT.display(21)
    // The surname alone is the fallback for a name too long to print whole —
    // better a real short name than "BRANDON CRONENWO…".
    const room = COL.position - COL.name - 10
    const whole = caps(p.name)
    const shown = ctx.measureText(whole).width <= room ? whole : caps(p.last || p.name)
    line(ctx, clip(ctx, shown, room), box.x + COL.name, baseline, {
      font: FONT.display(21),
      fill: palette.body,
    })
    line(ctx, caps(p.position), box.x + COL.position, baseline, {
      font: FONT.mono(15),
      fill: palette.muted,
    })
    line(ctx, battingLine(p.batting), box.x + COL.stats, baseline, {
      font: FONT.mono(14),
      fill: palette.caption,
      maxWidth: box.width - COL.stats - PAD + 4,
    })
  })
}

export function drawCards(ctx, box, model, art, palette) {
  const [left, right] = columns(28)
  const shape = (col) => ({ x: col.x, y: box.y, width: col.width, height: box.height })
  drawOrderCard(ctx, shape(left), 'away', model.lineups.away, art.awayBar, art, palette)
  drawOrderCard(ctx, shape(right), 'home', model.lineups.home, art.homeBar, art, palette)
}

// ──────────────────────────────────────────────────────────── how they win ──
// The situational records both clubs carry INTO tonight, side by side — off the
// nightly callouts bundle (docs/callouts.md), whose shard for a date is written
// the night before, so every figure here is genuinely "entering this game".
//
// This is the card that says what kind of team each of them is: a club that is
// 49-0 when it leads after eight is a different problem from one that is 6-44
// when it trails. Four fixed rows, the same four for both clubs — see
// RECORD_ROWS in api/gamePreview.js for why they are fixed rather than picked.
function drawRecordsCard(ctx, box, model, art, palette) {
  const inner = { x: box.x + PAD, width: box.width - PAD * 2 }

  // Two value columns on the right, the label taking whatever is left. Capped
  // at a quarter of the card so a full-width row (no umpire card beside it) puts
  // the numbers under the marks rather than out at the far edge.
  const colWidth = Math.min(160, inner.width / 4)
  const homeCx = inner.x + inner.width - colWidth / 2
  const awayCx = homeCx - colWidth
  const labelWidth = awayCx - colWidth / 2 - inner.x - 10

  // The club marks ride IN the masthead, directly over the columns they head,
  // rather than in a header row of their own — the row cost 44pt to say
  // something the bar had room for, and the bar is where every other card on
  // this poster already puts a mark. They are the one-colour knockouts, since
  // this bar is navy (ADR-0031); the full-colour marks would sink into it.
  const barBottom = openCard(ctx, box, { title: 'How they win', palette })
  for (const [cx, bar] of [
    [awayCx, art.awayBar],
    [homeCx, art.homeBar],
  ]) {
    if (bar?.mark?.width) {
      const h = 28
      const w = (bar.mark.width / bar.mark.height) * h
      ctx.drawImage(bar.mark, cx - w / 2, box.y + (barBottom - box.y - h) / 2, w, h)
    }
  }

  const top = barBottom + 10
  const away = model.records.away
  const home = model.records.home
  if (!away && !home) {
    notPosted(ctx, box.x, top + 70, box.width, palette, 'Season records not posted')
    return
  }

  const rowH = 52
  model.recordRows.forEach((row, i) => {
    const y = top + i * rowH
    if (i % 2 === 0) rect(ctx, box.x + 1, y, box.width - 2, rowH, palette.inset)
    const baseline = y + rowH / 2 + 7
    track(ctx, caps(row.label), inner.x, baseline, {
      font: FONT.display(18),
      fill: palette.caption,
      spacing: 1.4,
      maxWidth: labelWidth,
    })
    for (const [cx, side] of [
      [awayCx, away],
      [homeCx, home],
    ]) {
      line(ctx, side?.[row.key] || '—', cx, baseline, {
        font: FONT.mono(24),
        fill: palette.heading,
        align: 'center',
      })
    }
  })
}

// The third row: the umpire card on the left, the situational records beside
// it. Two halves of the same question — what the conditions are tonight, and
// what each club usually does with them.
//
// A card with nothing in it gives its width to the other one instead of sitting
// there as an empty box — the same rule the studio applies to a whole block. It
// happens for real: a crew is not assigned until close to first pitch, so a
// poster made the day before is records-only, and the records card reads
// perfectly well as a wide table.
export function drawUmpireRow(ctx, box, model, art, palette) {
  const hasUmpire = Boolean(model.plate)
  const hasRecords = Boolean(model.records.away || model.records.home)
  const full = contentBox()
  const shape = (col) => ({ x: col.x, y: box.y, width: col.width, height: box.height })

  if (hasUmpire && !hasRecords) {
    drawUmpireCard(ctx, { ...shape(full), width: full.width }, model, palette)
    return
  }
  if (hasRecords && !hasUmpire) {
    drawRecordsCard(ctx, { x: full.x, y: box.y, width: full.width, height: box.height }, model, art, palette)
    return
  }
  const [left, right] = columns(28)
  drawUmpireCard(ctx, shape(left), model, palette)
  drawRecordsCard(ctx, shape(right), model, art, palette)
}

// ────────────────────────────────────────────────────────────────── footer ──
export function drawFooter(ctx, y, model, palette) {
  const { x, width } = contentBox()
  rule(ctx, x, y + 6, width, { fill: palette.border })
  track(ctx, caps('Keep score by hand · tallybb.com'), x, y + 40, {
    font: FONT.display(21),
    fill: palette.caption,
    spacing: 2.4,
  })
  track(ctx, caps(`${model.away.abbr} @ ${model.home.abbr}`), x + width, y + 40, {
    font: FONT.display(21),
    fill: palette.caption,
    spacing: 2.4,
    align: 'right',
  })
}
