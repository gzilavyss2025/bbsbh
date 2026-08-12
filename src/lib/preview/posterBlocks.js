// The poster's three body blocks, each a navy/gold-mastheaded card in the same
// grammar as the pre-game surfaces they come from (styles/44-pre-game-cards.css).
//
//   STARTING PITCHERS  — the two probables, head to head. The single most
//                        useful thing on a pre-game screen, which is why
//                        TeamInfo leads with it too, so it leads here.
//   BATTING ORDER      — both posted cards, away left / home right, in the
//                        order/name/position shape a scorekeeper reads.
//   BEHIND THE PLATE   — the plate umpire's season accuracy, the four tiles
//                        and the league-relative zone grid off UmpireTendencies.
//
// Every block degrades the way the rest of the app does: no lineup posted, no
// probable named, a MiLB umpire the nightly accuracy sweep never reaches — each
// draws its own "not posted yet" line rather than an empty grid or a crash.
import { FONT } from './posterPaper.js'
import { caps, clip, contain, line, masthead, panel, rect, rule, track } from './posterInk.js'
import { columns, contentBox, LINEUP_ROW, POSTER } from './posterLayout.js'

const NOT_POSTED = 'Not posted yet'

// A block's card chrome: hairline panel on card paper, masthead across the top.
function openBlock(ctx, box, { title, aside, mark, palette }) {
  panel(ctx, box.x, box.y, box.width, box.height, {
    radius: 12,
    fill: palette.card,
    stroke: palette.border,
    thickness: 1.5,
  })
  ctx.save()
  panel(ctx, box.x, box.y, box.width, box.height, { radius: 12 })
  ctx.clip()
  const barBottom = masthead(ctx, box.x, box.y, box.width, { title, aside, mark, palette })
  ctx.restore()
  return barBottom
}

function notPosted(ctx, x, y, width, palette, text = NOT_POSTED) {
  track(ctx, caps(text), x + width / 2, y, {
    font: FONT.display(24),
    fill: palette.caption,
    spacing: 2,
    align: 'center',
    maxWidth: width - 24,
  })
}

