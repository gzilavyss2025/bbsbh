import { ScorebugMount } from '../../../components/gamehud/ScorebugMount.jsx'
import { GamedayBand } from './GamedayBand.jsx'
import { Checkpoint } from './checkpoint/Checkpoint.jsx'
import { GamedayEventCard, GamedayHero } from './hero/GamedayHero.jsx'
import { GamedayNextPage } from './GamedayNextPage.jsx'
import { useGamedayStage } from './stage/useGamedayStage.jsx'

// InningViewer's hand-off to the new shell: the band reads the live snapshot through
// ScorebugMount, so its clamp stays the only gate on the score (before a snapshot, the
// clubs and no figures). `mark` is the reveal mark (named so the seal pin in InningViewer stays put); `advance` is the advance control, resolved by InningViewer from today's
// reveal state (a step, the next half, "Close the book", the box score; no "Rest of half"). `checkpoint` is set once
// the half on screen is at or under the mark (its notes' inputs). A qualifying ending celebration
// holds the stage until Next opens that checkpoint, without advancing the scoring frontier.
// `open` ({ count, sub }) is the at-bat the reader is inside (ADR-0123); `pitch` the At-bat | Pitch switch.
export function GamedayNextMount({ sectionNav, bug: { mark, ...bug }, meta, panels, checkpoint, engine, advance, open, pitch, onBoxScore, onLineup, notices, refresh }) {
  const band = bug.started && bug.live ? (
    <ScorebugMount {...bug} revealedThrough={mark} meta={meta} />
  ) : (
    <GamedayBand
      awayName={meta.away.clubName} homeName={meta.home.clubName} awayTeamId={meta.away.id} homeTeamId={meta.home.id}
      awayTreatment={bug.treatment?.away} homeTreatment={bug.treatment?.home} season={bug.season}
      awayRuns="—" homeRuns="—"
    />
  )
  const cp = checkpoint && bug.feed && (
    <Checkpoint
      key={bug.viewIdx} feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} mark={mark} notes={checkpoint}
      abbr={{ away: meta.away.abbreviation, home: meta.home.abbreviation }} nextLabel={advance.label}
    />
  )
  // The stage owns the celebration-to-checkpoint handoff and wraps the advance.
  const staged = useGamedayStage({
    feed: bug.started ? bug.feed : null, last: bug.live?.last?.atBatIndex ?? null, reliever: bug.live?.midHalfPitcherId ?? null, view: bug.viewIdx,
    inning: bug.viewInning, half: bug.viewHalf, mark, stepAtBatIndex: bug.stepAtBatIndex, checkpoint: cp, advance, open,
  })
  const stage = staged.stage && (
    <>
      {staged.stage}
      {!checkpoint && <GamedayEventCard feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} count={open?.count} sub={open?.sub ?? 0} />}
    </>
  )
  const hero = bug.started && bug.feed && (
    <GamedayHero
      feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} mark={mark}
      last={bug.live?.last ?? null} stepAtBatIndex={bug.stepAtBatIndex} open={open} checkpoint={Boolean(checkpoint)}
    />
  )
  return (
    <GamedayNextPage
      sectionNav={sectionNav}
      band={band}
      stage={stage}
      // Before the first pitch: nothing revealed, the top of the 1st, the cursor at its start.
      pregame={(mark ?? -1) < 0 && bug.viewInning === 1 && bug.viewHalf === 'top' && !!open && !open.count && !open.sub}
      // `here`: the at-bat on screen (a replayed chip, else the hero's), which the trail marks.
      panels={{ ...panels, onReplay: staged.onReplay, here: staged.replaying ?? bug.live?.last?.atBatIndex ?? null }}
      hero={hero || null}
      engine={engine}
      advance={staged.advance}
      pitch={pitch}
      onBoxScore={onBoxScore}
      lineups={{ away: meta.away.abbreviation, home: meta.home.abbreviation, onLineup }}
      notices={notices}
      refresh={refresh}
    />
  )
}
