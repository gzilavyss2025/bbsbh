import { useState } from 'react'
import { loadUmpire } from '../api/umpires.js'
import { gamePath } from '../lib/route.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
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
