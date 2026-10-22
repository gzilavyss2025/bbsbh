import '../../styles/history/notable.css'
import { useMemo, useState } from 'react'
import { fetchNotable, KINDS } from '../../api/notable/notable.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useRouteLink } from '../../lib/nav.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { shelfRows } from '../../lib/notable/shelf.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// NOTABLE GAMES (/notable, #2508): a shelf of no-hitters, cycles and triple plays, one tab
// each, newest first. An open results page behind a labelled door (ADR-0081): each row
// prints its final score, and opens the game's box score, which seals or opens by the game's
// date as any box score does (ADR-0117). lib/notable/shelf.js leaves off any game that is not
// yet a past day, so no row names a score its box score is still holding.
// Decisions D4, D5, D6, D12: .scratch/old-games/decisions.md.
const TABS = {
  nohitters: 'No-hitters',
  cycles: 'Cycles',
  tripleplays: 'Triple plays',
}
const PAGE = 25

function Side({ side }) {
  return (
    <Cluster as="span" gap="snug" align="center" className="notable__side">
      <TeamLogo teamId={side.id} name={side.name || side.abbr} size={18} />
      <span className="notable__club">{side.abbr || side.name || 'Club not on file'}</span>
      <span className="notable__runs">{side.runs ?? '–'}</span>
    </Cluster>
  )
}

function Row({ row, linkProps }) {
  const body = (
    <Stack gap="tight">
      <span className="notable__when t-label">
        {humanDateWithYear(row.date)}
        {row.gameNumber > 1 && <span className="t-label t-label--bold"> Game {row.gameNumber}</span>}
      </span>
      <Cluster as="span" gap="base" rowGap="tight" className="notable__score">
        <Side side={row.away} />
        <Side side={row.home} />
      </Cluster>
      <span className="notable__feat">{row.feat}</span>
    </Stack>
  )
  return (
    <li>
      {row.href ? (
        <a className="notable__row" {...linkProps(row.href)}>
          {body}
        </a>
      ) : (
        <div className="notable__row">{body}</div>
      )}
    </li>
  )
}

export function NotablePage() {
  useDocumentTitle('Notable games')
  const linkProps = useRouteLink()
  const { loading, error, data } = useAsync(() => fetchNotable(), [])
  const [kind, setKind] = useState(KINDS[0])
  const [shown, setShown] = useState(PAGE)
  const rows = useMemo(() => shelfRows(kind, data?.[kind]), [kind, data])
  const loaded = data && KINDS.some((k) => data[k])

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Notable games</h1>
      </header>
      <Stack gap="base">
        <p className="hint">
          Lists AL and NL games, 1901 on.
        </p>
        <Segmented
          fill
          label="Kind of game"
          value={kind}
          onChange={(next) => {
            setKind(next)
            setShown(PAGE)
          }}
          options={KINDS.map((k) => ({ value: k, label: TABS[k] }))}
        />
        <AsyncStatus
          loading={loading}
          error={error}
          hasData={Boolean(loaded)}
          errorMessage="Couldn’t load Notable games. Try again."
          emptyMessage="Notable games are not available right now."
        />
        {loaded && rows.length === 0 && <p className="hint">None on file.</p>}
        {rows.length > 0 && (
          <ol className="notable__list">
            {rows.slice(0, shown).map((row) => (
              <Row key={row.key} row={row} linkProps={linkProps} />
            ))}
          </ol>
        )}
        {rows.length > shown && (
          <Door layout="block" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, rows.length - shown)} more
          </Door>
        )}
      </Stack>
      <ReportFooter />
    </div>
  )
}
