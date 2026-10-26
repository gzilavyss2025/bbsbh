import { ScorebugMount } from '../../../components/gamehud/ScorebugMount.jsx'
import { GamedayBand } from './GamedayBand.jsx'
import { GamedayNextPage } from './GamedayNextPage.jsx'

// InningViewer's hand-off to the new shell: the band reads the live snapshot through
// ScorebugMount, so its clamp stays the only gate on the score (before a snapshot, the
// clubs and no figures). `mark` is the reveal mark (named so the seal pin in InningViewer stays put); `advance` is the advance control, resolved by InningViewer from today's
// reveal state (the same states InningActionBar draws, minus "Rest of half").
export function GamedayNextMount({ bug: { mark, ...bug }, meta, engine, advance, onBoxScore, onScorecard, refresh }) {
  const band = bug.live ? (
    <ScorebugMount {...bug} revealedThrough={mark} meta={meta} Bug={GamedayBand} />
  ) : (
    <GamedayBand awayAbbr={meta.away.abbreviation} homeAbbr={meta.home.abbreviation} awayRuns="—" homeRuns="—" />
  )
  return (
    <GamedayNextPage
      band={band}
      engine={engine}
      advance={advance}
      onBoxScore={onBoxScore}
      onScorecard={onScorecard}
      refresh={refresh}
    />
  )
}
