// The scorecard's inked grid — every plate appearance laid onto the Numbers
// Game "22" sheet, plus the sheet's own footer numbers (P/WH/FO per inning,
// the two-row scoreboard with its FINAL block, the pitcher table, the
// decisions).
//
// SPOILER CLASSIFICATION: reveal-gated (ADR-0009's pattern, same as
// pitchers.js). Every builder here takes a `through` half-index and
// accumulates ONLY from half-innings at or under it, so nothing from a sealed
// half ever reaches the DOM. The live scorecard page (its one product caller)
// passes the user's own `revealedThrough` high-water mark, render-substituted
// under the Scores Unlocked pass exactly as the innings viewer substitutes it
// (ADR-0026). The DEV-only Scorecard Lab passes Infinity instead; it exists
// to see the whole game laid out and is dropped from the production module
// graph by App.jsx. A second product caller, the box score's own embedded
// copy of this sheet, was retired once the game's top nav pointed at this
// live page directly instead (ADR-0047's second amendment) — do not re-add
// it without reading that amendment first.
//
// Extra innings never spoil (ADR-0008): the visible inning columns are
// regulation plus one extra at a time as `through` crosses each extra's
// bottom half — the same walk as revealProgressCore's unlockedInnings, kept
// in step by test/scorecard-game.test.js so the sheet and the innings viewer
// can never disagree about how many columns tonight has.
//
// HISTORY. This grid began as loadScorecard.js's full-reveal half, safe only
// because its one consumer was DEV-gated out of the production build (the
// "scorecardPlays appears nowhere in a built dist/" era, PR #705). That
// containment argument is retired on purpose: the grid is a product surface
// now, and its safety is the clamp above rather than a DEV gate. The
// spoiler-free pre-pitch half (the loader + staging view) stays behind in
// loadScorecard.js — which is finally the spoiler-free module its header
// once falsely claimed to be.

import {
  selectTeamMeta,
  selectInningCount,
  selectRegulationInnings,
  selectIsFinal,
  halfIndex,
} from './select.js'
import { scorecardView } from './loadScorecard.js'
import { computeHalfInningFeed, battingSlot, pitchLadder, nextStepBoundary } from './playbyplay.js'
import { revealInning, revealTotals } from './linescore.js'
import { computeDerivedByInning, revealDerived } from './derive.js'
import { computePitcherLines } from './pitchers.js'
import { NON_AB_EVENTS, classifyOut, scorecardCenterCode } from './scorecard/notation.js'

// The sheet's pure notation rules live a file away (scorecard/notation.js) and
// are re-exported here, so a caller still reaches them through this module.
export { scorecardCenterCode }

// Half-index of the game's last recorded play — the frontier every "did this
// half actually END?" question below is answered against. -1 with no plays.
function lastPlayedHalfIndex(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const last = plays[plays.length - 1]
  if (!last?.about?.inning || !last?.about?.halfInning) return -1
  return halfIndex(last.about.inning, last.about.halfInning)
}

// halfIndex's inverse: the (inning, half, batting side-of-sheet) a half-index
// names. Structural, same footing as halfIndex itself.
function halfAt(idx) {
  const inning = Math.floor(idx / 2) + 1
  const half = idx % 2 === 1 ? 'bottom' : 'top'
  return { inning, half, side: half === 'top' ? 'top' : 'bottom' }
}

