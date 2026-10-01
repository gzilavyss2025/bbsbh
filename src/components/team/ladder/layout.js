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
