import { useMemo } from 'react'
import { gamePath } from '../../../lib/route.js'
import { useNav } from '../../../lib/nav.js'
import { TeamLogo } from '../../../components/identity/TeamLogo.jsx'

// Season progress strip for the team page — one block per series (a run of
// consecutive games against the same opponent), one small cell per game
// within it, in chronological order left-to-right/top-to-bottom (wraps on
// narrow screens rather than paging by month). `games` is spoiler-free
// (dates, opponents, home/away — see fetchTeamSchedule) plus a `won` flag
// that's already cutoff-gated by the caller (null for anything not yet safe
// to show), so every game renders regardless of whether it's already been
// played, and a played game's cell tints green/won or red/loss only once
// `won` isn't null; the destination page (lineup1) still manages its own
// sealing independently for anyone who taps through. `refDate` marks the
// series the page was opened from (or today's) so it can be highlighted.
function SeriesStrip({ games, allStarGame, refDate }) {
  const navigate = useNav()

  const series = useMemo(() => {
    const out = []
    for (const g of games) {
      const last = out[out.length - 1]
      if (last && last.opponent.id === g.opponent.id) {
        last.games.push(g)
      } else {
        out.push({ opponent: g.opponent, games: [g] })
      }
    }
    return out
  }, [games])

  // Splice the All-Star Game in chronologically — right before the first
  // series that resumes after the break (a team's own schedule has no games
  // during the break itself, so there's no series to attach it to).
  const items = useMemo(() => {
    const list = series.map((s) => ({ type: 'series', key: `${s.opponent.id}-${s.games[0].apiDate}`, ...s }))
    if (allStarGame) {
      const card = { type: 'allstar', key: `allstar-${allStarGame.apiDate}`, ...allStarGame }
      const idx = list.findIndex((it) => it.games[0].apiDate > allStarGame.apiDate)
      if (idx === -1) list.push(card)
      else list.splice(idx, 0, card)
    }
    return list
  }, [series, allStarGame])

  const openGame = (g) => {
    navigate(gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, 'lineup1', g.gameNumber))
  }

  return (
    <div className="sstrip">
      {items.map((it) => {
        if (it.type === 'allstar') {
          return (
            <button
              key={it.key}
              type="button"
              className="sstrip__series sstrip__series--allstar"
              onClick={() => openGame(it)}
              title={`${it.apiDate} · All-Star Game · ${it.away.name} vs ${it.home.name}`}
            >
              <div className="sstrip__opp">
                <TeamLogo teamId={it.away.id} name={it.away.name} size={18} />
                <TeamLogo teamId={it.home.id} name={it.home.name} size={18} />
              </div>
              <span className="sstrip__opplabel">All-Star Break</span>
            </button>
          )
        }
        const isCurrent = it.games.some((g) => g.apiDate === refDate)
        return (
          <div key={it.key} className={`sstrip__series${isCurrent ? ' sstrip__series--current' : ''}`}>
            <div className="sstrip__opp" title={it.opponent.name}>
              <TeamLogo teamId={it.opponent.id} name={it.opponent.name} size={18} />
              <span className="sstrip__opplabel">{it.opponent.abbreviation}</span>
            </div>
            <div className="sstrip__cells">
              {it.games.map((g) => {
                const resultClass =
                  g.won === true ? ' sstrip__cell--win' : g.won === false ? ' sstrip__cell--loss' : ''
                const resultLabel = g.won === true ? ' · W' : g.won === false ? ' · L' : ''
                return (
                  <button
                    key={g.gamePk}
                    type="button"
                    className={`sstrip__cell${g.isHome ? ' sstrip__cell--home' : ''}${resultClass}`}
                    onClick={() => openGame(g)}
                    title={`${g.apiDate} · ${g.isHome ? 'vs' : 'at'} ${g.opponent.name}${g.doubleHeader !== 'N' ? ` · Gm ${g.gameNumber}` : ''}${resultLabel}`}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SeasonSchedule({ teamId, asOf, schedule, allStarGame, refDate }) {
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Schedule</span>
      </div>
      <div className="thub-card__body">
        <SeriesStrip
          key={`${teamId}-${asOf ?? ''}`}
          games={schedule}
          allStarGame={allStarGame}
          refDate={refDate}
        />
      </div>
    </div>
  )
}
