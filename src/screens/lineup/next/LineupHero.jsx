import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { TeamTreatmentMark } from '../../../components/logo/TeamTreatmentMark.jsx'
import { SeriesMark } from '../../../components/postseason/SeriesMark.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { useRouteLink } from '../../../lib/nav.js'
import { useGameNotes } from '../useGameNotes.js'

const ShirtIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-1 2-7 2-8 0Z" />
  </svg>
)

// The band over the hero: the club's mono mark, the series mark and game number of a
// postseason game ("Regular season" otherwise), and a tag at the right: the series tally
// (a round's tally, never a score of this game) or "Game 4 of 4" for a regular-season series.
// The paint is the theme's (.sectionhead--band reads --bar-fill and friends, ADR-0030).
function HeroBand({ id, series, position }) {
  const routeLink = useRouteLink()
  const { meta, masthead, season } = id
  const tag = series ? series.status?.replace(/^Game \d+ · /, '') : position ? `Game ${position.n} of ${position.of}` : ''
  const title = series ? (series.gameNumber ? `Game ${series.gameNumber}` : 'Postseason') : 'Regular season'
  const lead = series && <SeriesMark mark={series.mark} height={34} decorative />
  const label = (
    <>
      {lead}
      <b className="lband__title">{title}</b>
    </>
  )
  return (
    // component-reuse-exempt: the band's mark sits left and a tag right, which SectionHead's layout cannot say
    <div className="sectionhead--band lband">
      <span className="lband__mk">
        <TeamLogo
          teamId={meta.id}
          name={meta.name}
          size={26}
          variant="mono"
          crop="bar"
          overrideUrl={masthead.url}
          season={season}
          className={`sectionhead__mark${masthead.url ? ' sectionhead__mark--custom' : ''}`}
        />
        {series?.href ? (
          <a className="lband__link" aria-label={`${series.mark.alt}: open the series page`} {...routeLink(series.href)}>
            {label}
          </a>
        ) : (
          label
        )}
      </span>
      {tag && <span className="lband__tag">{tag}</span>}
    </div>
  )
}

// First pitch, Game Notes and MLB.TV as one box: a row on a phone, a column on a wide screen.
function HeroActions({ feed, side, id, info, gamePk }) {
  const notes = useGameNotes(feed, side)
  const { meta, season } = id
  return (
    <div className="lact">
      <div className="lact__stamp">
        <span className="lact__stamplabel">First pitch</span>
        <b className="lact__stamptime">{info.firstPitch || info.scheduledTime || '—'}</b>
      </div>
      {notes && (
        <a
          className="lact__notes"
          href={notes.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${notes.title}: the club's official press notes (PDF), opens in a new tab`}
        >
          <TeamLogo teamId={meta.id} name="" size={20} season={season} />
          <span className="lact__label">Game notes</span>
          <span className="lact__arrow" aria-hidden="true">↗</span>
        </a>
      )}
      {gamePk && (
        <a className="lact__tv" href={`https://www.mlb.com/tv/g${gamePk}`} target="_blank" rel="noopener noreferrer" title="Watch this game on MLB.TV">
          <img className="lact__tvlogo" src="/icons/mlbtv-logo.svg" alt="Watch on MLB.TV" />
          <svg className="lact__play" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M19 14l16 10-16 10z" fill="currentColor" />
          </svg>
          <span className="lact__watch" aria-hidden="true">▶ Watch</span>
          <span className="lact__arrow" aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}

// The page's top card: the band, the crest on the club's tile (a tap opens the uniform sheet),
// the name and matchup line, the action box, then the fact strips passed as children.
// Identity and schedule only; nothing here is a score.
export function LineupHero({ id, side, treatment, info, series, position, gamePk, feed, onCrest, children }) {
  const { meta, oppMeta, season } = id
  return (
    <Card as="div" frame="stamped" body="flush" stampIn className="lnext__hero">
      <HeroBand id={id} series={series} position={position} />
      <div className="lnext__id">
        <button type="button" className="lnext__crestbtn" onClick={onCrest} aria-label={`Uniform and marks for ${meta.name}`}>
          <TeamTreatmentMark teamId={meta.id} name={meta.name} treatment={treatment} side={side} size={96} block="lnext__crest" season={season} />
          <span className="lnext__badge" aria-hidden="true">
            <ShirtIcon />
          </span>
        </button>
        <div className="lnext__who">
          <p className="lnext__role">{side === 'away' ? 'Away' : 'Home'} · Lineup</p>
          <h1 className="lnext__name">
            <TeamLink id={meta.id}>{meta.name || 'Team'}</TeamLink>
          </h1>
          <p className="lnext__vs">
            {side === 'away' ? 'At' : 'Vs'} {oppMeta.name}
          </p>
        </div>
      </div>
      <HeroActions feed={feed} side={side} id={id} info={info} gamePk={gamePk} />
      {children}
    </Card>
  )
}
