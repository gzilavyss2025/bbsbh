import '../styles/66-situational-records.css'
import '../styles/situational-records/66a-detail.css'
import { useMemo } from 'react'
import { fetchLevelTeamRecords, buildRankingIndex, rankMetric, levelMonths } from '../api/situationalRecordRankings.js'
import { HALVES } from '../api/teamRecords.js'
import { seasonOf, cutoffFor } from './team/data/shared.js'
import { SPORT_LABEL } from '../lib/teams.js'
import { situationalRecordsPath } from '../lib/route.js'
import { postseasonRecordsPath } from '../lib/postseason/recordsRoute.js'
import { useNav, useRouteLink } from '../lib/nav.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { LevelNav } from '../components/team/LevelNav.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { SituationalIndex, GROUP_KEYS } from '../components/situational/SituationalIndex.jsx'
import { SituationalBoard } from '../components/situational/SituationalBoard.jsx'

// One situational record, every club at one level, in rank order. The bare
// route is a browse-first index: every split stays visible inside its
// baseball subject and each card shows its leader before the reader chooses
// anything. A `?metric=` route is the focused broadcast board for that split.
// Both views use the same ranking index and download the level's ledgers once.

export function SituationalRecordsPage({
  asOf,
  sportId: routeSportId,
  category: routeCategory,
  metric: routeMetric,
  half: routeHalf,
  month: routeMonth,
  sort: routeSort,
  order: routeOrder,
}) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const sportId = routeSportId ?? 1
  const half = HALVES.some((item) => item.key === routeHalf) ? routeHalf : 'all'
  // A free-form query value: anything outside 1-12 falls back to the whole
  // season rather than erroring, the same stance every other param here takes.
  const monthNum = Number(routeMonth)
  const month = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null
  const sortBy = routeSort === 'played' ? 'played' : 'pct'
  const order = routeOrder === 'asc' || routeOrder === 'desc' ? routeOrder : null
  const { favoriteTeamId } = useFavoriteTeam()

  const season = seasonOf(asOf, sportId)
  const cutoff = cutoffFor(asOf)
  const { loading, error, data } = useAsync(
    () => fetchLevelTeamRecords(sportId, season),
    [sportId, season],
  )
  const index = useMemo(
    () => buildRankingIndex(data ?? [], { cutoff, half, month }),
    [data, cutoff, half, month],
  )
  const months = useMemo(() => levelMonths(data ?? [], { cutoff }), [data, cutoff])

  // A stale metric link still opens a useful board. A bare route stays bare:
  // it is the situational index, not an implicit first leaderboard.
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

  const activeGroup = resolvedId
    ? overviewGroups.find((group) => group.metrics.some((item) => item.id === resolvedId))
    : null
  const activeCategory = routeCategory
    ? overviewGroups.find((group) => group.key === routeCategory) ?? null
    : null
  const clubAbbr = useMemo(
    () => new Map(index.teams.map((t) => [t.id, t.abbreviation ?? ''])),
    [index],
  )
  const showHalves = (data ?? []).some((entry) => entry.data?.allStarDate)
  useDocumentTitle(
    result
      ? `${result.metric.k} · Situational Records`
      : activeCategory
        ? `${activeCategory.title} · Situational Records`
        : 'Situational Records',
  )

  const pathFor = ({
    category: nextCategory = routeCategory,
    metric: nextMetric = resolvedId,
    half: nextHalf = half,
    month: nextMonth = month,
    sport: nextSport = sportId,
    sort: nextSort = sortBy,
    order: nextOrder = order,
  } = {}) => situationalRecordsPath({
    category: nextMetric ? null : nextCategory,
    metric: nextMetric,
    half: nextHalf,
    month: nextMonth,
    sort: nextMetric ? nextSort : null,
    order: nextMetric ? nextOrder : null,
    d: asOf,
    s: nextSport,
  })

  return (
    <div className="screen trrank-page">
      <SiteHeader />

      <header className="trrank__hero">
        <span className="trrank__note">{season} {SPORT_LABEL[sportId] ?? ''} season</span>
        <h1>Situational Records</h1>
        <p>W–L records and season totals for every club, split by game situation.</p>
        <a className="trrank__sibling" {...linkProps(postseasonRecordsPath({ d: asOf }))}>
          Postseason records <span aria-hidden="true">›</span>
        </a>
      </header>

      <section className="trrank__scope" aria-label="Situational record filters">
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
        {months.length > 1 && (
          <div className="trrank__chips" role="group" aria-label="Month">
            <button
              type="button"
              className={`trrank__chip${month == null ? ' is-on' : ''}`}
              aria-pressed={month == null}
              onClick={() => navigate(pathFor({ month: null }))}
            >
              Every month
            </button>
            {months.map((item) => (
              <button
                key={item.month}
                type="button"
                className={`trrank__chip${item.month === month ? ' is-on' : ''}`}
                aria-pressed={item.month === month}
                onClick={() => navigate(pathFor({ month: item.month }))}
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
        errorMessage="Couldn’t load situational records. Try again."
        emptyMessage="No situational records on file for this level yet."
      />

      {!loading && !error && index.groups.length > 0 && !result && (
        <>
          {activeCategory && (
            <a
              className="trrank__back trrank__categoryback"
              {...linkProps(pathFor({ category: null, metric: null, sort: null, order: null }))}
            >
              <span aria-hidden="true">‹</span> All situational categories
            </a>
          )}
          <SituationalIndex
            groups={activeCategory ? [activeCategory] : overviewGroups}
            favoriteTeamId={favoriteTeamId}
            pathFor={pathFor}
            linkProps={linkProps}
            preview={!activeCategory}
          />
        </>
      )}

      {result && (
        <SituationalBoard
          result={result}
          group={activeGroup}
          pathFor={pathFor}
          favoriteTeamId={favoriteTeamId}
          clubAbbr={clubAbbr}
          sortBy={sortBy}
        />
      )}

      <ReportFooter />
    </div>
  )
}
