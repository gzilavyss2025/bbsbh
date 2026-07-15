import { useMemo, useState } from 'react'
import { loadAwardsHistory } from '../api/awardsHistory.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { Headshot } from '../components/Headshot.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SectionTitle } from '../components/SectionTitle.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { teamClubNameShort, favoriteAccentColor } from '../lib/teams.js'

// The two All-MLB families arrive from the generator as ordinary award
// families (see gen-awards-history.mjs / MAJOR_AWARDS), but the page treats
// them as one combined "All-MLB Teams" section — First/Second Team stacked
// side by side rather than as two separate award rows.
const ALL_MLB_FIRST_KEY = 'All-MLB First Team'
const ALL_MLB_SECOND_KEY = 'All-MLB Second Team'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// A year's recipients, grouped AL first, then NL, then MLB-wide (no league —
// Roberto Clemente) — a fixed order so a season's row always reads the same
// way regardless of what order the source recipients arrived in.
const LEAGUE_ORDER = ['AL', 'NL', null]
function groupByLeague(recipients) {
  return LEAGUE_ORDER.map((league) => ({
    league,
    recipients: recipients.filter((r) => r.league === league),
  })).filter((g) => g.recipients.length > 0)
}

// Reshapes the award-first families into year-first sections for the "By
// Year" toggle — same underlying data, grouped the other way. Awards within a
// year keep the families' own canonical order (MVP, Cy Young, ROY, Silver
// Slugger, ...) since that's the order they're encountered walking `families`.
function groupFamiliesByYear(families) {
  const byYear = new Map()
  for (const family of families) {
    for (const [yearStr, recipients] of Object.entries(family.years)) {
      const year = Number(yearStr)
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year).push({ key: family.key, label: family.label, recipients })
    }
  }
  return Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, awards]) => ({ year, awards }))
}

// Union of the years either All-MLB team has a roster for, newest first —
// the two families aren't guaranteed to cover the exact same season range.
function unionYears(firstYears, secondYears) {
  const years = new Set([
    ...Object.keys(firstYears ?? {}),
    ...Object.keys(secondYears ?? {}),
  ].map(Number))
  return Array.from(years).sort((a, b) => b - a)
}

// One recipient — the app's own "baseball card" idiom (headshot + position
// badge floated on its bottom-left corner, name, team, optional stat line),
// same pattern as Top Performers/Day Highlights (see PastDayRecapBox.jsx's
// PerformerCard + .playercard in index.css). A recipient who plays for the
// user's favoriteTeamId gets the same --fav-accent highlight the rest of the
// app's rosters/leaderboards use.
function AwardCard({ r, favoriteTeamId }) {
  const isFavorite = favoriteTeamId != null && r.teamId === favoriteTeamId
  const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(r.teamId) } : undefined
  return (
    <li className={`playercard awardhistory__card${isFavorite ? ' awardhistory__card--fav' : ''}`} style={favStyle}>
      <span className="playercard__shotwrap">
        <Headshot personId={r.playerId} name={r.name} teamId={r.teamId} className="playercard__shot" />
        {r.position && <span className="playercard__posbadge">{r.position}</span>}
      </span>
      <div className="playercard__body">
        <div className="playercard__name">
          <PlayerLink id={r.playerId}>{r.name}</PlayerLink>
        </div>
        <div className="playercard__team">
          {r.teamId ? (
            <TeamLink id={r.teamId} className="awardhistory__teamlink">
              <TeamLogo teamId={r.teamId} name={r.teamName} size={14} />
            </TeamLink>
          ) : (
            <TeamLogo teamId={r.teamId} name={r.teamName} size={14} />
          )}
          <span>{r.teamId ? teamClubNameShort(r.teamId) : r.teamName}</span>
        </div>
        {r.statLine && <div className="playercard__stat">{r.statLine}</div>}
      </div>
    </li>
  )
}

