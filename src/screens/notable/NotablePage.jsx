import '../../styles/history/notable.css'
import { useMemo, useState } from 'react'
import { fetchNotable, KINDS } from '../../api/notable/notable.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useRouteLink } from '../../lib/nav.js'
import { humanDateWithYear, slateToday } from '../../lib/dates.js'
import { filterByClub, shelfRows } from '../../lib/notable/shelf.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
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
const ROLES = [
  { value: 'did', label: 'Did it' },
  { value: 'against', label: 'Done to them' },
  { value: 'either', label: 'Either' },
]

// The slot at the row's left, one face wide on every row so the text beside it starts at the same
// edge: the person the row is about (the first arm of a combined no-hitter, with a +N tag; every
// name is in the line beside it), or for a triple play, which names no one, the club that turned it.
function Face({ row }) {
  const [lead] = row.players
  const more = row.players.length - 1
  return (
    <span className="notable__face" aria-hidden="true">
      {lead ? (
        <Headshot personId={lead.id} name={lead.name} teamId={row.doerId} className="notable__shot" />
      ) : (
        <span className="notable__shot notable__crest">
          <TeamLogo teamId={row.doerId} name="" size={28} />
        </span>
      )}
      {more > 0 && <span className="notable__more">+{more}</span>}
    </span>
  )
}

// The club that did it carries the marker underline; a row with no known side marks neither.
function Side({ side, did }) {
  return (
    <Cluster as="span" gap="snug" align="center" className={`notable__side${did ? ' notable__side--did' : ''}`}>
      <TeamLogo teamId={side.id} name={side.name || side.abbr} size={18} />
      <span className="notable__club">{side.abbr || side.name || 'Club not on file'}</span>
      <span className="notable__runs">{side.runs ?? '–'}</span>
    </Cluster>
  )
}

function Row({ row, linkProps }) {
  const did = (side) => row.doerId != null && side.id === row.doerId
  const body = (
    <>
      <Face row={row} />
      <Stack gap="tight" className="notable__body">
        <span className="notable__when t-label">
          {humanDateWithYear(row.date)}
          {row.gameNumber > 1 && <span className="t-label t-label--bold"> Game {row.gameNumber}</span>}
        </span>
        <Cluster as="span" gap="base" rowGap="tight" className="notable__score">
          <Side side={row.away} did={did(row.away)} />
          <Side side={row.home} did={did(row.home)} />
        </Cluster>
        <span className="notable__feat">{row.feat}</span>
      </Stack>
      {row.href && (
        <span className="notable__go" aria-hidden="true">
          ›
        </span>
      )}
    </>
  )
  return (
    <li>
      {row.href ? (
        <a className="notable__row" aria-label={row.label} {...linkProps(row.href)}>
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
  const [clubId, setClubId] = useState(null)
  const [role, setRole] = useState('did')
  // The cutoff is the slate's day at render, so a page left open past midnight moves with it.
  const today = slateToday()
  const doc = data?.[kind] ?? null
  const all = useMemo(() => shelfRows(kind, doc, new Date()), [kind, doc, today])
  const rows = useMemo(() => filterByClub(all, clubId, role), [all, clubId, role])

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
        <TeamFilterStrip
          selectedTeamId={clubId}
          onSelect={(id) => {
            setClubId(id)
            setShown(PAGE)
          }}
          ariaLabel="Club"
        />
        {clubId != null && (
          <Segmented
            fill
            label="Club's part"
            value={role}
            onChange={(next) => {
              setRole(next)
              setShown(PAGE)
            }}
            options={ROLES}
          />
        )}
        <AsyncStatus
          loading={loading}
          error={error || (data && !doc)}
          hasData={Boolean(doc)}
          errorMessage="Couldn’t load Notable games. Try again."
          emptyMessage="Notable games are not available right now."
        />
        {doc && rows.length === 0 && (
          <p className="hint">{clubId != null ? 'None on file for this club.' : 'None on file.'}</p>
        )}
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
