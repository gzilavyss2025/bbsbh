import { useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { Loader } from '../components/Loader.jsx'

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const FULL_DATE = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

function dateLabel(date, full = false) {
  const [year, month, day] = date.split('-').map(Number)
  return (full ? FULL_DATE : DATE).format(new Date(year, month - 1, day))
}

function gameTitle(game) {
  return `${game.away.abbreviation} ${game.away.runs}, ${game.home.abbreviation} ${game.home.runs}`
}

function leagueGameScoreContext(sortedScores, value) {
  if (!sortedScores?.length) return null
  const count = sortedScores.length
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedScores[mid] < value) lo = mid + 1
    else hi = mid
  }
  const atOrAbove = count - lo
  return { count, atOrAbove, percentile: (lo / count) * 100 }
}

function leagueRankPhrase(ctx, season) {
  if (!ctx) return ''
  if (ctx.atOrAbove <= 1) return `the single best-pitched start by any starting pitcher in the majors all ${season} season, out of ${ctx.count.toLocaleString()} starts`
  return `better than ${ctx.percentile.toFixed(1)}% of the ${ctx.count.toLocaleString()} starts thrown across the majors this season`
}

function gameNote(game) {
  const total = game.away.runs + game.home.runs
  const margin = Math.abs(game.away.runs - game.home.runs)
  if (game.innings > 9) return `${game.innings} innings · ${total} combined runs`
  if (game.away.runs === 0 || game.home.runs === 0) return `Shutout · ${game.away.hits + game.home.hits} combined hits`
  if (margin === 1) return `One-run game · ${total} combined runs`
  return `${total} combined runs · ${game.away.hits + game.home.hits} combined hits`
}

function ScorebookGameLink({ game, className = '', children }) {
  const navigate = useNav()
  return (
    <button
      type="button"
      className={className}
      onClick={() => navigate(gamePath(game.date, game.away.abbreviation, game.home.abbreviation, 'boxscore', game.gameNumber))}
    >
      {children}
    </button>
  )
}

function SectionHead({ eyebrow, title, note }) {
  return (
    <header className="scorebookstory__sectionhead">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {note && <p className="scorebookstory__prose">{note}</p>}
    </header>
  )
}

