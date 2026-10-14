import { Fragment, useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/history/moves.css'
import { dayBefore } from '../../../../../api/player/context.js'
import { transactionRowsFor } from '../../../../../api/player/history.js'
import { fetchTransactions } from '../../../../../api/person-fetch.js'
import { fetchRookieRecord } from '../../../../../api/rookies.js'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { isoToday } from '../../../../../lib/dates.js'
import { OPEN, movesView } from './movesView.js'

// Copied from TransactionTimeline.jsx: the other players in a trade, named in the league's text, linked to their pages.
function linkifyNames(text, links) {
  const named = (links ?? []).filter((p) => p?.id && p.fullName)
  if (!named.length) return text
  const escaped = named.map((p) => p.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const idByName = new Map(named.map((p) => [p.fullName, p.id]))
  return text.split(new RegExp(`(${escaped.join('|')})`, 'g')).map((part, i) =>
    idByName.has(part) ? <PlayerLink key={i} id={idByName.get(part)}>{part}</PlayerLink> : <Fragment key={i}>{part}</Fragment>,
  )
}

// The live History tab's read: transactionRowsFor (api/player/history.js).
async function load(bio, endDate) {
  const [txns, rookieInfo] = await Promise.all([fetchTransactions(bio.id, endDate), fetchRookieRecord(bio.id)])
  return transactionRowsFor(bio, txns, rookieInfo, endDate)
}

// Transactions (#2020): a dated ledger with year dividers. Open surface (ADR-0034): no seal, no gate.
// A two-way player gets one instance (the slot is `once`), so the role is not read.
export default function MovesModule({ bio, asOf, onEmpty, onCount }) {
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  const { data, loading } = useAsync(() => load(bio, endDate), [bio.id, endDate])
  const [all, setAll] = useState(false)
  const view = useMemo(() => movesView(data?.rows, endDate), [data, endDate])
  // A null fetch result settles the load, so an empty view ends it with onEmpty().
  const empty = !loading && !view
  useEffect(() => {
    if (empty) onEmpty()
    onCount(view?.count)
  }, [empty, view, onEmpty, onCount])
  if (loading) return <div className="moves moves--wait" aria-busy="true" />
  if (!view) return null
  const rows = all ? view.rows : view.rows.slice(0, OPEN)
  return (
    <div className="moves">
      <ol className="moves__list">
        {rows.map((r) => (
          <Fragment key={r.key}>
            {r.yearHead && (
              <li className="moves__yr" aria-hidden="true">
                <span>{r.yearHead.year}</span>
                <span>{r.yearHead.n}</span>
              </li>
            )}
            <li className={`moves__row moves__row--${r.injured ? 'il' : r.tone}`}>
              <time className="moves__date mono" dateTime={r.iso}>{r.date}</time>
              <span className="moves__chip">
                {r.mark && <b aria-hidden="true">{r.mark}</b>}
                {r.chip}
              </span>
              {r.club ? (
                <TeamLogo teamId={r.club.id} name={r.club.name} size={20} />
              ) : (
                <span className="moves__noclub" title="Club not listed" />
              )}
              <p className="moves__desc">{linkifyNames(r.description, r.links)}</p>
            </li>
          </Fragment>
        ))}
      </ol>
      {view.showAll && (
        <Door layout="block" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? view.showFewer : view.showAll}
        </Door>
      )}
    </div>
  )
}
