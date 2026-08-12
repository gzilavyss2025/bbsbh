// The poster's head — the slate card's hover state, printed at poster scale.
//
// The slate card (components/game/GameCard.jsx) holds three things back until
// you hover it: the ballpark photograph washes in behind the whole card, the
// two-layer '@' watermark inks up, and the park's name slides open next to the
// start time. A poster has no hover, and the hover state is the good one — so
// this paints the card as if it were permanently hovered, at the opacities
// 06a-gamecard-parkart.css uses for `:hover` rather than its resting ones.
//
// What is deliberately NOT here: the readiness pips. On the card they are a
// live checklist — "have the lineups posted yet?" — which is a question about
// the moment you are looking at the slate, not a fact about the game. Printed
// into an image that outlives that moment they would be stale the second the
// card posts, and worse, wrong to whoever reads the image tomorrow.
import { FONT } from './posterPaper.js'
import { caps, contain, cover, line, panel, rect, rule, track } from './posterInk.js'
import { POSTER } from './posterLayout.js'

// The head's vertical rhythm, all measured from the top of the poster. Kept
// as one table rather than scattered through the draw functions so the whole
// composition can be re-tuned by reading a single block — and so it is obvious
// at a glance that nothing here reaches past POSTER.headHeight (640).
const HEAD = {
  barHeight: 58,
  tileSize: 196,
  tileTop: 88,
  awayCx: 322,
  homeCx: 878,
  placeBaseline: 334,
  nickBaseline: 382,
  recordBaseline: 418,
  ruleY: 444,
  venueBaseline: 486,
  factsBaseline: 520,
}

// The full-bleed ballpark photograph, grayscale, washed back under a sheet of
// manila so the type on top holds its contrast. Same order the card paints in
// (photo first, everything else over it) and the same grayscale(1) treatment;
// the wash is what replaces the card's 0.24 opacity, since a poster's photo has
// to survive being looked at rather than glanced past.
function drawBackdrop(ctx, park, palette, height, stretch) {
  rect(ctx, 0, 0, POSTER.width, height, palette.canvas)
  if (!park?.image) return
  ctx.save()
  ctx.filter = 'grayscale(1)'
  cover(ctx, park.image, 0, 0, POSTER.width, height, { focus: park.focus })
  ctx.restore()
  // The manila sheet over the photograph, in three stops. The middle stop is
  // pinned to where the club marks START, not to a fraction of the head — on a
  // stretched head that band moves down, and the photograph should stay open
  // above it rather than being washed out at a fixed 50%.
  const marksTop = (HEAD.tileTop + stretch) / height
  const wash = ctx.createLinearGradient(0, 0, 0, height)
  wash.addColorStop(0, hexAlpha(palette.paper1, 0.52))
  wash.addColorStop(Math.min(0.95, marksTop), hexAlpha(palette.paper1, 0.66))
  wash.addColorStop(1, hexAlpha(palette.paper0, 0.95))
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, POSTER.width, height)
}

