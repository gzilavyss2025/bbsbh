import { createElement as h, useEffect, useMemo, useState } from 'react'
import { selectDueUpDuring } from '../../../../api/dueup.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { stagePlay } from './play.js'

// The stage slot (#2573, #2568 slice 4): the revealed play, or the rest frame. A `.js` file so the
// suite can render it; GamedayNextMount passes the real SealBox and StageCanvas.
//
// SPOILER FOOTING. `shown` (tapRule.js) is an at-bat the reader already revealed. Its feed play is
// read only inside the SealBox reveal render function (ADR-0001, ADR-0002), so a home run's landing
// exists only in the revealed stage. The rest frame reads no play at all: the batter's side, the
// pitcher's hand and the zone map's pre-game temperatures only.

// The clock starts when the play mounts and holds through a poll or a resize, so neither restarts it.
// The play ends on its own duration, not on the canvas: an unmeasured canvas, or Motion: Reduced
// switched on mid-play, must not leave the tap rule thinking it still plays.
function Played({ StageCanvas, feed, idx, wall, playing, onEnd }) {
  const [start] = useState(() => performance.now())
  const play = useMemo(() => stagePlay(feed.liveData.plays.allPlays.find((p) => p.about?.atBatIndex === idx), wall), [feed, idx, wall])
  useEffect(() => {
    if (!playing) return undefined
    const left = play.end * 1000 - (performance.now() - start)
    if (left <= 0 || motionIsReduced()) { onEnd(); return undefined }
    const id = setTimeout(onEnd, left)
    return () => clearTimeout(id)
  }, [playing, play, start, onEnd])
  return h(StageCanvas, playing ? { play, start } : { play, t: play.end })
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

export function GamedayStage({ SealBox, StageCanvas, feed, wall, shown, playing, onEnd, batSide, pitchHand, zones }) {
  return shown != null
    ? h(SealBox, { coverless: true, forceRevealed: true }, () => h(Played, { key: shown, StageCanvas, feed, idx: shown, wall, playing, onEnd }))
    : h(Rest, { StageCanvas, wall, batSide, pitchHand, zones })
}
