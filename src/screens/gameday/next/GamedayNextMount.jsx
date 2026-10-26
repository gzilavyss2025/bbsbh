import { ScorebugMount } from '../../../components/gamehud/ScorebugMount.jsx'
import { GamedayBand } from './GamedayBand.jsx'
import { GamedayNextPage } from './GamedayNextPage.jsx'

// InningViewer's hand-off to the new shell: the band reads the live snapshot through
// ScorebugMount, so its clamp stays the only gate on the score (before a snapshot, the
// clubs and no figures). `mark` is the reveal mark (named so the seal pin in InningViewer stays put); `advance` is the advance control, resolved by InningViewer from today's
// reveal state (the same states InningActionBar draws, minus "Rest of half").
export function GamedayNextMount({ bug: { mark, ...bug }, meta, panels, engine, advance, onBoxScore, onScorecard, refresh }) {
  const band = bug.started && bug.live ? (
    <ScorebugMount {...bug} revealedThrough={mark} meta={meta} Bug={GamedayBand} />
  ) : (
    <GamedayBand
      awayName={meta.away.clubName} homeName={meta.home.clubName} awayTeamId={meta.away.id} homeTeamId={meta.home.id}
      awayTreatment={bug.treatment?.away} homeTreatment={bug.treatment?.home} season={bug.season}
      awayRuns="—" homeRuns="—"
    />
  )
  return (
    <GamedayNextPage
      band={band}
      panels={panels}
      engine={engine}
      advance={advance}
      onBoxScore={onBoxScore}
      onScorecard={onScorecard}
      refresh={refresh}
    />
  )
}
