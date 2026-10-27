import { ScorebugMount } from '../../../components/gamehud/ScorebugMount.jsx'
import { GamedayBand } from './GamedayBand.jsx'
import { Checkpoint } from './checkpoint/Checkpoint.jsx'
import { GamedayEventCard, GamedayHero } from './hero/GamedayHero.jsx'
import { GamedayNextPage } from './GamedayNextPage.jsx'
import { useGamedayStage } from './stage/useGamedayStage.jsx'

// InningViewer's hand-off to the new shell: the band reads the live snapshot through
// ScorebugMount, so its clamp stays the only gate on the score (before a snapshot, the
// clubs and no figures). `mark` is the reveal mark (named so the seal pin in InningViewer stays put); `advance` is the advance control, resolved by InningViewer from today's
// reveal state (the same states InningActionBar draws, minus "Rest of half"). `checkpoint` is set once
// the half on screen is at or under the mark (its notes' inputs), and the checkpoint takes the stage.
// `open` ({ count, sub }) is the at-bat the reader is inside (ADR-0123); `pitch` the At-bat | Pitch switch.
export function GamedayNextMount({ bug: { mark, ...bug }, meta, panels, checkpoint, engine, advance, open, pitch, onBoxScore, onScorecard, refresh }) {
  const band = bug.started && bug.live ? (
    <ScorebugMount {...bug} revealedThrough={mark} meta={meta} Bug={GamedayBand} />
  ) : (
    <GamedayBand
      awayName={meta.away.clubName} homeName={meta.home.clubName} awayTeamId={meta.away.id} homeTeamId={meta.home.id}
      awayTreatment={bug.treatment?.away} homeTreatment={bug.treatment?.home} season={bug.season}
      awayRuns="—" homeRuns="—"
    />
  )
  // The stage slot, and the advance wrapped in the tap rule (stage/useGamedayStage.jsx).
  const staged = useGamedayStage({
    feed: bug.started ? bug.feed : null, last: bug.live?.last?.atBatIndex ?? null, reliever: bug.live?.midHalfPitcherId ?? null, view: bug.viewIdx,
    inning: bug.viewInning, half: bug.viewHalf, mark, stepAtBatIndex: bug.stepAtBatIndex, covered: !!checkpoint, advance, open,
  })
  const stage = staged.stage && (
    <>
      {staged.stage}
      <GamedayEventCard feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} count={open?.count} sub={open?.sub ?? 0} />
    </>
  )
  const hero = bug.started && bug.feed && (
    <GamedayHero
      feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} mark={mark}
      last={bug.live?.last ?? null} stepAtBatIndex={bug.stepAtBatIndex} open={open} checkpoint={Boolean(checkpoint)}
    />
  )
  const cp = checkpoint && bug.feed && (
    <Checkpoint
      key={bug.viewIdx} feed={bug.feed} inning={bug.viewInning} half={bug.viewHalf} mark={mark} notes={checkpoint}
      abbr={{ away: meta.away.abbreviation, home: meta.home.abbreviation }} nextLabel={advance.label}
    />
  )
  return (
    <GamedayNextPage
      band={band}
      stage={stage}
      panels={panels}
      hero={hero || null}
      checkpoint={cp || null}
      engine={engine}
      advance={staged.advance}
      pitch={pitch}
      onBoxScore={onBoxScore}
      onScorecard={onScorecard}
      refresh={refresh}
    />
  )
}
