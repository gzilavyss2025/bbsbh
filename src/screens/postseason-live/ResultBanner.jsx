import { bestOfLine, recordLine } from '../../api/postseason/text.js'
import { seriesMark } from '../../lib/postseason/seriesMarks.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { SeriesMark } from '../../components/postseason/SeriesMark.jsx'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'

// The result hero, reusing the finished page's exact banner/ledger classes (.psseries__result etc.)
// but the headline is recordLine's state ("Series tied 1–1", "CHC leads 2–1", or a decided series'
// own "TOR won 3–1": trap 7 means a decided 2026 series still opens here) rather than a clinch
// declaration, since this page may render before there IS one. Each club's win trace is the same
// inked-cell ledger idiom (.psseries__cell--won); winner/loser tinting applies only once the
// series actually is decided.
//
//   series   the bracket's series    results  its counted games    clubs  the two clubs
//   season   the bracket's season
export function ResultBanner({ series, results, clubs, season }) {
  return (
      <Card body="flush" className="psseries__result">
        <div className="psseries__banner">
          <h2 className="psseries__headline">{results.length === 0 ? bestOfLine(series) : recordLine(series)}</h2>
          <SeriesMark
            mark={seriesMark({ season: season, round: series.round, league: series.league })}
            height={40}
            decorative
            className="psseries__mark"
          />
        </div>
        <div className="psseries__ledger">
          {clubs.map((club) => {
            const wins = series.slots.find((slot) => slot.club?.id === club.id)?.wins ?? 0
            const isWinner = series.decided && series.winner?.id === club.id
            const isLoser = series.decided && series.eliminated?.id === club.id
            return (
              <div
                key={club.id}
                className={`psseries__team${isWinner ? ' psseries__team--winner' : ''}${isLoser ? ' psseries__team--loser' : ''}`}
              >
                <TeamLink id={club.id} className="psseries__teamlink">
                  <TeamLogo teamId={club.id} name={teamClubNameShort(club.id)} size={32} />
                  <span className="psseries__teamname">{teamClubNameShort(club.id)}</span>
                </TeamLink>
                <div className="psseries__cells" aria-hidden="true">
                  {results.map((g) => (
                    <span
                      key={g.gameNumber}
                      className={`psseries__cell${g.winnerId === club.id ? ' psseries__cell--won' : ''}`}
                    >
                      {g.winnerId === club.id ? g.gameNumber : ''}
                    </span>
                  ))}
                </div>
                <span className="psseries__wins">{wins}</span>
              </div>
            )
          })}
        </div>
      </Card>
  )
}
