// Loader + view selector for the Scorecard Lab's "load a real game" mode. It
// pulls ONLY spoiler-free, pre-pitch reference data — the lineup, the defensive
// alignment, the umpire crew, the starters, and the header write-in fields — the
// same staging information the lineup pages already show before first pitch. The
// score-revealing cells (the at-bat grid, the pitcher's line, the scoreboard)
// are never fetched into here; you still ink those by hand. So, unlike the live
// game view, this needs no SealBox: there is no sealed number in what it reads.
//
// Managers and uniforms aren't in the live feed (see api/game.js + api/uniforms.js),
// so they ride their own fetches alongside it; both degrade to null/'' and the
// sheet just shows a blank write-in line, same as the empty template.

import { fetchGameFeed, fetchManager, managerLabel } from './game.js'
import { fetchGameUniforms, uniformSummary } from './uniforms.js'
import {
  selectLineup,
  selectOpposingDefense,
  selectOpposingPitcher,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
  selectInningCount,
} from './select.js'
import { computeHalfInningFeed, battingSlot, pitchLadder } from './playbyplay.js'
import { revealInning, revealTotals } from './linescore.js'

// Fetch the raw pieces for a gamePk: the live feed plus the two out-of-feed
// sources (managers, uniforms), in parallel once the feed resolves the team ids
// and season. Throws only if the feed itself fails — the side fetches each
// degrade to null on their own.
export async function loadScorecardGame(gamePk) {
  const feed = await fetchGameFeed(gamePk)
  const season = feed?.gameData?.game?.season
  const awayId = feed?.gameData?.teams?.away?.id
  const homeId = feed?.gameData?.teams?.home?.id
  const [awayMgr, homeMgr, uniforms] = await Promise.all([
    fetchManager(awayId, season),
    fetchManager(homeId, season),
    fetchGameUniforms(gamePk),
  ])
  return { feed, managers: { away: awayMgr, home: homeMgr }, uniforms }
}

// Shape the loaded game into everything one half's sheet renders. `side` picks
// which team's card this is: 'top' = the visitors bat (home team defends),
// 'bottom' = the home team bats (visitors defend). The batting team fills the
// header + lineup; the fielding team fills the defense diamond + pitcher table
// (the arms that face this lineup). Every field falls back to '' / [] so a
// MiLB feed missing lineups or a crew renders blanks instead of crashing.
export function scorecardView(loaded, side /* 'top' | 'bottom' */) {
  if (!loaded?.feed) return null
  const { feed, managers, uniforms } = loaded
  const battingSide = side === 'bottom' ? 'home' : 'away'
  const fieldingSide = battingSide === 'away' ? 'home' : 'away'

  const batMeta = selectTeamMeta(feed, battingSide)
  const fieldMeta = selectTeamMeta(feed, fieldingSide)
  const officials = selectOfficials(feed)
  const umpiresByRole = {}
  for (const o of officials) umpiresByRole[o.role] = o.name ?? ''
  const info = selectGameInfo(feed)
  const pitcher = selectOpposingPitcher(feed, battingSide)

  return {
    teamName: batMeta.name,
    manager: managerLabel(managers?.[battingSide]),
    uniforms: uniformSummary(uniforms?.[battingSide], battingSide, batMeta.clubName),
    firstPitch: info.firstPitch,
    umpiresByRole,
    lineup: selectLineup(feed, battingSide).map((r) => ({
      pos: r.position,
      name: r.nameLastFirst,
    })),
    // The fielding team's name titles the diamond ("Brewers Defense"); its
    // starting nine (minus the pitcher, plus the DH) is the alignment this
    // lineup bats against, and its probable starter opens the pitcher table.
    fieldingTeamName: fieldMeta.teamName || fieldMeta.name,
    defense: selectOpposingDefense(feed, battingSide),
    pitcherName: pitcher?.nameLastFirst ?? '',
  }
}

// ---------------------------------------------------------------------------
// FULL-REVEAL grid — Scorecard Lab ONLY. Everything below reads score-revealing
// state (the play-by-play outcomes, the linescore runs). It is the deliberate
// opposite of the spoiler-safe game view: the lab exists to see the WHOLE game
// laid out on the sheet, so nothing here is sealed. Keep it out of any product
// surface — the only importer is screens/ScorecardLab.jsx.
// ---------------------------------------------------------------------------

