import '../styles/66-team-record-rankings.css'
import { useMemo, useState } from 'react'
import { fetchLevelTeamRecords, buildRankingIndex, rankMetric, defaultOrder } from '../api/teamRecordRankings.js'
import { HALVES } from '../api/teamRecords.js'
import { seasonOf, cutoffFor } from './team/data/shared.js'
import { SPORT_LABEL } from '../lib/teams.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { LevelNav } from '../components/team/LevelNav.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'

// One situational record, every club at one level, in rank order — the Numbers
// tab's Records card read across the league instead of down one club. "The
// Brewers are 64-10 scoring four or more; where does that sit among the
// thirty?" is a question the card raises on every one of its fifty rows and
// cannot answer, so every row on it links here with that row preselected.
//
// The whole page is three choices — the split, the level, the half of the
// season — over one pivot (api/teamRecordRankings.js). It computes nothing
// itself.
//
// ORDER IS NOT ALWAYS HIGHEST-FIRST, and that is the point of the direction
// control. A win percentage always reads best at the top. A single-number
// count does not: most walk-off wins leads its column, FEWEST losses after
// leading leads its own, and days in third place have no good end at all. The
// catalog in teamRecords.js (COUNT_METRICS) says which is which; this page
// prints the framing that follows and lets the reader flip it either way.
//
// Spoiler-free on the same footing as the card it came from: a season
// aggregate over Final games, cut off at `?d=` exactly where the card cuts off.

const SORTS = [
  { key: 'pct', label: 'Win pct' },
  { key: 'played', label: 'How often' },
]

