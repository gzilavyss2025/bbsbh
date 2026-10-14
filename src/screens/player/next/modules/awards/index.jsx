import { useEffect, useMemo, useState } from 'react'
import { parseAwardCap, parseAwardOrder } from '../../../../../api/person/awards.js'
import { dayBefore } from '../../../../../api/player/context.js'
import { awardLedgerFor } from '../../../../../api/player/history.js'
import { fetchPlayerAwards } from '../../../../../api/person-fetch.js'
import { useCopy } from '../../../../../copy/copyContext.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { useMediaQuery, WIDE_QUERY } from '../../../../../hooks/useMediaQuery.js'
import { isoToday } from '../../../../../lib/dates.js'
import { teamAbbr, teamFullName, teamLogoUrl } from '../../../../../lib/teams.js'
import { awardsModView } from './awardsModView.js'
import '../../../../../styles/player-next/history/awards.css'

// The Awards slot (#2018, the contract is in ../../CLAUDE.md): one ledger row per award. The
// ledger is awardLedgerFor's, the same one the old tbd card drew. Open surface (ADR-0034).
// A two-way player gets one instance (the slot is `once`), so it renders for whatever role it gets.
const endDateOf = (asOf) => (asOf ? dayBefore(asOf) : isoToday())

export default function AwardsModule({ bio, asOf, onEmpty, onCount }) {
  const { t } = useCopy()
  const wide = useMediaQuery(WIDE_QUERY)
  const [open, setOpen] = useState(false)
  const { data, loading: busy } = useAsync(
    async () => ({ id: bio.id, ledger: await awardLedgerFor(await fetchPlayerAwards(bio.id), endDateOf(asOf)) }),
    [bio.id, asOf],
  )
  // useAsync keeps the last player's data for one render after the id changes.
  const loading = busy || Boolean(data && data.id !== bio.id)
  const view = useMemo(() => {
    if (loading || !data) return null
    const order = parseAwardOrder(t('awards.order'))
    const desktopCap = parseAwardCap(t('awards.capDesktop'), 6)
    const phoneCap = Math.min(parseAwardCap(t('awards.capPhone'), 3), desktopCap)
    return awardsModView(data.ledger, { order, cap: wide ? desktopCap : phoneCap })
  }, [data, loading, wide, t])
  useEffect(() => {
    if (!loading && !view) onEmpty()
    onCount(view?.tabled.length ? view.tag : undefined)
  }, [loading, view, onEmpty, onCount])

  if (!view) return loading ? <div className="awmod awmod--wait" aria-busy="true" /> : null
  return (
    <div className="awmod">
      {view.tabled.map((c) => (
        <section className="awmod__award" key={c.key}>
          <h4 className="awmod__head">
            <span className="awmod__name">{c.label}</span>
            <span className="awmod__count">×{c.count}</span>
            <span className={`awmod__tier tier-${c.tier}`}>{c.tierWord}</span>
          </h4>
          <ul className="awmod__rows">
            {c.rows.map((r) => (
              <li className="awmod__row" key={r.key}>
                <span className="awmod__when">{r.when}</span>
                <Club row={r} />
                <Org orgId={r.orgId} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {view.rest.length > 0 && (
        <>
          {open && (
            <ul className="awmod__rest">
              {view.rest.map((c) => (
                <li className="awmod__resti" key={c.key}>
                  <span>{c.label}</span>
                  <span className="awmod__count">×{c.count}</span>
                  <span className={`awmod__tier tier-${c.tier}`}>{c.tierWord}</span>
                  <span className="awmod__restw">{c.whens}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="awmod__door" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Show fewer' : view.doorOpen}
          </button>
        </>
      )}
    </div>
  )
}

// The club's own name where teams.js knows it (the feed abbreviates), else the feed's. No club is a dash.
function Club({ row }) {
  const name = (row.teamId && teamFullName(row.teamId)) || row.teamName
  if (!name) return <span className="awmod__none">—</span>
  return (
    <span className="awmod__club">
      {row.teamId && <img className="awmod__mark" src={teamLogoUrl(row.teamId)} alt="" loading="lazy" />}
      <span>{name}</span>
    </span>
  )
}

function Org({ orgId }) {
  const abbr = orgId ? teamAbbr({ id: orgId }) : ''
  return abbr ? <span className="awmod__org">{abbr}</span> : <span className="awmod__org awmod__none">—</span>
}
