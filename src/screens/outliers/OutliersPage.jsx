import '../../styles/outliers/outliers.css'
import { useMemo, useState } from 'react'
import { cutoffSpan, flagsAsOf, groupFlags, loadOutliersFile } from '../../api/hotcold/outliers.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { humanDate, slateToday } from '../../lib/dates.js'
import { useNav } from '../../lib/nav.js'
import { LinkScope } from '../../lib/nav.jsx'
import { outliersPath } from '../../lib/route.js'
import { OutlierGroup } from './OutlierGroup.jsx'
import { daysBetween, typeCounts } from './outliersView.js'

const ROLES = [
  { role: 'hitting', title: 'Hitters' },
  { role: 'pitching', title: 'Pitchers' },
]

// League-wide "Standing out" (#2453): every MLB player the hot and cold rule flags, as of
// a date. The slider is the page's ?d= cutoff: a cutoff counts only games dated BEFORE it,
// the same as the player page's card. With no ?d= it rests on the latest night, and never
// past today, so a game in progress is never counted.
//
// An open surface (ADR-0034): no seal, no gate. The cutoff is the only guard.
//
// THE POOL. A line is placed among the pooled seasons of tails.json, and the pool holds the
// season shown. The player page does the same, so an open row and its page always agree;
// leaving the season out here would make a row flag that the page then denies. The page
// says so under the list.
export function OutliersPage({ asOf = null }) {
  useDocumentTitle('Standing out')
  const navigate = useNav()
  const today = slateToday()
  const season = Number((asOf || today).slice(0, 4))
  const { data: file, loading, error } = useAsync(() => loadOutliersFile(season), [season])
  const [open, setOpen] = useState(null) // { cutoff, id }: a date change closes the row
  const [all, setAll] = useState({}) // group id -> show every row

  const span = file ? cutoffSpan(file, today) : null
  const days = useMemo(() => (span ? daysBetween(span.min, span.max) : []), [span?.min, span?.max])
  const cutoff = span ? (asOf && asOf >= span.min ? (asOf > span.max ? span.max : asOf) : span.max) : null
  const groups = useMemo(() => (file ? groupFlags(flagsAsOf(file, cutoff)) : null), [file, cutoff])
  const openId = open?.cutoff === cutoff ? open.id : null

  const go = (d) => navigate(outliersPath({ d: d === span.max && !asOf ? null : d }), { replace: true })
  const index = Math.max(0, days.indexOf(cutoff))
  const counts = groups ? ROLES.flatMap((r) => typeCounts(groups[r.role])) : []
  const players = counts.reduce((n, c) => n + c.count, 0)

  return (
    <LinkScope asOf={asOf}>
      <div className="screen outl">
        <SiteHeader />
        <header className="topbar">
          <h1 className="topbar__title">Standing out</h1>
        </header>
        <AsyncStatus
          loading={loading}
          error={error}
          hasData={file != null}
          errorMessage="Couldn’t load the callouts. Try again."
        />
        {!file && !loading && !error && (
          <EmptyState note="The file appears after the first game night of the season.">
            {`No callouts for ${season} yet.`}
          </EmptyState>
        )}
        {file && (
          <>
            <div className="outl__slider">
              <p className="outl__asof">
                <span>As of</span> <strong>{humanDate(cutoff)}</strong>
              </p>
              <input
                type="range"
                className="outl__range"
                min={0}
                max={Math.max(0, days.length - 1)}
                step={1}
                value={index}
                onChange={(e) => go(days[Number(e.target.value)])}
                aria-label="Date"
                aria-valuetext={humanDate(cutoff)}
              />
              <div className="outl__ends" aria-hidden="true">
                <span>{humanDate(span.min)}</span>
                <span>{humanDate(span.max)}</span>
              </div>
              {cutoff !== span.max && (
                <Button size="control" onClick={() => go(span.max)}>Latest night</Button>
              )}
              <p className="outl__note">Counts games dated before this day.</p>
            </div>

            {players === 0 ? (
              <EmptyState>No player stands out on this date.</EmptyState>
            ) : (
              <>
                <div className="outl__summary">
                  <p className="outl__note">{`${counts.length} callout types, ${players} flags:`}</p>
                  {ROLES.map(({ role, title }) => groups[role].length > 0 && (
                    <p key={role} className="outl__types">
                      <strong>{title}</strong>
                      {typeCounts(groups[role]).map((c) => (
                        <span key={c.id} className="outl__type">{`${c.short} ${c.count}`}</span>
                      ))}
                    </p>
                  ))}
                </div>
                {ROLES.map(({ role, title }) => groups[role].length > 0 && (
                  <section key={role} className="outl__role" aria-label={title}>
                    <h2 className="outl__role-title">{title}</h2>
                    {groups[role].map((g) => (
                      <OutlierGroup
                        key={g.id}
                        group={g}
                        openId={openId}
                        onOpen={(id) => setOpen(id == null ? null : { cutoff, id })}
                        all={Boolean(all[g.id])}
                        onAll={() => setAll({ ...all, [g.id]: true })}
                        cutoff={cutoff}
                        season={season}
                        asOf={asOf}
                      />
                    ))}
                  </section>
                ))}
                <p className="outl__note">
                  Each line is placed among the same pooled past seasons as the player page, this
                  season included. A row and its player page agree.
                </p>
              </>
            )}
          </>
        )}
        <ReportFooter />
      </div>
    </LinkScope>
  )
}