// The sheet's own reveal step — the state the live scorecard's face-down
// frontier card plays against. The half AFTER `through` is the one being
// stepped; `count` is how many of its feed entries are already revealed (the
// same entry-count cursor the innings viewer's at-bat stepping persists,
// ADR-0016, so the two surfaces share one mark and can never double-reveal).
// Returns null when there is nothing to step: the game hasn't reached that
// half, or the sheet is fully caught up to a finished game.
//
//   total     — entries in the stepped half so far (grows live via Refresh)
//   nextCount — the cursor after one more step (one plate appearance plus
//               the notes trailing it — nextStepBoundary's bundling)
//   halfOver  — the half has actually ENDED (the game moved past it, or is
//               Final): stepping past `total` may then commit the whole half
//               (revealTo); a still-live half instead waits for new entries.
export function scorecardStep(feed, through, countFor = () => 0) {
  if (!feed) return null
  const idx = through + 1
  const last = lastPlayedHalfIndex(feed)
  if (last < 0 || idx > last) return null
  const { inning, half, side } = halfAt(idx)
  const battingSide = half === 'top' ? 'away' : 'home'
  const entries = computeHalfInningFeed(feed, inning, half, battingSide)
  if (entries.length === 0) return null
  // The persisted cursor for THIS half (0 for any other half — the caller
  // hands in useRevealProgress's own atBatCountFor, so the sheet and the
  // innings viewer read one mark).
  const count = countFor(inning, half)
  return {
    inning,
    half,
    side,
    count,
    total: entries.length,
    nextCount: nextStepBoundary(entries, count),
    halfOver: idx < last || selectIsFinal(feed),
  }
}

// How many inning columns the sheet shows for a given clamp: regulation, plus
// one extra at a time as each extra's bottom half clears `through` — the same
// walk as revealProgressCore's unlockedInnings (extras never spoil, ADR-0008).
// Deliberately computed HERE from the same inputs rather than imported from
// the hooks layer (the api layer stays free of src/hooks);
// test/scorecard-game.test.js pins the two walks to the same answers.
function visibleInnings(feed, through) {
  const actual = selectInningCount(feed)
  if (through === Infinity) return actual
  let u = selectRegulationInnings(feed)
  while (u < actual && through >= halfIndex(u, 'bottom')) u++
  return u
}

