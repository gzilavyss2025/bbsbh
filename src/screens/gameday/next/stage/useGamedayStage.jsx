import { useCallback, useMemo, useState } from 'react'
import { SealBox } from '../../../../components/SealBox.jsx'
import { selectMoundPitcher } from '../../../../api/select.js'
import { fetchBatterZones } from '../../../../api/gameday/zones.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { ZoneCard } from '../zonemap/ZoneCard.jsx'
import { setZoneMapHidden, zoneMapDismissed } from '../zonemap/zoneMapFlag.js'
import { GamedayStage, restBatter, restZones } from './GamedayStage.js'
import { GamedayPlayCanvas } from '../cutscene/integration/GamedayPlayCanvas.jsx'
import { battingSide } from './battingSide.js'
import { wallFn } from './scene.js'
import { openingChangeHeld, stageKey, stepCapAt } from '../steps/subStep.js'
import { disarm, ended, replay, rest, saw, tap } from './tapRule.js'
import { checkpointPhase, dismissCheckpoint, emptyCheckpointGate, recordCheckpoint } from '../cutscene/integration/checkpointGate.js'

// The stage mount (#2573, #2568 slice 4): the stage slot, and the advance control wrapped in the tap
// rule (tapRule.js). `last` is the last finished at-bat's index as of the cursor, `view` the half on
// screen, `advance.reveal` marks the tap that reveals an at-bat. At rest with no tapped play, the
// stage draws the due-up batter before the pitch, with his zone map unless this game dismissed it.
// `reliever` is the live snapshot's revealed mid-half change (deriveLiveState's midHalfPitcherId).
// A qualifying ending celebration keeps the stage until Next dismisses it
// into the checkpoint. The reveal subtree reports only its eligibility flag.
// `open` ({ count, sub }): a sub-step inside the open at-bat is what the stage plays (stageKey).
export function useGamedayStage({ feed, last, reliever, view, inning, half, mark, stepAtBatIndex, checkpoint, advance, open }) {
  const covered = !!checkpoint
  const [s, setS] = useState(() => rest(stageKey(open, last, null), view))
  const [gate, setGate] = useState(emptyCheckpointGate)
  // State adjusted during render (useBecameTrue's shape): the play starts on the frame it arrives.
  const cur = saw(s, stageKey(open, last, s.seen), view)
  if (cur !== s) setS(cur)
  const onEnd = useCallback(() => setS(ended), [])
  // A trail card's tap plays its at-bat again (tapRule.js replay).
  const onReplay = useCallback((idx) => setS((p) => replay(p, idx, motionIsReduced())), [])

  const gd = feed?.gameData
  const pk = gd?.game?.pk
  const checkpointKey = typeof cur.shown === 'number' ? `${pk}:${view}:${cur.shown}` : null
  const phase = checkpointPhase(covered, checkpointKey, gate, !!cur.armed)
  const onCheckpoint = useCallback((eligible) => setGate((g) => recordCheckpoint(g, checkpointKey, eligible)), [checkpointKey])
  const date = gd?.datetime?.officialDate
  const venue = gd?.venue
  const wall = useMemo(() => wallFn(resolveBallparkLayout({ venueId: venue?.id, venueName: venue?.name, gameDate: date })), [venue?.id, venue?.name, date])

  // The due-up batter is the pre-pitch lineup (dueup.js, caller-gated like the hero's strip).
  const batter = cur.shown == null ? restBatter(feed, { view, mark, inning, half, last, stepAtBatIndex, covered }) : null
  const [hidden, setHidden] = useState(() => zoneMapDismissed(pk))
  const { data: zm } = useAsync(
    async () => (hidden || !batter ? null : { id: batter.id, zones: (await fetchBatterZones(batter.id, gd.game.season, gd.teams?.home?.sport?.id ?? 1, date))?.zones }),
    [batter?.id, hidden, pk],
  )
  // A tap on the strike zone, or the card's ✕, turns the zone map off and on for this game.
  const toggleZones = () => { setZoneMapHidden(pk, !hidden); setHidden(!hidden) }
  // Inside an open at-bat the zone map stands down: a reload there rests under the sub-step's card.
  const zones = open?.sub > 0 ? null : restZones(zm, batter?.id, hidden)

  // The pitcher on the mound at the cursor: the revealed change, else the half's opener (caller-gated
  // to the half reached, select.js). Hands are pre-game player data.
  const pitcherId = batter ? reliever ?? selectMoundPitcher(feed, inning, half, mark, { opening: !(open && openingChangeHeld(feed, inning, half, open.count, open.sub)) })?.id : null
  const hand = (id, k) => gd?.players?.[`ID${id}`]?.[k]?.code
  const stage = feed ? (
    <>
      {!(covered && cur.armed) && <GamedayStage
        SealBox={SealBox} StageCanvas={GamedayPlayCanvas} feed={feed} inning={inning} half={half} wall={wall} shown={cur.shown} run={cur.run ?? 0} playing={cur.playing} onEnd={onEnd} onReplay={onReplay}
        mark={mark} step={open ? stepCapAt(feed, inning, half, open.count, open.sub) : null} open={open} batter={batter}
        batSide={hand(batter?.id, 'batSide')} pitchHand={hand(pitcherId, 'pitchHand')} zones={zones} onZone={batter ? toggleZones : undefined}
        checkpoint={checkpoint} checkpointDismissed={phase === 'checkpoint'} onCheckpoint={onCheckpoint}
      />}
      {batter && !hidden && !(open?.sub > 0) && (
        <ZoneCard teamId={gd?.teams?.[half === 'top' ? 'away' : 'home']?.id} id={batter.id} name={gd?.players?.[`ID${batter.id}`]?.fullName ?? batter.last} side={battingSide(hand(batter.id, 'batSide'), hand(pitcherId, 'pitchHand'))} zones={zones ?? {}} onDismiss={toggleZones} />
      )}
    </>
  ) : null

  const onClick = () => {
    if (phase === 'pending') return
    if (phase === 'celebration') {
      setGate(dismissCheckpoint)
      setS(ended)
      return // reveal nothing: this press opens the already-earned checkpoint
    }
    const [next, go] = tap(cur, advance.reveal === true, motionIsReduced(), covered)
    setS(next)
    if (!go) return
    if (next.armed) setGate(emptyCheckpointGate())
    advance.onClick()
    // ponytail: the engine reports the tapped step within a render or two; a step that brings no new
    // last at-bat (a stoppage, a placed runner) is disarmed after a second rather than tracked.
    if (next.armed) setTimeout(() => setS(disarm), 1000)
  }
  // The at-bat the stage is replaying (a trail tap), for the trail's "you are here" mark.
  const replaying = typeof cur.shown === 'number' && cur.run ? cur.shown : null
  const holding = phase === 'pending' || phase === 'celebration'
  return { stage, advance: { ...advance, ...(holding ? { label: 'Next', disabled: false, caughtUp: false, refresh: false } : {}), onClick }, onReplay: covered ? undefined : onReplay, replaying }
}
