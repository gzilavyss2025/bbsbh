import { useState } from 'react'
import { loadUmpire } from '../../../../api/umpires.js'
import { postseasonPlateLine } from '../../../../components/umpire/postseasonPlateLine.js'
import { Pill } from '../../../../components/ui/control/Pill.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { EmptyState } from '../../../../components/ui/state/EmptyState.jsx'
import { useNav } from '../../../../lib/nav.js'
import { gamePath, umpirePath } from '../../../../lib/route.js'
import { HomePlateIcon } from '../../../../components/badges/UmpireTierGlyph.jsx'
import { UmpireZoneMap } from '../../../../components/umpire/UmpireZoneMap.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { LEAN_TIERS, LEAN_TIER_LABELS, leanCaretFraction } from '../../../../lib/statTiers.js'
import { SheetFrame } from './SheetFrame.jsx'
import { monthDay } from '../../../../lib/dates.js'

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const HAND = { L: 'left-handers', R: 'right-handers' }

// The batter the area to watch is about, beside the zone map: Gameday's generic "immortal"
// figure (docs/gameday-assets.md) in that hand's stance. The art is drawn from the catcher's
// side; the map is seen from the pitcher's, so it is mirrored (CSS). Drawn only when the tendency
// names a hand, and dropped if the unofficial CDN fails (Gary, 2026-10-29).
const IMMORTAL = 'https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/immortal'
function WatchBatter({ hand }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const stance = hand === 'L' ? 'left' : 'right'
  return <img className="lump__batter" src={`${IMMORTAL}/${stance}/GENERIC-home.png`} alt="" aria-hidden="true" onError={() => setFailed(true)} />
}

function Tile({ label, value, sup }) {
  return (
    <div className="lump__tile">
      <dt>{label}</dt>
      <dd>
        {value}
        {sup && <sub>{sup}</sub>}
      </dd>
    </div>
  )
}

