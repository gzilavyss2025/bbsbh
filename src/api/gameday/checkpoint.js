// Gameday's checkpoint pages (#2605, #2572): the pages a reader cycles through
// when a half-inning closes, to fill in the paper card. REVEAL-ONLY (ADR-0001):
// they are the half's runs, hits and pitch counts, so call this only inside a
// SealBox's reveal render function (ADR-0002), for a half already committed.
//
// THE CLAMP. A checkpoint follows a CLOSED half, so it answers only for a half
// at or under `revealedThrough` (ADR-0016) and null for any other. It reads that
// one half and the ones before it, nothing after. It never asks whether the game
// is over (`selectIsFinal`): the double rule keys on the half against
// `selectFinalHalfIndex` (ADR-0043, 2026-08-13 amendment), through
// `selectFinalReached` with the CLAMPED mark (this half), so a page never tells
// the bottom of the 9th whether a 10th exists, and a half reviewed after the end
// is not the final line.
//
// THE PAGES. Gary chose four on 2026-10-22 and a fifth, the notes, in round 2
// of #2568; he says the content "will need work to dial in", so the list is
// PAGE_ORDER and a builder per id: add, drop or reorder a page there. A builder
// that answers null drops its page (the notes with nothing to say).
//
// Page 1, the tally: R, H and LOB are the batting side's; E is a fielding stat
// and belongs to the side in the field (ADR-0006). From the linescore
// (revealInning), as the old tally read it.
//
// Page 2, pitching: pitches, strikes, whiffs and fouls, with one line per
// pitcher who threw in the half. A strike is any pitch that is not a ball
// (`isBall`): the box score's own count. A foul is FOUL_CODES (F, L, T, O, R),
// the set derive.js's tally counts. A pitch belongs to the pitcher on the mound
// when it was thrown, not to the play's `matchup.pitcher`, which names the one
// who finished the at-bat: walking the play's events, each
// `pitching_substitution` puts its own `player.id` on the mound.
// Checked 2026-10-26 on gamePk 823035, 823036, 823169, 824546 and 815625: every
// pitcher's pitches and strikes summed over his halves equal his box-score line.
//
// Page 3, the at-bats in order, from computeHalfInningFeed: one row per at-bat
// (a called third strike has no `code`, by design, and says `calledLooking`),
// plus the substitutions a scorer writes in (SUB_ROWS). A mound visit or a
// steal note is not a row. The placed runner of an extra half is not either.
//
// Page 4, the game so far: the line through this half only, each side's R and
// H, and E as the side's own fielding (ADR-0006), then who is due up next half
// by batting order (dueup.js, through lineupEntering's gate). It names no
// pitcher: a change made before the next half's first pitch would leak (#2572).
// At the game's last half it is the final line, with no due-up.
//
// Page 5, facts: the score-free notes for the next half (../between-innings.js,
// with its allowlist); `notes` carries that builder's inputs (bundle,
// marginNotes, workload, gameDate, shownCounts, ...). An empty list drops the
// page (Gary, 2026-10-26: hide the tab). Inference: that is safe because the
// list's emptiness depends on data (the callout bundle covers only the nightly
// window), not on the half. The last half has no next half, so no notes.

import { revealInning } from '../linescore.js'
import { computeHalfInningFeed, pitchCallCode, FOUL_CODES, WHIFF_CODES } from '../playbyplay.js'
import { halfIndex, personNameParts, selectFinalReached } from '../select.js'
import { selectDueUpNext } from '../dueup.js'
import { buildBetweenInnings } from '../between-innings.js'
import { battingSideOf, fieldingSideOf } from './stepCut.js'

export const PAGE_ORDER = ['tally', 'pitching', 'atBats', 'gameSoFar', 'facts']

const SUB_ROWS = new Set(['pinch_hitting', 'pinch_running', 'pitching_substitution', 'defensive_substitution', 'defensive_switch'])

function tallyPage(feed, inning, half) {
  const batting = battingSideOf(half)
  const fielding = fieldingSideOf(half)
  const line = revealInning(feed, inning, batting)
  const field = revealInning(feed, inning, fielding)
  return {
    runs: line?.runs ?? null,
    hits: line?.hits ?? null,
    errors: field?.errors ?? null,
    leftOnBase: line?.leftOnBase ?? null,
  }
}

