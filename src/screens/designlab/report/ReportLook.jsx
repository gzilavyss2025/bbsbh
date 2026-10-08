import '../../../styles/designlab/report.css'
import { TeamScoreCard } from '../../../components/teamstats/TeamScoreCard.jsx'
import { TeamChallengeCard } from '../../team/modules/TeamChallengeCard.jsx'
import {
  CHALLENGES, LEAGUE_FORM, LEAGUE_GRADE, LEAGUE_QUALITY, LEAGUE_SURPRISE, SNAPSHOT, SURPRISE, TEAM_ID,
} from './fixture.js'

// A REPORT LOOK FOR REPORT CARDS (#1776, Q6 of #1113). Both cards are the REAL
// components on invented props, so a candidate is one wrapper class and the
// rules in styles/designlab/report.css. No production file changes and no new
// Card frame: every card is still frame="sheet", and a candidate only
// restyles the parts inside it. Gary picks by looking, then the pick becomes
// its own issue. The row marked "today" is the baseline.
//
// The cards read the VIEWPORT (740px), not their parent, so a phone-width
// frame inside a wide page would lie. Resize the window to see both widths.
const LOOKS = [
  {
    key: 'today',
    name: 'Today: frame="sheet"',
    why: 'The baseline: the two real cards as they ship.',
    tokens: 'Sheet, --surface-inset for the inner box, --border-rule',
    inner: 'A grade tile, driver tiles and a chip pair, each boxed in the sheet', score: 'Mono figure with a small "/10"', chart: 'Dots on a rail; scatter on a base rule',
  },
  {
    key: 'flat',
    name: 'A. Sheet, inner box removed',
    why: 'The smallest change. The sheet stays; only the card inside it goes. Costs the least and matches #1775.',
    tokens: '--surface-card, --border-hairline rules, --text-heading mono',
    inner: 'Gone: grade, tiles and chips sit on the sheet, split by hairline rules',
    score: 'Unchanged', chart: 'Unchanged. The chip pair becomes underlined tabs',
  },
  {
    key: 'form',
    name: 'B. Printed form',
    why: 'Reads like a ruled report page: heavy navy rules, the score in its own ruled column, graph paper under the chart. The sheet frame is untouched; square corners would need a new frame, which #1776 rules out.',
    tokens: '--navy heavy rule, --border-rule, --border-grid',
    inner: 'Gone: ruled rows, the figure in its own ruled column',
    score: 'Same mono figure and "/10", in a column cut by a rule', chart: 'Graph-paper grid (--border-grid) and a left rule on the scatter',
  },
  {
    key: 'margin',
    name: 'C. Margin numeral',
    why: 'The score is the headline: a large numeral in the left margin, the verdict beside it, marker ink on the one fact that matters.',
    tokens: '--marker for emphasis, --graphite pencil line, --text-caption, --fs-hero-sm mono',
    inner: 'Gone: a navy rule above and below the grade',
    score: 'Large mono numeral, "/10" small beside it', chart: 'Graphite dots and line; the one labelled dot in --marker',
  },
]

function Specimens() {
  return (
    <div className="rl__pair">
      <TeamScoreCard
        snapshot={SNAPSHOT}
        surprise={SURPRISE}
        teamId={TEAM_ID}
        leagueGradeScores={LEAGUE_GRADE}
        leagueSeasonScores={LEAGUE_QUALITY}
        leagueSurpriseScores={LEAGUE_SURPRISE}
        leagueFormScores={LEAGUE_FORM}
      />
      <TeamChallengeCard data={CHALLENGES} teamId={TEAM_ID} clubName="Sample club" />
    </div>
  )
}

export function ReportLook() {
  return (
    <div className="rl">
      {LOOKS.map((l) => (
        <section key={l.key} className={`rl__look rl--${l.key}`}>
          <h3 className="rl__name">{l.name}</h3>
          <p className="rl__why">{l.why}</p>
          <dl className="rl__spec">
            <div><dt>Tokens</dt><dd>{l.tokens}</dd></div>
            <div><dt>Card inside a card</dt><dd>{l.inner}</dd></div>
            <div><dt>Score out of 10</dt><dd>{l.score}</dd></div>
            <div><dt>Trend chart</dt><dd>{l.chart}</dd></div>
          </dl>
          <Specimens />
        </section>
      ))}
    </div>
  )
}
