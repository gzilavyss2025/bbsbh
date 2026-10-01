// Ladder layout, in row units: pure math, no React or DOM, so `npm test` can
// import it. Each connected group from teammateLadder() is one band with three
// columns: L (away players), C (shared clubs), R (home players). Barycenter
// sweeps: sort a column by the mean position of its neighbors, then push nodes
// apart to a 1-row minimum gap inside the band. Keep the pass with the fewest
// crossings. `ladderLayout` takes teammateLadder()'s { groups, edges }.

// Move nodes (already sorted by `want`) apart to a 1-row gap, inside 0..hi.
// Clamp, push down to the gap, then pull back up from the last row. Shifting
// the whole column instead lets one end slip out of the band, so the pass can
// overshoot: a want of 3.5 in a 4-row band came back as 3.5.
function spread(order, want, hi) {
  const pos = order.map((id) => Math.min(Math.max(want[id], 0), hi))
  for (let i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + 1)
  pos[pos.length - 1] = Math.min(pos[pos.length - 1], hi)
  for (let i = pos.length - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - 1)
  return Object.fromEntries(order.map((id, i) => [id, pos[i]]))
}

// Pairs of line segments whose ends swap order between two columns.
function crossings(edges, L, C, R) {
  const segs = (side) => {
    const seen = new Set()
    const out = []
    for (const e of edges) {
      if (C[e.club] == null) continue
      const s = side === 'L' ? [L[e.away], C[e.club]] : [C[e.club], R[e.home]]
      const k = s.join(',')
      if (!seen.has(k)) {
        seen.add(k)
        out.push(s)
      }
    }
    return out
  }
  let n = 0
  for (const S of [segs('L'), segs('R')])
    for (let i = 0; i < S.length; i++)
      for (let j = i + 1; j < S.length; j++) if ((S[i][0] - S[j][0]) * (S[i][1] - S[j][1]) < 0) n++
  return n
}

function layoutBand(g, edges, sweeps = 12) {
  const rows = Math.max(g.away.length, g.home.length, g.clubs.length)
  const hi = rows - 1
  const nb = {}
  const link = (x, y) => {
    ;(nb[x] ??= []).push(y)
    ;(nb[y] ??= []).push(x)
  }
  for (const e of edges)
    if (g.clubs.includes(e.club)) {
      link(`p${e.away}`, `c${e.club}`)
      link(`p${e.home}`, `c${e.club}`)
    }
  const mean = (id, pos) => {
    const xs = nb[id].map((n) => pos[n.slice(1)]).filter((v) => v != null)
    return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0
  }
  const place = (ids, wantOf) => {
    const want = Object.fromEntries(ids.map((id) => [id, wantOf(id)]))
    return spread([...ids].sort((x, y) => want[x] - want[y]), want, hi)
  }
  let C = place(g.clubs, (id) => (rows - g.clubs.length) / 2 + g.clubs.indexOf(id))
  let best = null
  for (let s = 0; s < sweeps; s++) {
    const L = place(g.away, (id) => mean(`p${id}`, C))
    const R = place(g.home, (id) => mean(`p${id}`, C))
    const both = { ...L, ...R }
    C = place(g.clubs, (id) => mean(`c${id}`, both))
    const n = crossings(edges, L, C, R)
    if (!best || n < best.n) best = { n, L, C, R }
  }
  return { rows, L: best.L, C: best.C, R: best.R, crossings: best.n }
}

// { bands: [{ top, rows, L, C, R, crossings }], rows }: `L`/`C`/`R` map an id
// to its row inside the band, `top` is the band's first row in the stack.
export function ladderLayout({ groups, edges }) {
  let top = 0
  const bands = groups.map((g) => {
    const band = { top, ...layoutBand(g, edges) }
    top += band.rows
    return band
  })
  return { bands, rows: top }
}

// A line's key: `L<away>-<club>` (away player to club) or `R<club>-<home>`.
const segL = (e) => `L${e.away}-${e.club}`
const segR = (e) => `R${e.club}-${e.home}`

// What a trace lights, from PAIRS, never from club membership: two players on
// one club box may never have overlapped there (Andujar and Bauers both link to
// the Yankees box, through two different pairs). `key` is `p<playerId>` or
// `c<clubId>`. Returns { nodes, segments } (Sets of keys), or null for no trace.
export function traceOf({ edges }, key) {
  if (!key) return null
  const hit = edges.filter((e) => [`p${e.away}`, `c${e.club}`, `p${e.home}`].includes(key))
  return {
    nodes: new Set([key, ...hit.flatMap((e) => [`p${e.away}`, `c${e.club}`, `p${e.home}`])]),
    segments: new Set(hit.flatMap((e) => [segL(e), segR(e)])),
  }
}

// The sideways Ladder needs a card at least this wide (a tablet stays vertical)
// AND this many px per column. The width is the CARD's, measured, not the
// viewport's: the same viewport can hold a one-column page or the spread.
export const SIDEWAYS_MIN = 840
const SIDEWAYS_COL = 54

// Vertical: a 40px row per ladder row, three columns (player | club | player).
// At 328px the columns are 92 | 30 | 84 | 30 | 92; wider, the player columns
// grow to 132 and the gutters take the rest.
const ROW = 40
const PLAYER_H = 34
const CLUB_W = 84
const CLUB_H = 30
const BAND_GAP = 9
const GUTTER = 30
// Sideways: away players along the top, clubs across the middle, home players
// along the bottom.
const TOP_H = 90
const GAP_H = 50
const MID_H = 58
const BOT_H = 104

