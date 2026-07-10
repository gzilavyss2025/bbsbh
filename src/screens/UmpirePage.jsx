import { useState } from 'react'
import { loadUmpire } from '../api/umpires.js'
import { gamePath } from '../lib/route.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TOP_TEAMS_LIMIT = 10
const TOP_VENUES_LIMIT = 5

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// Every club involved in a game the umpire worked (away or home both count —
// this counts games *involving* a team, not just ones at its own park; see
// topVenues below for "at their own park"), ranked most games first.
function topTeams(games, limit) {
  const byTeam = new Map()
  for (const g of games) {
    for (const [id, abbr] of [[g.awayId, g.awayAbbr], [g.homeId, g.homeAbbr]]) {
      if (!id) continue
      if (!byTeam.has(id)) byTeam.set(id, { id, abbr, count: 0 })
      byTeam.get(id).count++
    }
  }
  return [...byTeam.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

// Every ballpark the umpire has worked a game at, ranked most games first.
function topVenues(games, limit) {
  const byVenue = new Map()
  for (const g of games) {
    if (!g.venueId) continue
    if (!byVenue.has(g.venueId)) byVenue.set(g.venueId, { id: g.venueId, name: g.venueName, count: 0 })
    byVenue.get(g.venueId).count++
  }
  return [...byVenue.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

// An umpire's page: every MLB game he's worked this season, most recent
// first, with a toggle to show only the games he had behind the plate. Game
// dates and who-worked-what carry no score, so — unlike the player/team pages
// this mirrors — there's no spoiler cutoff to thread through: the page just
// shows the umpire's whole season.
export function UmpirePage({ id }) {
  const { loading, error, data } = useAsync(() => loadUmpire(id), [id])
  const navigate = useNav()
  const [hpOnly, setHpOnly] = useState(false)
  useDocumentTitle(data?.name || null)

  const back = () => window.history.back()
  const gate = AsyncGate({ loading, error, data, screenClass: 'umpire', noun: 'umpire', onBack: back })
  if (gate) return gate

  const games = data.games ?? []
  const hpCount = games.filter((g) => g.role === 'HP').length
  const shown = hpOnly ? games.filter((g) => g.role === 'HP') : games
  const teams = topTeams(games, TOP_TEAMS_LIMIT)
  const venues = topVenues(games, TOP_VENUES_LIMIT)

  return (
    <div className="screen umpire">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="umpage__head">
        <h1 className="umpage__name">{data.name}</h1>
        <p className="umpage__sub">
          {data.season ? `${data.season} season` : 'This season'} · {games.length}{' '}
          {games.length === 1 ? 'game' : 'games'}
          {hpCount > 0 && ` · ${hpCount} behind the plate`}
        </p>
      </header>

      <div className="umpage__cards">
        {teams.length > 0 && (
          <section className="umpage__card">
            <h2 className="umpage__cardtitle">Most worked teams</h2>
            <ul className="umpage__teamgrid">
              {teams.map((t) => (
                <li key={t.id} className="umpage__teamitem">
                  <TeamLink id={t.id} className="umpage__teamlink">
                    <TeamLogo teamId={t.id} name={t.abbr} size={34} />
                    <span className="umpage__teamcount">{t.count}</span>
                  </TeamLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {venues.length > 0 && (
          <section className="umpage__card">
            <h2 className="umpage__cardtitle">Most worked ballparks</h2>
            <ul className="umpage__venuelist">
              {venues.map((v, i) => (
                <li key={v.id} className="umpage__venuerow">
                  <span className="umpage__venuerank">{i + 1}</span>
                  <span className="umpage__venuename">{v.name || 'Unknown'}</span>
                  <span className="umpage__venuecount">{v.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="umpage__filter" role="group" aria-label="Filter games by base">
        <button
          type="button"
          className={`umpage__filterbtn ${!hpOnly ? 'is-active' : ''}`}
          onClick={() => setHpOnly(false)}
        >
          All games
        </button>
        <button
          type="button"
          className={`umpage__filterbtn ${hpOnly ? 'is-active' : ''}`}
          onClick={() => setHpOnly(true)}
          disabled={hpCount === 0}
        >
          Home plate only
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="hint">
          {hpOnly ? 'No games behind the plate this season.' : 'No games recorded this season.'}
        </p>
      ) : (
        <ul className="umpage__list">
          {shown.map((g) => (
            <li key={`${g.gamePk}-${g.gameNumber}-${g.role}`} className="umpage__row">
              <span className="umpage__role">{g.role}</span>
              <span className="umpage__date">{monthDay(g.date)}</span>
              <button
                type="button"
                className="plink umpage__matchup"
                onClick={() =>
                  navigate(gamePath(g.date, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber))
                }
              >
                {g.awayAbbr} @ {g.homeAbbr}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
