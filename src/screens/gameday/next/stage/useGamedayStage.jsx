import '../../../../styles/gameday-next/stage.css' // the stage slot's sizes
import { useCallback, useMemo, useState } from 'react'
import { SealBox } from '../../../../components/SealBox.jsx'
import { selectMoundPitcher } from '../../../../api/select.js'
import { fetchBatterZones } from '../../../../api/gameday/zones.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { Button } from '../../../../components/ui/control/Button.jsx'
import { ZoneCard } from '../zonemap/ZoneCard.jsx'
import { zonePitches } from '../zonemap/zonePitches.js'
import { ScoutLine } from '../panels/ScoutLine.jsx'
import { BallFlight } from '../../../../components/charts/BallFlight.jsx'
import { SavantFacts } from '../hero/SavantFacts.jsx'
import { setZoneMapHidden, zoneMapDismissed } from '../zonemap/zoneMapFlag.js'
import { GamedayStage, holdsFinished, restBatter, restZones } from './GamedayStage.js'
import { GamedayPlayCanvas } from '../cutscene/integration/GamedayPlayCanvas.jsx'
import { battingSide } from './battingSide.js'
import { wallFn } from './scene.js'
import { openingChangeHeld, stageKey, stepCapAt } from '../steps/subStep.js'
import { disarm, ended, replay, rest, saw, tap } from './tapRule.js'
import { checkpointPhase, dismissCheckpoint, emptyCheckpointGate, recordCheckpoint } from '../cutscene/integration/checkpointGate.js'