// '#RRGGBB' + alpha -> 'rgba(r, g, b, a)'. The palette is read out of the
// stylesheet as hex, and canvas gradients need a real color string.
function hexAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) return `rgba(243, 236, 216, ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// The two-layer '@', printed a couple of pixels out of register in kraft-amber
// and navy — the misregistration a real ballpark-program print run has. Drawn
// at the card's HOVER opacities (0.30 ghost / 0.28 ink), not its resting ones.
function drawAtMark(ctx, palette) {
  const cx = POSTER.width / 2
  const cy = HEAD.tileTop + HEAD.tileSize / 2
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = FONT.watermark(300)
  ctx.translate(cx, cy)
  // The card's own transform: skewX(-8deg) rotate(-2deg), and a lift because
  // this face's '@' carries more descent than ascent.
  ctx.rotate((-2 * Math.PI) / 180)
  ctx.transform(1, 0, Math.tan((-8 * Math.PI) / 180), 1, 0, 0)
  ctx.globalAlpha = 0.3
  ctx.fillStyle = palette.seal
  ctx.fillText('@', 2, -22)
  ctx.globalAlpha = 0.28
  ctx.fillStyle = palette.navy
  ctx.fillText('@', -2, -18)
  ctx.restore()
}

// One club's uniform-treatment tile — the same square the slate card and the
// in-game masthead show, rebuilt in canvas: tinted fill, the mark overscaled
// past its own box (EDGE_BLEED in TeamTreatmentMark.jsx) and cropped by the
// tile. A club with no tint on file gets the plain paper tile, exactly as the
// component's NO_TILE fallback does.
function drawTile(ctx, club, palette) {
  const { x, tile } = club
  const size = HEAD.tileSize
  const y = HEAD.tileTop
  ctx.save()
  panel(ctx, x - size / 2, y, size, size, {
    radius: 18,
    fill: tile?.tint || palette.inset,
    stroke: tile?.tint ? null : palette.border,
    thickness: 1.5,
  })
  ctx.clip()
  if (tile?.pinstripeColor) {
    rect(ctx, x - size / 2, y, size, size, tile.pinstripeBg || palette.inset)
    ctx.strokeStyle = tile.pinstripeColor
    ctx.lineWidth = 2
    for (let px = x - size / 2; px < x + size / 2; px += 12) {
      ctx.beginPath()
      ctx.moveTo(px, y)
      ctx.lineTo(px, y + size)
      ctx.stroke()
    }
  }
  if (club.mark) {
    const bleed = 1.32 * (tile?.scale ?? 1)
    const dx = ((tile?.offsetX ?? 0) / 100) * size
    const dy = ((tile?.offsetY ?? 0) / 100) * size
    contain(ctx, club.mark, x - size / 2 + dx, y + dy, size, size, { scale: bleed })
  }
  ctx.restore()
}

// Place over nickname, centred under the tile — the scorebook stack the card
// prints (MILWAUKEE / BREWERS), with the club's record penciled under it.
function drawClubName(ctx, club, palette) {
  const { x } = club
  const width = 470
  track(ctx, caps(club.place), x, HEAD.placeBaseline, {
    font: FONT.display(30),
    fill: palette.caption,
    spacing: 3,
    align: 'center',
    maxWidth: width,
  })
  track(ctx, caps(club.nick), x, HEAD.nickBaseline, {
    font: FONT.display(50),
    fill: palette.heading,
    spacing: 1.5,
    align: 'center',
    maxWidth: width,
  })
  if (club.record) {
    line(ctx, club.record.line, x, HEAD.recordBaseline, {
      font: FONT.mono(26),
      fill: palette.muted,
      align: 'center',
    })
  }
}

// The brand bar the poster hangs from: wordmark left, the day right. Navy with
// the kraft-gold under-edge, the same masthead grammar every section bar below
// it uses, so the poster reads as one printed sheet.
function drawBrandBar(ctx, model, palette) {
  const h = HEAD.barHeight
  rect(ctx, 0, 0, POSTER.width, h, palette.navy)
  rect(ctx, 0, h - 4, POSTER.width, 4, palette.seal)
  track(ctx, caps('Tally Baseball'), POSTER.margin, h / 2 + 6, {
    font: FONT.display(26),
    fill: palette.onInk,
    spacing: 4,
  })
  const day = [model.date.weekday, model.date.monthDay, model.date.year].filter(Boolean).join(' · ')
  track(ctx, caps(day), POSTER.width - POSTER.margin, h / 2 + 6, {
    font: FONT.display(24),
    fill: palette.seal,
    spacing: 2.5,
    align: 'right',
  })
}

// The ballpark line — the card's hover-revealed park name, promoted to the
// poster's dateline, over the facts you'd want before deciding to watch.
function drawDateline(ctx, model, palette) {
  const cx = POSTER.width / 2
  rule(ctx, POSTER.margin, HEAD.ruleY, POSTER.width - POSTER.margin * 2, { fill: palette.border })
  track(ctx, caps(model.venue.name || 'Ballpark not posted'), cx, HEAD.venueBaseline, {
    font: FONT.display(36),
    fill: palette.heading,
    spacing: 2.5,
    align: 'center',
    maxWidth: POSTER.width - POSTER.margin * 2,
  })
  // Start time, then where, then what the sky is doing, then who is carrying
  // it — one line rather than the chip this used to be, because the head's
  // vertical budget is spent (see POSTER.headHeight) and a broadcast reads
  // perfectly well as another fact about the evening.
  const facts = [
    model.startTime,
    model.venue.place,
    model.venue.roof && model.venue.roof !== 'Open' ? `${model.venue.roof} roof` : '',
    model.weather,
    model.broadcast,
  ].filter(Boolean)
  track(ctx, caps(facts.join('  ·  ')), cx, HEAD.factsBaseline, {
    font: FONT.display(23),
    fill: palette.muted,
    spacing: 1.6,
    align: 'center',
    maxWidth: POSTER.width - POSTER.margin * 2,
  })
}

// `art` carries the loaded images and resolved tiles the screen prepared:
// { park: {image, focus}, away: {mark, tile}, home: {mark, tile} }.
// `head` is posterLayout's { height, stretch } — the head is a floor plus
// whatever the switched-off blocks gave back.
//
// The stretch is spent ABOVE the matchup, not around it: the marks, names and
// dateline keep the rhythm they were tuned at (HEAD, all measured from a 560px
// head) and the whole group slides down, so the extra room becomes open
// ballpark at the top of the sheet. The brand bar stays pinned at y=0, which is
// why it is drawn outside the translate.
export function drawHead(ctx, model, art, palette, head) {
  const height = head?.height ?? POSTER.headHeight
  const stretch = head?.stretch ?? 0
  drawBackdrop(ctx, art.park, palette, height, stretch)

  ctx.save()
  ctx.translate(0, stretch)
  drawAtMark(ctx, palette)
  const away = { ...art.away, x: HEAD.awayCx, ...model.away }
  const home = { ...art.home, x: HEAD.homeCx, ...model.home }
  drawTile(ctx, away, palette)
  drawTile(ctx, home, palette)
  drawClubName(ctx, away, palette)
  drawClubName(ctx, home, palette)
  drawDateline(ctx, model, palette)
  ctx.restore()

  drawBrandBar(ctx, model, palette)
}
