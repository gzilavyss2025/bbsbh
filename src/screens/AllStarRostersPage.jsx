import { useState } from 'react'
import { loadAllStarRosters } from '../api/allStarRosters.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { humanDate } from '../lib/dates.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { AllStarGameResult } from '../components/AllStarGameResult.jsx'
import { AllStarTeamFilter } from '../components/AllStarTeamFilter.jsx'
import { favoriteAccentColor } from '../lib/teams.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// AL first, then NL — a fixed order so a season's row always reads the same
// way regardless of what order the source recipients arrived in (same
// convention as AwardsHistoryPage's groupByLeague).
const LEAGUE_ORDER = ['AL', 'NL']

// The three buckets gen-all-star-rosters.mjs precomputes per league, in
// display order — the starting lineup (pitcher, DH, and every defensive
// spot, already scorebook-sorted by the generator), then the bullpen, then
// the bench. No client-side grouping/sorting needed for any of the three.
const SECTIONS = [
  { key: 'starters', label: 'Starting Lineup' },
  { key: 'bullpen', label: 'Bullpen' },
  { key: 'substitutes', label: 'Substitutes' },
]

// One recipient row. `effectiveTeamId` is the team currently highlighted —
// either the picked team filter or, absent a filter, the user's favorite
// team (see AllStarRostersPage). `filtering` is true only when an explicit
// team is picked, in which case every OTHER recipient dims rather than being
// removed — the year/section structure stays intact, just visually muted.
function RecipientRow({ r, effectiveTeamId, filtering, groupStart }) {
  const isHighlight = effectiveTeamId != null && r.teamId === effectiveTeamId
  const isDimmed = filtering && r.teamId !== effectiveTeamId
  const favStyle = isHighlight ? { '--fav-accent': favoriteAccentColor(r.teamId) } : undefined
  const classes = [
    'allstarrosters__recipient',
    isHighlight && 'allstarrosters__recipient--fav',
    isDimmed && 'allstarrosters__recipient--dim',
    groupStart && 'allstarrosters__recipient--groupstart',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} style={favStyle}>
      {r.teamId ? (
        <TeamLink id={r.teamId} className="allstarrosters__teamlink">
          <TeamLogo teamId={r.teamId} name={r.teamName} size={16} />
        </TeamLink>
      ) : (
        <TeamLogo teamId={r.teamId} name={r.teamName} size={16} />
      )}
      <PlayerLink id={r.playerId} className="allstarrosters__name">
        {r.name}
      </PlayerLink>
      {r.position && <em className="allstarrosters__pos">{r.position}</em>}
    </span>
  )
}

