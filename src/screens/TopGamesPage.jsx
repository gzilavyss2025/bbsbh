import { useMemo } from 'react'
import { fetchGameScores, gameScoreIndex } from '../api/gameScore.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { humanDate } from '../lib/dates.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { GameCard } from '../components/GameCard.jsx'
import { TierPill } from '../components/TierPill.jsx'

const LIMIT = 25

// The season's most exciting finished games, ranked by Game Score (see
// docs/game-score.md + ADR-0015) — same SD-bucket tiers as the umpire
// accuracy rankings (lib/statTiers.js), applied to Game Score's own pool
// instead of called-pitch accuracy. Deliberately NOT gated by
// useGameScoreVisible — that preference is about whether a score shows up
// AMBIENTLY on the daily slate; landing on this page is already an explicit
// "show me scores" action, the same way opening the umpire rankings page is.
export function TopGamesPage() {
  useDocumentTitle('Top Games')
  const navigate = useNav()
  const scoresAsync = useAsync(() => fetchGameScores(), [])
  const index = useMemo(
    () => gameScoreIndex(scoresAsync.data ?? {}),
    [scoresAsync.data],
  )
  const top = index.ranked.slice(0, LIMIT)
  const topKey = top.map((g) => g.gamePk).join(',')

  const cardsAsync = useAsync(() => fetchGameCardsByPk(top.map((g) => g.gamePk)), [topKey])
  const cards = cardsAsync.data ?? {}

  const fmt = (n) => n.toFixed(1)

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Top Games</h1>
      </header>

      <p className="hint">
        {index.n > 0
          ? `The ${Math.min(LIMIT, index.n)} most exciting finished games this season, out of ${index.n} scored, by Game Score.`
          : 'The most exciting finished games this season, by Game Score.'}
        {' '}Tiers are set by standard deviation from the season&rsquo;s mean, not
        an even split — Elite is {fmt(index.thresholds.eliteMin)}+, Good is{' '}
        {fmt(index.thresholds.goodMin)}–{fmt(index.thresholds.eliteMin)}, Average
        is {fmt(index.thresholds.averageMin)}–{fmt(index.thresholds.goodMin)}, and
        Below Average is under {fmt(index.thresholds.averageMin)}.
      </p>

      <AsyncStatus
        loading={scoresAsync.loading || (top.length > 0 && cardsAsync.loading)}
        error={scoresAsync.error || cardsAsync.error}
        hasData={top.length > 0}
        errorMessage="Couldn’t load Game Score data. Try again."
        emptyMessage="No scored games yet."
        emptyProse
      />

      {top.length > 0 && (
        <ul className="gamelist">
          {top.map((g) => {
            const game = cards[g.gamePk]
            if (!game) return null
            return (
              <li key={g.gamePk} className="topgames__row">
                <span className="topgames__tier">
                  <TierPill tier={g.tier} />
                </span>
                <GameCard
                  game={game}
                  gameScore={fmt(g.score)}
                  dateLabel={humanDate(game.officialDate)}
                  onSelect={() =>
                    navigate(
                      gamePath(
                        game.officialDate,
                        game.away.abbreviation,
                        game.home.abbreviation,
                        'lineup1',
                        game.gameNumber,
                      ),
                    )
                  }
                  onBoxScore={() =>
                    navigate(
                      gamePath(
                        game.officialDate,
                        game.away.abbreviation,
                        game.home.abbreviation,
                        'boxscore',
                        game.gameNumber,
                      ),
                    )
                  }
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
