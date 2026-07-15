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

// How many most-recent seasons show by default, and how far back "Load
// more" reaches in one press — a flat cutoff rather than incremental
// paging, since 1990-and-earlier All-Star history is a much colder path
// than the last decade.
const DEFAULT_SEASON_COUNT = 10
const LOAD_MORE_CUTOFF = 1990

// AL first, then NL — a fixed order so a season's row always reads the same
// way regardless of what order the source recipients arrived in (same
// convention as AwardsHistoryPage's groupByLeague). Each carries its full
// name (for the card header) and which colored header class it gets — red
// for the American League, the app's existing All-Star blue for the
// National League (see .allstarrosters__leaguehead--al/--nl).
const LEAGUES = [
  { key: 'AL', name: 'American League', headClass: 'allstarrosters__leaguehead--al' },
  { key: 'NL', name: 'National League', headClass: 'allstarrosters__leaguehead--nl' },
]

// The three buckets gen-all-star-rosters.mjs precomputes per league, in
// display order — the starting lineup (pitcher, DH, and every defensive
// spot, already scorebook-sorted by the generator), then the bullpen, then
// the bench. No client-side grouping/sorting needed for any of the three.
// Each gets its OWN column at the iPad/desktop breakpoint (see
// .roster-super__row) rather than stacking Bullpen+Substitutes in one tall
// column next to a short Starting Lineup — three independent columns keep
// the card's overall height close to whichever section happens to be
// longest that season, instead of one short column leaving a block of
// visible whitespace next to a much taller stacked one.
const SECTIONS = [
  { key: 'starters', label: 'Starting Lineup' },
  { key: 'bullpen', label: 'Bullpen' },
  { key: 'substitutes', label: 'Substitutes' },
]

// One recipient row, styled like the Team Page's roster rows (.thub-row) —
// a bordered list card instead of loose inline spans, so a season with a
// full 30+ name roster reads as compact rows rather than wrapped whitespace.
// `effectiveTeamId` is the team currently highlighted — either the picked
// team filter or, absent a filter, the user's favorite team (see
// AllStarRostersPage). `filtering` is true only when an explicit team is
// picked, in which case every OTHER recipient dims rather than being
// removed — the section structure stays intact, just visually muted.
function RecipientRow({ r, effectiveTeamId, filtering }) {
  const isHighlight = effectiveTeamId != null && r.teamId === effectiveTeamId
  const isDimmed = filtering && r.teamId !== effectiveTeamId
  const favStyle = isHighlight ? { '--fav-accent': favoriteAccentColor(r.teamId) } : undefined
  const classes = [
    'allstarrosters__row',
    isHighlight && 'allstarrosters__row--fav',
    isDimmed && 'allstarrosters__row--dim',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={classes} style={favStyle}>
      {r.teamId ? (
        <TeamLink id={r.teamId} className="allstarrosters__teamlink">
          <TeamLogo teamId={r.teamId} name={r.teamName} size={18} />
        </TeamLink>
      ) : (
        <TeamLogo teamId={r.teamId} name={r.teamName} size={18} />
      )}
      <PlayerLink id={r.playerId} className="allstarrosters__name">
        {r.name}
      </PlayerLink>
      {r.position && <span className="allstarrosters__pos">{r.position}</span>}
    </li>
  )
}

// A bordered card list — one per roster section — mirroring the Team Page's
// .thub-roster convention. Returns null for an empty bucket so a caller can
// render it unconditionally.
function RosterCard({ recipients, effectiveTeamId, filtering }) {
  if (!recipients.length) return null
  return (
    <ul className="allstarrosters__rows">
      {recipients.map((r) => (
        <RecipientRow key={r.playerId} r={r} effectiveTeamId={effectiveTeamId} filtering={filtering} />
      ))}
    </ul>
  )
}

