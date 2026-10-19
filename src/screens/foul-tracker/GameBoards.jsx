import { useState } from 'react'
import { splitDisplayName } from '../../api/person.js'
import { monthDayYear, weekdayAbbr, isWithinDays } from '../../lib/dates.js'
import { gamePath } from '../../lib/route.js'
import { useNav } from '../../lib/nav.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { teamAbbr, teamClubName } from '../../lib/teams.js'
import { BoardCard, favRowProps } from './Boards.jsx'

export function GameHighBoard({ title, rows, favoriteTeamId, gameLinks, positions }) {
  const [showAll, setShowAll] = useState(false)
  if (!rows || rows.length === 0) return null
  const shown = showAll ? rows : rows.slice(0, GAME_HIGHS_LIMIT)
  return (
    <BoardCard title={title}>
      <ol className="sgh-list">
        {shown.map((b) => (
          <GameHighRow key={b.id} b={b} favoriteTeamId={favoriteTeamId} gameLinks={gameLinks} positions={positions} />
        ))}
      </ol>
      {!showAll && rows.length > GAME_HIGHS_LIMIT && (
        <button type="button" className="plink foulboard__viewmore" onClick={() => setShowAll(true)}>
          View more
        </button>
      )}
    </BoardCard>
  )
}

// The score+date badge links to that game's box score once the batched
// schedule lookup (FoulTrackerPage's gameLinks, keyed by gamePk) resolves —
// until then, or if the lookup failed, it renders as a plain non-clickable
// badge (same degrade-gracefully rule the rest of the app applies to any
// dependent fetch).
export function GameHighRow({ b, favoriteTeamId, gameLinks, positions }) {
  const navigate = useNav()
  const hasScore = b.maxGameHisScore != null && b.maxGameOppScore != null
  const link = b.maxGamePk != null ? gameLinks?.[b.maxGamePk] : null
  const MatchupTag = link ? 'button' : 'div'
  const matchupProps = link
    ? {
        type: 'button',
        onClick: () => navigate(gamePath(link.apiDate, link.awayAbbr, link.homeAbbr, 'boxscore', link.gameNumber)),
      }
    : {}
  const { first, last } = splitDisplayName(b.name)
  const position = positions?.[b.id]
  const isNew = isWithinDays(b.maxGameDate, 7)
  return (
    <li className="sgh-row gamehigh-row" {...favRowProps(b.teamId, favoriteTeamId)}>
      <Headshot personId={b.id} name={b.name} teamId={b.teamId} className="sgh-shot sgh-shot--xl" />
      <div className="gamehigh-who">
        <PlayerLink id={b.id} className="sgh-name gamehigh-name">
          {first && <span className="foulboard__heroname-first">{first}</span>}
          <span className="foulboard__heroname-last">{last}</span>
        </PlayerLink>
        <p className="foulboard__herometa">
          {position}
          {position && ' · '}
          <TeamLink id={b.teamId} className="foulboard__heroteamname">
            {teamAbbr({ id: b.teamId })}
          </TeamLink>
        </p>
      </div>
      <MatchupTag className="gamehigh-matchup" {...matchupProps}>
        {isNew && (
          <span className="gamehigh-newstamp" aria-label="Within the last 7 days">
            New!
          </span>
        )}
        {hasScore && (
          <span className="gamehigh-matchup__score">
            <TeamLogo teamId={b.teamId} name={teamAbbr({ id: b.teamId })} size={20} />
            <b>{b.maxGameHisScore}</b>
            <span className="gamehigh-matchup__sep">–</span>
            <b>{b.maxGameOppScore}</b>
            <TeamLogo teamId={b.maxGameOpponentId} name={teamAbbr({ id: b.maxGameOpponentId })} size={20} />
          </span>
        )}
        {b.maxGameDate && (
          <span className="gamehigh-matchup__date">
            {weekdayAbbr(b.maxGameDate)} {monthDayYear(b.maxGameDate)}
          </span>
        )}
      </MatchupTag>
      <Card as="div" frame="ledger" body="flush" className="gamehigh-tiles">
        <div className="gamehigh-tiles__grid">
          <div className="stat">
            <span className="stat__v">{b.maxGamePa || '—'}</span>
            <span className="stat__k">PA</span>
          </div>
          <div className="stat">
            <span className="stat__v">{b.maxGamePitches || '—'}</span>
            <span className="stat__k">Pitches seen</span>
          </div>
          <div className="stat">
            <span className="stat__v">{b.maxGameFouls}</span>
            <span className="stat__k">Fouls</span>
          </div>
        </div>
      </Card>
    </li>
  )
}

