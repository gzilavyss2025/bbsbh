// The organization's depth by position and level, before and after a deal
// (/trade). Pure. A player is { id, pos, level }, where level is one of LEVELS
// and pos is a roster abbreviation (P, C, 1B, ..., or RHP/LHP from a prospect
// list).

export const LEVELS = ['MLB', 'AAA', 'AA', 'A+', 'A', 'Rk']
export const SLOTS = ['C', '1B', '2B', 'SS', '3B', 'OF', 'P']

const SLOT_OF = {
  C: 'C', '1B': '1B', DH: '1B', '2B': '2B', SS: 'SS', '3B': '3B', IF: 'SS',
  LF: 'OF', CF: 'OF', RF: 'OF', OF: 'OF',
  P: 'P', SP: 'P', RP: 'P', RHP: 'P', LHP: 'P', TWP: 'P',
}
export const slotOf = (pos) => SLOT_OF[pos] ?? null

// rows: one per slot, each { slot, cells: { [level]: { before, after, out, in, stay } } },
// where `stay` are the players who remain.
// `out` are this club's players leaving; `inn` are the other club's arriving,
// who land at the level they play now.
export function depthGrid(players, { out = [], inn = [] } = {}) {
  const outIds = new Set(out.map((p) => p.id))
  const rows = SLOTS.map((slot) => ({
    slot,
    cells: Object.fromEntries(LEVELS.map((l) => [l, { before: 0, after: 0, out: [], in: [], stay: [] }])),
  }))
  const at = (p) => {
    const slot = slotOf(p.pos)
    return slot && LEVELS.includes(p.level) ? rows[SLOTS.indexOf(slot)].cells[p.level] : null
  }
  for (const p of players) {
    const c = at(p)
    if (!c) continue
    c.before += 1
    if (outIds.has(p.id)) c.out.push(p)
    else {
      c.after += 1
      c.stay.push(p)
    }
  }
  for (const p of inn) {
    const c = at(p)
    if (!c) continue
    c.after += 1
    c.in.push(p)
  }
  return rows
}

// The slots where the big club and its top farm level hold the fewest players
// after the deal: what a reader would call the club's need. Ties keep slot order.
// A pitching slot is judged against a staff (13 arms), a position against 2.
export function thinnest(rows, { count = 2 } = {}) {
  const near = (r) => r.cells.MLB.after + r.cells.AAA.after
  const want = (r) => (r.slot === 'P' ? 13 : r.slot === 'OF' ? 5 : 2)
  return rows
    .map((r) => ({ slot: r.slot, ratio: near(r) / want(r), have: near(r) }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, count)
}

// The three ways the card can name a club's need near the majors (MLB + AAA,
// after the deal). Each returns rows sorted thinnest first:
//   count   — head count against what a club carries there (thinnest above)
//   war     — last season's WAR left at the spot, with what the deal changed
//   starter — the best player left at the spot; under 1.0 WAR is "no starter"
// A player's `war` is null when he has none on file.
const near = (c) => [c.MLB, c.AAA]
const warOf = (ps) => ps.reduce((t, p) => t + (p.war ?? 0), 0)

export function needBy(rows, mode, { count = 3 } = {}) {
  if (mode === 'war') {
    return rows
      .map((r) => {
        const after = near(r.cells).reduce((t, c) => t + warOf(c.stay) + warOf(c.in), 0)
        const before = near(r.cells).reduce((t, c) => t + warOf(c.stay) + warOf(c.out), 0)
        return { slot: r.slot, war: after, change: after - before }
      })
      .sort((a, b) => a.war - b.war)
      .slice(0, count)
  }
  if (mode === 'starter') {
    return rows
      .map((r) => {
        const pool = near(r.cells).flatMap((c) => [...c.stay, ...c.in])
        const best = [...pool].sort((a, b) => (b.war ?? -99) - (a.war ?? -99))[0] ?? null
        return { slot: r.slot, best, starter: (best?.war ?? -99) >= 1 }
      })
      .filter((n) => n.slot !== 'P')
      .sort((a, b) => (a.starter === b.starter ? (a.best?.war ?? -99) - (b.best?.war ?? -99) : a.starter ? 1 : -1))
      .slice(0, count)
  }
  return thinnest(rows, { count })
}
