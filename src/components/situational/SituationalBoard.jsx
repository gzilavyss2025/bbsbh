import { shortDate } from '../../api/teamRecords.js'
import { bestOrder } from '../../api/situationalRecordRankings.js'
import { useNav, useRouteLink } from '../../lib/nav.js'
import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Stack } from '../ui/layout/Stack.jsx'
import { Table } from '../ui/table/Table.jsx'
import { MetricFigure } from './SituationalIndex.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'

// The focused board for ONE split, every club ranked: the podium, the sort
// controls, the "more in this group" links and the table. Shared by the
// regular-season and postseason situational-record pages, which differ only in
// the ranking they hand in and the `pathFor` that spells their addresses.

const SORTS = [
  { key: 'pct', label: 'Win pct' },
  { key: 'played', label: 'How often' },
]

function RankCell({ rank, tied }) {
  if (rank == null) return <span className="trrank__rank trrank__rank--none">—</span>
  return (
    <span className="trrank__rank">
      {tied ? 'T' : ''}
      {rank}
    </span>
  )
}

function LeadersSpotlight({ rows, metric }) {
  return (
    <div className="trrank__podium" aria-label="Top three clubs">
      {rows.map((row) => (
        <Card as="div" body="flush" className="trrank__podiumcard" key={row.teamId}>
          <span className="trrank__podiumrank">{row.tied ? 'T' : ''}{row.rank}</span>
          <TeamLogo teamId={row.teamId} name={row.team.name} size={42} />
          <TeamLink id={row.teamId} tab="numbers" className="trrank__podiumteam">
            {row.team.teamName ?? row.team.name}
          </TeamLink>
          <span className="trrank__podiumfigure">
            <MetricFigure row={row} metric={metric} compact />
          </span>
        </Card>
      ))}
    </div>
  )
}

// `result` is rankMetric's answer, `group` the split's group
// ({ title, key, metrics }) or null, `clubAbbr` a Map(teamId -> abbreviation)
// for the "last time" column, and `pathFor` spells an address from
// { category, metric, sort, order }. `renderRecord(row, metric)` optionally
// dresses the W-L cell (the postseason page makes it a door to the games
// behind it); without it the cell is the plain figure.
export function SituationalBoard({ result, group, pathFor, favoriteTeamId, clubAbbr, sortBy, renderRecord }) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const metric = result.metric
  const isCount = metric.kind === 'count'
  const leaders = result.ranked.filter((row) => row.rank != null).slice(0, 3)
  // "When was the last time?" — carried only by the splits that answer a date
  // as well as a rate (the by-inning scoring rows), so the column appears only
  // on those boards rather than as a permanent empty fifth column. The
  // opponent is a team id in the ledger, resolved against the club list; a club
  // from outside that list degrades to the date alone.
  const hasLast = result.ranked.some((row) => row.last)
  const dir = result.order ?? 'desc'
  const flipLabel = result.byQuality
    ? dir === bestOrder(metric)
      ? 'Best first'
      : 'Worst first'
    : dir === 'desc'
      ? 'Highest first'
      : 'Lowest first'

  return (
    <Stack as="main" gap="loose" className="trrank__detail">
      <a
        className="trrank__back"
        {...linkProps(pathFor({
          category: group?.key ?? null,
          metric: null,
          sort: null,
          order: null,
        }))}
      >
        <span aria-hidden="true">‹</span> {group?.title ?? 'All situational records'}
      </a>

      <section className="trrank__detailhead">
        <span className="trrank__detailgroup">{group?.title ?? 'Situational records'}</span>
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
        <Cluster gap="tight" className="trrank__chips">
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
        </Cluster>
      </section>

      {group && group.metrics.length > 1 && (
        <nav className="trrank__related" aria-label={`More ${group.title} records`}>
          <span>More in {group.title}</span>
          <div>
            {group.metrics.map((item) => (
              <Pill
                key={item.id}
                role="control"
                aria-current={item.id === metric.id ? 'page' : undefined}
                {...linkProps(pathFor({ metric: item.id, sort: null, order: null }))}
              >
                {item.k}
              </Pill>
            ))}
          </div>
        </nav>
      )}

      <div className="trrank__tablewrap">
        <Table label={`${metric.k} team rankings`} className="trrank">
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
                  {hasLast && <th>Last</th>}
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
                    <td className="trrank__num">{renderRecord ? renderRecord(row, metric) : row.v}</td>
                    <td className="trrank__num trrank__pct">{row.pct}</td>
                    <td className="trrank__num">{row.played || '—'}</td>
                    {hasLast && (
                      <td className="trrank__num trrank__last">
                        {row.last ? (
                          <>
                            <span>{shortDate(row.last.date)}</span>
                            {clubAbbr.get(row.last.opp) && (
                              <span className="trrank__lastopp">
                                {row.last.result} vs {clubAbbr.get(row.last.opp)}
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Stack>
  )
}
