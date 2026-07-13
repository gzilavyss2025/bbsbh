import { loadAwardsHistory } from '../api/awardsHistory.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SectionTitle } from '../components/SectionTitle.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { teamClubNameShort } from '../lib/teams.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// A year's recipients, grouped AL first, then NL, then MLB-wide (no league —
// Roberto Clemente, All-MLB First/Second Team) — a fixed order so a season's
// row always reads the same way regardless of what order the source recipients
// arrived in.
const LEAGUE_ORDER = ['AL', 'NL', null]
function groupByLeague(recipients) {
  return LEAGUE_ORDER.map((league) => ({
    league,
    recipients: recipients.filter((r) => r.league === league),
  })).filter((g) => g.recipients.length > 0)
}

function AwardYear({ year, recipients }) {
  const groups = groupByLeague(recipients)
  return (
    <div className="awardhistory__year">
      <span className="awardhistory__yearnum">{year}</span>
      <div className="awardhistory__leagues">
        {groups.map((g) => (
          <div className="awardhistory__league" key={g.league ?? 'mlb'}>
            {g.league && <span className="awardhistory__leaguetag">{g.league}</span>}
            <div className="awardhistory__recipients">
              {g.recipients.map((r) => (
                <span className="awardhistory__recipient" key={`${r.playerId}-${r.position}`}>
                  {r.teamId ? (
                    <TeamLink id={r.teamId} className="awardhistory__teamlink">
                      <TeamLogo teamId={r.teamId} name={r.teamName} size={16} />
                    </TeamLink>
                  ) : (
                    <TeamLogo teamId={r.teamId} name={r.teamName} size={16} />
                  )}
                  <PlayerLink id={r.playerId} className="awardhistory__name">
                    {r.name}
                  </PlayerLink>
                  <span className="awardhistory__team">
                    {r.teamId ? teamClubNameShort(r.teamId) : r.teamName}
                  </span>
                  {g.recipients.length > 1 && r.position && (
                    <em className="awardhistory__pos">{r.position}</em>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// League-wide Awards History: who won each major MLB award (the same hardware
// set the player page's Trophy Case counts, MAJOR_AWARDS in api/person.js) over
// the last several seasons — the standalone counterpart to that per-player
// card ("what has THIS player won" vs. "who won THIS award"). Grouped by
// award, then by season descending, since that's how a fan actually looks
// this up ("who's won the MVP lately") rather than season-first. Data comes
// from scripts/gen-awards-history.mjs, a hand-run precompute (a season's
// winners are decided once and never change, same footing as
// war-history.json/milb-history.json) — no SealBox needed, same as Milestone
// Watch/League Leaders/WAR: a past season's award roll carries no individual
// game's score.
export function AwardsHistoryPage() {
  useDocumentTitle('Awards History')
  const { loading, error, data } = useAsync(() => loadAwardsHistory(), [])
  const families = data?.families ?? []
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Awards History</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={families.length > 0}
        errorMessage="Couldn’t load Awards History. Try again."
        emptyMessage="No award history is available right now."
        emptyProse
      />

      {families.length > 0 && (
        <>
          <div className="awardhistory__list">
            {families.map((family) => {
              const years = Object.keys(family.years)
                .map(Number)
                .sort((a, b) => b - a)
              return (
                <section className="awardhistory__award" key={family.key}>
                  <SectionTitle title={family.label} />
                  <div className="awardhistory__years">
                    {years.map((year) => (
                      <AwardYear key={year} year={year} recipients={family.years[year]} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
          {updated && <p className="hint prospects__caption">Updated {updated}.</p>}
        </>
      )}
    </div>
  )
}