export function FirstScorebookPage() {
  useDocumentTitle('My First 22 Scorebook')
  const [logFilter, setLogFilter] = useState('all')
  const archive = useAsync(async (signal) => {
    const res = await fetch('/data/first-scorebook.json', { signal })
    if (!res.ok) throw new Error(`first-scorebook.json ${res.status}`)
    return res.json()
  }, [])

  const data = archive.data
  const filteredGames = useMemo(() => {
    if (!data) return []
    if (logFilter === 'brewers') return data.games.filter((game) => game.away.id === 158 || game.home.id === 158)
    if (logFilter === 'close') return data.games.filter((game) => Math.abs(game.away.runs - game.home.runs) === 1)
    return data.games
  }, [data, logFilter])

  const rotation = useMemo(() => {
    if (!data) return []
    const byPitcher = new Map()
    for (const start of data.brewersStarts) {
      const pitcher = byPitcher.get(start.playerId) ?? { id: start.playerId, name: start.name, starts: [] }
      pitcher.starts.push(start)
      byPitcher.set(start.playerId, pitcher)
    }
    return [...byPitcher.values()]
      .map((pitcher) => {
        const outs = pitcher.starts.reduce((n, s) => n + s.outs, 0)
        const earnedRuns = pitcher.starts.reduce((n, s) => n + s.er, 0)
        const walks = pitcher.starts.reduce((n, s) => n + s.bb, 0)
        const hits = pitcher.starts.reduce((n, s) => n + s.h, 0)
        const teamWins = pitcher.starts.filter((s) => s.teamWin).length
        return {
          ...pitcher,
          gamesStarted: pitcher.starts.length,
          wins: pitcher.starts.filter((s) => s.decision === 'W').length,
          losses: pitcher.starts.filter((s) => s.decision === 'L').length,
          teamWins,
          teamLosses: pitcher.starts.length - teamWins,
          strikeOuts: pitcher.starts.reduce((n, s) => n + s.k, 0),
          inningsPitched: `${Math.floor(outs / 3)}.${outs % 3}`,
          era: outs ? (earnedRuns * 9) / (outs / 3) : 0,
          whip: outs ? (walks + hits) / (outs / 3) : 0,
        }
      })
      .sort((a, b) => b.gamesStarted - a.gamesStarted || a.era - b.era)
  }, [data])

  const rotationTotals = useMemo(() => {
    if (!data?.brewersStarts?.length) return null
    const starts = data.brewersStarts
    const outs = starts.reduce((n, s) => n + s.outs, 0)
    const earnedRuns = starts.reduce((n, s) => n + s.er, 0)
    const teamWins = starts.filter((s) => s.teamWin).length
    return {
      arms: rotation.length,
      starts: starts.length,
      inningsPitched: `${Math.floor(outs / 3)}.${outs % 3}`,
      era: (earnedRuns * 9) / (outs / 3),
      strikeOuts: starts.reduce((n, s) => n + s.k, 0),
      teamWins,
      teamLosses: starts.length - teamWins,
    }
  }, [data, rotation])

  const starterNuggets = useMemo(() => {
    if (!data?.brewersStarts?.length || !rotationTotals) return []
    const starts = data.brewersStarts
    const league = data.leagueStarterGameScores
    const bestStart = [...starts].sort((a, b) => b.gameScore - a.gameScore)[0]
    const noDecisions = starts.filter((s) => s.decision === 'ND')
    const hardLuck = noDecisions.length ? [...noDecisions].sort((a, b) => b.gameScore - a.gameScore)[0] : null
    const workhorse = [...rotation].filter((p) => p.gamesStarted >= 4).sort((a, b) => (b.gamesStarted - b.wins - b.losses) - (a.gamesStarted - a.wins - a.losses))[0]
    const tightest = [...rotation].filter((p) => p.gamesStarted >= 2).sort((a, b) => a.whip - b.whip)[0]
    const bestStartLeague = leagueGameScoreContext(league?.scores, bestStart.gameScore)
    const hardLuckLeague = hardLuck ? leagueGameScoreContext(league?.scores, hardLuck.gameScore) : null
    const nuggets = [
      {
        key: 'best',
        stat: bestStart.gameScore.toFixed(0),
        label: 'Game Score',
        headline: 'The one for the scrapbook',
        body: `${bestStart.name}’s start against the ${bestStart.opponent} on ${dateLabel(bestStart.date, true)} is the best in the book — ${bestStart.ip} IP, ${bestStart.h} H, ${bestStart.bb} BB, ${bestStart.k} K${bestStart.shutout ? ', a shutout' : ''}${bestStart.completeGame ? ', and the only complete game a Brewers starter finished all summer.' : '.'} ${bestStartLeague ? `Leaguewide, it’s ${leagueRankPhrase(bestStartLeague, league.season)}.` : ''}`,
      },
      {
        key: 'rotation',
        stat: rotationTotals.era.toFixed(2),
        label: 'Rotation ERA',
        headline: 'The full arsenal',
        body: `${rotationTotals.arms} different arms started for Milwaukee across these ${rotationTotals.starts} games and combined for a ${rotationTotals.era.toFixed(2)} ERA over ${rotationTotals.inningsPitched} innings with ${rotationTotals.strikeOuts} strikeouts. The Brewers went ${rotationTotals.teamWins}–${rotationTotals.teamLosses} in games their starter took the ball — the same record as the book itself.`,
      },
    ]
    if (league?.scores?.length) {
      const eliteThreshold = league.scores[Math.floor(0.9 * league.scores.length)]
      const eliteStarts = starts.filter((s) => s.gameScore >= eliteThreshold).length
      const bookAverage = starts.reduce((n, s) => n + s.gameScore, 0) / starts.length
      const leagueAverage = league.scores.reduce((n, s) => n + s, 0) / league.scores.length
      nuggets.push({
        key: 'field',
        stat: `${eliteStarts}/${starts.length}`,
        label: 'Elite starts',
        headline: 'Against the field',
        body: `${eliteStarts} of the Brewers’ ${starts.length} starts in this book scored a Game Score of at least ${eliteThreshold} — the top 10% of all ${league.count.toLocaleString()} starts thrown across the majors in ${league.season}. The book’s starts averaged a ${bookAverage.toFixed(1)} Game Score, well above the ${leagueAverage.toFixed(1)} league average.`,
      })
    }
    if (hardLuck) {
      nuggets.push({
        key: 'hardluck',
        stat: hardLuck.gameScore.toFixed(0),
        label: 'Game Score',
        headline: 'Best start with nothing to show for it',
        body: `${hardLuck.name} against the ${hardLuck.opponent} on ${dateLabel(hardLuck.date, true)} — ${hardLuck.ip} IP, ${hardLuck.h} H, ${hardLuck.bb} BB, ${hardLuck.k} K — is the best-pitched start in the book that still ended in a no-decision. The bullpen took it from there in a game Milwaukee ${hardLuck.teamWin ? 'eventually won' : 'let get away'}, ${hardLuck.teamRuns}–${hardLuck.oppRuns}.${hardLuckLeague ? ` It was still ${leagueRankPhrase(hardLuckLeague, league.season)}.` : ''}`,
      })
    }
    if (workhorse) {
      const decisions = workhorse.wins + workhorse.losses
      nuggets.push({
        key: 'workhorse',
        stat: String(workhorse.gamesStarted),
        label: 'Starts',
        headline: `${workhorse.name}, the iron arm`,
        body: `${workhorse.name} made more starts than anyone in the book (${workhorse.gamesStarted}) but left with a decision only ${decisions} time${decisions === 1 ? '' : 's'} — his own line reads ${workhorse.wins}–${workhorse.losses}, even though Milwaukee went ${workhorse.teamWins}–${workhorse.teamLosses} on the days he started.`,
      })
    }
    if (tightest && tightest.id !== bestStart.playerId) {
      nuggets.push({
        key: 'tightest',
        stat: tightest.whip.toFixed(2),
        label: 'WHIP',
        headline: `${tightest.name}’s tight ship`,
        body: `Across ${tightest.gamesStarted} starts and ${tightest.inningsPitched} innings, ${tightest.name} posted the stingiest WHIP of any Brewers starter in the book at ${tightest.whip.toFixed(2)} — command that clean is rare even in a small sample.`,
      })
    }
    return nuggets
  }, [data, rotation, rotationTotals])

  if (archive.loading && !data) {
    return <div className="screen"><Loader /></div>
  }
  if (!data) {
    return (
      <div className="screen">
        <SiteHeader />
        <p className="hint hint--error">Couldn’t open the scorebook archive.</p>
        <button type="button" className="btn" onClick={archive.reload}>Retry</button>
      </div>
    )
  }

  const { summary } = data
  return (
    <div className="screen scorebookstory">
      <SiteHeader />

      <header className="scorebookstory__cover">
        <div className="scorebookstory__coverline">
          <span>Numbers Game</span>
          <span>No. 01</span>
        </div>
        <p className="scorebookstory__kicker">The 22 Scorebook</p>
        <h1>My First<br />Scorebook</h1>
        <p className="scorebookstory__prose scorebookstory__dek">
          Thirty-nine games in pencil, from the first out in Milwaukee to a one-run finish in Arlington.
        </p>
        <div className="scorebookstory__dateline">
          <span>{dateLabel(data.dateRange[0], true)}</span>
          <i aria-hidden="true" />
          <span>{dateLabel(data.dateRange[1], true)}</span>
        </div>
      </header>

      <section className="scorebookstory__tally" aria-label="Scorebook totals">
        <div><strong>{summary.games}</strong><span>Games</span></div>
        <div><strong>{summary.innings}</strong><span>Innings</span></div>
        <div><strong>{summary.runs}</strong><span>Runs inked</span></div>
        <div><strong>{summary.oneRunGames}</strong><span>One-run games</span></div>
      </section>

      <aside className="scorebookstory__pullquote">
        <span className="scorebookstory__stamp">The book’s team</span>
        <TeamLogo teamId={158} name="Brewers" size={58} variant="cap" />
        <div>
          <strong>{summary.brewers.wins}–{summary.brewers.losses}</strong>
          <p className="scorebookstory__prose">The Brewers’ record when they appeared in your scorebook — a .750 winning percentage.</p>
        </div>
      </aside>

      <section className="scorebookstory__section">
        <SectionHead
          eyebrow="The instant classics"
          title="Most exciting games"
          note="Ranked by Tally Game Score, which blends tension, lead changes, late drama, spectacle and dominant individual performances."
        />
        <ol className="scorebookstory__gamegrid">
          {data.excitingGames.slice(0, 6).map((game, index) => (
            <li key={game.gamePk}>
              <ScorebookGameLink game={game} className="scorebookstory__gamecard">
                <span className="scorebookstory__rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="scorebookstory__gamescore"><b>{game.gameScore.toFixed(1)}</b> Game Score</span>
                <span className="scorebookstory__matchup">
                  <TeamLogo teamId={game.away.id} name={game.away.name} size={30} />
                  <strong>{game.away.abbreviation} {game.away.runs}</strong>
                  <span>at</span>
                  <strong>{game.home.abbreviation} {game.home.runs}</strong>
                  <TeamLogo teamId={game.home.id} name={game.home.name} size={30} />
                </span>
                <span className="scorebookstory__gamefoot">{dateLabel(game.date)} · {gameNote(game)}</span>
              </ScorebookGameLink>
            </li>
          ))}
        </ol>
      </section>

      <section className="scorebookstory__section">
        <SectionHead
          eyebrow="Stars in the margins"
          title="Best individual performances"
          note="The strongest single-game lines across every player and every club in the book."
        />
        <div className="scorebookstory__performers">
          {data.performances.slice(0, 8).map((performance, index) => {
            const game = data.games.find((g) => g.gamePk === performance.gamePk)
            return (
              <ScorebookGameLink key={`${performance.gamePk}-${performance.playerId}-${performance.type}`} game={game} className="scorebookstory__performer">
                <span className="scorebookstory__performerRank">#{index + 1}</span>
                <Headshot personId={performance.playerId} name={performance.name} teamId={performance.teamId} className="scorebookstory__shot" />
                <span className="scorebookstory__performerText">
                  <strong>{performance.name}</strong>
                  <span>{performance.team} · {dateLabel(performance.date)}</span>
                  <b>{performance.line}</b>
                </span>
              </ScorebookGameLink>
            )
          })}
        </div>
      </section>

      <section className="scorebookstory__section scorebookstory__momentsSection">
        <SectionHead
          eyebrow="Turned the page"
          title="Most memorable moments"
          note="The biggest swings in win probability — the plays where the whole shape of the game changed at once."
        />
        <ol className="scorebookstory__moments">
          {data.moments.slice(0, 7).map((moment) => {
            const game = data.games.find((g) => g.gamePk === moment.gamePk)
            return (
              <li key={`${moment.gamePk}-${moment.inning}-${moment.description}`}>
                <ScorebookGameLink game={game} className="scorebookstory__moment">
                  <span className="scorebookstory__momentmeta">
                    <b>{moment.half} {moment.inning}</b>
                    <span>{dateLabel(moment.date)} · {gameTitle(game)}</span>
                  </span>
                  <p className="scorebookstory__prose">{moment.description}</p>
                  <strong>{Math.round(moment.swing)}-point swing</strong>
                </ScorebookGameLink>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="scorebookstory__section">
        <SectionHead
          eyebrow="Across the whole book"
          title="Combined leaders"
          note="Totals count only the games you scored, turning the book into its own miniature season."
        />
        <div className="scorebookstory__leaderboards">
          <div className="scorebookstory__leaders">
            <h3>At the plate</h3>
            <div className="scorebookstory__leaderhead"><span>Player</span><span>H</span><span>HR</span><span>RBI</span><span>AVG</span></div>
            {data.battingLeaders.slice(0, 8).map((player) => (
              <div className="scorebookstory__leaderrow" key={player.id}>
                <span><TeamLogo teamId={player.teamId} name={player.team} size={20} /><b>{player.name}</b><small>{player.games} G</small></span>
                <span>{player.batting.hits}</span><span>{player.batting.homeRuns}</span><span>{player.batting.rbi}</span><span>{player.average.toFixed(3).replace(/^0/, '')}</span>
              </div>
            ))}
          </div>
          <div className="scorebookstory__leaders">
            <h3>On the mound</h3>
            <div className="scorebookstory__leaderhead"><span>Pitcher</span><span>IP</span><span>K</span><span>ER</span><span>WHIP</span></div>
            {data.pitchingLeaders.slice(0, 8).map((player) => {
              const outs = player.pitching._outs
              const whip = ((player.pitching.baseOnBalls + player.pitching.hits) / (outs / 3)).toFixed(2)
              return (
                <div className="scorebookstory__leaderrow" key={player.id}>
                  <span><TeamLogo teamId={player.teamId} name={player.team} size={20} /><b>{player.name}</b><small>{player.games} G</small></span>
                  <span>{player.pitching.inningsPitched}</span><span>{player.pitching.strikeOuts}</span><span>{player.pitching.earnedRuns}</span><span>{whip}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="scorebookstory__section">
        <SectionHead
          eyebrow="Arm by arm"
          title="The Brewers’ rotation"
          note="Every pitcher who started for Milwaukee in these pages — his record, the team’s record behind him, and his ERA in those starts alone."
        />
        <div className="scorebookstory__leaders">
          <h3>Starting pitchers</h3>
          <div className="scorebookstory__leaderhead"><span>Pitcher</span><span>GS</span><span>Record</span><span>Team</span><span>ERA</span></div>
          {rotation.map((pitcher) => (
            <div className="scorebookstory__leaderrow" key={pitcher.id}>
              <span><TeamLogo teamId={158} name="Brewers" size={20} /><b>{pitcher.name}</b><small>{pitcher.inningsPitched} IP</small></span>
              <span>{pitcher.gamesStarted}</span>
              <span>{pitcher.wins}–{pitcher.losses}</span>
              <span>{pitcher.teamWins}–{pitcher.teamLosses}</span>
              <span>{pitcher.era.toFixed(2)}</span>
            </div>
          ))}
        </div>
        {starterNuggets.length > 0 && (
          <div className="scorebookstory__nuggets">
            {starterNuggets.map((nugget) => (
              <article className="scorebookstory__nugget" key={nugget.key}>
                <span className="scorebookstory__nuggetstat">{nugget.stat}<small>{nugget.label}</small></span>
                <div>
                  <strong>{nugget.headline}</strong>
                  <p className="scorebookstory__prose">{nugget.body}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="scorebookstory__section">
        <SectionHead eyebrow="The standings, as scored" title="Team records" note="Every club’s record in this scorebook universe." />
        <div className="scorebookstory__records">
          {data.teamRecords.map((team) => (
            <div key={team.id}>
              <TeamLogo teamId={team.id} name={team.name} size={26} />
              <span><b>{team.name}</b><small>{team.games} {team.games === 1 ? 'game' : 'games'}</small></span>
              <strong>{team.wins}–{team.losses}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="scorebookstory__section scorebookstory__ledgerSection">
        <SectionHead eyebrow="Every line in the ledger" title="All 39 games" />
        <div className="scorebookstory__filters" aria-label="Filter game log">
          {[['all', 'All 39'], ['brewers', 'Brewers 32'], ['close', 'One-run 16']].map(([key, label]) => (
            <button type="button" key={key} className={logFilter === key ? 'is-active' : ''} aria-pressed={logFilter === key} onClick={() => setLogFilter(key)}>{label}</button>
          ))}
        </div>
        <ol className="scorebookstory__ledger">
          {filteredGames.map((game, index) => (
            <li key={game.gamePk}>
              <ScorebookGameLink game={game} className="scorebookstory__ledgerrow">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{dateLabel(game.date)}</span>
                <span><TeamLogo teamId={game.away.id} name={game.away.name} size={22} />{game.away.abbreviation}</span>
                <strong>{game.away.runs}–{game.home.runs}</strong>
                <span>{game.home.abbreviation}<TeamLogo teamId={game.home.id} name={game.home.name} size={22} /></span>
                <span>{game.innings > 9 ? `${game.innings} inn.` : game.venue}</span>
              </ScorebookGameLink>
            </li>
          ))}
        </ol>
      </section>

      <footer className="scorebookstory__footer">
        <span>Book No. 01</span>
        <p className="scorebookstory__prose">Scored by hand. Remembered here.</p>
        <span>39 / 39</span>
      </footer>
    </div>
  )
}
