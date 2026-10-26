// Gameday's checkpoint pages (#2605): the pages a reader cycles through when a
// half-inning closes, to fill in the paper card. REVEAL-ONLY (ADR-0001): they
// are the half's runs, hits and pitch counts, so call this only inside a
// SealBox's reveal render function (ADR-0002), for a half already committed.
//
// THE CLAMP. A checkpoint follows a CLOSED half, so it answers only for a half
// at or under `revealedThrough` (ADR-0016) and null for any other. It reads that
// one half and nothing after it. It never asks whether the game is over
// (`selectIsFinal`): the double rule keys on `revealedThrough` against
// `finalHalfIndex` (ADR-0043, 2026-08-13 amendment), and a page that knew the
// game had ended would tell the bottom of the 9th whether a 10th exists.
//
// THE PAGES. Gary chose four on 2026-10-22, and says the content "will need
// work to dial in", so the list is PAGE_ORDER and a builder per id: add, drop or
// reorder a page there. Two are built here; the other two are listed with
// `built: false` until #2572 builds them. A fifth page of score-free facts
// (../between-innings.js) is open: the wireframes in #2568 decide it, and it
// would be one more id in PAGE_ORDER.
//
// Page 1, the tally: R, H and LOB are the batting side's; E is a fielding stat
// and belongs to the side in the field (ADR-0006). From the linescore
// (revealInning), as the old tally read it.
//
// Page 2, pitching: pitches, strikes and whiffs, with one line per pitcher who
// threw in the half. A strike is any pitch that is not a ball (`isBall`): the
// box score's own count. A pitch belongs to the pitcher on the mound when it
// was thrown, not to the play's `matchup.pitcher`: when a pitcher is replaced
// in the middle of an at-bat, the play names the one who finished it, and the
// pitches before the `pitching_substitution` event are the replaced man's.
// Checked 2026-10-26 on gamePk 823035, 823036, 823169, 824546 and 815625: every
// pitcher's pitches and strikes summed over his halves equal his box-score line.

import { revealInning } from '../linescore.js'
import { pitchCallCode, WHIFF_CODES } from '../playbyplay.js'
import { halfIndex, personNameParts } from '../select.js'

export const PAGE_ORDER = ['tally', 'pitching', 'atBats', 'gameSoFar']

function tallyPage(feed, inning, half) {
  const batting = half === 'top' ? 'away' : 'home'
  const fielding = half === 'top' ? 'home' : 'away'
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
    const side = h === 'top' ? 'home' : 'away'
    const finisher = play.matchup?.pitcher?.id ?? null
    if (i === target) {
      const events = play.playEvents ?? []
      const lastSub = events.findLastIndex((e) => e?.details?.eventType === 'pitching_substitution')
      events.forEach((e, idx) => {
        if (!e?.isPitch) return
        const id = idx < lastSub && onMound[side] != null ? onMound[side] : finisher
        if (id == null) return
        if (!lines.has(id)) {
          const { first, last } = personNameParts(players[`ID${id}`] ?? {})
          lines.set(id, { id, first, last, pitches: 0, strikes: 0, whiffs: 0 })
        }
        const l = lines.get(id)
        l.pitches += 1
        if (e.details?.isBall !== true) l.strikes += 1
        const code = pitchCallCode(e)
        if (code && WHIFF_CODES.has(code)) l.whiffs += 1
      })
    }
    if (finisher != null) onMound[side] = finisher
  }
  const pitchers = [...lines.values()]
  const sum = (k) => pitchers.reduce((n, l) => n + l[k], 0)
  return { pitches: sum('pitches'), strikes: sum('strikes'), whiffs: sum('whiffs'), pitchers }
}

const BUILDERS = { tally: tallyPage, pitching: pitchingPage }

// The checkpoint for a closed half, as an ordered list of pages:
// [{ id, built: true, fields } | { id, built: false }], or null for a half
// past `revealedThrough`.
export function checkpointPages(feed, { inning, half, revealedThrough }) {
  if (!inning || !half) return null
  if (halfIndex(inning, half) > (revealedThrough ?? -1)) return null
  return PAGE_ORDER.map((id) =>
    BUILDERS[id] ? { id, built: true, fields: BUILDERS[id](feed, inning, half) } : { id, built: false },
  )
}
