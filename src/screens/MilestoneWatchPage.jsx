import { loadMilestoneWatch, formatMilestoneProjection } from '../api/milestones.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { MasonryColumns } from '../components/MasonryColumns.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// Rows arrive one per (player, milestone) pair, already sorted rarest-club-
// first then nearest-first (see gen-milestones.mjs). A player chasing more
// than one milestone at once (e.g. both 3,000 hits and 500 doubles) would
// otherwise get one row per chase, fighting for grid space with everyone
// else — folded here into ONE card per player instead, its milestones nested
// as a stack inside, in the order they already arrived (so a group's own
// position — and the order of its milestones — stays rarity/nearest-ranked
// with no re-sort).
function groupMilestoneRows(rows) {
  const groups = []
  const byId = new Map()
  for (const row of rows) {
    let group = byId.get(row.playerId)
    if (!group) {
      group = { playerId: row.playerId, playerName: row.playerName, teamId: row.teamId, teamName: row.teamName, position: row.position, milestones: [] }
      byId.set(row.playerId, group)
      groups.push(group)
    }
    group.milestones.push(row)
  }
  return groups
}

// League-wide Milestone Watch: every debuted player in an MLB org (active, on
// the IL, or in the minors) within reach of a
// round career-total milestone, rarest club first — the standalone
// counterpart to the player page's Milestone Watch card, sibling in spirit to
// the Rehab Assignments page (same "one small precomputed static file,
// same-origin read" shape; see api/milestones.js). Sorting rarest-first
// (`rarity` — the nightly generator's approximate historical-membership rank)
// is the whole point of the page: a 500-save chase (a handful of pitchers
// ever) reads as the headline, not just another row alongside a much more
// common 1,000-hit chase. Rendered as a card per player (see
// groupMilestoneRows) in a CSS-columns waterfall, same shape as the box
// score's grouped Insights cards, since a card's height varies with how many
// milestones that player is chasing at once. No SealBox here — counting-stat
// totals and projections carry no individual game's score, same footing as
// the (ungated) League Leaders and WAR pages.
export function MilestoneWatchPage() {
  useDocumentTitle('Milestone Watch')
  const { loading, error, data } = useAsync(() => loadMilestoneWatch(), [])
  const rows = data?.players ?? []
  const groups = groupMilestoneRows(rows)
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
          <MasonryColumns
            items={groups}
            columnWidth={288}
            gap={12}
            className="milestonewatch-page__grid"
            columnClassName="milestonewatch-page__col"
          >
            {(g) => (
              <article className="milestonewatch-page__card" key={g.playerId}>
                <span className="milestonewatch-page__mug">
                  <Headshot personId={g.playerId} name={g.playerName} teamId={g.teamId} className="milestonewatch-page__shot" />
                  {g.position && <span className="milestonewatch-page__pos">{g.position}</span>}
                </span>
                <div className="milestonewatch-page__body">
                  <span className="milestonewatch-page__who">
                    <PlayerLink id={g.playerId}>{g.playerName}</PlayerLink>
                    <TeamLink id={g.teamId} className="milestonewatch-page__team">
                      <TeamLogo teamId={g.teamId} name={g.teamName} size={16} />
                      {g.teamName}
                    </TeamLink>
                  </span>
                  {g.milestones.map((m) => {
                    const eta = formatMilestoneProjection(m.projection)
                    return (
                      <div className="milestonewatch-page__row" key={`${m.stat}-${m.threshold}`}>
                        <span className="milestonewatch-page__stat">{m.threshold.toLocaleString('en-US')} {m.label}</span>
                        <span className="milestonewatch-page__progress">{m.value.toLocaleString('en-US')} · {m.remaining} to go</span>
                        {eta && <span className="milestonewatch-page__eta">{eta}</span>}
                      </div>
                    )
                  })}
                </div>
              </article>
            )}
          </MasonryColumns>
          <p className="hint prospects__caption">
            {rows.length} milestone{rows.length === 1 ? '' : 's'} in range across {groups.length} player{groups.length === 1 ? '' : 's'}
            {updated && ` · updated ${updated}`}.
          </p>
        </>
      )}
    </div>
  )
}
