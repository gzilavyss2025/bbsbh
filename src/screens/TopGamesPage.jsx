import { useMemo, useState } from 'react'
import { fetchGameScores, gameScoreIndex } from '../api/gameScore.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { humanDate } from '../lib/dates.js'
import { teamClubName } from '../lib/teams.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { GameCard } from '../components/GameCard.jsx'
import { TierPill } from '../components/TierPill.jsx'
import { GameScoreModal } from '../components/GameScoreModal.jsx'

const LIMIT = 25

// The level filter row: an "All" option alongside MLB/MiLB/AAA/AA/A+/A —
// unlike the slate's LevelNav (which always shows exactly one level, so it
// has no "all" state), Top Games can rank across every level at once, and
// these narrow the POOL, not just the visible list. Defaults to MLB (the
// level almost everyone lands here for); "All" is one tap away.
const LEVEL_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mlb', label: 'MLB' },
  { key: 'milb', label: 'MiLB' },
  { key: 'aaa', label: 'AAA' },
  { key: 'aa', label: 'AA' },
  { key: 'a+', label: 'A+' },
  { key: 'a', label: 'A' },
]
const LEVEL_SPORT_ID = { aaa: 11, aa: 12, 'a+': 13, a: 14 }

function matchesLevel(sportId, key) {
  if (key === 'all') return true
  if (key === 'mlb') return sportId === 1
  if (key === 'milb') return sportId !== 1
  return sportId === LEVEL_SPORT_ID[key]
}

// The season's most exciting finished games, ranked by Game Score (see
// docs/game-score.md + ADR-0015) — same SD-bucket tiers as the umpire
// accuracy rankings (lib/statTiers.js), applied to Game Score's own pool
// instead of called-pitch accuracy. Deliberately NOT gated by
// useGameScoreVisible — that preference is about whether a score shows up
// AMBIENTLY on the daily slate; landing on this page is already an explicit
// "show me scores" action, the same way opening the umpire rankings page is.
//
// The level + favorite-team filters narrow the SCORED POOL before ranking
// (not just the displayed top 25), so both the tiers and the "out of N
// scored" count recompute relative to whatever subset is showing — see
// gameScoreIndex's own note in api/gameScore.js.
export function TopGamesPage() {
  useDocumentTitle('Top Games')
  const navigate = useNav()
  const { favoriteTeamId } = useFavoriteTeam()
  const [levelFilter, setLevelFilter] = useState('mlb')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [showFormula, setShowFormula] = useState(false)

  const scoresAsync = useAsync(() => fetchGameScores(), [])

  const filteredScores = useMemo(() => {
    const raw = scoresAsync.data ?? {}
    const out = {}
    for (const [gamePk, v] of Object.entries(raw)) {
      if (!matchesLevel(v?.sportId, levelFilter)) continue
      if (favoriteOnly && v?.homeId !== favoriteTeamId && v?.awayId !== favoriteTeamId) continue
      out[gamePk] = v
    }
    return out
  }, [scoresAsync.data, levelFilter, favoriteOnly, favoriteTeamId])

  const index = useMemo(() => gameScoreIndex(filteredScores), [filteredScores])
  const top = index.ranked.slice(0, LIMIT)
  const topKey = top.map((g) => g.gamePk).join(',')

  const cardsAsync = useAsync(() => fetchGameCardsByPk(top.map((g) => g.gamePk)), [topKey])
  const cards = cardsAsync.data ?? {}

  const fmt = (n) => n.toFixed(1)
  const favoriteName = teamClubName(favoriteTeamId) || 'my team'

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Top Games</h1>
      </header>

      <div className="levelnav topgames__levels" aria-label="Filter games">
        {LEVEL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={levelFilter === f.key}
            className={`levelnav__btn ${levelFilter === f.key ? 'is-active' : ''}`}
            onClick={() => setLevelFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={favoriteOnly}
          className={`topgames__favtoggle ${favoriteOnly ? 'is-active' : ''}`}
          onClick={() => setFavoriteOnly((v) => !v)}
        >
          ★ {favoriteName} only
        </button>
      </div>

      <p className="hint topgames__hint">
        {index.n > 0
          ? `The ${Math.min(LIMIT, index.n)} most exciting finished games this season, out of ${index.n} scored.`
          : 'No scored games match this filter yet.'}
        {' '}Ranked by Game Score, a single number for how dramatic and
        memorable a game was.{' '}
        <button
          type="button"
          className="hint__link"
          onClick={() => setShowFormula(true)}
        >
          How&rsquo;s this calculated?
        </button>
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
          {top.map((g, i) => {
            const game = cards[g.gamePk]
            if (!game) return null
            return (
              <li key={g.gamePk} className="topgames__row">
                {/* Row header: the rank (this is a ranking, not just a pile of
                    cards), the statistical tier pill, and the Game Score itself
                    surfaced big — the whole point of this page. The score is
                    pulled OUT of the GameCard's meta line (gameScore left null
                    below) so it isn't shown twice. */}
                <div className="topgames__rowhead">
                  <span className="topgames__rank">#{i + 1}</span>
                  <TierPill tier={g.tier} className="topgames__tier" />
                  <span className="topgames__score">
                    <span className="topgames__scorenum">{fmt(g.score)}</span>
                    <span className="topgames__scorelabel">Game Score</span>
                  </span>
                </div>
                <GameCard
                  game={game}
                  gameScore={null}
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

      {showFormula && (
        <GameScoreModal
          thresholds={index.thresholds}
          onClose={() => setShowFormula(false)}
        />
      )}
    </div>
  )
}