// Best Souvenir Odds — ranks GAMES, not players, by both teams' combined
// fouls: more fouls hit means more balls that left play unfielded, so these
// are the games a fan sitting anywhere near foul territory had the best shot
// at going home with a keepsake. Unlike Single-Game Highs (GameHighBoard
// above) — a two-line grid because a headshot+name needs the room — a game
// has no photo to anchor, so everything (rank, both teams, the fouls split,
// the date) fits on ONE line; only .gamehigh-matchup's date-badge chrome and
// .stat's tile look are reused, not the two-row grid shape itself.
export function SouvenirGameBoard({ title, rows, gameLinks }) {
  if (!rows || rows.length === 0) return null
  return (
    <BoardCard title={title}>
      <ol className="sgh-list">
        {rows.map((g, i) => (
          <SouvenirGameRow key={g.gamePk} g={g} rank={i + 1} gameLinks={gameLinks} />
        ))}
      </ol>
    </BoardCard>
  )
}

export function SouvenirGameRow({ g, rank, gameLinks }) {
  const navigate = useNav()
  const link = gameLinks?.[g.gamePk]
  const MatchupTag = link ? 'button' : 'div'
  const matchupProps = link
    ? {
        type: 'button',
        onClick: () => navigate(gamePath(link.apiDate, link.awayAbbr, link.homeAbbr, 'boxscore', link.gameNumber)),
      }
    : {}
  const isNew = isWithinDays(g.date, 7)
  return (
    <li className="sgh-row souvenir-row">
      <span className="umprank__rank">{rank}</span>
      {/* Both teams are already identified by the score badge's logos below —
          a separate name/logo column here was pure duplication. */}
      <Card as="div" frame="ledger" body="flush" className="souvenir-row__tiles">
        <div className="souvenir-row__tilegrid">
          <div className="stat">
            <span className="stat__v">{g.awayFouls}</span>
            <span className="stat__k">{teamClubName(g.awayTeamId)}</span>
          </div>
          <div className="stat">
            <span className="stat__v">{g.homeFouls}</span>
            <span className="stat__k">{teamClubName(g.homeTeamId)}</span>
          </div>
          <div className="stat">
            <span className="stat__v">{g.totalFouls}</span>
            <span className="stat__k">Total</span>
          </div>
        </div>
      </Card>
      {/* Same score+date badge idiom as GameHighRow above (gamehigh-matchup__score/
          __sep/__date) — a fan scanning both boards should recognize a final
          score in the same shape everywhere on this page, not a one-off. */}
      <MatchupTag className="gamehigh-matchup souvenir-row__date" {...matchupProps}>
        {isNew && (
          <span className="gamehigh-newstamp" aria-label="Within the last 7 days">
            New!
          </span>
        )}
        <span className="gamehigh-matchup__score">
          <TeamLogo teamId={g.awayTeamId} name={teamAbbr({ id: g.awayTeamId })} size={20} />
          <b>{g.awayScore}</b>
          <span className="gamehigh-matchup__sep">–</span>
          <b>{g.homeScore}</b>
          <TeamLogo teamId={g.homeTeamId} name={teamAbbr({ id: g.homeTeamId })} size={20} />
        </span>
        {g.date && (
          <span className="gamehigh-matchup__date">
            {weekdayAbbr(g.date)} {monthDayYear(g.date)}
          </span>
        )}
      </MatchupTag>
    </li>
  )
}

// Single-game highs is ALSO a story, not a ranking, but reads as a compact
// scorebug-style ledger row rather than a sentence: who, the game's final
// score + date (the same logos-and-score idiom FirstScorebookPage's
// gamegrid uses for "recap this game" — see ScorebookGameLink), then the
// at-bat's workload as three stat tiles (same `.stat`/`.stat__v`/`.stat__k`
// idiom StatBox's Insights row uses on the innings page) so PA/pitches-seen/
// fouls read as one consistent line rather than a prose sentence.
const GAME_HIGHS_LIMIT = 5
