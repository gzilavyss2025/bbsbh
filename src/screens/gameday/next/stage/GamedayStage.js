import { createElement as h, useEffect, useMemo, useState } from 'react'
import { selectDueUpDuring } from '../../../../api/dueup.js'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { stagePlay } from './play.js'
import { celebrationForPlay } from '../cutscene/integration/celebrationForPlay.js'
import { BALLPARK_SCENES } from '../cutscene/ballpark/scenes.js'

// The stage slot (#2573, #2568 slice 4): the revealed play, or the rest frame. A `.js` file so the
// suite can render it; GamedayNextMount passes the real SealBox and StageCanvas.
//
// SPOILER FOOTING. `shown` (tapRule.js) is an at-bat the reader already revealed. Its feed play is
// read only inside the SealBox reveal render function (ADR-0001, ADR-0002), so a home run's landing
// exists only in the revealed stage. The rest frame reads no play at all: the batter's side, the
// pitcher's hand and the zone map's pre-game temperatures only.
//
// A sub-step (`shown` { count, sub }, steps/subStep.js stageKey) plays one pitch: the at-bat's play cut at that
// pitch, with only the runner moves before it. Any other sub-step (an event, a change, an automatic
// call) holds the field still under its card for one short beat (STILL), so a double tap on it is
// swallowed like one on a pitch (#2573).

// The clock starts when the play mounts and holds through a poll or a resize, so neither restarts it.
// The play ends on its own duration, not on the canvas: an unmeasured canvas, or Motion: Reduced
// switched on mid-play, must not leave the tap rule thinking it still plays.
const STILL = 0.8 // seconds

function subPlay(feed, inning, half, { count, sub }) {
  const o = openAtBat(feed, inning, half, count)
  const s = o?.steps[sub - 1]
  const p = o?.play
  if (!p || s?.kind !== 'pitch') return { p: p && { matchup: p.matchup }, still: true }
  const cut = { ...p, playEvents: p.playEvents.filter((e, i) => (e.index ?? i) <= s.index), runners: (p.runners ?? []).filter((r) => r.details?.playIndex < s.index) }
  return { p: cut, still: false }
}

function Played({ StageCanvas, feed, idx, inning, half, wall, playing, onEnd }) {
  const [start] = useState(() => performance.now())
  const { play, still, celebration } = useMemo(() => {
    const { p, still } = typeof idx === 'object' ? subPlay(feed, inning, half, idx) : { p: feed.liveData.plays.allPlays.find((q) => q.about?.atBatIndex === idx), still: false }
    return { play: stagePlay(p ?? {}, wall), still, celebration: typeof idx === 'object' ? null : celebrationForPlay(p, feed.gameData) }
  }, [feed, idx, inning, half, wall])
  useEffect(() => {
    if (!playing) return undefined
    // Decorative assets may decode after the tap. Their player reports its
    // own completion; this watchdog prevents a stalled import/load holding
    // the scoring control. Ordinary field timing stays on its existing clock.
    const duration = celebration ? BALLPARK_SCENES[celebration.scene].track.duration + 4 : still ? STILL : play.end
    const left = duration * 1000 - (performance.now() - start)
    if (left <= 0 || motionIsReduced()) { onEnd(); return undefined }
    const id = setTimeout(onEnd, left)
    return () => clearTimeout(id)
  }, [playing, play, still, celebration, start, onEnd])
  const props = playing && !still ? { play, start } : { play, t: still ? 0 : play.end }
  return h(StageCanvas, { ...props, celebration, playing, onEnd })
}

// Who stands in at rest: the due-up batter of the half being scored (dueup.js, the pre-pitch lineup),
// or null when the checkpoint covers the stage or the half on screen is committed.
export function restBatter(feed, { view, mark, inning, half, last, stepAtBatIndex, covered }) {
  if (!feed || covered || view <= (mark ?? -1)) return null
  return selectDueUpDuring(feed, inning, half, mark, last ?? stepAtBatIndex, 1)?.batters?.[0] ?? null
}

// The zone map for the batter at rest: only his own fetch (`zm.id`), so a new batter never shows
// the last one's averages while his own load.
export const restZones = (zm, batterId, hidden) => (!hidden && batterId != null && zm?.id === batterId ? zm.zones : null)

// At rest the batter stands where he will hit: a switch hitter (S) opposite the pitcher's throwing
// hand. Both are pre-game player data. A revealed play uses its own matchup.batSide instead.
function Rest({ StageCanvas, wall, batSide, pitchHand, zones }) {
  const side = batSide === 'S' ? (pitchHand === 'L' ? 'R' : 'L') : batSide
  const play = useMemo(() => stagePlay({ matchup: { batSide: { code: side }, pitchHand: { code: pitchHand } } }, wall), [wall, side, pitchHand])
  return h(StageCanvas, { play, t: 0, zones, label: 'The field before the pitch' })
}

export function GamedayStage({ SealBox, StageCanvas, feed, inning, half, wall, shown, playing, onEnd, batSide, pitchHand, zones }) {
  return shown != null
    ? h(SealBox, { coverless: true, forceRevealed: true }, () => h(Played, { key: typeof shown === 'object' ? `${shown.count}.${shown.sub}` : shown, StageCanvas, feed, idx: shown, inning, half, wall, playing, onEnd }))
    : h(Rest, { StageCanvas, wall, batSide, pitchHand, zones })
}