// Every plate appearance of the batting team, laid onto the scorecard grid by
// batting-order slot (row) × COLUMN, clamped to `through` (see the module
// header). Columns are the innings, but an inning in which some slot batted
// more than once (the team batting around) widens into as many sub-columns as
// the busiest slot needed — so a slot's second trip in an inning lands in the
// NEXT column, the way a paper scorebook flows it, while every inning still
// occupies the same columns for every row (the header + the per-inning totals
// stay aligned). Reuses the game view's own per-half feed builder
// (computeHalfInningFeed) so each cell is a real `atbat` card in exactly the
// shape AtBatBox renders — diamond, scorebook code, RBIs, outs all free.
// Each card is enriched with `outType` (top-left corner); a slot's handover is
// recorded on the OUTGOING man's row instead (`subMarks`, see below).
//
// Alongside the cards, the grid carries the #22 sheet's own footer row —
// per-inning P (pitches this side's batters saw), WH (swings and misses) and
// FO (balls fouled off), from the same derive readers the innings viewer's
// tally reads — and the leadoff boxes
// (`leadoffCells`): for each finished half, the next-due batter's unused box
// in that inning's column. Nothing is DRAWN there; it is the location the
// live page's turn handoff puts its flip button in.
//
// `step` is the live sheet's play-in-place layer (see scorecardStep): the
// half at `step.halfIdx` — always through+1, the reveal frontier — shows its
// first `step.count` entries' cards even though the half isn't committed,
// exactly the cards the innings viewer's own stepping would show for the
// same persisted cursor. The stepped half deliberately contributes NOTHING
// else: no P/WH/FO line, no inning-end diagonal, no scoreboard cell — those
// are whole-half facts, and they ink on commit (ADR-0016's collapse), never
// mid-step. When there is a next plate appearance to reveal on THIS side's
// sheet, the grid also carries `frontier` — the { slot, colIndex } cell that
// card will occupy, where the page renders its face-down seal.
export function scorecardPlays(feed, side /* 'top' | 'bottom' */, { through = Infinity, step = null } = {}) {
  if (!feed) return null
  const battingSide = side === 'bottom' ? 'home' : 'away'
  const half = side === 'bottom' ? 'bottom' : 'top'
  const maxInning = visibleInnings(feed, through)
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1)
  const lastHalf = lastPlayedHalfIndex(feed)
  const isFinal = selectIsFinal(feed)
  // The stepped half, when it belongs to this side's sheet and its inning
  // column is on the sheet (it always is — through+1 can only reach an extra
  // inning once the previous bottom committed, which is exactly when
  // visibleInnings grows).
  const stepHere =
    step != null && halfAt(step.halfIdx).side === side && halfAt(step.halfIdx).inning <= maxInning
      ? { inning: halfAt(step.halfIdx).inning, count: step.count }
      : null

  const descByAtBat = new Map()
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    if (p?.about?.atBatIndex != null) {
      descByAtBat.set(p.about.atBatIndex, p.result?.description ?? '')
    }
  }

  // Per slot: this inning's cards in plate-appearance order, plus running
  // tallies and the ordered list of players who occupied the slot (starter
  // first, then each substitute) so the sheet can give each his own sub-line.
  const slotData = Array.from({ length: 9 }, (_, i) => ({
    slot: i + 1,
    byInning: {}, // inning -> [card, …]
    occById: new Map(), // batterId -> occupant record
    occupants: [], // occupant records in the order they took the slot
    ab: 0,
    h: 0,
    r: 0,
    rbi: 0,
  }))

  // The last plate appearance of each included half, in feed order — its own
  // box takes the inning-end rule, and its slot decides whose empty box gets
  // the leads-off-next diagonal below.
  const lastCardByInning = {}

  // The frontier's target cell, filled in below once the columns exist.
  let frontier = null
  let frontierSub = null

  for (const inning of innings) {
    const idx = halfIndex(inning, half)
    const stepped = stepHere != null && stepHere.inning === inning && idx === through + 1
    if (idx > through && !stepped) continue
    // The cursor is passed as computeHalfInningFeed's own `stepCap`, not just
    // used to slice below — the two do DIFFERENT jobs and the sheet needs
    // both. Slicing drops the cards past the cursor; the cap is what stops a
    // later play from being folded BACK onto an earlier card that is already
    // inked (entriesView.js's "THE TRAP EVERY READER HERE MUST CLEAR"). Built
    // uncapped, the half's whole advancement bookkeeping — outNumber, outAt,
    // outCode, reached, scored — landed on cards the reader had already
    // turned over: a runner wearing the double play that erased him a tap
    // before that batter's own box existed, and a run filled in before the
    // at-bat that drove it in. The innings viewer passes the same cursor for
    // the same reason, so the two surfaces read one mark identically
    // (ADR-0016).
    const entries = computeHalfInningFeed(
      feed,
      inning,
      half,
      battingSide,
      stepped ? stepHere.count : null,
    )
    // A stepped half shows only the entries the cursor has revealed; a
    // committed half shows them all.
    const visibleEntries = stepped ? entries.slice(0, stepHere.count) : entries
    for (const card of visibleEntries) {
      // The extra-innings automatic runner (`kind: 'placed'`) took no plate
      // appearance, but he has a real battingOrder — he's by rule the
      // previous half's last batter — so `battingSlot` resolves him a row
      // same as any hitter. Give him a cell there rather than dropping his
      // card: without one his run reached the linescore's own R column but
      // never this grid's, disagreeing with the scoreboard on the same
      // sheet. Normalize his card onto the same `batterId`/`batter` shape
      // the rest of this loop reads, so nothing downstream needs to branch.
      const isPlaced = card.kind === 'placed'
      if (card.kind !== 'atbat' && !isPlaced) continue
      if (isPlaced) {
        card.batterId = card.runnerId
        card.batter = card.runner
      }
      const slot = battingSlot(feed, battingSide, card.batterId)
      if (!slot || slot < 1 || slot > 9) continue
      const s = slotData[slot - 1]
      card.outType = card.codeKind === 'out' ? classifyOut(card.eventType, descByAtBat.get(card.atBatIndex)) : ''
      card.centerCode = scorecardCenterCode(card.code)
      // Each pitch sorted into its ball / strike column (in-play = 'X'), the
      // same two-column ladder the live play-by-play card uses. The placed
      // runner faced no pitches, so this is an empty ladder for him.
      card.ladder = pitchLadder(card.pitches ?? [])
      ;(s.byInning[inning] ??= []).push(card)
      // The placed runner opens a half, never ends one, so he can't be the
      // half's last trip; an interrupted card CAN be (the half died on the
      // bases mid-count) and is flagged — that batter bats again next inning,
      // so his row gets no diagonal.
      if (!isPlaced) {
        lastCardByInning[inning] = { slot, card, interrupted: Boolean(card.interrupted) }
      }
      // Which occupant of the slot this card belongs to (0 = starter), plus his
      // own AB/H/R/RBI so each sub-line carries its own line, not the slot's sum.
      let occ = s.occById.get(card.batterId)
      if (!occ) {
        const b = card.batter ?? {}
        occ = {
          id: card.batterId,
          name: b.last ? `${b.last}${b.first ? `, ${b.first}` : ''}` : b.fullName ?? '',
          pos: b.pos ?? '',
          jersey: b.jersey ?? '',
          index: s.occupants.length,
          ab: 0,
          h: 0,
          r: 0,
          rbi: 0,
        }
        s.occById.set(card.batterId, occ)
        s.occupants.push(occ)
      }
      card.occIndex = occ.index
      if (card.codeKind === 'hit') { s.h += 1; occ.h += 1 }
      // An INTERRUPTED at-bat (the half ended on the bases mid-count — see
      // computeHalfInningFeed) still gets its cell (the pitches were real),
      // but no at-bat or plate appearance was charged, so it counts toward
      // nothing. Its eventType is the baserunning event's
      // (caught_stealing_2b…), which NON_AB_EVENTS alone wouldn't exclude.
      // The placed runner is excluded the same way — he's not a plate
      // appearance at all, official or otherwise.
      if (!isPlaced && !card.interrupted && !NON_AB_EVENTS.has(card.eventType)) { s.ab += 1; occ.ab += 1 }
      if (card.scored) { s.r += 1; occ.r += 1 }
      s.rbi += card.rbi ?? 0
      occ.rbi += card.rbi ?? 0
    }
  }

  // Where the NEXT plate appearance of the stepped half will land: the first
  // at-bat entry at or past the cursor names the batter, his slot names the
  // row, and the cards he already has in this inning name the sub-column.
  // Resolved before the columns are built so a bat-around frontier can widen
  // its inning by the one extra column its face-down card needs.
  if (stepHere != null) {
    const entries = computeHalfInningFeed(feed, stepHere.inning, half, battingSide)
    const next = entries.slice(stepHere.count).find((e) => e.kind === 'atbat')
    if (next) {
      const slot = battingSlot(feed, battingSide, next.batterId)
      if (slot >= 1 && slot <= 9) {
        frontierSub = slotData[slot - 1].byInning[stepHere.inning]?.length ?? 0
        frontier = { slot }
      }
    }
  }

  // How many sub-columns each inning needs (>=1 so an un-batted inning still
  // shows a blank column, and the frontier's inning always has room for its
  // face-down card), then the flattened column list every row shares.
  const columns = []
  for (const inning of innings) {
    let width = 1
    for (const s of slotData) width = Math.max(width, s.byInning[inning]?.length ?? 0)
    if (frontier != null && stepHere?.inning === inning) {
      width = Math.max(width, frontierSub + 1)
    }
    for (let sub = 0; sub < width; sub += 1) {
      columns.push({ inning, sub, inningStart: sub === 0 })
    }
  }
  if (frontier != null) {
    frontier.colIndex = columns.findIndex(
      (c) => c.inning === stepHere.inning && c.sub === frontierSub,
    )
  }

  // What a FINISHED half leaves behind: one mark, and one location.
  //
  // Both take the same gate — the half must be COMMITTED (at or under
  // `through`; a stepped half takes neither mid-step, even on a Final game
  // being replayed, like the P/WH/FO line below) and must have actually
  // ENDED (the game has moved past it, or is over), so a revealed half still
  // being scored gets neither prematurely.
  //
  //  • `endsHalf` on the LAST plate appearance's own card — the scorer's
  //    end-of-inning slash, drawn diagonally across that box's lower-right
  //    corner. Set even when that card is `interrupted` (the half died on
  //    the bases mid-count): the half ended at that box either way, which is
  //    the only thing the mark claims. Anchored on the last PLATE
  //    APPEARANCE, not on the cell that recorded the third out — the two
  //    differ whenever the out was a runner cut down during a later batter's
  //    trip, and a half can also end with no third out at all (a walk-off).
  //  • `leadoffMarks` — the unused box on the row BELOW the one that closed
  //    the half, in the column of the inning that just ended. NOT a mark:
  //    nothing is drawn there. It is a LOCATION, and its one consumer is the
  //    live page's turn handoff, which puts its flip button in that box
  //    (ScorecardSheet's `flip`). The corner-to-corner diagonal that used to
  //    be slashed here is retired — it was a second, competing end-of-inning
  //    notation, and the slash above is the one the scorer actually draws.
  //    The row below is USUALLY the next-due batter's, and for an ordinary
  //    half it exactly is. It is not when the half died mid-count on the
  //    bases (an inning-ending caught stealing): that batter bats AGAIN next
  //    inning, so the next-due row is his own and his box is already spent on
  //    the carry-over card. The handoff still belongs on the sheet, so it
  //    takes the empty box directly under the "CS →" — where the eye lands
  //    when the half closes — rather than vanishing and leaving the reader
  //    with only the Top/Bottom control to find. (In the bat-around case the
  //    row below may have already batted this inning; its unused box is then
  //    the widened sub-column's, and if the inning was never widened that far
  //    there is no box and no handoff.)
  //
  // Each location carries its own `inning` so a caller can single one out —
  // the handoff belongs to the half that JUST ended and must be tellable
  // from every older half's (ScorecardPage).
  const leadoffMarks = []
  for (const inning of innings) {
    const last = lastCardByInning[inning]
    if (!last) continue
    if (halfIndex(inning, half) > through) continue
    if (!(halfIndex(inning, half) < lastHalf || isFinal)) continue
    last.card.endsHalf = true
    const nextSlot = (last.slot % 9) + 1
    const sub = slotData[nextSlot - 1].byInning[inning]?.length ?? 0
    const colIndex = columns.findIndex((c) => c.inning === inning && c.sub === sub)
    if (colIndex >= 0) leadoffMarks.push({ slot: nextSlot, colIndex, inning })
  }

  const slots = slotData.map((s) => {
    const cells = {} // columnIndex -> card
    columns.forEach((col, ci) => {
      const card = s.byInning[col.inning]?.[col.sub]
      if (card) cells[ci] = card
    })
    // The SUBSTITUTION MARK, and whose row it belongs on. A scorer draws the
    // change on the line of the man LEAVING — a rule down the column where he
    // stopped batting, with the incoming man's uniform number beside it — not
    // on the line of the man coming in. So the boundary is detected on the
    // arriving card (its batter differs from the slot's previous trip) but
    // recorded against the OUTGOING occupant, keyed by the column the new man
    // first bats in. That box is always empty on the outgoing row (a column
    // holds one card for the whole slot, and the newcomer owns this one), so
    // the mark never competes with notation.
    let prevOcc = null
    const subMarksByOcc = new Map() // occupant index -> { colIndex: jersey }
    columns.forEach((_, ci) => {
      const card = cells[ci]
      if (!card) return
      if (prevOcc != null && card.occIndex !== prevOcc) {
        const marks = subMarksByOcc.get(prevOcc) ?? {}
        marks[ci] = card.batter?.jersey ?? ''
        subMarksByOcc.set(prevOcc, marks)
      }
      prevOcc = card.occIndex
    })
    // The leadoff boxes that land on this slot's row, keyed by the shared
    // column index and valued by the INNING that ended (never a bare `true` —
    // the turn handoff has to tell the newest from every older one). They
    // ride the slot's FIRST display row: the box sat unused, so no occupant's
    // card competes for it.
    const leadoffCells = {}
    for (const m of leadoffMarks) {
      if (m.slot === s.slot) leadoffCells[m.colIndex] = m.inning
    }
    // One display row per occupant (starter first), each with only his own
    // cards under the shared columns and his own line — so a pinch-hitter gets
    // his own sub-line beneath the starter instead of sharing one name label.
    const rows = s.occupants.map((occ) => {
      const occCells = {}
      for (const ci in cells) {
        if (cells[ci].occIndex === occ.index) occCells[ci] = cells[ci]
      }
      return {
        id: occ.id,
        name: occ.name,
        pos: occ.pos,
        jersey: occ.jersey,
        cells: occCells,
        // Where THIS man handed the slot over, and to whose number.
        subMarks: subMarksByOcc.get(occ.index) ?? null,
        ab: occ.ab,
        h: occ.h,
        r: occ.r,
        rbi: occ.rbi,
      }
    })
    return { slot: s.slot, cells, rows, leadoffCells, ab: s.ab, h: s.h, r: s.r, rbi: s.rbi }
  })

  // The #22's own row under the grid: P (pitches this side's batters saw that
  // inning), WH (swings and misses) and FO (balls fouled off) — what the half
  // COST the pitcher, which is what a scorer keeps a foot row for. It read
  // P/TP/LOB until PR #725: the running pitch total repeated P's own sum a
  // column later, and LOB is already on the sheet in the FINAL block. All
  // three come from the per-half readers the innings viewer's tally reads
  // (computeDerivedByInning / revealInning) — never a second walk that could
  // disagree with it. A half past the clamp, or one the game never reached,
  // is null and the sheet leaves its boxes blank to write on.
  const derived = computeDerivedByInning(feed)
  const perInning = {}
  let tp = 0
  for (const inning of innings) {
    const line = revealInning(feed, inning, battingSide)
    const played =
      halfIndex(inning, half) <= through && (line != null || lastCardByInning[inning] != null)
    if (!played) {
      perInning[inning] = null
      continue
    }
    const d = revealDerived(derived, inning, half)
    tp += d.pitches
    perInning[inning] = {
      p: d.pitches,
      // What the batting side DID with those pitches — swings and misses, and
      // balls fouled off. The sheet's foot row shows P / WH / FO; `tp` (the
      // running pitch total) and `lob` stay on the line because the scoreboard
      // block and the tests read them, even though no cell prints them now.
      whiffs: d.whiffs,
      fouls: d.fouls,
      tp,
      lob: line?.leftOnBase ?? 0,
      runs: line?.runs ?? 0,
    }
  }

  const totals = slots.reduce(
    (a, s) => ({ ab: a.ab + s.ab, h: a.h + s.h, r: a.r + s.r, rbi: a.rbi + s.rbi }),
    { ab: 0, h: 0, r: 0, rbi: 0 },
  )

  return { columns, innings, slots, leadoffMarks, perInning, totals, frontier }
}

