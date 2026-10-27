import { useCallback, useMemo, useState } from 'react'
import { SealBox } from '../../../../components/SealBox.jsx'
import { selectDueUpDuring } from '../../../../api/dueup.js'
import { dayBefore } from '../../../../api/game.js'
import { fetchBatterZones } from '../../../../api/gameday/zones.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { ZoneCard } from '../zonemap/ZoneCard.jsx'
import { dismissZoneMap, zoneMapDismissed } from '../zonemap/zoneMapFlag.js'
import { GamedayStage } from './GamedayStage.js'
import { StageCanvas } from './StageCanvas.jsx'
import { wallFn } from './scene.js'
import { ended, rest, saw, tap } from './tapRule.js'

// The stage mount (#2573, #2568 slice 4): the stage slot, and the advance control wrapped in the tap
// rule (tapRule.js). `last` is the last finished at-bat's index as of the cursor, `view` the half on
// screen, `advance.reveal` marks the tap that reveals an at-bat. At rest with no tapped play, the
// stage draws the due-up batter before the pitch, with his zone map unless this game dismissed it.
export function useGamedayStage({ feed, last, view, inning, half, mark, stepAtBatIndex, advance }) {
  const [s, setS] = useState(() => rest(last, view))
  // State adjusted during render (useBecameTrue's shape): the play starts on the frame it arrives.
  const cur = saw(s, last, view)
  if (cur !== s) setS(cur)
  const onEnd = useCallback(() => setS(ended), [])

  const gd = feed?.gameData
  const pk = gd?.game?.pk
  const date = gd?.datetime?.officialDate
  const venue = gd?.venue
  const wall = useMemo(() => wallFn(resolveBallparkLayout({ venueId: venue?.id, venueName: venue?.name, gameDate: date })), [venue?.id, venue?.name, date])

  // The due-up batter is the pre-pitch lineup (dueup.js, caller-gated like the hero's strip).
  const batter = feed && cur.shown == null ? selectDueUpDuring(feed, inning, half, mark, last ?? stepAtBatIndex, 1)?.batters?.[0] : null
  const [hidden, setHidden] = useState(() => zoneMapDismissed(pk))
  const { data: zm } = useAsync(
    () => (hidden || !batter ? null : fetchBatterZones(batter.id, gd.game.season, gd.teams?.home?.sport?.id ?? 1, date)),
    [batter?.id, hidden, pk],
  )
  const zones = cur.shown == null && !hidden ? zm?.zones ?? null : null

  // ponytail: a switch hitter stands right-handed at rest; the pitcher's hand would settle it.
  const stage = feed ? (
    <>
      <GamedayStage
        SealBox={SealBox} StageCanvas={StageCanvas} feed={feed} wall={wall} shown={cur.shown} playing={cur.playing} onEnd={onEnd}
        batSide={gd.players?.[`ID${batter?.id}`]?.batSide?.code === 'L' ? 'L' : 'R'} zones={zones}
      />
      {zones && (
        <ZoneCard name={batter.last} zones={zones} through={dayBefore(date)} onDismiss={() => { dismissZoneMap(pk); setHidden(true) }} />
      )}
    </>
  ) : null

  const onClick = () => {
    const [next, go] = tap(cur, advance.reveal === true, motionIsReduced())
    setS(next)
    if (go) advance.onClick()
  }
  return { stage, advance: { ...advance, onClick } }
}