// ─────────────────────────────────────────────────────── starting pitchers ──
// One starter: headshot left, name and hand/number stacked right, the season
// line under it, and his last outing on a dotted second line. The stats are
// season aggregates and an already-final previous box line — never this game's
// (see api/game.js's fetchPitcherSeasonLine / fetchPitcherLastGame).
function drawStarter(ctx, col, top, starter, shot, palette) {
  const shotSize = 104
  if (!starter) {
    notPosted(ctx, col.x, top + 70, col.width, palette, 'Starter not announced')
    return
  }
  if (shot) {
    ctx.save()
    panel(ctx, col.x, top, shotSize, shotSize, { radius: 52, fill: palette.inset })
    ctx.clip()
    contain(ctx, shot, col.x, top, shotSize, shotSize, { scale: 1.06 })
    ctx.restore()
    panel(ctx, col.x, top, shotSize, shotSize, { radius: 52, stroke: palette.border, thickness: 1.5 })
  }
  const textX = col.x + shotSize + 18
  const textWidth = col.width - shotSize - 18
  track(ctx, caps(starter.name), textX, top + 34, {
    font: FONT.display(34),
    fill: palette.heading,
    spacing: 1,
    maxWidth: textWidth,
  })
  const badges = [starter.jersey ? `#${starter.jersey}` : '', starter.hand].filter(Boolean).join('  ·  ')
  track(ctx, caps(badges), textX, top + 64, {
    font: FONT.display(22),
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
  line(ctx, stats.join(' · ') || 'Season line not posted', textX, top + 96, {
    font: FONT.mono(18),
    fill: palette.body,
    maxWidth: textWidth,
  })

  // The dotted divider and last-outing line, the same "LAST: …" convention
  // TeamInfo's starter card prints under its season line.
  const g = starter.lastGame
  if (!g) return
  ctx.save()
  ctx.setLineDash([2, 4])
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(col.x, top + 124)
  ctx.lineTo(col.x + col.width, top + 124)
  ctx.stroke()
  ctx.restore()
  const where = g.opponent ? `${g.home ? 'vs' : '@'} ${g.opponent}` : ''
  const last = [
    g.inningsPitched && `${g.inningsPitched} IP`,
    g.hits != null && `${g.hits} H`,
    g.earnedRuns != null && `${g.earnedRuns} ER`,
    g.strikeOuts != null && `${g.strikeOuts} K`,
  ]
    .filter(Boolean)
    .join(' · ')
  // Label and line share one row rather than stacking — the block's height is
  // spoken for (BLOCK_HEIGHT.arms), and "LAST @ CIN" is short enough to sit
  // beside its numbers.
  const labelWidth = track(ctx, caps(`Last ${where}`.trim()), col.x, top + 152, {
    font: FONT.display(19),
    fill: palette.caption,
    spacing: 1.6,
    maxWidth: col.width * 0.5,
  })
  line(ctx, last, col.x + labelWidth + 14, top + 152, {
    font: FONT.mono(18),
    fill: palette.muted,
    maxWidth: col.width - labelWidth - 14,
  })
}

export function drawArms(ctx, box, model, art, palette) {
  const barBottom = openBlock(ctx, box, { title: 'Starting pitchers', palette })
  const [left, right] = columns(40)
  const top = barBottom + 26
  // The gutter rule, so the two arms read as a matchup rather than a list.
  rule(ctx, POSTER.width / 2, top - 6, 1, { fill: palette.hairline, thickness: 1 })
  ctx.fillStyle = palette.hairline
  ctx.fillRect(POSTER.width / 2, top - 6, 1, box.height - (top - box.y) - 24)
  drawStarter(ctx, left, top, model.starters.away, art.awayShot, palette)
  drawStarter(ctx, right, top, model.starters.home, art.homeShot, palette)
}

// ────────────────────────────────────────────────────────────── the cards ──
// A club's posted batting order: number, surname, position. Nine rows on a
// ruled grid, alternating cell fill the way a scorebook page alternates — and
// a per-column club heading, since at this size a mark alone is ambiguous.
function drawOrder(ctx, col, top, club, lineup, mark, palette) {
  track(ctx, caps(club.abbr || club.nick), col.x + 4, top, {
    font: FONT.display(24),
    fill: palette.heading,
    spacing: 2.5,
    maxWidth: col.width - 46,
  })
  // The club's FULL-COLOUR mark, not the one-colour knockout: this heading sits
  // on card paper, and a white knockout on manila is an invisible mark rather
  // than a subtle one. The knockouts are for the navy mastheads (ADR-0031).
  if (mark) contain(ctx, mark, col.x + col.width - 36, top - 24, 32, 32)
  rule(ctx, col.x, top + 12, col.width, { fill: palette.border, thickness: 1.5 })

  if (!lineup.length) {
    notPosted(ctx, col.x, top + 66, col.width, palette)
    track(ctx, caps('Posts close to first pitch'), col.x + col.width / 2, top + 96, {
      font: FONT.display(19),
      fill: palette.caption,
      spacing: 1.4,
      align: 'center',
      maxWidth: col.width - 24,
    })
    return
  }

  // Nine rows, always — cardsHeight() sized the block for exactly this many, so
  // the two must not each work it out separately. They did once, disagreed by
  // one, and the ninth hitter silently vanished off every poster.
  lineup.slice(0, 9).forEach((p, i) => {
    const y = top + 24 + i * LINEUP_ROW
    if (i % 2 === 0) rect(ctx, col.x, y, col.width, LINEUP_ROW, palette.inset)
    const baseline = y + LINEUP_ROW / 2 + 8
    line(ctx, String(p.order), col.x + 20, baseline, {
      font: FONT.mono(21),
      fill: palette.caption,
      align: 'center',
    })
    ctx.font = FONT.display(27)
    const nameMax = col.width - 46 - 54
    line(ctx, caps(clip(ctx, p.name, nameMax)), col.x + 42, baseline, {
      font: FONT.display(27),
      fill: palette.body,
    })
    line(ctx, caps(p.position), col.x + col.width - 14, baseline, {
      font: FONT.mono(20),
      fill: palette.muted,
      align: 'right',
    })
  })
}

export function drawCards(ctx, box, model, art, palette) {
  const posted = model.lineups.away.length || model.lineups.home.length
  const barBottom = openBlock(ctx, box, {
    title: 'Batting order',
    aside: posted ? '' : 'Not final',
    palette,
  })
  const [left, right] = columns(36)
  const top = barBottom + 44
  drawOrder(ctx, left, top, model.away, model.lineups.away, art.away.mark, palette)
  drawOrder(ctx, right, top, model.home, model.lineups.home, art.home.mark, palette)
}

// ───────────────────────────────────────────────────────── behind the plate ──
// The plate umpire's season, in the four numbers UmpireTendencies leads with,
// plus its 3×3 league-relative zone grid. All of it is a Final-games aggregate
// off the nightly accuracy sweep — a fact about the umpire, not about tonight.
function drawTile(ctx, x, y, w, h, { label, value, sup = '' }, palette) {
  panel(ctx, x, y, w, h, { radius: 8, fill: palette.inset, stroke: palette.hairline, thickness: 1 })
  track(ctx, caps(label), x + w / 2, y + 26, {
    font: FONT.display(18),
    fill: palette.caption,
    spacing: 1.6,
    align: 'center',
    maxWidth: w - 12,
  })
  // The value and its superscript are centred as one run, so "3/89" sits on
  // the tile's axis rather than the "3" alone doing so.
  ctx.font = FONT.mono(30)
  const valueWidth = ctx.measureText(String(value)).width
  let supWidth = 0
  if (sup) {
    ctx.font = FONT.mono(17)
    supWidth = ctx.measureText(sup).width
  }
  const startX = x + w / 2 - (valueWidth + supWidth) / 2
  line(ctx, String(value), startX, y + 66, { font: FONT.mono(30), fill: palette.heading })
  if (sup) line(ctx, sup, startX + valueWidth + 2, y + 66, { font: FONT.mono(17), fill: palette.caption })
}

// The 3×3 grid, each cell inked toward green where this umpire calls MORE
// strikes than the league does there and toward clay where he calls fewer —
// the same signed `over` UmpireZoneMap reads, and the same two accent tokens
// ADR-0017 pairs for positive/negative.
function drawZone(ctx, x, y, size, cells, palette) {
  const cell = size / 3
  for (let i = 0; i < 9; i += 1) {
    const over = Number(cells?.[i]?.over ?? 0)
    const cx = x + (i % 3) * cell
    const cy = y + Math.floor(i / 3) * cell
    const strength = Math.min(1, Math.abs(over) / 0.12)
    ctx.globalAlpha = 0.14 + strength * 0.62
    rect(ctx, cx, cy, cell, cell, over >= 0 ? palette.positive : palette.negative)
    ctx.globalAlpha = 1
    ctx.strokeStyle = palette.card
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, cell, cell)
  }
  panel(ctx, x, y, size, size, { radius: 2, stroke: palette.body, thickness: 2 })
}

export function drawZoneBlock(ctx, box, model, art, palette) {
  const plate = model.plate
  const barBottom = openBlock(ctx, box, {
    title: 'Behind the plate',
    aside: plate?.games ? `${plate.games} scored games` : '',
    palette,
  })
  const { x, width } = contentBox()
  const top = barBottom + 26

  if (!plate) {
    notPosted(ctx, x, top + 58, width, palette, 'Crew not posted yet')
    return
  }

  // The zone grid rides the right edge; everything textual is measured against
  // the column that leaves, so a long crew line never runs under it.
  const zoneSize = 104
  const zoneX = x + width - zoneSize - 16
  const textWidth = zoneX - x - 40

  track(ctx, caps(plate.name), x + 20, top + 30, {
    font: FONT.display(34),
    fill: palette.heading,
    spacing: 1.2,
    maxWidth: textWidth,
  })
  const crew = [
    ...model.crew.filter((o) => o.role !== 'HP').map((o) => `${o.role} ${o.name}`),
    plate.watch ? `Watches ${plate.watch}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ')
  line(ctx, crew, x + 20, top + 54, {
    font: FONT.body(18),
    fill: palette.caption,
    maxWidth: textWidth,
  })

  if (plate.accuracy == null) {
    notPosted(ctx, x, top + 104, width, palette, 'No scored games on file')
    return
  }

  drawZone(ctx, zoneX, top + 2, zoneSize, plate.zoneCells, palette)
  track(ctx, caps('Strikes vs league'), zoneX + zoneSize / 2, top + zoneSize + 22, {
    font: FONT.display(15),
    fill: palette.caption,
    spacing: 1,
    align: 'center',
    maxWidth: zoneSize + 70,
  })

  // The same four UmpireTendencies leads with, in its order. Rank drops out
  // below the ranking floor (loadUmpire returns none), and the tile row simply
  // shortens rather than printing a placeholder rank nobody can act on.
  const tiles = [
    { label: 'Accuracy', value: pct(plate.accuracy) },
    plate.rank ? { label: 'Rank', value: plate.rank.rank, sup: `/${plate.rank.total}` } : null,
    { label: 'Consistency', value: pct(plate.consistency) },
    { label: 'Run impact', value: runs(plate.favorPerGame) },
  ].filter(Boolean)
  const gap = 14
  const tileW = Math.min(160, (textWidth - gap * (tiles.length - 1)) / tiles.length)
  const tileH = 80
  let tx = x + 20
  const ty = top + 70
  for (const t of tiles) {
    drawTile(ctx, tx, ty, tileW, tileH, t, palette)
    tx += tileW + gap
  }
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const runs = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)

// ────────────────────────────────────────────────────────────────── footer ──
export function drawFooter(ctx, y, model, palette) {
  const { x, width } = contentBox()
  rule(ctx, x, y + 6, width, { fill: palette.border })
  track(ctx, caps('Keep score by hand · tallybb.com'), x, y + 40, {
    font: FONT.display(21),
    fill: palette.caption,
    spacing: 2.4,
  })
  const matchup = `${model.away.abbr} @ ${model.home.abbr}`
  track(ctx, caps(matchup), x + width, y + 40, {
    font: FONT.display(21),
    fill: palette.caption,
    spacing: 2.4,
    align: 'right',
  })
}