// The stage mount (#2573, #2568 slice 4): the stage slot, and the advance control wrapped in the tap
// rule (tapRule.js). `last` is the last finished at-bat's index as of the cursor, `view` the half on
// screen, `advance.reveal` marks the tap that reveals an at-bat. At rest, including after a tapped play settles, the
// stage draws the due-up batter before the pitch, with his zone map unless this game dismissed it.
// `reliever` is the live snapshot's revealed mid-half change (deriveLiveState's midHalfPitcherId).
// A qualifying ending celebration keeps the stage until Next dismisses it
// into the checkpoint. The reveal subtree reports only its eligibility flag.
// `open` ({ count, sub }): a sub-step inside the open at-bat is what the stage plays (stageKey).
// A pitch pinned to the stage's edge points the way it went.
const OFF_ARROW = { up: '▲', down: '▼', left: '◀', right: '▶' }

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
  // He and his zones stay up while a pitch plays (Gary, 2026-10-28): a tap never blanks the batting view.
  // A held ending scene closed by its ✕ gives the stage back to the batting view (the man who made the
  // last out, his zones and pitches) until Next opens the checkpoint (Gary, 2026-10-28).
  const [closedAt, setClosedAt] = useState(null)
  const shelved = covered && phase === 'celebration' && closedAt != null && closedAt === checkpointKey
  // A trail chip's tap brings back that at-bat's batter, his zones and its pitches (Gary, 2026-10-28)
  // until the next tap; it is one the reader already revealed.
  // Under the checkpoint a chip's tap lifts it for that at-bat's batting view; Next puts it back (`over`).
  const [over, setOver] = useState(null)
  const lifted = covered && over != null // a stale `over` is inert once the checkpoint goes; Next clears it
  const replaying = lifted ? over : typeof cur.shown === 'number' && cur.run ? cur.shown : null
  // A held ending scene's own Replay plays under the checkpoint: it brings no batting view over it.
  const replayed = replaying != null && (lifted || !covered) ? feed?.liveData?.plays?.allPlays?.find((p) => p.about?.atBatIndex === replaying)?.matchup?.batter : null
  const batter = replayed?.id ? { id: replayed.id, last: gd?.players?.[`ID${replayed.id}`]?.lastName ?? '' }
    : restBatter(feed, { view, mark, inning, half, last, stepAtBatIndex, covered: covered && !shelved, open })
  const [hidden, setHidden] = useState(() => zoneMapDismissed(pk))
  const { data: zm } = useAsync(
    async () => (hidden || !batter ? null : { id: batter.id, zones: (await fetchBatterZones(batter.id, gd.game.season, gd.teams?.home?.sport?.id ?? 1, date))?.zones }),
    [batter?.id, hidden, pk],
  )
  // A tap on the strike zone, or the card's ✕, turns the zone map off and on for this game.
  const toggleZones = () => { setZoneMapHidden(pk, !hidden); setHidden(!hidden) }
  // The batting view returns when playback settles, including between pitch sub-steps.
  const zones = restZones(zm, batter?.id, hidden)

  // The pitcher on the mound at the cursor: the revealed change, else the half's opener (caller-gated
  // to the half reached, select.js). Hands are pre-game player data.
  const pitcherId = batter ? reliever ?? selectMoundPitcher(feed, inning, half, mark, { opening: !(open && openingChangeHeld(feed, inning, half, open.count, open.sub)) })?.id : null
  const hand = (id, k) => gd?.players?.[`ID${id}`]?.[k]?.code
  const stage = feed ? (
    <>
      {!(covered && cur.armed) && !lifted && <GamedayStage
        SealBox={SealBox} StageCanvas={GamedayPlayCanvas} feed={feed} inning={inning} half={half} wall={wall} shown={cur.shown} run={cur.run ?? 0} playing={cur.playing} onEnd={onEnd} onReplay={onReplay}
        mark={mark} step={open ? stepCapAt(feed, inning, half, open.count, open.sub) : null} open={open} batter={batter}
        batSide={hand(batter?.id, 'batSide')} pitchHand={hand(pitcherId, 'pitchHand')}
        checkpoint={checkpoint} checkpointDismissed={phase === 'checkpoint'} onCheckpoint={onCheckpoint}
        // The celebration's ✕: a held ending scene opens its checkpoint, as Next would.
        onCloseCelebration={() => { if (covered) setClosedAt(checkpointKey) }}
      />}
      {batter && !hidden && (
        <ZoneCard teamId={gd?.teams?.[half === 'top' ? 'away' : 'home']?.id} id={batter.id} name={gd?.players?.[`ID${batter.id}`]?.fullName ?? batter.last} side={battingSide(hand(batter.id, 'batSide'), hand(pitcherId, 'pitchHand'))} zones={zones ?? {}} club={half === 'top' ? 'away' : 'home'}
          matchup={pitcherId ? <ScoutLine feed={feed} hitterId={batter.id} pitcherId={pitcherId} /> : null}
          pitcher={pitcherId ? { id: pitcherId, first: gd?.players?.[`ID${pitcherId}`]?.useName ?? gd?.players?.[`ID${pitcherId}`]?.firstName ?? '', last: gd?.players?.[`ID${pitcherId}`]?.lastName ?? '' } : null}
          pitches={<SealBox coverless forceRevealed>{() => zonePitches(feed, replayed ? { inning, half, open: null, last: replaying, committed: true } : { inning, half, open, last, committed: holdsFinished({ view, mark, open, last }) }).map((p) => (
            <span key={p.no} className={`gdzonemap__pitch gdzonemap__pitch--${p.cat}${p.ball ? ' has-flight' : ''}${p.off ? ` is-off is-off--${p.off}` : ''}`} style={{ left: `${p.left}%`, top: `${p.top}%` }}>
              {p.off && <span className="gdzonemap__offarrow" aria-hidden="true">{OFF_ARROW[p.off]}</span>}
              {p.no}
              {/* The ball in play opens where it went (the hero diamond's flight card). */}
              {p.ball && <BallFlight ball={p.ball} batter={{ id: batter.id, last: batter.last }} facts={false} arc={false} head={false} hover={false}
                extra={p.playId ? <SavantFacts gamePk={feed.gamePk} sportId={gd?.teams?.home?.sport?.id ?? 1} playId={p.playId} /> : null} />}
            </span>
          ))}</SealBox>} />
      )}
      {/* A dismissed zone map comes back from the stage's corner (Gary, 2026-10-28). */}
      {batter && hidden && (
        <Button size="control" className="gdzonemap__show" onClick={toggleZones}>Zones</Button>
      )}
    </>
  ) : null

  const onClick = () => {
    if (lifted) { setOver(null); return } // back to the checkpoint, nothing revealed
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
  // `replaying` (above) also marks the trail's "you are here".
  const holding = phase === 'pending' || phase === 'celebration'
  return { stage, advance: { ...advance, ...(holding ? { label: 'Next', disabled: false, caughtUp: false, refresh: false } : {}), onClick }, onReplay: covered ? setOver : onReplay, replaying }
}
