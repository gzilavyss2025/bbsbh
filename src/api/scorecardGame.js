// The scorecard's inked grid — every plate appearance laid onto the Numbers
// Game "22" sheet, plus the sheet's own footer numbers (P/TP/LOB per inning,
// the two-row scoreboard with its FINAL block, the pitcher table, the
// decisions).
//
// SPOILER CLASSIFICATION: reveal-gated (ADR-0009's pattern, same as
// pitchers.js). Every builder here takes a `through` half-index and
// accumulates ONLY from half-innings at or under it, so nothing from a sealed
// half ever reaches the DOM. The product callers each hold the gate their own
// way:
//   • the live scorecard page passes the user's own `revealedThrough`
//     high-water mark (render-substituted under the Scores Unlocked pass,
//     ADR-0026, exactly as the innings viewer substitutes it);
//   • the box score's embedded sheet passes Infinity from INSIDE its one
//     SealBox reveal render — the whole game is already behind that seal
//     (ADR-0002), so there is nothing left for a clamp to hold back.
// The DEV-only Scorecard Lab passes Infinity too; it exists to see the whole
// game laid out and is dropped from the production module graph by App.jsx.
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
import { computeHalfInningFeed, battingSlot, pitchLadder } from './playbyplay.js'
import { revealInning, revealTotals } from './linescore.js'
import { computeDerivedByInning, revealDerived } from './derive.js'
import { computePitcherLines } from './pitchers.js'

// Event types that are a plate appearance but NOT an official at-bat, so the
// per-row AB tally excludes them (a walk, HBP, sacrifice, catcher's interference).
const NON_AB_EVENTS = new Set([
  'walk',
  'intent_walk',
  'hit_by_pitch',
  'sac_fly',
  // A sac fly that also turns a double play (a second runner retired on the
  // same play) is still excluded from at-bats by rule (9.02(a)(1)/9.08(d)) —
  // classifyOut and playbyplay.js's SAC_FLY_EVENTS already mark the batter's
  // own trip as the sacrifice, so this must agree or he's charged both a
  // sacrifice AND an at-bat for one plate appearance.
  'sac_fly_double_play',
  'sac_bunt',
  // sac_bunt_double_play is deliberately NOT listed here — unlike the fly
  // ball case, a sacrifice bunt is not credited at all when a runner is
  // retired advancing on it, so whether this is an at-bat depends on how MLB
  // actually scored it, which this eventType name doesn't say on its own.
  // See docs/unresolved-scoring-conventions.md.
  'catcher_interf',
])

