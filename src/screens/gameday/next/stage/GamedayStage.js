import { createElement as h, useEffect, useMemo, useState } from 'react'
import { selectDueUpDuring } from '../../../../api/dueup.js'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { useCopy } from '../../../../copy/copyContext.js'
import { parkBackdrop } from '../../../../lib/ballpark/parkBackdrop.js'
import { parkWashColorOverride } from '../../../../lib/ballpark/parkWash.js'
import { teamPrimaryColor } from '../../../../lib/teams.js'
import { stageActors } from './actors.js'
import { stagePlay } from './play.js'

// The stage slot (#2573, #2568 slice 4): the revealed play, or the rest frame. A `.js` file so the
// suite can render it; GamedayNextMount passes the real SealBox and StageCanvas.
//
// SPOILER FOOTING. `shown` (tapRule.js) is an at-bat the reader already revealed. Its feed play is
// read only inside the SealBox reveal render function (ADR-0001, ADR-0002), so a home run's landing
// exists only in the revealed stage. The rest canvas reads no result: the batter's side, the
// pitcher's hand and the zone card's pre-game temperatures only. Hover identities below use
// the existing defense step clamp inside their own SealBox reveal function.
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

function Played({ StageCanvas, feed, idx, inning, half, wall, playing, onEnd, actors }) {
  const [start] = useState(() => performance.now())
  const { play, still } = useMemo(() => {
    const { p, still } = typeof idx === 'object' ? subPlay(feed, inning, half, idx) : { p: feed.liveData.plays.allPlays.find((q) => q.about?.atBatIndex === idx), still: false }
    return { play: stagePlay(p ?? {}, wall), still }
  }, [feed, idx, inning, half, wall])
  useEffect(() => {
    if (!playing) return undefined
    const left = (still ? STILL : play.end) * 1000 - (performance.now() - start)
    if (left <= 0 || motionIsReduced()) { onEnd(); return undefined }
    const id = setTimeout(onEnd, left)
    return () => clearTimeout(id)
  }, [playing, play, still, start, onEnd])
  return h(StageCanvas, playing && !still ? { play, start, actors } : { play, t: still ? 0 : play.end, actors })
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
function Rest({ StageCanvas, wall, batSide, pitchHand, zones, actors }) {
  const side = batSide === 'S' ? (pitchHand === 'L' ? 'R' : 'L') : batSide
  const play = useMemo(() => stagePlay({ matchup: { batSide: { code: side }, pitchHand: { code: pitchHand } } }, wall), [wall, side, pitchHand])
  return h(StageCanvas, { play, t: 0, zones, actors, label: 'The field before the pitch' })
}

export function GamedayStage({ SealBox, StageCanvas, feed, inning, half, wall, shown, playing, onEnd, batSide, pitchHand, zones, mark, step, open, batter }) {
  // The same photograph, crop and club wash as the identity drawer. Identity only:
  // no revealed play, score or inning decides this decorative background.
  const { t } = useCopy()
  const venue = feed?.gameData?.venue, homeId = feed?.gameData?.teams?.home?.id
  const park = parkBackdrop(venue?.name, t, venue?.id)
  const color = homeId != null ? parkWashColorOverride(homeId) ?? teamPrimaryColor(homeId) : null
  const style = { ...(park ? { '--park-art': park.cssUrl, '--park-focus': park.focus } : null), ...(color ? { '--park-tint': color } : null) }
  const field = (actors) => shown != null
    ? h(SealBox, { coverless: true, forceRevealed: true }, () => h(Played, { key: typeof shown === 'object' ? `${shown.count}.${shown.sub}` : shown, StageCanvas, feed, idx: shown, inning, half, wall, playing, onEnd, actors }))
    : h(Rest, { StageCanvas, wall, batSide, pitchHand, zones, actors })
  return h('div', { className: 'gdstageScene', style }, mark == null ? field(null)
    : h(SealBox, { coverless: true, forceRevealed: true }, () => field(stageActors(feed, { inning, half, mark, step, open, batter }))))
}
