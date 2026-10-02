import '../../styles/66-situational-records.css'
import '../../styles/situational-records/66a-detail.css'
import { useMemo } from 'react'
import {
  ALL_SEASONS,
  MIN_GAMES,
  fetchPostseasonSeasons,
  fetchPostseasonEntries,
  resolveSeason,
  resolveMinGames,
  teamRankRows,
} from '../../api/postseason/records.js'
import { buildRankingIndex, rankMetric } from '../../api/situationalRecordRankings.js'
import { cutoffFor } from '../team/data/shared.js'
import { postseasonRecordsPath } from '../../lib/postseason/recordsRoute.js'
import { situationalRecordsPath } from '../../lib/route.js'
import { useNav, useRouteLink } from '../../lib/nav.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { SituationalIndex, GROUP_KEYS } from '../../components/situational/SituationalIndex.jsx'
import { SituationalBoard } from '../../components/situational/SituationalBoard.jsx'
import { TeamRecordsList } from '../../components/situational/TeamRecordsList.jsx'

// The regular-season Situational Records page (SituationalRecordsPage.jsx),
// over the MLB postseason: one split with every postseason club ranked, or one
// club with all of its splits, for one postseason or for every one since 1995.
// Same ranking index, same board, same index of splits; only the ledger
// (src/api/postseason/records.js) and the scope controls differ.
//
// Two views, one switch. "By situation" is the regular-season page's own shape:
// the bare route is the index of splits, `?metric=` the focused board. "By
// team" (`?view=teams`) reads down one club (`?team=`, else the reader's
// favorite club if it has played, else the first club alphabetically).

const SCOPE_NOTE = 'W–L records for every postseason club, split by game situation.'

function seasonLabel(season) {
  return season === ALL_SEASONS ? 'All postseasons since 1995' : `${season} postseason`
}