function pitchingPage(feed, inning, half) {
  const target = halfIndex(inning, half)
  const players = feed?.gameData?.players ?? {}
  const lines = new Map() // pitcherId -> line, in the order they threw
  const onMound = {} // fielding side -> the pitcher of that side's last play
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || !h) continue
    const i = halfIndex(inn, h)
    if (i > target) break
    const side = fieldingSideOf(h)
    const finisher = play.matchup?.pitcher?.id ?? null
    // Who is on the mound, event by event: the last play's pitcher, then each
    // `pitching_substitution`'s own incoming `player.id`.
    let current = onMound[side] ?? null
    for (const e of play.playEvents ?? []) {
      if (e?.details?.eventType === 'pitching_substitution' && e.player?.id != null) {
        current = e.player.id
        continue
      }
      const id = current ?? finisher
      if (!e?.isPitch || i !== target || id == null) continue
      if (!lines.has(id)) {
        const { first, last } = personNameParts(players[`ID${id}`] ?? {})
        lines.set(id, { id, first, last, pitches: 0, strikes: 0, whiffs: 0, fouls: 0 })
      }
      const l = lines.get(id)
      l.pitches += 1
      if (e.details?.isBall !== true) l.strikes += 1
      const code = pitchCallCode(e)
      if (code && WHIFF_CODES.has(code)) l.whiffs += 1
      if (code && FOUL_CODES.has(code)) l.fouls += 1
    }
    if (finisher != null) onMound[side] = finisher
  }
  const pitchers = [...lines.values()]
  const sum = (k) => pitchers.reduce((n, l) => n + l[k], 0)
  const totals = { pitches: sum('pitches'), strikes: sum('strikes'), whiffs: sum('whiffs'), fouls: sum('fouls') }
  return { ...totals, pitchers }
}

function atBatsPage(feed, inning, half) {
  const rows = []
  for (const c of computeHalfInningFeed(feed, inning, half, battingSideOf(half))) {
    if (c.kind === 'atbat') {
      const { jersey, first, last } = c.batter ?? {}
      rows.push({
        kind: 'atBat', atBatIndex: c.atBatIndex, jersey, first, last,
        code: c.code ?? '', rbi: c.rbi, out: c.outNumber ?? null, calledLooking: c.calledLooking === true,
      })
    } else if (c.kind === 'event' && SUB_ROWS.has(c.eventType)) {
      rows.push({ kind: 'sub', eventType: c.eventType, playerId: c.playerId ?? c.pinchId ?? null, text: c.text })
    }
  }
  return { rows }
}

function gameSoFarPage(feed, inning, half, { final, revealedThrough }) {
  const through = halfIndex(inning, half)
  const cell = (n, side) => (halfIndex(n, side === 'away' ? 'top' : 'bottom') <= through ? revealInning(feed, n, side) : null)
  const innings = []
  const total = { away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 0, hits: 0, errors: 0 } }
  for (const { num } of feed?.liveData?.linescore?.innings ?? []) {
    if (halfIndex(num, 'top') > through) break
    const away = cell(num, 'away')
    const home = cell(num, 'home')
    innings.push({ num, away: away?.runs ?? null, home: home?.runs ?? null })
    for (const [side, line] of [['away', away], ['home', home]]) {
      total[side].runs += line?.runs ?? 0
      total[side].hits += line?.hits ?? 0
    }
    // E is the fielding side's (ADR-0006): the home side's errors come in the top half.
    for (const side of ['away', 'home']) {
      if (halfIndex(num, side === 'home' ? 'top' : 'bottom') <= through) total[side].errors += revealInning(feed, num, side)?.errors ?? 0
    }
  }
  const dueUp = final ? null : selectDueUpNext(feed, inning, half, revealedThrough)?.batters ?? null
  return { innings, ...total, final, dueUp }
}

function factsPage(feed, inning, half, { final, revealedThrough, notes }) {
  if (final || !notes) return null
  const list = buildBetweenInnings({ ...notes, feed, inning, half, revealedThrough })
  return list.length ? { notes: list } : null
}

const BUILDERS = { tally: tallyPage, pitching: pitchingPage, atBats: atBatsPage, gameSoFar: gameSoFarPage, facts: factsPage }

// The checkpoint for a closed half, as an ordered list of pages
// [{ id, fields }] (a page with nothing to show is left out), or null for a
// half past `revealedThrough`. `notes` is buildBetweenInnings' inputs, for
// page 5.
export function checkpointPages(feed, { inning, half, revealedThrough, notes = null }) {
  if (!inning || !half) return null
  if (halfIndex(inning, half) > (revealedThrough ?? -1)) return null
  const ctx = { revealedThrough, notes, final: selectFinalReached(feed, halfIndex(inning, half)) }
  return PAGE_ORDER.map((id) => ({ id, fields: BUILDERS[id](feed, inning, half, ctx) })).filter((p) => p.fields)
}
