import '../../styles/heritage/pass.css'
import '@fontsource/bungee/latin-400.css'
import { useId, useState } from 'react'
import { factsRecord, heritagePassModel, passCity, yearRecordThrough } from '../../lib/heritage/pass.js'
import { fetchClubSeason } from '../../api/heritage/records.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { stampSeed } from '../../lib/stampArt.js'
import { PassMark } from './PassMark.jsx'
import { PassHeader } from './PassHeader.jsx'

/**
 * Collectible view of existing stamp facts. Mount only inside the box score's
 * revealed body, the owner's passport, or the DEV-only preview (guarded).
 * artwork is optional caller-owned {src, alt?}; this component never resolves,
 * generates, stores or requests a ballpark illustration on its own.
 */
export function HeritagePass({ game, artwork = null }) {
  const id = useId()
  const { favoriteTeamId } = useFavoriteTeam()
  const model = heritagePassModel(game, favoriteTeamId)
  const records = { away: useClubRecord(game, 'away'), home: useClubRecord(game, 'home') }
  if (!model) return null
  const seed = stampSeed(game.gamePk)
  return (
    <figure className="heritagepass" aria-label="Heritage Pass">
      <svg className="heritagepass__frame" viewBox="0 0 360 560" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id={`${id}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed={seed} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <filter id={`${id}-press`} x="-3%" y="-3%" width="106%" height="106%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed={seed} result="edge" />
            <feDisplacementMap in="SourceGraphic" in2="edge" scale="0.75" xChannelSelector="R" yChannelSelector="G" result="impression" />
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={seed + 7} result="pressure" />
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed={seed + 19} result="wear" />
            <feComposite in="wear" in2="pressure" operator="arithmetic" k1="0" k2="0.82" k3="0.18" k4="0" result="unevenWear" />
            <feColorMatrix in="unevenWear" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.2126 0.7152 0.0722 0 0" />
            <feComponentTransfer result="wornInk"><feFuncA type="linear" slope="24" intercept="-15.6" /></feComponentTransfer>
            <feComposite in="impression" in2="wornInk" operator="out" />
          </filter>
        </defs>
        <g filter={`url(#${id}-press)`}>
          <rect x="1" y="1" width="358" height="558" rx="25" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <path d="M26 13 H334 L347 26 V534 L334 547 H26 L13 534 V26 Z" fill="none" stroke="currentColor" strokeWidth="5" />
          <path d="M28 21 H332 L339 28 V532 L332 539 H28 L21 532 V28 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </g>
        <rect className="heritagepass__grain" x="4" y="4" width="352" height="552" rx="22" filter={`url(#${id}-grain)`} opacity="0.16" />
      </svg>
      <div className="heritagepass__body" style={{ filter: `url(#${id}-press)` }}>
        <PassHeader game={game} model={model} records={records} />
        <div className="heritagepass__matchup">
          <PassTeam team={game.away} date={game.date} />
          <span className="heritagepass__at"><span>at</span></span>
          <PassTeam team={game.home} date={game.date} />
        </div>
        <div className="heritagepass__scores" aria-label="Final score">
          <PassScore team={game.away} />
          <span className="heritagepass__bats" aria-hidden="true"><CrossedBats /></span>
          <PassScore team={game.home} />
        </div>
        <PassVenue key={artwork?.src ?? 'no-art'} artwork={artwork} />
        <figcaption className="heritagepass__foot">
          {model.date && <time dateTime={game.date}>{model.date}</time>}
          {game.venue && <span className="heritagepass__park">{game.venue}</span>}
        </figcaption>
      </div>
    </figure>
  )
}

// The club's record after this game. A regular-season pass carries it in its facts;
// a postseason pass (or older facts without it) reads the club's year of games.
function useClubRecord(game, side) {
  const fromFacts = factsRecord(game, side)
  const teamId = game?.[side]?.id
  const season = /^\d{4}/.exec(game?.date ?? '')?.[0]
  const fetchable = !fromFacts && game?.status === 'Final' && teamId && season && game.sportId
  const { data } = useAsync(async () => (fetchable
    ? yearRecordThrough(await fetchClubSeason(teamId, season, game.sportId), teamId, game.gamePk)
    : null), [fetchable, teamId, season, game?.sportId, game?.gamePk])
  return fromFacts ?? data ?? null
}

function PassTeam({ team, date }) {
  const city = passCity(team)
  const splitName = Boolean(team.teamName && city)
  const nickname = (splitName ? team.teamName : team.name) || team.abbreviation || 'Team not posted yet'
  return (
    <div className="heritagepass__team">
      <PassMark team={team} date={date} />
      {splitName && <span className="heritagepass__city">{city}</span>}
      <span className="heritagepass__name">
        {nickname.length <= 14 ? (
          <svg viewBox="0 0 300 88" role="img" aria-label={nickname}>
            <text x="150" y="74" textAnchor="middle" textLength={nickname.length > 7 ? 290 : undefined}
              lengthAdjust="spacingAndGlyphs">{nickname}</text>
          </svg>
        ) : nickname}
      </span>
    </div>
  )
}

function PassScore({ team }) {
  return (
    <span className="heritagepass__score" data-long={String(team.runs).length > 2 || undefined}
      aria-label={`${team.name || team.abbreviation || 'Team'} ${team.runs}`}>
      <svg viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M10 2 H110 L118 10 V70 L110 78 H10 L2 70 V10 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      {team.runs}
    </span>
  )
}

function CrossedBats() {
  return (
    <svg viewBox="0 0 64 64">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M9 5 Q6 4 6 8 L7 12 L51 54 L53 58 L58 53 L54 51 L12 7 Z" />
        <path d="M55 5 Q58 4 58 8 L57 12 L13 54 L11 58 L6 53 L10 51 L52 7 Z" />
        <path d="M9 8 L27 26 M55 8 L37 26" />
      </g>
    </svg>
  )
}

function PassVenue({ artwork }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="heritagepass__venue">
      {artwork?.src && !failed && (
        <img className="heritagepass__art" src={artwork.src} alt={artwork.alt ?? ''} onError={() => setFailed(true)} />
      )}
    </div>
  )
}