// The KIND of out for the box's top-left corner (GO groundout, FO flyout, LO
// lineout, PO popout, SO strikeout, DP double play, FC fielder's choice, SAC
// sacrifice) — read off the result description the same way scorebookCode reads
// the fielder chain, so the two agree. '' when it's an out we can't classify;
// the fielder chain still shows in the diamond center. Only meaningful for outs.
function classifyOut(eventType, desc = '') {
  if (eventType === 'strikeout' || eventType === 'strikeout_double_play') return 'SO'
  // Sacrifices first, so a sac fly/bunt that also turned a double play is still
  // marked as the sacrifice it was for the batter (matches scorebookCode's SF/SAC).
  if (eventType === 'sac_fly' || eventType === 'sac_fly_double_play' || /sacrifice fly/i.test(desc)) return 'SF'
  if (eventType === 'sac_bunt' || eventType === 'sac_bunt_double_play' || /sacrifice (bunt|hit)/i.test(desc)) return 'SAC'
  if (/double play|grounded into/i.test(desc)) return 'DP'
  if (/lines? (out|into)/i.test(desc)) return 'LO'
  if (/pops? (out|into)/i.test(desc)) return 'PO'
  if (/flies? (out|into)/i.test(desc)) return 'FO'
  if (/grounds? (out|into)|grounded/i.test(desc)) return 'GO'
  if (/force(d)? out|fielder'?s choice/i.test(desc)) return 'FC'
  if (/sac(rifice)? bunt|bunt/i.test(desc)) return 'SAC'
  return ''
}

// What the scorecard sheet pencils in the DIAMOND CENTER, given a card's
// scorebook `code`. The play-by-play surface can break a code across lines —
// a GIDP reads "GIDP" over its relay chain (see scorebookCode) — but the
// sheet's center is a single-line chip (.sc-ab__center is `white-space:
// nowrap`) inside a 90px box, so a multi-line code arrives there as one
// unwrapped run that overhangs the box. Take the fielding chain alone: the
// box's top-left corner already carries the play KIND ("DP", via classifyOut),
// which is exactly how the paper sheet splits the two.
export function scorecardCenterCode(code) {
  return (code ?? '').split('\n').pop()
}

// Half-index of the game's last recorded play — the frontier every "did this
// half actually END?" question below is answered against. -1 with no plays.
function lastPlayedHalfIndex(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const last = plays[plays.length - 1]
  if (!last?.about?.inning || !last?.about?.halfInning) return -1
  return halfIndex(last.about.inning, last.about.halfInning)
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
// Each card is enriched with `outType` (top-left corner) and, where the batter
// changed from the slot's previous trip, `subBefore` (the substitution rule).
//
// Alongside the cards, the grid carries the #22 sheet's own footer row —
// per-inning P (pitches this side's batters saw), TP (the running total), and
// LOB (runners this side stranded), from the same derive/linescore readers
// the innings viewer's tally reads — and the inning-end diagonals
// (`endCells`): for each finished half, the next-due batter's unused box in
// that inning's column, where the scorer slashes "the inning ended before
// this slot; he leads off the next."
export function scorecardPlays(feed, side /* 'top' | 'bottom' */, { through = Infinity } = {}) {
  if (!feed) return null
  const battingSide = side === 'bottom' ? 'home' : 'away'
  const half = side === 'bottom' ? 'bottom' : 'top'
  const maxInning = visibleInnings(feed, through)
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1)
  const lastHalf = lastPlayedHalfIndex(feed)
  const isFinal = selectIsFinal(feed)

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

  // The last plate appearance of each included half, in feed order — its slot
  // decides whose empty box gets the inning-end diagonal below.
  const lastCardByInning = {}

  for (const inning of innings) {
    if (halfIndex(inning, half) > through) continue
    for (const card of computeHalfInningFeed(feed, inning, half, battingSide)) {
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
        lastCardByInning[inning] = { slot, interrupted: Boolean(card.interrupted) }
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

  // How many sub-columns each inning needs (>=1 so an un-batted inning still
  // shows a blank column), then the flattened column list every row shares.
  const columns = []
  for (const inning of innings) {
    let width = 1
    for (const s of slotData) width = Math.max(width, s.byInning[inning]?.length ?? 0)
    for (let sub = 0; sub < width; sub += 1) {
      columns.push({ inning, sub, inningStart: sub === 0 })
    }
  }

  // The inning-end diagonal, drawn where the #22's scorer draws it: when a
  // half ends, slash through the NEXT-due batter's unused box in the column
  // of the inning that just ended — "the inning ended before this slot; he
  // leads off the next." Only for a half that actually ENDED (the game has
  // moved past it, or is over): a revealed half still being scored gets no
  // premature slash. An interrupted last card gets none either — that batter
  // bats AGAIN next inning with a fresh count, and his box in the ended
  // inning is already used by the carry-over cell, so there is nothing to
  // slash. (In the bat-around case the next-due slot may have already batted
  // this inning; his unused box is then the widened sub-column's, which is
  // exactly where the paper sheet's slash lands too.)
  const endMarks = []
  for (const inning of innings) {
    const last = lastCardByInning[inning]
    if (!last || last.interrupted) continue
    if (!(halfIndex(inning, half) < lastHalf || isFinal)) continue
    const nextSlot = (last.slot % 9) + 1
    const sub = slotData[nextSlot - 1].byInning[inning]?.length ?? 0
    const colIndex = columns.findIndex((c) => c.inning === inning && c.sub === sub)
    if (colIndex >= 0) endMarks.push({ slot: nextSlot, colIndex })
  }

  const slots = slotData.map((s) => {
    const cells = {} // columnIndex -> card
    columns.forEach((col, ci) => {
      const card = s.byInning[col.inning]?.[col.sub]
      if (card) cells[ci] = card
    })
    // Mark the substitution boundary: a card whose batter differs from this
    // slot's previous plate appearance gets a rule drawn before it.
    let prevBatter = null
    columns.forEach((_, ci) => {
      const card = cells[ci]
      if (!card) return
      if (prevBatter != null && card.batterId !== prevBatter) card.subBefore = true
      prevBatter = card.batterId
    })
    // The inning-end diagonals that land on this slot's row, keyed by the
    // shared column index. They ride the slot's FIRST display row: the mark
    // means "this slot's box sat unused", so no occupant's card competes.
    const endCells = {}
    for (const m of endMarks) {
      if (m.slot === s.slot) endCells[m.colIndex] = true
    }
    // One display row per occupant (starter first), each with only his own
    // cards under the shared columns and his own line — so a pinch-hitter gets
    // his own sub-line beneath the starter instead of sharing one name label.
    const rows = s.occupants.map((occ) => {
      const occCells = {}
      for (const ci in cells) {
        if (cells[ci].occIndex === occ.index) occCells[ci] = cells[ci]
      }
      return { id: occ.id, name: occ.name, pos: occ.pos, cells: occCells, ab: occ.ab, h: occ.h, r: occ.r, rbi: occ.rbi }
    })
    return { slot: s.slot, cells, rows, endCells, ab: s.ab, h: s.h, r: s.r, rbi: s.rbi }
  })

  // The #22's own row under the grid: P (pitches this side's batters saw that
  // inning), TP (the running total), LOB (runners this side stranded), from
  // the same per-half readers the innings viewer's tally reads
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
    const p = revealDerived(derived, inning, half).pitches
    tp += p
    perInning[inning] = {
      p,
      tp,
      lob: line?.leftOnBase ?? 0,
      runs: line?.runs ?? 0,
    }
  }

  const totals = slots.reduce(
    (a, s) => ({ ab: a.ab + s.ab, h: a.h + s.h, r: a.r + s.r, rbi: a.rbi + s.rbi }),
    { ab: 0, h: 0, r: 0, rbi: 0 },
  )

  return { columns, innings, slots, endMarks, perInning, totals }
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
    // "E. Lauer" — the first-initial style the #22's pitcher column is sized
    // for; a name-parts miss degrades to whichever half survives.
    name: [p.first ? `${p.first[0]}.` : '', p.last].filter(Boolean).join(' '),
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
export function scorecardFull(loaded, side, { through = Infinity } = {}) {
  const view = scorecardView(loaded, side)
  if (!view) return null
  return {
    ...view,
    grid: scorecardPlays(loaded.feed, side, { through }),
    scoreboard: scorecardScoreboard(loaded.feed, { through }),
    pitchers: scorecardPitchers(loaded.feed, side, { through }),
  }
}