// One award-family's year, split into its league groups. Multi-recipient
// groups (Silver Slugger/Gold Glove — up to ~9 per league) render as a dense
// 2-up grid with no stat line; single-recipient groups (MVP/Cy Young/ROY)
// render full-width with their stat line. `showYearLabel` is false when this
// is nested under a "By Year" section, which already names the year in its
// own SectionTitle.
function AwardYear({ year, recipients, favoriteTeamId, showYearLabel = true }) {
  const groups = groupByLeague(recipients)
  return (
    <div className="awardhistory__season">
      {groups.map((g) => (
        <div className="awardhistory__seasongroup" key={g.league ?? 'mlb'}>
          {(showYearLabel || g.league) && (
            <div className="awardhistory__seasonhead">
              {showYearLabel && <span className="awardhistory__yearnum">{year}</span>}
              {g.league && <span className="awardhistory__leaguetag">{g.league}</span>}
            </div>
          )}
          <ul className={`awardhistory__cards${g.recipients.length > 1 ? ' awardhistory__cards--dense' : ''}`}>
            {g.recipients.map((r) => (
              <AwardCard key={`${r.playerId}-${r.position}`} r={r} favoriteTeamId={favoriteTeamId} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AllMlbColumn({ label, recipients, favoriteTeamId }) {
  return (
    <div className="awardhistory__allmlbcol">
      <div className="awardhistory__allmlbhead">{label}</div>
      <ul className="awardhistory__cards awardhistory__cards--compact">
        {(recipients ?? []).map((r) => (
          <AwardCard key={`${r.playerId}-${r.position}`} r={r} favoriteTeamId={favoriteTeamId} />
        ))}
      </ul>
    </div>
  )
}

// All-MLB First/Second Team for one season, stacked side by side rather than
// as two separate award rows — the combined "All-MLB Teams" treatment.
function AllMlbYear({ year, first, second, favoriteTeamId, showYearLabel = true }) {
  return (
    <div className="awardhistory__season">
      {showYearLabel && (
        <div className="awardhistory__seasonhead">
          <span className="awardhistory__yearnum">{year}</span>
        </div>
      )}
      <div className="awardhistory__allmlb">
        <AllMlbColumn label="First Team" recipients={first} favoriteTeamId={favoriteTeamId} />
        <AllMlbColumn label="Second Team" recipients={second} favoriteTeamId={favoriteTeamId} />
      </div>
    </div>
  )
}

// League-wide Awards History: who won each major MLB award (the same hardware
// set the player page's Trophy Case counts, MAJOR_AWARDS in api/person.js) over
// the last several seasons — the standalone counterpart to that per-player
// card ("what has THIS player won" vs. "who won THIS award"). Toggles between
// "By Award" (award-first, then season — the original layout) and "By Year"
// (season-first, then award) via a right-aligned segmented control in the
// topbar, reusing the app's own .levelnav idiom (the slate's MLB/AAA/.../A
// switcher) rather than inventing a new control. Data comes from
// scripts/gen-awards-history.mjs, a hand-run precompute (a season's winners
// are decided once and never change, same footing as war-history.json/
// milb-history.json) — no SealBox needed, same as Milestone Watch/League
// Leaders/WAR: a past season's award roll carries no individual game's score.
// Recipient cards reuse the app's own headshot idiom (.playercard, see
// PastDayRecapBox.jsx) rather than a bespoke avatar treatment. A recipient
// who plays for the user's favoriteTeamId (useFavoriteTeam, same preference
// the slate/standings/leaders pages already highlight with) gets the same
// --fav-accent treatment as those surfaces.
export function AwardsHistoryPage() {
  useDocumentTitle('Awards History')
  const { loading, error, data } = useAsync(() => loadAwardsHistory(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  const [view, setView] = useState('award')
  const families = useMemo(() => data?.families ?? [], [data])
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  const { hardware, allMlbFirst, allMlbSecond } = useMemo(() => {
    const first = families.find((f) => f.key === ALL_MLB_FIRST_KEY) ?? null
    const second = families.find((f) => f.key === ALL_MLB_SECOND_KEY) ?? null
    return {
      hardware: families.filter((f) => f !== first && f !== second),
      allMlbFirst: first,
      allMlbSecond: second,
    }
  }, [families])

  const byYear = useMemo(() => groupFamiliesByYear(hardware), [hardware])
  const allMlbYears = useMemo(
    () => unionYears(allMlbFirst?.years, allMlbSecond?.years),
    [allMlbFirst, allMlbSecond],
  )
  const hasAllMlb = allMlbYears.length > 0

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Awards History</h1>
        <div className="levelnav awardhistory__grouptoggle" role="group" aria-label="Group by">
          <button
            type="button"
            aria-pressed={view === 'award'}
            className={`levelnav__btn${view === 'award' ? ' is-active' : ''}`}
            onClick={() => setView('award')}
          >
            By Award
          </button>
          <button
            type="button"
            aria-pressed={view === 'year'}
            className={`levelnav__btn${view === 'year' ? ' is-active' : ''}`}
            onClick={() => setView('year')}
          >
            By Year
          </button>
        </div>
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
            {view === 'award' &&
              hardware.map((family) => {
                const years = Object.keys(family.years)
                  .map(Number)
                  .sort((a, b) => b - a)
                return (
                  <section className="awardhistory__award" key={family.key}>
                    <SectionTitle title={family.label} />
                    <div className="awardhistory__years">
                      {years.map((year) => (
                        <AwardYear
                          key={year}
                          year={year}
                          recipients={family.years[year]}
                          favoriteTeamId={favoriteTeamId}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}

            {view === 'award' && hasAllMlb && (
              <section className="awardhistory__award" key="all-mlb-teams">
                <SectionTitle title="All-MLB Teams" />
                <div className="awardhistory__years">
                  {allMlbYears.map((year) => (
                    <AllMlbYear
                      key={year}
                      year={year}
                      first={allMlbFirst?.years[year]}
                      second={allMlbSecond?.years[year]}
                      favoriteTeamId={favoriteTeamId}
                    />
                  ))}
                </div>
              </section>
            )}

            {view === 'year' &&
              byYear.map(({ year, awards }) => (
                <section className="awardhistory__award" key={year}>
                  <SectionTitle title={String(year)} />
                  <div className="awardhistory__years">
                    {awards.map((a) => (
                      <div className="awardhistory__yearaward" key={a.key}>
                        <h4 className="awardhistory__yearawardlabel">{a.label}</h4>
                        <AwardYear
                          year={year}
                          recipients={a.recipients}
                          favoriteTeamId={favoriteTeamId}
                          showYearLabel={false}
                        />
                      </div>
                    ))}
                    {allMlbYears.includes(year) && (
                      <div className="awardhistory__yearaward" key="all-mlb-teams">
                        <h4 className="awardhistory__yearawardlabel">All-MLB Teams</h4>
                        <AllMlbYear
                          year={year}
                          first={allMlbFirst?.years[year]}
                          second={allMlbSecond?.years[year]}
                          favoriteTeamId={favoriteTeamId}
                          showYearLabel={false}
                        />
                      </div>
                    )}
                  </div>
                </section>
              ))}
          </div>
          {updated && <p className="hint prospects__caption">Updated {updated}.</p>}
        </>
      )}
    </div>
  )
}