// A season's full roster, AL then NL, each broken into its three precomputed
// sections and laid out in the Team Page's "super-section" shape
// (.roster-super/.roster-super__row/__col) — but with three independent
// columns, one per section, rather than pairing two sections into one tall
// stacked column (see SECTIONS above). Each league card gets a full-width,
// colored header naming the league (not just "AL"/"NL"). `teamName` (unused
// for display now that the logo carries team identity — see TeamLink/
// TeamLogo above) is still the club's name AS OF that season (a season-
// scoped lookup in the generator, not the app's current-team table) — a
// 1933 Washington Senators pick reads as a Senator, not a Twin, even though
// the franchise id is the same.
function RosterLeagues({ roster, effectiveTeamId, filtering }) {
  const leagues = LEAGUES.filter((l) => roster?.[l.key])
  if (!leagues.length) return null
  return (
    <div className="allstarrosters__leagues">
      {leagues.map(({ key, name, headClass }) => {
        const bucket = roster[key]
        return (
          <div className="roster-super" key={key}>
            <div className={`allstarrosters__leaguehead ${headClass}`}>{name}</div>
            <div className="roster-super__row">
              {SECTIONS.map(({ key: sectionKey, label }) => {
                const recipients = bucket[sectionKey] ?? []
                if (!recipients.length) return null
                return (
                  <div className="roster-super__col" key={sectionKey}>
                    <section className="roster-sub">
                      <h4 className="roster-sub__title">{label}</h4>
                      <RosterCard
                        recipients={recipients}
                        effectiveTeamId={effectiveTeamId}
                        filtering={filtering}
                      />
                    </section>
                  </div>
                )
              })}
            </div>
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
function RosterYear({ year, roster, score, mvp, venue, card, navigate, effectiveTeamId, filtering }) {
  return (
    <section className="allstarrosters__year">
      <span className="allstarrosters__yearnum">{year}</span>
      <div className="allstarrosters__body">
        {score && (
          <div className="allstarrosters__game">
            <AllStarGameResult
              score={score}
              mvp={mvp}
              venue={venue}
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
//
// Only the most recent DEFAULT_SEASON_COUNT seasons render up front — ~90
// years of full rosters in one DOM tree is the bulk of what made this page
// feel slow. "Load more" is a single flat jump back to LOAD_MORE_CUTOFF
// (1990), not incremental paging; seasons older than that aren't reachable
// from this page yet.
export function AllStarRostersPage() {
  useDocumentTitle('All Star Game')
  const navigate = useNav()
  const { favoriteTeamId } = useFavoriteTeam()
  const [filterTeamId, setFilterTeamId] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const { loading, error, data } = useAsync(() => loadAllStarRosters(), [])
  const seasons = data?.seasons ?? []
  const rosters = data?.rosters ?? {}
  const games = data?.games ?? {}
  const scores = data?.scores ?? {}
  const mvps = data?.mvps ?? {}
  const venues = data?.venues ?? {}
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  const visibleSeasons = expanded
    ? seasons.filter((y) => y >= LOAD_MORE_CUTOFF)
    : seasons.slice(0, DEFAULT_SEASON_COUNT)
  const canLoadMore = !expanded && seasons.length > DEFAULT_SEASON_COUNT

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
        <h1 className="topbar__title">All-Star Rosters and Results</h1>
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
          <AllStarTeamFilter selectedTeamId={filterTeamId} onSelect={setFilterTeamId} />
          <div className="allstarrosters__list">
            {visibleSeasons.map((year) => {
              const gamePk = games[year]
              const card = gamePk ? cards[gamePk] : null
              return (
                <RosterYear
                  key={year}
                  year={year}
                  roster={rosters[year]}
                  score={scores[year]}
                  mvp={mvps[year]}
                  venue={venues[year]}
                  card={card}
                  navigate={navigate}
                  effectiveTeamId={effectiveTeamId}
                  filtering={filtering}
                />
              )
            })}
          </div>
          {canLoadMore && (
            <button
              type="button"
              className="allstarrosters__more"
              onClick={() => setExpanded(true)}
            >
              Load more (back to {LOAD_MORE_CUTOFF})
            </button>
          )}
          {updated && <p className="hint prospects__caption">Updated {updated}.</p>}
        </>
      )}
    </div>
  )
}
