import { loadMilestoneWatch, formatMilestoneProjection } from '../api/milestones.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { Ledger } from '../components/Ledger.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// League-wide Milestone Watch: every active-roster player within reach of a
// round career-total milestone, rarest club first — the standalone
// counterpart to the player page's Milestone Watch card, sibling in spirit to
// the Rehab Assignments page (same "one small precomputed static file,
// same-origin read" shape; see api/milestones.js). Sorting rarest-first
// (`rarity` — the nightly generator's approximate historical-membership rank)
// is the whole point of the page: a 500-save chase (a handful of pitchers
// ever) reads as the headline, not just another row alongside a much more
// common 1,000-hit chase. No SealBox here — counting-stat totals and
// projections carry no individual game's score, same footing as the
// (ungated) League Leaders and WAR pages.
export function MilestoneWatchPage() {
  useDocumentTitle('Milestone Watch')
  const { loading, error, data } = useAsync(() => loadMilestoneWatch(), [])
  const rows = data?.players ?? []
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Milestone Watch</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load Milestone Watch. Try again."
        emptyMessage="No one is within range of a career milestone right now."
        emptyProse
      />

      {rows.length > 0 && (
        <>
          <Ledger
            leftCols={2}
            head={['Player', 'Team', 'Milestone', 'Progress', 'Projected']}
            rows={rows.map((p) => ({
              key: `${p.playerId}-${p.stat}-${p.threshold}`,
              cells: [
                <span className="milestonewatch-row__player" key="p">
                  <Headshot personId={p.playerId} name={p.playerName} teamId={p.teamId} className="milestonewatch-row__shot" />
                  <PlayerLink id={p.playerId}>{p.playerName}</PlayerLink>
                </span>,
                <TeamLink id={p.teamId} key="t">
                  <TeamLogo teamId={p.teamId} name={p.teamName} size={20} />
                </TeamLink>,
                `${p.threshold.toLocaleString('en-US')} ${p.label}`,
                `${p.value.toLocaleString('en-US')} · ${p.remaining} to go`,
                formatMilestoneProjection(p.projection) || '—',
              ],
            }))}
          />
          <p className="hint prospects__caption">
            {rows.length} milestone{rows.length === 1 ? '' : 's'} in range
            {updated && ` · updated ${updated}`}.
          </p>
        </>
      )}
    </div>
  )
}
