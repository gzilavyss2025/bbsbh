import '../styles/66-team-record-rankings.css'
import '../styles/team-records/66a-detail.css'
import { useMemo } from 'react'
import { fetchLevelTeamRecords, buildRankingIndex, rankMetric, defaultOrder } from '../api/teamRecordRankings.js'
import { HALVES } from '../api/teamRecords.js'
import { seasonOf, cutoffFor } from './team/data/shared.js'
import { SPORT_LABEL, offDayTreatmentFor } from '../lib/teams.js'
import { teamRecordsPath } from '../lib/route.js'
import { useNav, useRouteLink } from '../lib/nav.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { LevelNav } from '../components/team/LevelNav.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { TeamTreatmentMark } from '../components/logo/TeamTreatmentMark.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'

// One situational record, every club at one level, in rank order. The bare
// route is a browse-first record book: every split stays visible inside its
// baseball subject and each card shows its leader before the reader chooses
// anything. A `?metric=` route is the focused broadcast board for that split.
// Both views use the same ranking index and download the level's ledgers once.

const SORTS = [
  { key: 'pct', label: 'Win pct' },
  { key: 'played', label: 'How often' },
]

const GROUP_NOTES = {
  Scoring: 'Runs on the board and the games they shaped.',
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

const GROUP_KEYS = {
  Scoring: 'scoring',
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

function RankCell({ rank, tied }) {
  if (rank == null) return <span className="trrank__rank trrank__rank--none">—</span>
  return (
    <span className="trrank__rank">
      {tied ? 'T' : ''}
      {rank}
    </span>
  )
}

function MetricFigure({ row, metric, compact = false }) {
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

function RecordTile({ result, favoriteTeamId, linkProps, path }) {
  const leader = result.ranked.find((row) => row.rank != null)
  const favorite = result.ranked.find((row) => row.teamId === favoriteTeamId)
  const leaderName = leader?.team.teamName ?? leader?.team.name ?? 'No leader yet'

  return (
    <a
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
            <strong>
              {favorite.rank == null ? 'Not ranked' : `#${favorite.rank}`} ·{' '}
              {result.metric.kind === 'count' ? favorite.value : favorite.v}
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
    </a>
  )
}

function RecordBook({ groups, favoriteTeamId, pathFor, linkProps, preview }) {
  return (
    <>
      {preview && <nav className="trrank__jump" aria-label="Record categories">
        {groups.map((group, index) => (
          <a key={group.title} href={`#record-group-${index}`}>
            {group.title}
          </a>
        ))}
      </nav>}

      <div className="trrank__book">
        {groups.map((group, index) => {
          const visibleResults = preview ? group.results.slice(0, 2) : group.results
          return (
            <section className="trrank__group" id={`record-group-${index}`} key={group.title}>
              <header className="trrank__grouphead">
                <span className="trrank__groupnum">{String(group.order).padStart(2, '0')}</span>
                <span>
                  <h2>{group.title}</h2>
                  <p>{GROUP_NOTES[group.title] ?? 'Every club, ranked in this split.'}</p>
                </span>
              </header>
              <div className="trrank__tilegrid">
                {visibleResults.map((result) => (
                  <RecordTile
                    key={result.metric.id}
                    result={result}
                    favoriteTeamId={favoriteTeamId}
                    path={pathFor({ category: null, metric: result.metric.id, sort: null, order: null })}
                    linkProps={linkProps}
                  />
                ))}
              </div>
              {preview && group.results.length > visibleResults.length && (
                <a
                  className="trrank__groupdoor"
                  {...linkProps(pathFor({ category: group.key, metric: null, sort: null, order: null }))}
                >
                  Explore all {group.results.length} {group.title} records <span aria-hidden="true">›</span>
                </a>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

function LeadersSpotlight({ rows, metric }) {
  return (
    <div className="trrank__podium" aria-label="Top three clubs">
      {rows.map((row) => (
        <div className="trrank__podiumcard" key={row.teamId}>
          <span className="trrank__podiumrank">{row.tied ? 'T' : ''}{row.rank}</span>
          <TeamLogo teamId={row.teamId} name={row.team.name} size={42} />
          <TeamLink id={row.teamId} tab="numbers" className="trrank__podiumteam">
            {row.team.teamName ?? row.team.name}
          </TeamLink>
          <span className="trrank__podiumfigure">
            <MetricFigure row={row} metric={metric} compact />
          </span>
        </div>
      ))}
    </div>
  )
}

export function TeamRecordsPage({
  asOf,
  sportId: routeSportId,
  category: routeCategory,
  metric: routeMetric,
  half: routeHalf,
  sort: routeSort,
  order: routeOrder,
}) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const sportId = routeSportId ?? 1
  const half = HALVES.some((item) => item.key === routeHalf) ? routeHalf : 'all'
  const sortBy = routeSort === 'played' ? 'played' : 'pct'
  const order = routeOrder === 'asc' || routeOrder === 'desc' ? routeOrder : null
  const { favoriteTeamId } = useFavoriteTeam()

  const season = seasonOf(asOf)
  const cutoff = cutoffFor(asOf)
  const { loading, error, data } = useAsync(
    () => fetchLevelTeamRecords(sportId, season),
    [sportId, season],
  )
  const index = useMemo(
    () => buildRankingIndex(data ?? [], { cutoff, half }),
    [data, cutoff, half],
  )

  // A stale metric link still opens a useful board. A bare route stays bare:
  // it is the record-book overview, not an implicit first leaderboard.
  const resolvedId = routeMetric
    ? index.metrics.has(routeMetric)
      ? routeMetric
      : index.groups[0]?.metrics[0]?.id ?? null
    : null
  const result = useMemo(
    () => (resolvedId ? rankMetric(index, resolvedId, { sortBy, order }) : null),
    [index, resolvedId, sortBy, order],
  )
  const overviewGroups = useMemo(
    () => index.groups.map((group, groupIndex) => ({
      ...group,
      key: GROUP_KEYS[group.title] ?? group.title,
      order: groupIndex + 1,
      results: group.metrics.map((metric) => rankMetric(index, metric.id)).filter(Boolean),
    })),
    [index],
  )

  const metric = result?.metric
  const isCount = metric?.kind === 'count'
  const activeGroup = resolvedId
    ? overviewGroups.find((group) => group.metrics.some((item) => item.id === resolvedId))
    : null
  const activeCategory = routeCategory
    ? overviewGroups.find((group) => group.key === routeCategory) ?? null
    : null
  const leaders = result?.ranked.filter((row) => row.rank != null).slice(0, 3) ?? []
  const showHalves = (data ?? []).some((entry) => entry.data?.allStarDate)
  const dir = result?.order ?? 'desc'
  const flipLabel = result?.byQuality
    ? dir === defaultOrder(metric)
      ? 'Best first'
      : 'Worst first'
    : dir === 'desc'
      ? 'Highest first'
      : 'Lowest first'
  const halfShortLabel = half === 'pre' ? 'Pre-ASG' : half === 'post' ? 'Post-ASG' : 'Full'

  useDocumentTitle(
    metric
      ? `${metric.k} · Team Records`
      : activeCategory
        ? `${activeCategory.title} · Team Records`
        : 'Team Records',
  )

  const pathFor = ({
    category: nextCategory = routeCategory,
    metric: nextMetric = resolvedId,
    half: nextHalf = half,
    sport: nextSport = sportId,
    sort: nextSort = sortBy,
    order: nextOrder = order,
  } = {}) => teamRecordsPath({
    category: nextMetric ? null : nextCategory,
    metric: nextMetric,
    half: nextHalf,
    sort: nextMetric ? nextSort : null,
    order: nextMetric ? nextOrder : null,
    d: asOf,
    s: nextSport,
  })

  return (
    <div className="screen trrank-page">
      <SiteHeader />

      <header className="trrank__hero">
        <span className="trrank__eyebrow">{season} {SPORT_LABEL[sportId] ?? ''} record book</span>
        <h1>Team Records</h1>
        <p>Every split. Every club. See who owns the season’s defining situations.</p>
        <dl className="trrank__herostats">
          <div><dt>Clubs</dt><dd>{data?.length || '—'}</dd></div>
          <div><dt>Records</dt><dd>{index.metrics.size || '—'}</dd></div>
          <div><dt>Range</dt><dd>{halfShortLabel}</dd></div>
        </dl>
      </header>

      <section className="trrank__scope" aria-label="Record book filters">
        <div className="trrank__scopehead">
          <span>League filters</span>
          <strong>{season} · {SPORT_LABEL[sportId] ?? ''}</strong>
        </div>
        <LevelNav
          sportId={sportId}
          onChange={(nextSport) => navigate(pathFor({ sport: nextSport }))}
        />
        {showHalves && (
          <div className="trrank__chips" role="group" aria-label="Season half">
            {HALVES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`trrank__chip${item.key === half ? ' is-on' : ''}`}
                aria-pressed={item.key === half}
                onClick={() => navigate(pathFor({ half: item.key }))}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={index.groups.length > 0}
        errorMessage="Couldn’t load team records. Try again."
        emptyMessage="No team records on file for this level yet."
        emptyProse
      />

      {!loading && !error && index.groups.length > 0 && !result && (
        <>
          {activeCategory && (
            <a
              className="trrank__back trrank__categoryback"
              {...linkProps(pathFor({ category: null, metric: null, sort: null, order: null }))}
            >
              <span aria-hidden="true">‹</span> All record categories
            </a>
          )}
          <RecordBook
            groups={activeCategory ? [activeCategory] : overviewGroups}
            favoriteTeamId={favoriteTeamId}
            pathFor={pathFor}
            linkProps={linkProps}
            preview={!activeCategory}
          />
        </>
      )}

      {result && (
        <main className="trrank__detail">
          <a
            className="trrank__back"
            {...linkProps(pathFor({
              category: activeGroup?.key ?? null,
              metric: null,
              sort: null,
              order: null,
            }))}
          >
            <span aria-hidden="true">‹</span> {activeGroup?.title ?? 'All team records'}
          </a>

          <section className="trrank__detailhead">
            <span className="trrank__detailgroup">{activeGroup?.title ?? 'Team records'}</span>
            <h2>{metric.k}</h2>
            <p>
              {result.of} club{result.of === 1 ? '' : 's'} ranked
              {isCount ? '' : sortBy === 'played' ? ' by frequency' : ' by win percentage'}
              {isCount && result.byQuality
                ? ` · ${metric.better === 'low' ? 'Fewest is best' : 'Most is best'}`
                : ''}
            </p>
          </section>

          {leaders.length > 0 && <LeadersSpotlight rows={leaders} metric={metric} />}

          <section className="trrank__boardcontrols" aria-label="Leaderboard controls">
            <span className="trrank__controltitle">Rank the board</span>
            <div className="trrank__chips">
              {!isCount && SORTS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`trrank__chip${item.key === sortBy ? ' is-on' : ''}`}
                  aria-pressed={item.key === sortBy}
                  onClick={() => navigate(pathFor({ sort: item.key, order: null }))}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                className="trrank__chip trrank__flip"
                onClick={() => navigate(pathFor({ order: dir === 'desc' ? 'asc' : 'desc' }))}
              >
                {flipLabel} {dir === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </section>

          {activeGroup && activeGroup.metrics.length > 1 && (
            <nav className="trrank__related" aria-label={`More ${activeGroup.title} records`}>
              <span>More in {activeGroup.title}</span>
              <div>
                {activeGroup.metrics.map((item) => (
                  <a
                    key={item.id}
                    className={item.id === resolvedId ? 'is-active' : ''}
                    aria-current={item.id === resolvedId ? 'page' : undefined}
                    {...linkProps(pathFor({ metric: item.id, sort: null, order: null }))}
                  >
                    {item.k}
                  </a>
                ))}
              </div>
            </nav>
          )}

          <div className="ledger-wrap trrank__tablewrap">
            <table className="standings trrank">
              <caption className="sr-only">{metric.k} team rankings</caption>
              <thead>
                <tr>
                  <th className="team">Club</th>
                  {isCount ? (
                    <th>Total</th>
                  ) : (
                    <>
                      <th>W-L</th>
                      <th>Win pct</th>
                      <th>Games</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {result.ranked.map((row) => (
                  <tr
                    key={row.teamId}
                    className={`${row.teamId === favoriteTeamId ? 'trrank__row--mine' : ''}${
                      row.rank == null ? ' trrank__row--none' : ''
                    }`}
                  >
                    <td className="team">
                      <RankCell rank={row.rank} tied={row.tied} />
                      <TeamLink id={row.teamId} tab="numbers">
                        <TeamLogo teamId={row.teamId} name={row.team.name} size={22} />
                        <span className="trrank__teamname">{row.team.name}</span>
                        <span className="trrank__teamabbr">{row.team.abbreviation}</span>
                      </TeamLink>
                    </td>
                    {isCount ? (
                      <td className="trrank__num">{row.value ?? '—'}</td>
                    ) : (
                      <>
                        <td className="trrank__num">{row.v}</td>
                        <td className="trrank__num trrank__pct">{row.pct}</td>
                        <td className="trrank__num">{row.played || '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      <ReportFooter />
    </div>
  )
}
