// The pitcher game card as a PNG (#2969 slice 5): painted on a canvas, never
// captured from the DOM (ADR-0045, the preview poster's rule), and saved by
// components/preview/SavePosterButton.jsx. It paints the CARD only — band,
// line, figures, mix, plots, footer — not the arsenal detail under it.
//
// `cardLayout` is the pure part (each block's top and height, in card units
// 360 wide); `paintGameCard` draws it. Colours and fonts arrive from the
// caller, read off the rendered sheet, so the image wears the same club band
// and the same tokens as the card on screen. Plot geometry is
// lib/pitch/cardPlots.js, shared with the SVG.
import { glyphD } from '../pitch/pitchGlyph.js'
import { pitchMark } from '../pitch/pitchTypes.js'
import { locationScale, fitViewBox, BALL_R } from '../pitch/cardPlots.js'
import { geometryOf, parkWindow } from '../ballpark/layout/parkWindow.js'
import { HOME, wallStroke } from '../ballpark/ballparkGeometry.js'

export const CARD_W = 360
export const SCALE = 3 // 1080 px wide
const PAD = 16
// Tightened so a five-pitch card is no taller than 9:16 (a phone story, no crop).
const BAND_H = 124
const HERO_H = 54
const TRIO_H = 46
const MIX_HEAD = 28
const MIX_ROW = 26
const PLOT_GAP = 10
const PLOT_TOP = 10
const PLOT_CAPTION = 18
const FOOT_H = 28
const SHOT_W = 96
const SHOT_H = 112

export function cardLayout({ mixRows, hasPlots }) {
  const blocks = []
  let y = 0
  const add = (name, h) => {
    blocks.push({ name, y, h })
    y += h
  }
  add('band', BAND_H)
  add('hero', HERO_H)
  add('trio', TRIO_H)
  if (mixRows > 0) add('mix', MIX_HEAD + mixRows * MIX_ROW + PAD / 2)
  const plotW = (CARD_W - 2 * PAD - PLOT_GAP) / 2
  const plotH = (plotW * 140) / 120
  if (hasPlots) add('plots', PLOT_TOP + plotH + PLOT_CAPTION + 6)
  add('foot', FOOT_H)
  return { width: CARD_W, height: y, blocks: Object.fromEntries(blocks.map((b) => [b.name, b])), plot: { w: plotW, h: plotH } }
}

// The source rectangle that fills a boxW×boxH slot at the image's own
// proportions (CSS object-fit: cover), trimming the sides of a wide photo
// evenly and the bottom of a tall one, so the face stays. Never stretches.
export function coverRect(imgW, imgH, boxW, boxH) {
  const box = boxW / boxH
  if (imgW / imgH > box) {
    const sw = imgH * box
    return { sx: (imgW - sw) / 2, sy: 0, sw, sh: imgH }
  }
  return { sx: 0, sy: 0, sw: imgW, sh: imgW / box }
}