// The picker's whole menu, flattened into one <select> with a group per
// heading. A phone gets its native scroll wheel over sixty-odd splits, which
// beats a chip strip that would wrap to eight lines, and the group headings are
// the card's own — so a reader who tapped in from a row lands in a list
// organised the way the card they left was.
function MetricPicker({ groups, value, onChange }) {
  return (
    <label className="trrank__picker">
      <span className="trrank__pickerlabel">Record type</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g.title} label={g.title}>
            {g.metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.k}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

// Rank cell. A shared rank prints with the leaderboard's 'T'; a club that has
// never been in the split prints nothing rather than a number it did not earn.
function RankCell({ rank, tied }) {
  if (rank == null) return <span className="trrank__rank trrank__rank--none">—</span>
  return (
    <span className="trrank__rank">
      {tied ? 'T' : ''}
      {rank}
    </span>
  )
}

export function TeamRecordsPage({ asOf, sportId: routeSportId, metric: routeMetric, half: routeHalf }) {
  useDocumentTitle('Team Records')
  const [sportId, setSportId] = useState(routeSportId ?? 1)
  const [metricId, setMetricId] = useState(routeMetric ?? 'scored-4-plus')
  const [half, setHalf] = useState(HALVES.some((h) => h.key === routeHalf) ? routeHalf : 'all')
  const [sortBy, setSortBy] = useState('pct')
  // null means "whatever this metric's own good end is" — the flip button sets
  // an explicit direction, and picking a different metric clears it back to
  // null so the next column opens the right way round again.
  const [order, setOrder] = useState(null)
  const { favoriteTeamId } = useFavoriteTeam()

  const season = seasonOf(asOf)
  const cutoff = cutoffFor(asOf)
  const { loading, error, data } = useAsync(
    () => fetchLevelTeamRecords(sportId, season),
    [sportId, season],
  )

  // Rebuilt only when the level, the cutoff or the half changes — NOT when the
  // reader pages through splits, which is the common move and is then a pure
  // re-sort of an index already in hand.
  const index = useMemo(
    () => buildRankingIndex(data ?? [], { cutoff, half }),
    [data, cutoff, half],
  )
  // A split can be absent from a level (only MLB has the by-league rows) or
  // from a half (a club may not have been shut out since the break). Falling
  // back to the first split in the menu keeps a stale link or a level switch on
  // a page rather than on an empty table.
  const resolvedId = index.metrics.has(metricId)
    ? metricId
    : index.groups[0]?.metrics[0]?.id ?? null
  const result = useMemo(
    () => (resolvedId ? rankMetric(index, resolvedId, { sortBy, order }) : null),
    [index, resolvedId, sortBy, order],
  )

  const metric = result?.metric
  const isCount = metric?.kind === 'count'
  // The break only exists once a level's files carry its date — an early-season
  // file, or a level whose season has not reached it, leaves only 'all'
  // meaningful and the toggle hides, exactly as it does on the card.
  const showHalves = (data ?? []).some((e) => e.data?.allStarDate)
  const dir = result?.order ?? 'desc'
  const flipLabel = result?.byQuality
    ? dir === defaultOrder(metric)
      ? 'Best first'
      : 'Worst first'
    : dir === 'desc'
      ? 'Highest first'
      : 'Lowest first'

  const pickMetric = (id) => {
    setMetricId(id)
    setOrder(null)
  }

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Team Records</h1>
      </header>

      <p className="hint">
        Every club’s record in one situation at a time — {season} {SPORT_LABEL[sportId] ?? ''} — from
        the same ledger the Records card on a club’s Numbers tab reads. Pick a split, and the whole
        level sorts by it. Some columns read best from the top and some from the bottom; the arrow
        turns the list either way.
      </p>

      <LevelNav sportId={sportId} onChange={setSportId} />

      <div className="trrank__controls">
        <MetricPicker groups={index.groups} value={resolvedId ?? ''} onChange={pickMetric} />

        {showHalves && (
          <div className="trrank__chips" role="group" aria-label="Season half">
            {HALVES.map((h) => (
              <button
                key={h.key}
                type="button"
                className={`trrank__chip${h.key === half ? ' is-on' : ''}`}
                aria-pressed={h.key === half}
                onClick={() => setHalf(h.key)}
              >
                {h.label}
              </button>
            ))}
          </div>
        )}

        <div className="trrank__chips">
          {!isCount &&
            SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`trrank__chip${s.key === sortBy ? ' is-on' : ''}`}
                aria-pressed={s.key === sortBy}
                onClick={() => {
                  setSortBy(s.key)
                  setOrder(null)
                }}
              >
                {s.label}
              </button>
            ))}
          <button
            type="button"
            className="trrank__chip trrank__flip"
            onClick={() => setOrder(dir === 'desc' ? 'asc' : 'desc')}
          >
            {flipLabel} {dir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={Boolean(result)}
        errorMessage="Couldn’t load team records. Try again."
        emptyMessage="No team records on file for this level yet."
        emptyProse
      />

      {result && (
        <>
          <p className="trrank__caption">
            <strong>{metric.k}</strong> · {result.of} club{result.of === 1 ? '' : 's'} ranked
            {isCount ? '' : sortBy === 'played' ? ', by how often' : ', by win percentage'}
            {/* Said in words, not left to the arrow: on a count the good end is
                whichever one the catalog names, and a reader who lands on
                "Losses after leading" should not have to work out that the club
                at the top is the best rather than the worst. */}
            {isCount && result.byQuality
              ? ` · ${metric.better === 'low' ? 'fewest is best' : 'most is best'}`
              : ''}
            {half !== 'all' ? ` · ${HALVES.find((h) => h.key === half).label}` : ''}
          </p>
          <div className="ledger-wrap">
            <table className="standings trrank">
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
                        <TeamLogo teamId={row.teamId} name={row.team.name} size={18} />
                        {row.team.name}
                      </TeamLink>
                    </td>
                    {isCount ? (
                      <td className="trrank__num">{row.value ?? '—'}</td>
                    ) : (
                      <>
                        <td className="trrank__num">{row.v}</td>
                        <td className="trrank__num">{row.pct}</td>
                        <td className="trrank__num">{row.played || '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