// A season's full roster, AL then NL, each broken into its three precomputed
// sections. `teamName` (unused for display now that the logo carries team
// identity — see TeamLink/TeamLogo above) is still the club's name AS OF that
// season (a season-scoped lookup in the generator, not the app's current-team
// table) — a 1933 Washington Senators pick reads as a Senator, not a Twin,
// even though the franchise id is the same.
function RosterLeagues({ roster, effectiveTeamId, filtering }) {
  const leagues = LEAGUE_ORDER.filter((league) => roster?.[league])
  if (!leagues.length) return null
  return (
    <div className="allstarrosters__leagues">
      {leagues.map((league) => {
        const bucket = roster[league]
        return (
          <div className="allstarrosters__league" key={league}>
            <span className="allstarrosters__leaguetag">{league}</span>
            {SECTIONS.map(({ key, label }) => {
              const recipients = bucket[key] ?? []
              if (!recipients.length) return null
              // Bullpen/Substitutes are pre-grouped by team (see the
              // generator's groupByTeam); mark each run's first row so the
              // CSS can add a hairline between clubs. Starting Lineup is
              // sorted by scorebook position instead, so no grouping cue
              // applies there even if two same-club rows land adjacent.
              let prevTeamId = null
              return (
                <div className="allstarrosters__section" key={key}>
                  <span className="allstarrosters__sectionlabel">{label}</span>
                  <div className="allstarrosters__recipients">
                    {recipients.map((r, i) => {
                      const groupStart = key !== 'starters' && i > 0 && r.teamId !== prevTeamId
                      prevTeamId = r.teamId
                      return (
                        <RecipientRow
                          key={r.playerId}
                          r={r}
                          effectiveTeamId={effectiveTeamId}
                          filtering={filtering}
                          groupStart={groupStart}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// One season: the roster (above) plus, when the game itself resolved, the
// AllStarGameResult card — this page's one deliberate exception to the
// spoiler rule's "never print a score" invariant (see that component's
// header comment + docs/adr/0019). `card` (from fetchGameCardsByPk) supplies
// the date + the real club abbreviations the box-score link needs; the score
// itself comes straight from the static file (data.scores[year]), so the
// card still renders even in the rare case `card` hasn't resolved yet.
function RosterYear({ year, roster, score, card, navigate, effectiveTeamId, filtering }) {
  return (
    <section className="allstarrosters__year">
      <span className="allstarrosters__yearnum">{year}</span>
      <div className="allstarrosters__body">
        {score && (
          <div className="allstarrosters__game">
            <AllStarGameResult
              score={score}
              dateLabel={card ? humanDate(card.officialDate) : null}
              onBoxScore={
                card
                  ? () =>
                      navigate(
                        gamePath(
                          card.officialDate,
                          card.away.abbreviation,
                          card.home.abbreviation,
                          'boxscore',
                          card.gameNumber,
                        ),
                      )
                  : undefined
              }
            />
          </div>
        )}
        <RosterLeagues roster={roster} effectiveTeamId={effectiveTeamId} filtering={filtering} />
      </div>
    </section>
  )
}

// All-Star Rosters: every MLB All-Star Game roster, year over year back to
// 1933 — the standalone historical counterpart to a live game's lineup card.
// Data comes from scripts/gen-all-star-rosters.mjs, a hand-run precompute (a
// season's roster is decided once and never changes, same footing as
// awards-history.json/milb-history.json) — no SealBox needed for the roster
// itself, same as Awards History/League Leaders/WAR: who was NAMED to a
// squad carries no individual game's score. The game's final score DOES show
// plainly here (see RosterYear/AllStarGameResult above + ADR-0019) — the
// page's one deliberate exception to that invariant.
//
// The team filter (AllStarTeamFilter) picks one club to highlight across
// EVERY season at once, overriding the ordinary favorite-team highlight
// while active — `effectiveTeamId` below is the filter pick, falling back to
// favoriteTeamId only when no filter is picked (the default "MLB" entry).
export function AllStarRostersPage() {
  useDocumentTitle('All-Star Rosters')
  const navigate = useNav()
  const { favoriteTeamId } = useFavoriteTeam()
  const [filterTeamId, setFilterTeamId] = useState(null)
  const { loading, error, data } = useAsync(() => loadAllStarRosters(), [])
  const seasons = data?.seasons ?? []
  const rosters = data?.rosters ?? {}
  const games = data?.games ?? {}
  const scores = data?.scores ?? {}
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  const gamePks = Object.values(games)
  const gamePksKey = gamePks.join(',')
  const cardsAsync = useAsync(() => fetchGameCardsByPk(gamePks), [gamePksKey])
  const cards = cardsAsync.data ?? {}

  const effectiveTeamId = filterTeamId ?? favoriteTeamId
  const filtering = filterTeamId != null

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">All-Star Rosters</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={seasons.length > 0}
        errorMessage="Couldn’t load All-Star Rosters. Try again."
        emptyMessage="No All-Star roster history is available right now."
        emptyProse
      />

      {seasons.length > 0 && (
        <>
          <p className="hint">
            Every player named to an All-Star squad — including one who was
            selected but never played, replaced by an injury or a starter who
            pitched the Sunday before.
          </p>
          <AllStarTeamFilter selectedTeamId={filterTeamId} onSelect={setFilterTeamId} />
          <div className="allstarrosters__list">
            {seasons.map((year) => {
              const gamePk = games[year]
              const card = gamePk ? cards[gamePk] : null
              return (
                <RosterYear
                  key={year}
                  year={year}
                  roster={rosters[year]}
                  score={scores[year]}
                  card={card}
                  navigate={navigate}
                  effectiveTeamId={effectiveTeamId}
                  filtering={filtering}
                />
              )
            })}
          </div>
          {updated && <p className="hint prospects__caption">Updated {updated}.</p>}
        </>
      )}
    </div>
  )
}
