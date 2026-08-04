import { useState } from 'react'
import { loadTradeDeadlineSeason, SEASONS } from '../api/tradeDeadline.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { tradeDeadlinePath, tradeDeadlineSeasonPath } from '../lib/route.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'
import { TeamFilterStrip } from '../components/TeamFilterStrip.jsx'
import { TradeCard } from '../components/TradeCard.jsx'

// Newest year first, matching the season index page's own tile order.
const SEASON_YEARS = [...SEASONS].map((s) => s.year).sort((a, b) => b - a)

// The season switcher below the "TRADE DEADLINE" title — same `.levelnav`
// pill-row look/deep-link idiom as LeadersPage's own ScopeNav.
function SeasonNav({ year, navigate }) {
  return (
    <div className="levelnav tradedl__seasonnav" aria-label="Trade deadline season">
      {SEASON_YEARS.map((y) => (
        <button
          key={y}
          type="button"
          aria-pressed={year === y}
          className={`levelnav__btn ${year === y ? 'is-active' : ''}`}
          onClick={() => navigate(tradeDeadlineSeasonPath(y))}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthDayYear(iso) {
  const [y, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}

// Unlike lib/teamFilter.js's filterByTeam (one team id per row), a trade
// touches two or more clubs at once — kept whenever the selected club is
// ANY side of the deal, not matched against a single field.
function filterByEitherTeam(trades, teamId) {
  if (teamId == null) return trades
  return trades.filter((trade) => trade.teams.some((side) => side.teamId === teamId))
}

// Groups the season's already newest-first trades array into consecutive
// same-date runs, for the sticky date rail (the changelog/activity-feed
// pattern from the non-sports UX research — a persistent date header beats
// re-reading a date on every card while scrolling a season's worth of
// deadline activity).
function groupByDate(trades) {
  const groups = []
  for (const trade of trades ?? []) {
    const last = groups[groups.length - 1]
    if (last && last.date === trade.date) {
      last.trades.push(trade)
    } else {
      groups.push({ date: trade.date, trades: [trade] })
    }
  }
  return groups
}

// One season's worth of completed trade-deadline-window trades
// (/trade-deadline/{year}), grouped by date. Static, precomputed JSON (see
// scripts/gen-trade-deadline.mjs) — a season-culminating historical report,
// same footing as Awards History/Postseason History, so no SealBox: a
// completed trade carries no score (src/api/tradeDeadline.js's module header).
export function TradeDeadlineSeasonPage({ season }) {
  const year = Number(season)
  useDocumentTitle(`Trade Deadline ${year}`)
  const navigate = useNav()
  const { loading, error, data } = useAsync(() => loadTradeDeadlineSeason(year), [year])
  const [filterTeamId, setFilterTeamId] = useState(null)
  const allTrades = data?.trades ?? []
  const trades = filterByEitherTeam(allTrades, filterTeamId)
  const groups = groupByDate(trades)

  return (
    <div className="screen">
      <SiteHeader />
      <BackBtn onClick={() => navigate(tradeDeadlinePath())} />
      <header className="topbar">
        <h1 className="topbar__title">Trade Deadline</h1>
      </header>
      <SeasonNav year={year} navigate={navigate} />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={allTrades.length > 0}
        errorMessage="Couldn’t load this season’s trades. Try again."
        emptyMessage="No trades within the deadline window for this season."
        emptyProse
      />

      {allTrades.length > 0 && (
        <>
          <p className="tradedl__filterlabel">Filter by team</p>
          <TeamFilterStrip
            selectedTeamId={filterTeamId}
            onSelect={setFilterTeamId}
            ariaLabel="Filter trades by team"
          />
        </>
      )}

      {allTrades.length > 0 && trades.length === 0 && (
        <p className="hint hint--prose">That club made no trades within this season’s deadline window.</p>
      )}

      {trades.length > 0 && (
        <div className="tradedl__list">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="tradedl__daterail">{monthDayYear(group.date)}</h2>
              <div className="tradedl__list">
                {group.trades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ReportFooter />
    </div>
  )
}
