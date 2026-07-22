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
import { ReportFooter } from '../components/ReportFooter.jsx'
import { teamClubNameShort, favoriteAccentColor } from '../lib/teams.js'

// The two All-MLB families arrive from the generator as ordinary award
// families (see gen-awards-history.mjs / MAJOR_AWARDS), but the page treats
// them as one combined "All-MLB Teams" section — First/Second Team stacked
// side by side rather than as two separate award rows.
const ALL_MLB_FIRST_KEY = 'All-MLB First Team'
const ALL_MLB_SECOND_KEY = 'All-MLB Second Team'

// Spelled out for the wide-viewport league banner (below); the phone layout
// still shows the short "AL"/"NL" tag — see .awardhistory__leaguetag-full/
// -short in index.css. The color class (kraft-clay red for AL, allstar-blue
// for NL) is the same at every size, just a bolder fill once the tag becomes
// a full banner at 740px+.
const LEAGUE_NAME = { AL: 'American League', NL: 'National League' }
const LEAGUE_CLASS = { AL: 'awardhistory__leaguetag--al', NL: 'awardhistory__leaguetag--nl' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// "Pete Crow-Armstrong" -> ["Pete", "Crow-Armstrong"] (everything after the
// first space) — same convention as PerformerCard.jsx's splitFirstLast, so
// a dense card can break the name onto two lines at the first/last boundary
// instead of the browser's own mid-word wrap.
function splitFirstLast(full) {
  const i = (full ?? '').indexOf(' ')
  return i === -1 ? [full ?? '', ''] : [full.slice(0, i), full.slice(i + 1)]
}

// A dense card is only ~half the width of a full-width one on a phone, so a
// long name part ("Crow-Armstrong", "Guerrero Jr.") needs a smaller face to
// still fit two lines without wrapping again or overflowing. Three tiers,
// keyed off the longer of the two name parts. (Desktop widens the dense card
// back out to full width — see .awardhistory__cards--dense's 740px override —
// so this only matters on a phone; harmless either way.)
function nameSizeClass(first, last) {
  const longest = Math.max(first.length, last.length)
  if (longest >= 12) return 'awardhistory__name--tiny'
  if (longest >= 9) return 'awardhistory__name--small'
  return ''
}

// Whether a family ever splits by league — every hardware award except the
// MLB-wide ones (only Roberto Clemente today). Data-driven rather than a
// hardcoded award list, so a future MLB-wide-only award degrades the same way
// without a code change.
function isLeagueSplit(family) {
  return Object.values(family.years).some((recipients) => recipients.some((r) => r.league))
}

// Silver Slugger/Gold Glove (multi-recipient) go dense; every single-
// recipient group renders at the base size with its stat line
// (gen-awards-history.mjs fetches one for every recipient now, not just MVP/
// Cy Young/ROY). A recipient the stats endpoint had nothing for falls back
// to the bigger "full" headshot instead, so a bare name+team card doesn't
// read as half-empty next to every other card's stat line.
function cardsClassFor(recipients) {
  const isDense = recipients.length > 1
  const hasStatLine = recipients.some((r) => r.statLine)
  const cardsClass = isDense
    ? 'awardhistory__cards--dense'
    : hasStatLine
      ? 'awardhistory__cards--base'
      : 'awardhistory__cards--full'
  return { isDense, cardsClass }
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
// same pattern as Top Performers/slate result cards (see PerformerCard.jsx +
// .playercard in index.css). `dense` (Silver Slugger/Gold Glove) breaks the
// name onto two lines at the first/last boundary and
// shrinks the face for a long name part on a phone, where a dense card is
// half the width of a full one (desktop widens it back out — see index.css).
// The team logo docks to the right of the team name at 740px+
// (.awardhistory__teamname's `order`, index.css). A recipient who plays for
// the user's favoriteTeamId gets the same --fav-accent highlight the rest of
// the app's rosters/leaderboards use.
function AwardCard({ r, favoriteTeamId, dense = false }) {
  const isFavorite = favoriteTeamId != null && r.teamId === favoriteTeamId
  const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(r.teamId) } : undefined
  const [first, last] = dense ? splitFirstLast(r.name) : [r.name, '']
  const nameClass = dense ? nameSizeClass(first, last) : ''
  return (
    <li className={`playercard awardhistory__card${isFavorite ? ' awardhistory__card--fav' : ''}`} style={favStyle}>
      <span className="playercard__shotwrap">
        <Headshot personId={r.playerId} name={r.name} teamId={r.teamId} className="playercard__shot" />
        {r.position && <span className="playercard__posbadge">{r.position}</span>}
      </span>
      <div className="playercard__body">
        <div className={`playercard__name ${nameClass}`}>
          <PlayerLink id={r.playerId}>
            {dense ? (
              <>
                {first}
                {last && <br className="awardhistory__namebreak" />}
                {last}
              </>
            ) : (
              r.name
            )}
          </PlayerLink>
        </div>
        <div className="playercard__team">
          {r.teamId ? (
            <TeamLink id={r.teamId} className="awardhistory__teamlink">
              <TeamLogo teamId={r.teamId} name={r.teamName} size={18} />
            </TeamLink>
          ) : (
            <TeamLogo teamId={r.teamId} name={r.teamName} size={18} />
          )}
          <span className="awardhistory__teamname">
            {r.teamId ? teamClubNameShort(r.teamId) : r.teamName}
          </span>
        </div>
        {r.statLine && <div className="playercard__stat">{r.statLine}</div>}
      </div>
    </li>
  )
}

// One league's recipients for one season — the year sits in a narrow rail to
// the left rather than its own full-width row, so it doesn't cost horizontal
// space the cards could use.
function SeasonRow({ year, recipients, favoriteTeamId }) {
  const { isDense, cardsClass } = cardsClassFor(recipients)
  return (
    <div className="awardhistory__season">
      <div className="awardhistory__seasonyear">
        <span className="awardhistory__yearnum">{year}</span>
      </div>
      <ul className={`awardhistory__cards ${cardsClass}`}>
        {recipients.map((r) => (
          <AwardCard key={`${r.playerId}-${r.position}`} r={r} favoriteTeamId={favoriteTeamId} dense={isDense} />
        ))}
      </ul>
    </div>
  )
}

// One award's recipients for one league, within a single year — used by the
// "By Year" toggle (AwardRow, below), which has no year rail of its own
// (the year already names the section).
function LeagueRows({ league, rows }) {
  if (rows.length === 0) return null
  return (
    <div className="awardhistory__leaguecol">
      <div className={`awardhistory__leaguetag ${LEAGUE_CLASS[league]}`}>
        <span className="awardhistory__leaguetag-full">{LEAGUE_NAME[league]}</span>
        <span className="awardhistory__leaguetag-short">{league}</span>
      </div>
      <div className="awardhistory__leagueyears">{rows}</div>
    </div>
  )
}

// A whole league-split award family ("By Award" view): American League and
// National League each get ONE banner at the top of their own column, with
// every season's winners stacked underneath it — rather than repeating the
// banner every season. Same two-column width structure as the All-MLB Teams
// section, at the app's existing 740px wide-viewport breakpoint; phone stacks
// AL above NL.
function AwardFamilySplit({ years, yearsData, favoriteTeamId }) {
  return (
    <div className="awardhistory__familysplit">
      {['AL', 'NL'].map((league) => {
        const rows = years
          .map((year) => ({
            year,
            recipients: (yearsData[year] ?? []).filter((r) => r.league === league),
          }))
          .filter((row) => row.recipients.length > 0)
          .map((row) => (
            <SeasonRow key={row.year} year={row.year} recipients={row.recipients} favoriteTeamId={favoriteTeamId} />
          ))
        return <LeagueRows key={league} league={league} rows={rows} />
      })}
    </div>
  )
}

// One award, for one year, split by league — used by the "By Year" toggle.
// Same banner-once-per-column shape as AwardFamilySplit, just keyed by award
// instead of by season (a year is already the outer grouping there, so a
// league banner here only ever appears once per award either way).
function AwardYearSplit({ label, recipients, favoriteTeamId }) {
  return (
    <div className="awardhistory__yearaward">
      <h4 className="awardhistory__yearawardlabel">{label}</h4>
      <div className="awardhistory__familysplit">
        {['AL', 'NL'].map((league) => {
          const leagueRecipients = recipients.filter((r) => r.league === league)
          if (!leagueRecipients.length) return null
          const { isDense, cardsClass } = cardsClassFor(leagueRecipients)
          const rows = [
            <ul className={`awardhistory__cards ${cardsClass}`} key="cards">
              {leagueRecipients.map((r) => (
                <AwardCard key={`${r.playerId}-${r.position}`} r={r} favoriteTeamId={favoriteTeamId} dense={isDense} />
              ))}
            </ul>,
          ]
          return <LeagueRows key={league} league={league} rows={rows} />
        })}
      </div>
    </div>
  )
}

// One award, for one year, with no league split (Roberto Clemente) — a plain
// label + card row, same as any other MLB-wide award.
function AwardYearPlain({ label, recipients, favoriteTeamId }) {
  const { isDense, cardsClass } = cardsClassFor(recipients)
  return (
    <div className="awardhistory__yearaward">
      <h4 className="awardhistory__yearawardlabel">{label}</h4>
      <ul className={`awardhistory__cards ${cardsClass}`}>
        {recipients.map((r) => (
          <AwardCard key={`${r.playerId}-${r.position}`} r={r} favoriteTeamId={favoriteTeamId} dense={isDense} />
        ))}
      </ul>
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
        <div className="awardhistory__seasonyear">
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
// "By Award" (award-first, then season) and "By Year" (season-first, then
// award) via a right-aligned segmented control in the topbar, reusing the
// app's own .levelnav idiom (the slate's MLB/AAA/.../A switcher) rather than
// inventing a new control.
//
// Both views give a league-split award (every hardware award except Roberto
// Clemente) ONE American League/National League banner per award, not one per
// season — "By Award" via AwardFamilySplit (a season rail under each league's
// banner), "By Year" via AwardYearSplit (an award block under each league's
// banner, since the year itself is already the outer grouping there).
//
// Data comes from scripts/gen-awards-history.mjs, a hand-run precompute (a
// season's winners are decided once and never change, same footing as
// war-history.json/milb-history.json) — no SealBox needed, same as Milestone
// Watch/League Leaders/WAR: a past season's award roll carries no individual
// game's score. Recipient cards reuse the app's own headshot idiom
// (.playercard, see PerformerCard.jsx) rather than a bespoke avatar
// treatment. A recipient who plays for the user's favoriteTeamId
// (useFavoriteTeam, same preference the slate/standings/leaders pages already
// highlight with) gets the same --fav-accent treatment as those surfaces.
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
          <div className={`awardhistory__list${view === 'award' ? ' awardhistory__list--zebra' : ''}`}>
            {view === 'award' &&
              hardware.map((family) => {
                const years = Object.keys(family.years)
                  .map(Number)
                  .sort((a, b) => b - a)
                return (
                  <section className="awardhistory__award" key={family.key}>
                    <SectionTitle title={family.label} />
                    {isLeagueSplit(family) ? (
                      <AwardFamilySplit years={years} yearsData={family.years} favoriteTeamId={favoriteTeamId} />
                    ) : (
                      <div className="awardhistory__years">
                        {years.map((year) => (
                          <SeasonRow
                            key={year}
                            year={year}
                            recipients={family.years[year]}
                            favoriteTeamId={favoriteTeamId}
                          />
                        ))}
                      </div>
                    )}
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
                    {awards.map((a) =>
                      a.recipients.some((r) => r.league) ? (
                        <AwardYearSplit
                          key={a.key}
                          label={a.label}
                          recipients={a.recipients}
                          favoriteTeamId={favoriteTeamId}
                        />
                      ) : (
                        <AwardYearPlain
                          key={a.key}
                          label={a.label}
                          recipients={a.recipients}
                          favoriteTeamId={favoriteTeamId}
                        />
                      ),
                    )}
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

      <ReportFooter />
    </div>
  )
}