export function PostseasonRecordsPage({
  asOf,
  season: routeSeason,
  view: routeView,
  team: routeTeam,
  min: routeMin,
  category: routeCategory,
  metric: routeMetric,
  sort: routeSort,
  order: routeOrder,
}) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const { favoriteTeamId } = useFavoriteTeam()
  const byTeam = routeView === 'teams'
  const sortBy = routeSort === 'played' ? 'played' : 'pct'
  const order = routeOrder === 'asc' || routeOrder === 'desc' ? routeOrder : null
  const cutoff = cutoffFor(asOf)

  // The seasons on file come first, because the season param is read against
  // them: a year with no file falls back to the latest rather than erroring.
  const { loading, error, data } = useAsync(async () => {
    const seasons = await fetchPostseasonSeasons()
    const season = resolveSeason(routeSeason, seasons)
    const entries = season == null ? [] : await fetchPostseasonEntries(season, seasons)
    return { seasons, season, entries }
  }, [routeSeason])
  const seasons = data?.seasons ?? []
  const season = data?.season ?? null
  // The all-years floor on games in a split; 0 everywhere else.
  const minGames = resolveMinGames(routeMin, season)

  const index = useMemo(() => buildRankingIndex(data?.entries ?? [], { cutoff }), [data, cutoff])
  const clubs = useMemo(
    () => [...index.teams].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [index],
  )
  const clubAbbr = useMemo(
    () => new Map(index.teams.map((t) => [t.id, t.abbreviation ?? ''])),
    [index],
  )

  // A stale metric link still opens a useful board; a bare route stays bare.
  const resolvedId = routeMetric
    ? index.metrics.has(routeMetric)
      ? routeMetric
      : index.groups[0]?.metrics[0]?.id ?? null
    : null
  const result = useMemo(
    () => (resolvedId ? rankMetric(index, resolvedId, { sortBy, order, minPlayed: minGames }) : null),
    [index, resolvedId, sortBy, order, minGames],
  )
  const overviewGroups = useMemo(
    () => index.groups.map((group, groupIndex) => ({
      ...group,
      key: GROUP_KEYS[group.title] ?? group.title,
      order: groupIndex + 1,
      results: group.metrics.map((metric) => rankMetric(index, metric.id, { minPlayed: minGames })).filter(Boolean),
    })),
    [index, minGames],
  )
  const activeGroup = resolvedId
    ? overviewGroups.find((group) => group.metrics.some((item) => item.id === resolvedId))
    : null
  const activeCategory = routeCategory
    ? overviewGroups.find((group) => group.key === routeCategory) ?? null
    : null

  const teamId = useMemo(() => {
    const wanted = Number(routeTeam)
    if (clubs.some((t) => t.id === wanted)) return wanted
    if (clubs.some((t) => t.id === favoriteTeamId)) return favoriteTeamId
    return clubs[0]?.id ?? null
  }, [clubs, routeTeam, favoriteTeamId])
  const team = clubs.find((t) => t.id === teamId) ?? null
  const teamGroups = useMemo(
    () => (byTeam && teamId != null ? teamRankRows(index, teamId, { sortBy: 'pct', minPlayed: minGames }) : null),
    [index, byTeam, teamId, minGames],
  )

  useDocumentTitle(
    byTeam && team
      ? `${team.name} · Postseason Records`
      : result
        ? `${result.metric.k} · Postseason Records`
        : activeCategory
          ? `${activeCategory.title} · Postseason Records`
          : 'Postseason Records',
  )

  // Every address keeps the scope it was built in (season, view, club) unless
  // the caller names a new one, so a link never drops the reader's postseason.
  const pathFor = ({
    category: nextCategory = routeCategory,
    metric: nextMetric = resolvedId,
    season: nextSeason = routeSeason,
    view: nextView = routeView,
    team: nextTeam = teamId,
    min: nextMin = minGames,
    sort: nextSort = sortBy,
    order: nextOrder = order,
  } = {}) => postseasonRecordsPath({
    category: nextMetric ? null : nextCategory,
    metric: nextMetric,
    season: nextSeason,
    view: nextView,
    team: nextTeam,
    min: nextSeason === ALL_SEASONS ? nextMin : null,
    sort: nextMetric ? nextSort : null,
    order: nextMetric ? nextOrder : null,
    d: asOf,
  })
  const switchView = (view) => navigate(pathFor({ view, category: null, metric: null, sort: null, order: null }))

  const scopeLabel = season == null ? '' : seasonLabel(season)

  return (
    <div className="screen trrank-page">
      <SiteHeader />

      <header className="trrank__hero">
        <span className="trrank__note">{scopeLabel || 'MLB postseason'}</span>
        <h1>Postseason Records</h1>
        <p>{SCOPE_NOTE}</p>
        <a className="trrank__sibling" {...linkProps(situationalRecordsPath({ d: asOf }))}>
          Regular season records <span aria-hidden="true">›</span>
        </a>
      </header>

      <section className="trrank__scope" aria-label="Postseason record filters">
        <div className="trrank__scopehead">
          <span>Scope</span>
          <strong>{scopeLabel || '—'}</strong>
        </div>
        {seasons.length > 0 && (
          <label className="trrank__pick">
            <span>Season</span>
            <select
              className="trrank__select"
              value={season ?? ''}
              onChange={(e) => navigate(pathFor({ season: e.target.value }))}
            >
              <option value={ALL_SEASONS}>All postseasons</option>
              {[...seasons].reverse().map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
        )}
        {season === ALL_SEASONS && (
          <div className="trrank__chips" role="group" aria-label="Minimum games in a split">
            {MIN_GAMES.map((n) => (
              <button
                key={n}
                type="button"
                className={`trrank__chip${n === minGames ? ' is-on' : ''}`}
                aria-pressed={n === minGames}
                onClick={() => navigate(pathFor({ min: n }))}
              >
                {n === 0 ? 'Any games' : `${n}+ games`}
              </button>
            ))}
          </div>
        )}
        <div className="trrank__chips" role="group" aria-label="View">
          {[
            { key: null, label: 'By situation' },
            { key: 'teams', label: 'By team' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className={`trrank__chip${(item.key === 'teams') === byTeam ? ' is-on' : ''}`}
              aria-pressed={(item.key === 'teams') === byTeam}
              onClick={() => switchView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {byTeam && clubs.length > 0 && (
          <label className="trrank__pick">
            <span>Club</span>
            <select
              className="trrank__select"
              value={teamId ?? ''}
              onChange={(e) => navigate(pathFor({ team: e.target.value }))}
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>{club.name}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={index.groups.length > 0}
        errorMessage="Couldn’t load postseason records. Try again."
        emptyMessage="No postseason games on file for this span yet."
        emptyProse
      />

      {!loading && !error && byTeam && teamGroups && (
        <main className="trrank__detail">
          <section className="trrank__detailhead">
            <span className="trrank__detailgroup">{scopeLabel}</span>
            <h2>{team.name}</h2>
            <p>Record and rank among the postseason clubs that played each split.</p>
          </section>
          <TeamRecordsList
            groups={teamGroups}
            pathFor={(metric) => pathFor({ view: null, metric, team: null, sort: null, order: null })}
          />
        </main>
      )}

      {!loading && !error && !byTeam && index.groups.length > 0 && !result && (
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

      {!loading && !error && !byTeam && result && (
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