// The sheet's scoreboard block, #22 shape: runs per inning for BOTH clubs over
// the visible innings, then the FINAL line — R/H/E/LOB — and the three
// decisions (WP/LP/SV). Each per-inning cell is clamped on ITS OWN half: the
// away row shows inning n only once the top of n is at or under `through`,
// the home row only once the bottom is — so mid-game the board fills exactly
// as far as the reveal mark, never a half ahead of it.
//
// The FINAL line and the decisions are whole-game facts with no per-half
// clamp possible, so they fill only once there is nothing left to hold back:
// the game is Final AND every played half sits at or under `through`
// (`done`). Until then they are null/'' and the sheet leaves the write-in
// boxes empty — the same "you haven't gotten there yet" blank as an
// unrevealed inning cell. A skipped bottom half (the home club ahead, never
// needed to bat) reads 'X' once the game is done, the linescore's own mark.
export function scorecardScoreboard(feed, { through = Infinity } = {}) {
  if (!feed) return null
  const maxInning = visibleInnings(feed, through)
  const lastHalf = lastPlayedHalfIndex(feed)
  const done = selectIsFinal(feed) && (through === Infinity || through >= lastHalf)

  const innings = []
  for (let n = 1; n <= maxInning; n++) {
    const cell = (side, half) => {
      if (halfIndex(n, half) > through) return ''
      const runs = revealInning(feed, n, side)?.runs
      if (runs != null) return runs
      return done && halfIndex(n, half) > lastHalf ? 'X' : ''
    }
    innings.push({
      num: n,
      away: cell('away', 'top'),
      home: cell('home', 'bottom'),
    })
  }

  const side = (s) => {
    const meta = selectTeamMeta(feed, s)
    const totals = done ? revealTotals(feed, s) : null
    return {
      abbr: meta.abbreviation,
      name: meta.teamName || meta.name,
      final: totals
        ? { r: totals.runs, h: totals.hits, e: totals.errors, lob: totals.leftOnBase }
        : null,
    }
  }

  // Pitchers of record, by scorebook label. Field path verified against gamePk
  // 823035 (2026-07-07 MIL@STL g2): liveData.decisions carries winner/loser/
  // save as { id, fullName }, and is absent until the game is Final.
  const d = done ? feed?.liveData?.decisions ?? {} : {}
  const decisions = {
    wp: d.winner?.fullName ?? '',
    lp: d.loser?.fullName ?? '',
    sv: d.save?.fullName ?? '',
  }

  return { innings, away: side('away'), home: side('home'), decisions, done }
}

