import { createElement as h, useMemo, useState } from 'react'
import { stagePlay } from './play.js'

// The stage slot (#2573, #2568 slice 4): the revealed play, or the rest frame. A `.js` file so the
// suite can render it; GamedayNextMount passes the real SealBox and StageCanvas.
//
// SPOILER FOOTING. `shown` (tapRule.js) is an at-bat the reader already revealed. Its feed play is
// read only inside the SealBox reveal render function (ADR-0001, ADR-0002), so a home run's landing
// exists only in the revealed stage. The rest frame reads no play at all: the batter's side and the
// zone map's pre-game temperatures only.

// The clock starts when the play mounts and holds through a poll or a resize, so neither restarts it.
function Played({ StageCanvas, feed, idx, wall, playing, onEnd }) {
  const [start] = useState(() => performance.now())
  const play = useMemo(() => stagePlay(feed.liveData.plays.allPlays.find((p) => p.about?.atBatIndex === idx), wall), [feed, idx, wall])
  return h(StageCanvas, playing ? { play, start, onEnd } : { play, t: play.end })
}

function Rest({ StageCanvas, wall, batSide, zones }) {
  const play = useMemo(() => stagePlay({ matchup: { batSide: { code: batSide } } }, wall), [wall, batSide])
  return h(StageCanvas, { play, t: 0, zones, label: 'The field before the pitch' })
}

export function GamedayStage({ SealBox, StageCanvas, feed, wall, shown, playing, onEnd, batSide, zones }) {
  return shown != null
    ? h(SealBox, { coverless: true, forceRevealed: true }, () => h(Played, { key: shown, StageCanvas, feed, idx: shown, wall, playing, onEnd }))
    : h(Rest, { StageCanvas, wall, batSide, zones })
}