// Event types that are a plate appearance but NOT an official at-bat, so the
// per-row AB tally excludes them (a walk, HBP, sacrifice, catcher's interference).
const NON_AB_EVENTS = new Set([
  'walk',
  'intent_walk',
  'hit_by_pitch',
  'sac_fly',
  'sac_bunt',
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

// Every plate appearance of the batting team, laid onto the scorecard grid by
// batting-order slot (row) × COLUMN. Columns are the innings, but an inning in
// which some slot batted more than once (the team batting around) widens into
// as many sub-columns as the busiest slot needed — so a slot's second trip in an
// inning lands in the NEXT column, the way a paper scorebook flows it, while
// every inning still occupies the same columns for every row (the header + the
// per-inning totals stay aligned). Reuses the game view's own per-half feed
// builder (computeHalfInningFeed) so each cell is a real `atbat` card in exactly
// the shape AtBatBox renders — diamond, scorebook code, RBIs, outs all free.
// Each card is enriched with `outType` (top-left corner) and, where the batter
// changed from the slot's previous trip, `subBefore` (the substitution rule).
export function scorecardPlays(feed, side /* 'top' | 'bottom' */) {
  if (!feed) return null
  const battingSide = side === 'bottom' ? 'home' : 'away'
  const half = side === 'bottom' ? 'bottom' : 'top'
  const maxInning = selectInningCount(feed)
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1)

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

  for (const inning of innings) {
    for (const card of computeHalfInningFeed(feed, inning, half, battingSide)) {
      if (card.kind !== 'atbat') continue
      const slot = battingSlot(feed, battingSide, card.batterId)
      if (!slot || slot < 1 || slot > 9) continue
      const s = slotData[slot - 1]
      card.outType = card.codeKind === 'out' ? classifyOut(card.eventType, descByAtBat.get(card.atBatIndex)) : ''
      // Each pitch sorted into its ball / strike column (in-play = 'X'), the
      // same two-column ladder the live play-by-play card uses.
      card.ladder = pitchLadder(card.pitches ?? [])
      ;(s.byInning[inning] ??= []).push(card)
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
      if (!NON_AB_EVENTS.has(card.eventType)) { s.ab += 1; occ.ab += 1 }
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
    return { slot: s.slot, cells, rows, ab: s.ab, h: s.h, r: s.r, rbi: s.rbi }
  })

  const perInning = {}
  for (const inning of innings) {
    perInning[inning] = revealInning(feed, inning, battingSide)?.runs ?? 0
  }
  const totals = slots.reduce(
    (a, s) => ({ ab: a.ab + s.ab, h: a.h + s.h, r: a.r + s.r, rbi: a.rbi + s.rbi }),
    { ab: 0, h: 0, r: 0, rbi: 0 },
  )

  return { columns, innings, slots, perInning, totals }
}

// The bottom scoreboard: runs per inning for BOTH teams plus final R/H/E, from
// the linescore reveal selectors. A half that wasn't played (a walk-off skipping
// the bottom of the last inning) has no linescore entry and reads blank.
export function scorecardScoreboard(feed) {
  if (!feed) return null
  const maxInning = selectInningCount(feed)
  const innings = []
  for (let n = 1; n <= maxInning; n++) {
    innings.push({
      num: n,
      away: revealInning(feed, n, 'away')?.runs,
      home: revealInning(feed, n, 'home')?.runs,
    })
  }
  const side = (s) => ({
    abbr: selectTeamMeta(feed, s).abbreviation,
    ...(revealTotals(feed, s) ?? { runs: 0, hits: 0, errors: 0 }),
  })
  return { innings, away: side('away'), home: side('home') }
}

// The lab's one-call composite: the spoiler-free pre-pitch view PLUS the
// full-reveal grid and scoreboard, for a given half.
export function scorecardFull(loaded, side) {
  const view = scorecardView(loaded, side)
  if (!view) return null
  return {
    ...view,
    grid: scorecardPlays(loaded.feed, side),
    scoreboard: scorecardScoreboard(loaded.feed),
  }
}
