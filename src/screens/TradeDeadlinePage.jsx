import { loadTradeDeadlineIndex } from '../api/tradeDeadline.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { tradeDeadlineSeasonPath } from '../lib/route.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// The season index (/trade-deadline) — one tile per year linking to its own
// standalone page (/trade-deadline/{year}). Static, precomputed JSON (see
// scripts/gen-trade-deadline.mjs); a one-fetch manifest so this page doesn't
// need all six seasons' full trade lists just to show the tiles.
export function TradeDeadlinePage() {
  useDocumentTitle('Trade Deadline')
  const navigate = useNav()
  const { loading, error, data } = useAsync(() => loadTradeDeadlineIndex(), [])
  const years = data?.years ?? []

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Trade Deadline</h1>
        <p className="hint hint--prose">
          Every trade completed within about four weeks of each season’s trade deadline.
        </p>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={years.length > 0}
        errorMessage="Couldn’t load Trade Deadline seasons. Try again."
        emptyMessage="No seasons available yet."
        emptyProse
      />

      {years.length > 0 && (
        <div className="tradedl__seasongrid">
          {years.map((y) => (
            <button
              key={y.year}
              type="button"
              className="tradedl__seasontile"
              onClick={() => navigate(tradeDeadlineSeasonPath(y.year))}
            >
              <span className="tradedl__seasonyear">{y.year}</span>
              <span className="tradedl__seasondeadline">Deadline: {monthDay(y.deadlineDate)}</span>
              <span className="tradedl__seasoncount">
                {y.tradeCount} {y.tradeCount === 1 ? 'trade' : 'trades'}
              </span>
            </button>
          ))}
        </div>
      )}

      <ReportFooter />
    </div>
  )
}