// An umpire's tendencies as a sheet (the redesign of the live Umpire Tendencies card): who he
// is and how many pitches he has called, four figures (accuracy, rank, consistency, run impact),
// where he leans on the zone, the area to watch with its map, and the ABS challenge rates.
// Opened from any crew member's name or the plate umpire's tier note. The same season
// aggregates of finished games' ball and strike calls as the live card, never a run, hit or
// result of any game, so it sits outside any seal. An umpire with no plate record shows his
// name and nothing else.
export function UmpSheet({ id, plate = true, seasonYear, onClose }) {
  const navigate = useNav()
  const { data: u, loading } = useAsync(() => loadUmpire(id, { seasonYear }), [id, seasonYear])
  // His last five plate games, each with its accuracy. A plate game's row lives in whichever
  // level's byGamePk map covers it (MLB or Triple-A), so both are checked.
  const hpGames = (u?.games ?? [])
    .filter((g) => g.role === 'HP')
    .map((g) => ({ ...g, row: u.accuracy?.byGamePk?.[g.gamePk] ?? u.accuracyAAA?.byGamePk?.[g.gamePk] ?? null }))
    .slice(0, 5)
  // Tag Triple-A rows only when the list mixes levels; otherwise every row is implicitly one level.
  const mixed = hpGames.some((g) => (g.level ?? 'MLB') === 'AAA') && hpGames.some((g) => (g.level ?? 'MLB') !== 'AAA')
  const openGame = (g) => {
    onClose()
    navigate(gamePath(g.date, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber))
  }
  const season = u?.accuracy?.season
  const postSeason = u?.accuracyPost?.season
  const post = postseasonPlateLine(postSeason)
  const { lean, watchArea, zoneCells, rank, challenges, leagueChallenges } = u ?? {}
  return (
    <SheetFrame title="Umpire tendencies" label={u?.name ? `Umpire tendencies for ${u.name}` : 'Umpire tendencies'} onClose={onClose}>
      <div className="lump__id">
        <span className="lump__plate" aria-hidden="true">
          <HomePlateIcon size={22} />
        </span>
        <div>
          <small className="lump__role">{plate ? 'Home plate' : 'Plate record'}</small>
          <strong className="lump__name">{u?.name ?? (loading ? '…' : '—')}</strong>
          {/* The game count lives in the Regular season header now (Gary, 2026-10-29). */}
          {!season?.called && !loading && <EmptyState size="compact">No plate-accuracy data on file for this umpire yet.</EmptyState>}
        </div>
      </div>
      {season?.called > 0 && (
        <>
          <h4 className="lsheet__head">Regular season · {season.games} {season.games === 1 ? 'game' : 'games'}</h4>
          <dl className="lump__tiles">
            <Tile label="Accuracy" value={pct(season.accuracy)} />
            {rank ? <Tile label="Rank" value={rank.rank} sup={`/${rank.total}`} /> : <Tile label="Called" value={season.called.toLocaleString()} />}
            <Tile label="Consistency" value={pct(season.consistency)} />
            <Tile label="Run impact" value={season.favorPerGame?.toFixed(1) ?? '—'} sup="/gm" />
          </dl>
          {post && (
            <>
              {/* The postseason in the same tiles as the season, under its own head (Gary, 2026-10-29).
                  Still unranked: postseasonPlateLine takes no rank (api/umpires.js). */}
              <h4 className="lsheet__head">Postseason · {post.games} {post.games === 1 ? 'game' : 'games'}</h4>
              <dl className="lump__tiles lump__tiles--three">
                <Tile label="Accuracy" value={post.accuracy} />
                <Tile label="Consistency" value={pct(postSeason.consistency)} />
                <Tile label="Run impact" value={postSeason.favorPerGame?.toFixed(1) ?? '—'} sup="/gm" />
              </dl>
            </>
          )}
          {lean && (
            <>
              <h4 className="lsheet__head">Strike zone</h4>
              <div className="lump__lean" role="img" aria-label={`Strike zone: ${LEAN_TIER_LABELS[lean.tier]}`}>
                <span className="lump__caret" style={{ left: `${leanCaretFraction(lean.z) * 100}%` }} />
                <div className="lump__bar">
                  {LEAN_TIERS.map((t) => (
                    <span key={t} className={`lump__seg${t === lean.tier ? ' is-on' : ''}`}>
                      <small>{LEAN_TIER_LABELS[t]}</small>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          {(watchArea || zoneCells) && (
            <>
              <div className="lump__watch">
                <div>
                  {/* The head rides with its text, beside the tall batter, not above an empty gap (Gary, 2026-10-29). */}
                  <h4 className="lsheet__head">Area to watch</h4>
                  <b>{watchArea ? `${watchArea.phrase}${watchArea.hand ? ` to ${HAND[watchArea.hand]}` : ''}` : 'No clear tendency'}</b>
                  <p className="lump__meta">Batter’s view. Outlined where his misses run above the league average.</p>
                </div>
                {zoneCells && (
                  // The map runs outside -> inside, left to right. A lefty stands on the left from the
                  // pitcher's side, so for him the map is mirrored to put inside next to him.
                  <div className={`lump__zone${watchArea?.hand === 'L' ? ' lump__zone--left' : ''}`}>
                    <UmpireZoneMap cells={zoneCells} />
                    {watchArea?.hand && <WatchBatter hand={watchArea.hand} />}
                  </div>
                )}
              </div>
            </>
          )}
          {challenges?.perGame != null && (
            <>
              <h4 className="lsheet__head">ABS challenges</h4>
              <dl className="lump__tiles lump__tiles--two">
                <Tile label="Per game" value={challenges.perGame.toFixed(1)} />
                <Tile label="Overturned" value={pct(challenges.overturnRate)} />
                {/* The league's rate as the box's own last row, not a footnote under it (Gary, 2026-10-29). */}
                {leagueChallenges?.overturnRate != null && (
                  <div className="lump__tilefoot">
                    <dt>League average</dt>
                    <dd>{pct(leagueChallenges.overturnRate)} overturned</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </>
      )}
      {/* No regular-season tiles to sit beside: the postseason line stands alone. */}
      {post && !(season?.called > 0) && <p className="hint">{post.text}</p>}
      {hpGames.length > 0 && (
        <>
          <h4 className="lsheet__head">Last {hpGames.length} behind the plate</h4>
          <ul className="lump__games">
            <li className="lump__game lump__game--head" aria-hidden="true">
              <span>Date</span>
              <span>Game</span>
              <span>Accuracy</span>
              <span>Consistency</span>
            </li>
            {hpGames.map((g) => (
              <li key={`${g.gamePk}-${g.gameNumber}`} className="lump__game">
                <span>{monthDay(g.date)}</span>
                <button type="button" className="plink" onClick={() => openGame(g)}>
                  {/* Club marks, not abbreviations (Gary, 2026-10-29); the abbreviation stays the name. */}
                  <TeamLogo teamId={g.awayId} name={g.awayAbbr} size={20} /> @ <TeamLogo teamId={g.homeId} name={g.homeAbbr} size={20} />
                  <span className="sr-only">{g.awayAbbr} at {g.homeAbbr}</span>
                  {mixed && (g.level ?? 'MLB') === 'AAA' && <Pill>AAA</Pill>}
                </button>
                <b>{g.row?.called ? `${((g.row.correct / g.row.called) * 100).toFixed(1)}%` : '—'}</b>
                {/* The game's own consistency, as the season tile reads it (consistent / judged). */}
                <span>{g.row?.consistentCalled ? `${((g.row.consistent / g.row.consistentCalled) * 100).toFixed(1)}%` : '—'}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {u && (
        <Door onClick={() => { onClose(); navigate(umpirePath(id, u.name, { seasonYear: u.season ?? seasonYear })) }}>Full umpire page</Door>
      )}
    </SheetFrame>
  )
}
