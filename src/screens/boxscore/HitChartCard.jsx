import { HitChart } from '../../components/charts/HitChart.jsx'

// The box score's hit chart: where the night's contact actually went, drawn on
// the park's own outline. Its own file rather than another block in
// BoxScore.jsx, which is long enough that check-file-size asks for exactly this
// (ADR-0038) — and the club/count assembly reads better beside the chart than
// buried in the middle of a 1,200-line body.
//
// No reveal gate of its own, deliberately. It is mounted from inside the one
// SealBox this page lifts over the whole game (ADR-0049), and `battedBalls`
// arrives already computed there by revealBoxScore.js, so nothing here reaches
// the DOM that the line score above it has not already shown (ADR-0051).
// Renders nothing at a park that sends no tracking, or a venue the ballpark
// drawing does not carry — HitChart decides that.
export function HitChartCard({ battedBalls, box, venue }) {
  const clubs = [
    { teamId: box.away.id, name: box.away.teamName, count: battedBalls.filter((b) => !b.isHome).length },
    { teamId: box.home.id, name: box.home.teamName, count: battedBalls.filter((b) => b.isHome).length },
  ]
  return (
    <HitChart
      balls={battedBalls}
      venue={venue}
      clubs={clubs}
      tag={[`${box.away.abbreviation} @ ${box.home.abbreviation}`]}
    />
  )
}
