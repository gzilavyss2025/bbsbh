// THE TWO HANDOVER MARKS on the #22 sheet — the red rules a scorer draws when
// the man doing a job changes mid-game. Split off scorecardGame.js at the file
// cap (ADR-0038); the grid builder there owns the clamp and calls both of
// these with cards it has ALREADY decided are revealed.
//
// SPOILER FOOTING: pure functions over cards handed in. Neither reads the feed,
// the linescore or a reveal mark, and neither can conjure a mark for a card
// that was not passed — so a sealed half, which contributes no cards, yields no
// marks by construction rather than by a check either of these has to remember.
//
// Both marks are anchored on the ARRIVING box, and the sheet draws them the
// same way: a rule across the box's top edge with a uniform number in red
// beside it (AtBatBox's `.sc-sub`). What they mean differs by whose change it
// was, which is why they are two functions and two keys on the slot, not one.

// The BATTING ORDER changed here. Every man who fills a slot shares its one row
// of boxes — his name goes on a written line of its own in the rail — so the
// rule falls in the column the INCOMING batter first bats in, on the box that
// is now his. The boundary is the slot's own trip-to-trip change of occupant:
// a card whose batter differs from the last card in the same slot.
//
// Takes the slot's column-indexed cells (the same map the sheet renders) and
// returns { colIndex: jersey }. The slot's first card can never carry a mark —
// somebody has to bat first — so the walk only starts comparing on the second.
export function battingChangeMarks(cells, columns) {
  const marks = {}
  let prevOcc = null
  columns.forEach((_, ci) => {
    const card = cells[ci]
    if (!card) return
    if (prevOcc != null && card.occIndex !== prevOcc) {
      marks[ci] = card.batter?.jersey ?? ''
    }
    prevOcc = card.occIndex
  })
  return marks
}

// The CLUB IN THE FIELD changed arms. The rule falls on the box of the first
// batter the new pitcher faces, so this one cannot be found a slot at a time:
// the change lands wherever the order happened to be, and the walk has to
// cross every slot on the sheet.
//
// IN THE ORDER THE GAME HAPPENED, which is `atBatIndex` and NOT column order.
// An inning where the side batted around widens into sub-columns whose
// left-to-right order is per-slot; walking columns would hand a reliever's mark
// to whichever slot's sub-column sorted first rather than to the batter who
// actually led off against him.
//
// The starter takes no mark — the first card only sets the comparison — and a
// placed runner (kind: 'placed') carries no pitcher at all: he faced nobody, so
// he neither draws a mark nor breaks the chain across the half he opens.
//
// Takes the per-slot cell maps in slot order and returns a Map of
// slot -> { colIndex: jersey }.
export function pitchingChangeMarks(cellsBySlot, columns) {
  const chrono = []
  cellsBySlot.forEach((cells, si) => {
    columns.forEach((_, ci) => {
      if (cells[ci]) chrono.push({ slot: si + 1, colIndex: ci, card: cells[ci] })
    })
  })
  chrono.sort((a, b) => (a.card.atBatIndex ?? 0) - (b.card.atBatIndex ?? 0))

  const bySlot = new Map()
  let prevPitcherId = null
  for (const { slot, colIndex, card } of chrono) {
    const id = card.pitcher?.id ?? null
    if (id == null) continue
    if (prevPitcherId != null && id !== prevPitcherId) {
      const marks = bySlot.get(slot) ?? {}
      marks[colIndex] = card.pitcher?.jersey ?? ''
      bySlot.set(slot, marks)
    }
    prevPitcherId = id
  }
  return bySlot
}