const curveAcross = (x1, y1, x2, y2) => {
  const xm = (x1 + x2) / 2
  return `M${x1} ${y1} C${xm} ${y1} ${xm} ${y2} ${x2} ${y2}`
}
const curveDown = (x1, y1, x2, y2) => {
  const ym = (y1 + y2) / 2
  return `M${x1} ${y1} C${x1} ${ym} ${x2} ${ym} ${x2} ${y2}`
}

// The Ladder in pixels for a card `width` wide: a box per node, a curve per
// distinct player-club link, the band dividers, and the "No other tie" note
// beside the former-only players. Takes teammateLadder()'s output.
// Returns { sideways, height, players: [{ id, side, box }], clubs: [{ id, box }],
//   segments: [{ key, d }], dividers: [{ x1, y1, x2, y2 }], note: box | null }
// where box = { left, top, width, height }.
export function ladderGeometry(ladder, width) {
  const { bands, rows } = ladderLayout(ladder)
  const { formerOnly, players: info } = ladder
  const columns = rows + formerOnly.length
  const sideways = width >= SIDEWAYS_MIN && columns * SIDEWAYS_COL <= width
  const players = []
  const clubs = []
  const dividers = []
  const at = {} // node key -> its line anchor(s)
  let note = null
  let height

  if (sideways) {
    const col = width / columns
    const midTop = TOP_H + GAP_H
    const botTop = midTop + MID_H + GAP_H
    height = botTop + BOT_H
    const place = (id, side, x) => {
      const top = side === 'away' ? 0 : botTop
      players.push({ id, side, box: { left: x - col / 2, top, width: col, height: side === 'away' ? TOP_H : BOT_H } })
      at[`p${id}`] = { x, y: side === 'away' ? TOP_H : botTop }
    }
    for (const b of bands) {
      if (b.top) dividers.push({ x1: b.top * col, y1: 0, x2: b.top * col, y2: height })
      const x = (pos) => (b.top + pos + 0.5) * col
      for (const [id, pos] of Object.entries(b.L)) place(id, 'away', x(pos))
      for (const [id, pos] of Object.entries(b.R)) place(id, 'home', x(pos))
      for (const [id, pos] of Object.entries(b.C)) {
        clubs.push({ id, box: { left: x(pos) - col / 2 + 3, top: midTop, width: col - 6, height: MID_H } })
        at[`c${id}`] = { in: { x: x(pos), y: midTop }, out: { x: x(pos), y: midTop + MID_H } }
      }
    }
    if (formerOnly.length) {
      if (rows) dividers.push({ x1: rows * col, y1: 0, x2: rows * col, y2: height })
      formerOnly.forEach((id, i) => place(String(id), info[id].side, (rows + i + 0.5) * col))
      note = { left: rows * col + 2, top: midTop, width: formerOnly.length * col - 4, height: MID_H }
    }
  } else {
    const side = Math.max(60, Math.min(132, (width - CLUB_W) / 2 - GUTTER))
    const clubLeft = (width - CLUB_W) / 2
    const place = (id, s, y) => {
      players.push({ id, side: s, box: { left: s === 'away' ? 0 : width - side, top: y - PLAYER_H / 2, width: side, height: PLAYER_H } })
      at[`p${id}`] = { x: s === 'away' ? side : width - side, y }
    }
    let top = 0
    bands.forEach((b, i) => {
      if (i) {
        dividers.push({ x1: 0, y1: top + BAND_GAP / 2, x2: width, y2: top + BAND_GAP / 2 })
        top += BAND_GAP
      }
      const y = (pos) => top + (pos + 0.5) * ROW
      for (const [id, pos] of Object.entries(b.L)) place(id, 'away', y(pos))
      for (const [id, pos] of Object.entries(b.R)) place(id, 'home', y(pos))
      for (const [id, pos] of Object.entries(b.C)) {
        clubs.push({ id, box: { left: clubLeft, top: y(pos) - CLUB_H / 2, width: CLUB_W, height: CLUB_H } })
        at[`c${id}`] = { in: { x: clubLeft, y: y(pos) }, out: { x: clubLeft + CLUB_W, y: y(pos) } }
      }
      top += b.rows * ROW
    })
    if (formerOnly.length) {
      if (bands.length) {
        dividers.push({ x1: 0, y1: top + BAND_GAP / 2, x2: width, y2: top + BAND_GAP / 2 })
        top += BAND_GAP
      }
      formerOnly.forEach((id, i) => place(String(id), info[id].side, top + (i + 0.5) * ROW))
      note = { left: clubLeft, top, width: CLUB_W, height: formerOnly.length * ROW }
      top += formerOnly.length * ROW
    }
    height = top
  }

  const curve = sideways ? curveDown : curveAcross
  const segments = []
  const seen = new Set()
  const line = (key, a, b) => {
    if (seen.has(key)) return
    seen.add(key)
    segments.push({ key, d: curve(a.x, a.y, b.x, b.y) })
  }
  for (const e of ladder.edges) {
    line(segL(e), at[`p${e.away}`], at[`c${e.club}`].in)
    line(segR(e), at[`c${e.club}`].out, at[`p${e.home}`])
  }
  return { sideways, height, players, clubs, segments, dividers, note }
}
