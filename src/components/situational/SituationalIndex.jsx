import { offDayTreatmentFor } from '../../lib/teams.js'
import { TeamTreatmentMark } from '../logo/TeamTreatmentMark.jsx'
import { Button } from '../ui/control/Button.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Grid } from '../ui/layout/Grid.jsx'

// The browse-first index both situational-record pages open on: every split
// visible inside its baseball subject, each tile showing its leader before the
// reader chooses anything. The regular-season page and the postseason page
// share it; each hands in its own `pathFor`.

const GROUP_NOTES = {
  Scoring: 'Runs on the board and the games they shaped.',
  'Scoring by inning': 'Which half of which inning a club put runs on the board, and the last time it did.',
  'Hits and homers': 'Contact, power and what each club allowed.',
  Defense: 'Clean sheets and costly mistakes.',
  'Leading and trailing': 'Who closed leads and who changed the ending.',
  'Close games': 'The margins that made every pitch matter.',
  'Starting pitching': 'Length, quality and the starter matchup.',
  Schedule: 'When the game was played and where it sat in the series.',
  'By month': 'The season, one calendar turn at a time.',
  'By division': 'How each club handled its division matchups.',
  'By league': 'The record on the other side of the league line.',
  'Season counts': 'Streaks, rallies, walk-offs and season-long totals.',
}

export const GROUP_KEYS = {
  Scoring: 'scoring',
  'Scoring by inning': 'scoring-by-inning',
  'Hits and homers': 'hits-homers',
  Defense: 'defense',
  'Leading and trailing': 'late-innings',
  'Close games': 'close-games',
  'Starting pitching': 'starting-pitching',
  Schedule: 'schedule',
  'By month': 'by-month',
  'By division': 'by-division',
  'By league': 'by-league',
  'Season counts': 'season-counts',
}

export function MetricFigure({ row, metric, compact = false }) {
  if (!row) return <span className="trrank__figuremain">—</span>
  if (metric.kind === 'count') {
    return <span className="trrank__figuremain">{row.value ?? '—'}</span>
  }
  return (
    <>
      <span className="trrank__figuremain">{row.v}</span>
      {!compact && <span className="trrank__figuresub">{row.pct} pct</span>}
    </>
  )
}

function SituationTile({ result, favoriteTeamId, linkProps, path }) {
  const leader = result.ranked.find((row) => row.rank != null)
  const favorite = result.ranked.find((row) => row.teamId === favoriteTeamId)
  const leaderName = leader?.team.teamName ?? leader?.team.name ?? 'No leader yet'

  return (
    <Card
      as="a"
      body="flush"
      className="trrank__tile"
      aria-label={`View ${result.metric.k} leaderboard`}
      {...linkProps(path)}
    >
      <span className="trrank__tilelabel">{result.metric.k}</span>
      <div className="trrank__tileleader">
        {leader && (
          <TeamTreatmentMark
            teamId={leader.teamId}
            name={leader.team.name}
            treatment={offDayTreatmentFor(leader.teamId)}
            side="home"
            size={42}
            block="trrank__tilemark"
          />
        )}
        <span className="trrank__tileteam">
          <strong>{leaderName}</strong>
        </span>
        <span className="trrank__tilefigure">
          <MetricFigure row={leader} metric={result.metric} />
        </span>
      </div>
      <span className={`trrank__tilefoot${favorite ? ' trrank__tilefoot--mine' : ''}`}>
        {favorite ? (
          <>
            <span>{favorite.team.teamName ?? favorite.team.name}</span>
            {/* The figure, then the rank on its own line under it — the house
                form PlayerContractCard's PayRankLine already sets, and for the
                same reason: a rank is a fact ABOUT the figure, not a decoration
                on it, and no "#" belongs in front of the number. `result.of`
                is the field a rank actually runs against — the clubs at this
                level that CAN be ranked on this split, which is not always
                thirty (a club that has never been in the split keeps its row
                but no rank). "Not ranked" is that club, and it keeps its
                figure. */}
            <strong className="trrank__tilemine">
              <span className="trrank__tilemineval">
                {result.metric.kind === 'count' ? favorite.value : favorite.v}
              </span>
              <span className="trrank__tileminerank">
                {favorite.rank == null
                  ? 'Not ranked'
                  : `${favorite.tied ? 'Tied ' : ''}${favorite.rank} of ${result.of}`}
              </span>
            </strong>
          </>
        ) : (
          <>
            <span>Full leaderboard</span>
            <strong>{result.of} ranked</strong>
          </>
        )}
        <span className="trrank__tilearrow" aria-hidden="true">›</span>
      </span>
    </Card>
  )
}

export function SituationalIndex({ groups, favoriteTeamId, pathFor, linkProps, preview }) {
  return (
    <>
      {/* In-page #anchors on a navy band: a Button with an href, as the
          design lab's jump links are (#1131). They do not leave the page, so
          they are not a Door, and they filter nothing, so they are not a Pill.
          66-situational-records.css re-inks the Button for the navy band. */}
      {preview && <nav className="trrank__jump" aria-label="Situational record categories">
        {groups.map((group, index) => (
          <Button key={group.title} size="control" href={`#record-group-${index}`}>
            {group.title}
          </Button>
        ))}
      </nav>}

      <div className="trrank__index">
        {groups.map((group, index) => (
          <section className="trrank__group" id={`record-group-${index}`} key={group.title}>
            <header className="trrank__grouphead">
              <span className="trrank__groupnum">{String(group.order).padStart(2, '0')}</span>
              <span>
                <h2>{group.title}</h2>
                <p>{GROUP_NOTES[group.title] ?? 'Every club, ranked in this split.'}</p>
              </span>
            </header>
            <Grid min={250} fit gap="base" className="trrank__tilegrid">
              {group.results.map((result) => (
                <SituationTile
                  key={result.metric.id}
                  result={result}
                  favoriteTeamId={favoriteTeamId}
                  path={pathFor({ category: null, metric: result.metric.id, sort: null, order: null })}
                  linkProps={linkProps}
                />
              ))}
            </Grid>
          </section>
        ))}
      </div>
    </>
  )
}
