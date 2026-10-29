import { ScorebugMount } from '../../../components/gamehud/ScorebugMount.jsx'
import { GamedayBand } from './GamedayBand.jsx'
import { Checkpoint } from './checkpoint/Checkpoint.jsx'
import { GamedayEventCard, GamedayHero } from './hero/GamedayHero.jsx'
import { GamedayNextPage } from './GamedayNextPage.jsx'
import { useGamedayStage } from './stage/useGamedayStage.jsx'
import { ScoringSheet } from './panels/GamedaySheets.jsx'
import { rewindTo, walkCut } from './panels/panelData.js'
import { useCallback, useMemo, useState } from 'react'
import { ordinal } from '../../../lib/format.js'

// InningViewer's hand-off to the new shell: the band reads the live snapshot through
// ScorebugMount, so its clamp stays the only gate on the score (before a snapshot, the
// clubs and no figures). `mark` is the reveal mark (named so the seal pin in InningViewer stays put); `advance` is the advance control, resolved by InningViewer from today's
// reveal state (a step, the next half, "Close the book", the box score; no "Rest of half"). `checkpoint` is set once
// the half on screen is at or under the mark (its notes' inputs). A qualifying ending celebration
// holds the stage until Next opens that checkpoint, without advancing the scoring frontier.
// `open` ({ count, sub }) is the at-bat the reader is inside (ADR-0123); `pitch` the At-bat | Pitch switch.
export function GamedayNextMount({ sectionNav, bug: { mark, ...bug }, meta, panels, checkpoint, engine, advance, open, pitch, onBoxScore, onLineup, notices, refresh }) {
  // A tap on a club's half of the band opens how it scored, as of the step (Gary, 2026-10-29).
  const [runsOf, setRunsOf] = useState(false)
  const [closing, setClosing] = useState(false)
  // A close plays the drop's exit first (`closing`); `onClosed` then takes it away.
  const closeRuns = useCallback(() => setClosing(true), [])
  const closedRuns = useCallback(() => { setClosing(false); setRunsOf(false) }, [])
  // Either half of the bug toggles the one combined summary.
  const onTeam = () => (runsOf ? setClosing(true) : (setClosing(false), setRunsOf(true)))
  const cp = checkpoint && bug.feed && (
    <Checkpoint
      key={bug.viewIdx} feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} mark={mark} notes={checkpoint}
      abbr={{ away: meta.away.abbreviation, home: meta.home.abbreviation }} nextLabel={advance.label}
    />
  )
  // THE HALF'S CLOSE-OUT (Gary, 2026-10-29): when a half ends, its last at-bat's result stays on the stage and
  // the hero until one more tap ("Middle 1st ›"), which opens the checkpoint over the whole center (the stage
  // and the hero's rows). That tap reveals nothing: the checkpoint is the half already under the mark.
  const [cpOpen, setCpOpen] = useState(null)
  const held = Boolean(cp) && cpOpen !== bug.viewIdx
  const closeOut = held
    ? { label: `${bug.viewHalf === 'top' ? 'Middle' : 'End'} ${ordinal(bug.viewInning)}`, disabled: false, onClick: () => setCpOpen(bug.viewIdx) }
    : advance
  // The stage owns the celebration-to-checkpoint handoff and wraps the advance.
  const staged = useGamedayStage({
    feed: bug.started ? bug.feed : null, last: bug.live?.last?.atBatIndex ?? null, reliever: bug.live?.midHalfPitcherId ?? null, view: bug.viewIdx,
    inning: bug.viewInning, half: bug.viewHalf, mark, stepAtBatIndex: bug.stepAtBatIndex, checkpoint: held ? null : cp, advance: closeOut, open,
  })
  // A finished half read back (Gary, 2026-10-29): a tapped chip, or the read-back walk, rewinds the band,
  // the line score and the Due up to that at-bat (panelData.js rewindTo); the trail keeps the whole half.
  const committed = panels.step == null && bug.viewIdx <= mark
  // The walk inside an at-bat counts the one before it; else the at-bat the read-back cursor stands on (a chip
  // moves it), else a stage replay. It holds until the reader moves it again.
  const rewindAbi = committed ? walkCut(bug.feed, bug.viewInning, bug.viewHalf, open) ?? panels.readAt ?? staged.replaying : null
  // walkCut and rewindTo read results, so they run only on a `committed` half: one already at or under the
  // reveal mark, which shows nothing the reader has not revealed. That gate is what keeps them out of a SealBox.
  const rewind = useMemo(() => (rewindAbi != null && bug.feed ? rewindTo(bug.feed, bug.viewInning, bug.viewHalf, rewindAbi) : null), [bug.feed, bug.viewInning, bug.viewHalf, rewindAbi])
  const trailExtras = { onReplay: (i) => { staged.onReplay(i); panels.onPick?.(i) }, onBack: staged.replaying != null ? staged.onBack : null, here: staged.replaying ?? (open?.sub > 0 ? null : bug.live?.last?.atBatIndex ?? null) }
  const shown = rewind ? { ...panels, step: rewind.step, mark: rewind.mark, runsInProgress: rewind.runsInProgress } : panels
  const band = bug.started && bug.live ? (
    <>
      <ScorebugMount {...bug} {...(rewind ? { runsInProgress: rewind.runsInProgress } : {})} revealedThrough={rewind ? rewind.mark : mark} meta={meta} onTeam={onTeam} />
      {runsOf && <ScoringSheet ctx={shown} onClose={closeRuns} closing={closing} onClosed={closedRuns} />}
    </>
  ) : (
    <GamedayBand
      awayName={meta.away.clubName} homeName={meta.home.clubName} awayTeamId={meta.away.id} homeTeamId={meta.home.id}
      awayTreatment={bug.treatment?.away} homeTreatment={bug.treatment?.home} season={bug.season}
      awayRuns="—" homeRuns="—"
    />
  )
  const stage = staged.stage && (
    <>
      {staged.stage}
      {!(checkpoint && !held) && <GamedayEventCard feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} count={open?.count} sub={open?.sub ?? 0} />}
    </>
  )
  const hero = bug.started && bug.feed && (
    <GamedayHero
      feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} mark={mark}
      last={bug.live?.last ?? null} stepAtBatIndex={bug.stepAtBatIndex} open={open} replay={staged.replaying} step={panels.step} checkpoint={Boolean(checkpoint) && !held}
    />
  )
  return (
    <>
    <GamedayNextPage
      sectionNav={sectionNav}
      band={band}
      stage={stage}
      wideCheckpoint={Boolean(cp) && !held}
      // Before the first pitch: nothing revealed, the top of the 1st, the cursor at its start.
      pregame={(mark ?? -1) < 0 && bug.viewInning === 1 && bug.viewHalf === 'top' && !!open && !open.count && !open.sub}
      // `here`: the at-bat on screen (a replayed chip, else the hero's), which the trail marks.
      // The trail marks the at-bat on screen: a replayed one, else the last finished one, but never once the
      // reader has stepped into the next at-bat (Gary, 2026-10-29: Aranda stayed yellow with Simpson up).
      panels={{ ...shown, ...trailExtras }}
      trailPanels={{ ...panels, ...trailExtras }}
      hero={hero || null}
      engine={engine}
      advance={staged.advance}
      pitch={pitch}
      onBoxScore={onBoxScore}
      lineups={{ away: meta.away.abbreviation, home: meta.home.abbreviation, onLineup }}
      notices={notices}
      refresh={refresh}
    />
    </>
  )
}