// "yamamoto-ws-g7-2025-11-01.png"-style: the pitcher and the date, safe for any file system.
export function cardFilename(name, isoDate) {
  const slug = (name || 'pitcher').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}${isoDate ? `-${isoDate}` : ''}-game-card.png`
}

const caps = (s) => String(s ?? '').toUpperCase() // caps-js-exempt: a canvas has no CSS text-transform

function text(ctx, s, x, y, { font, color, align = 'left', baseline = 'alphabetic' }) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(s, x, y)
}

function mark(ctx, code, x, y, r) {
  const m = pitchMark(code)
  ctx.save()
  ctx.translate(x, y)
  const p = new Path2D(glyphD(m.shape, r))
  if (m.ring) {
    ctx.strokeStyle = m.color
    ctx.lineWidth = 1.4
    ctx.stroke(p)
  } else {
    ctx.fillStyle = m.color
    ctx.fill(p)
  }
  ctx.restore()
}

// The park as the box score's hit chart draws it (components/ballpark/
// BallparkDiagram.jsx: foul ground, grass, track, the skinned infield, foul
// lines, the fence), in the field's own inks read off that drawing, then the
// balls in play: a hit is a marker dot, an out an ink ring.
function paintSpray(ctx, park, balls, w, h, c) {
  const g = geometryOf(park)
  const fit = fitViewBox(parkWindow(park).viewBox, w, h)
  ctx.translate(fit.dx, fit.dy)
  ctx.scale(fit.scale, fit.scale)
  const fill = (d, col) => {
    if (!d || !col) return
    ctx.fillStyle = col
    ctx.fill(new Path2D(d))
  }
  const stroke = (d, col, lw) => {
    if (!d || !col) return
    ctx.strokeStyle = col
    ctx.lineWidth = lw
    ctx.stroke(new Path2D(d))
  }
  const f = c.field
  fill(g.foul, f.foul)
  fill(g.fair, f.grass)
  fill(g.track, f.track)
  fill(g.skin, f.dirt)
  fill(g.grassDiamond, f.grass)
  stroke(g.baselineDirtL, f.dirt, g.baselineDirtW)
  stroke(g.baselineDirtR, f.dirt, g.baselineDirtW)
  ctx.fillStyle = f.dirt
  ctx.beginPath()
  ctx.arc(g.mound.x, g.mound.y, g.moundDirtR, 0, Math.PI * 2)
  ctx.arc(HOME.x, HOME.y, g.homeDirtR, 0, Math.PI * 2)
  ctx.fill()
  stroke(g.foulLineL, f.line, 2)
  stroke(g.foulLineR, f.line, 2)
  for (const seg of g.fenceSegs) stroke(seg.d, f.wall, wallStroke(seg.h))
  for (const b of balls) {
    ctx.beginPath()
    ctx.arc(b.ball.x, b.ball.y, b.hit ? BALL_R.hit : BALL_R.out, 0, Math.PI * 2)
    if (b.hit) {
      ctx.fillStyle = c.marker
      ctx.fill()
    }
    ctx.strokeStyle = c.ink
    ctx.lineWidth = 4
    ctx.stroke()
  }
}

// model: { card, name, role, ctxLine, headline, sub, figures: [[label, value]], season, park }
// art: { headshot } (HTMLImageElement | null). c: colours. f: font stacks { display, mono }.
export function paintGameCard(canvas, model, art, c, f) {
  const { card } = model
  const hasPlots = card.pitches.some((p) => p.loc || p.ball)
  const L = cardLayout({ mixRows: card.mix.length, hasPlots })
  canvas.width = L.width * SCALE
  canvas.height = L.height * SCALE
  const ctx = canvas.getContext('2d')
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  ctx.fillStyle = c.card
  ctx.fillRect(0, 0, L.width, L.height)
  const disp = (w, px) => `${w} ${px}px ${f.display}`
  const mono = (w, px) => `${w} ${px}px ${f.mono}`

  // Band
  const b = L.blocks.band
  ctx.fillStyle = c.band
  ctx.fillRect(0, b.y, L.width, b.h)
  const shot = art.headshot
  if (shot?.naturalWidth) {
    const r = coverRect(shot.naturalWidth, shot.naturalHeight, SHOT_W, SHOT_H)
    ctx.drawImage(shot, r.sx, r.sy, r.sw, r.sh, L.width - PAD - SHOT_W, b.y + b.h - SHOT_H, SHOT_W, SHOT_H)
  }
  text(ctx, caps(model.ctxLine), PAD, b.y + 22, { font: disp(600, 12), color: c.bandText })
  const [first, ...rest] = model.name.split(' ')
  text(ctx, caps(rest.length ? first : model.name), PAD, b.y + 54, { font: disp(900, 34), color: c.bandText })
  if (rest.length) text(ctx, caps(rest.join(' ')), PAD, b.y + 86, { font: disp(900, 34), color: c.bandText })
  text(ctx, caps(model.role), PAD, b.y + 110, { font: disp(600, 12), color: c.bandText })
  ctx.fillStyle = c.bandAccent
  ctx.fillRect(0, b.y + b.h - 3, L.width, 3)

  // Hero: IP in an ink block, the headline beside it
  const h = L.blocks.hero
  ctx.font = mono(700, 28)
  const ipW = ctx.measureText(card.line.ip).width + 44
  ctx.fillStyle = c.ink
  ctx.fillRect(PAD, h.y + 8, ipW, 38)
  text(ctx, card.line.ip, PAD + 10, h.y + 37, { font: mono(700, 28), color: c.marker })
  text(ctx, 'IP', PAD + ipW - 10, h.y + 37, { font: disp(600, 12), color: c.onInk, align: 'right' })
  // The headline shrinks to fit (a line with ER and HR runs long), never past 10px.
  const room = L.width - PAD - (PAD + ipW + 12)
  let size = 14
  ctx.font = mono(700, size)
  while (size > 10 && ctx.measureText(caps(model.headline)).width > room) ctx.font = mono(700, --size)
  text(ctx, caps(model.headline), PAD + ipW + 12, h.y + 25, { font: mono(700, size), color: c.text })
  text(ctx, caps(model.sub), PAD + ipW + 12, h.y + 41, { font: mono(500, 11), color: c.muted })
  ctx.fillStyle = c.rule
  ctx.fillRect(0, h.y + h.h - 1, L.width, 1)

  // Figures
  const t = L.blocks.trio
  const colW = L.width / model.figures.length
  model.figures.forEach(([label, v], i) => {
    const x = i * colW + PAD
    text(ctx, String(v), x, t.y + 25, { font: mono(700, 20), color: c.text })
    text(ctx, caps(label), x, t.y + 39, { font: disp(600, 11), color: c.muted })
    if (i > 0) ctx.fillRect(i * colW, t.y, 1, t.h)
  })
  ctx.fillStyle = c.rule
  ctx.fillRect(0, t.y + t.h - 1, L.width, 1)

  // Mix
  const m = L.blocks.mix
  if (m) {
    text(ctx, 'WHAT HE THREW', PAD, m.y + 19, { font: disp(700, 12), color: c.text })
    // Use, Mph (with the season change in its own slot after it), Whiffs.
    const cols = [L.width - PAD - 136, L.width - PAD - 76, L.width - PAD]
    ;['USE', 'MPH', 'WHIFFS'].forEach((s, i) => text(ctx, s, cols[i], m.y + 19, { font: disp(600, 11), color: c.muted, align: 'right' }))
    card.mix.forEach((row, i) => {
      const y = m.y + MIX_HEAD + i * MIX_ROW
      mark(ctx, row.type, PAD + 5, y + 6, 5)
      text(ctx, caps(row.name), PAD + 18, y + 10, { font: mono(500, 11), color: c.text })
      const pct = row.usage == null ? '—' : `${Math.round(row.usage * 100)}%`
      const velo = row.velo == null ? '—' : row.velo.toFixed(1)
      const d = model.season?.deltas?.get(row.type) || ''
      text(ctx, pct, cols[0], y + 10, { font: mono(500, 11), color: c.text, align: 'right' })
      text(ctx, velo, cols[1], y + 10, { font: mono(500, 11), color: c.text, align: 'right' })
      if (d) text(ctx, d, cols[1] + 4, y + 10, { font: mono(500, 11), color: c.muted })
      text(ctx, String(row.whiffs), cols[2], y + 10, { font: mono(500, 11), color: c.text, align: 'right' })
      const trackW = L.width - 2 * PAD - 18
      ctx.fillStyle = c.rule
      ctx.fillRect(PAD + 18, y + 16, trackW, 5)
      ctx.fillStyle = pitchMark(row.type).color
      ctx.fillRect(PAD + 18, y + 16, trackW * (row.usage ?? 0), 5)
    })
  }

  // Plots
  const p = L.blocks.plots
  if (p) {
    const { w, h: ph } = L.plot
    const boxes = [PAD, PAD + w + PLOT_GAP]
    const balls = card.pitches.filter((q) => q.ball)
    // The spray box only when there is a field and a ball to put on it, as on
    // screen; otherwise the image carries no empty frame beside the zone.
    const spray = Boolean(model.park && c.field && balls.length)
    ;(spray ? boxes : boxes.slice(0, 1)).forEach((x) => {
      ctx.fillStyle = c.page
      ctx.fillRect(x, p.y + PLOT_TOP, w, ph)
      ctx.strokeStyle = c.rule
      ctx.lineWidth = 1
      ctx.strokeRect(x, p.y + PLOT_TOP, w, ph)
    })
    const loc = locationScale(w, ph)
    ctx.save()
    ctx.translate(boxes[0], p.y + PLOT_TOP)
    ctx.strokeStyle = c.ink
    ctx.lineWidth = 1.4
    ctx.strokeRect(loc.zone.x, loc.zone.y, loc.zone.w, loc.zone.h)
    card.pitches.forEach((q) => q.loc && mark(ctx, q.type, loc.x(q.loc.xn), loc.y(q.loc.zn), 3.6))
    ctx.restore()
    if (spray) {
      ctx.save()
      ctx.translate(boxes[1], p.y + PLOT_TOP)
      ctx.beginPath()
      ctx.rect(0, 0, w, ph)
      ctx.clip()
      paintSpray(ctx, model.park, balls, w, ph, c)
      ctx.restore()
    }
    const cy = p.y + PLOT_TOP + ph + 14
    text(ctx, "WHERE · CATCHER'S VIEW", boxes[0], cy, { font: disp(600, 11), color: c.muted })
    if (spray) text(ctx, 'IN PLAY · ● HIT ○ OUT', boxes[1], cy, { font: disp(600, 11), color: c.muted })
  }

  // Footer
  const ft = L.blocks.foot
  ctx.fillStyle = c.ink
  ctx.fillRect(0, ft.y, L.width, ft.h)
  text(ctx, 'TALLY BASEBALL', PAD, ft.y + 18, { font: disp(700, 12), color: c.marker })

  // The card's ink edge
  ctx.strokeStyle = c.ink
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, L.width - 2, L.height - 2)
  return L
}