// The fielding club's pitching lines for one side of the sheet — the arms
// that faced this batting order, in the order they entered, each with the
// #22's own columns (R/L, IP, P, BF, H, R, ER, BB, K). Built on
// computePitcherLines, which owns the ADR-0009 clamp: a line accumulates only
// from plays in half-innings at or under `through`, and only pitchers who
// have already appeared within the clamp get a row at all.
export function scorecardPitchers(feed, side /* 'top' | 'bottom' */, { through = Infinity } = {}) {
  if (!feed) return []
  const fieldingSide = side === 'bottom' ? 'away' : 'home'
  const lines = computePitcherLines(feed, through)[fieldingSide] ?? []
  return lines.map((p) => ({
    id: p.id,
    // "Lauer, Eric" — surname first, the way a scorer writes a pitcher onto
    // the sheet and the way every other name column here reads. A name-parts
    // miss degrades to whichever half survives.
    name: p.last ? `${p.last}${p.first ? `, ${p.first}` : ''}` : p.first ?? '',
    jersey: p.jersey ?? '',
    hand: p.hand,
    ip: p.ip,
    p: p.pitches,
    bf: p.bf,
    h: p.h,
    r: p.r,
    er: p.er,
    bb: p.bb,
    k: p.k,
  }))
}

// The one-call composite a scorecard surface renders from: the spoiler-free
// pre-pitch view (loadScorecard.js's scorecardView — header fields, lineup,
// defense, starter) PLUS the clamped grid, scoreboard and pitcher table
// above, for a given half. `loaded` is loadScorecardGame's shape, or any
// `{ feed, managers, uniformBrief }` a screen assembled from useGameData's
// own fetches (see scorecardView's header for the accepted shapes).
export function scorecardFull(loaded, side, { through = Infinity, step = null } = {}) {
  const view = scorecardView(loaded, side)
  if (!view) return null
  return {
    ...view,
    // Only the GRID takes the step: the scoreboard and the pitcher table are
    // whole-half readings on this sheet and ink on commit, mid-step never.
    grid: scorecardPlays(loaded.feed, side, { through, step }),
    scoreboard: scorecardScoreboard(loaded.feed, { through }),
    pitchers: scorecardPitchers(loaded.feed, side, { through }),
  }
}
