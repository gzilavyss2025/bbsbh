import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { TeamTreatmentMark } from '../../../components/logo/TeamTreatmentMark.jsx'
import { SeriesMark } from '../../../components/postseason/SeriesMark.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { GameNotesButton } from '../../TeamInfo.jsx'
import { useRouteLink } from '../../../lib/nav.js'

// The band over the hero: the series mark and game number of a postseason game, "Regular
// season" otherwise, and the series status (a round's tally, never a score of this game).
function HeroBandHead({ series, mark }) {
  const routeLink = useRouteLink()
  // The band names the game; the note keeps the series tally without repeating the number.
  const status = series?.status?.replace(/^Game \d+ · /, '')
  const title = series ? series.gameNumber ? `Game ${series.gameNumber}` : 'Postseason' : 'Regular season'
  const lead = series && <SeriesMark mark={series.mark} height={34} decorative />
  return (
    <SectionHead look="band" as="span" className="lnext__bandhead" note={status || undefined} mark={mark}>
      {series?.href ? (
        <a className="lnext__serieslink" aria-label={`${series.mark.alt}: open the series page`} {...routeLink(series.href)}>
          {lead}
          {title}
        </a>
      ) : (
        <>
          {lead}
          {title}
        </>
      )}
    </SectionHead>
  )
}

// The page's top card: club band, the crest on the tonight-treatment tile, the name and the
// matchup line, then the first-pitch stamp with Game Notes and MLB.TV. The crest opens the
// club's sketch sheet. Identity and schedule only; nothing here is a score.
export function LineupHero({ id, side, treatment, info, series, gamePk, feed, onCrest, children }) {
  const { meta, oppMeta, masthead, season } = id
  return (
    <Card as="div" frame="stamped" body="flush" stampIn className="lnext__hero">
      <HeroBandHead
        series={series}
        mark={
          <TeamLogo
            teamId={meta.id}
            name={meta.name}
            size={22}
            variant="mono"
            crop="bar"
            overrideUrl={masthead.url}
            season={season}
            className={`sectionhead__mark${masthead.url ? ' sectionhead__mark--custom' : ''}`}
          />
        }
      />
      <div className="lnext__id">
        <button type="button" className="lnext__crestbtn" onClick={onCrest} aria-label={`Uniform and marks for ${meta.name}`}>
          <TeamTreatmentMark teamId={meta.id} name={meta.name} treatment={treatment} side={side} size={96} block="lnext__crest" season={season} />
        </button>
        <div className="lnext__who">
          <p className="lnext__role">{side === 'away' ? 'Away' : 'Home'} · Lineup</p>
          <h1 className="lnext__name">
            <TeamLink id={meta.id}>{meta.name || 'Team'}</TeamLink>
          </h1>
          <p className="lnext__vs">
            {side === 'away' ? '@' : 'vs'}
            <TeamLogo teamId={oppMeta.id} name={oppMeta.name} size={20} season={season} />
            {oppMeta.name}
          </p>
        </div>
      </div>
      <div className="lnext__side">
        <div className="lnext__stamp">
          <span className="lnext__stamplabel">First pitch</span>
          <b className="lnext__stamptime">{info.firstPitch || info.scheduledTime || '—'}</b>
        </div>
        <GameNotesButton feed={feed} side={side} />
        {gamePk && (
          <a
            className="lnext__watch"
            href={`https://www.mlb.com/tv/g${gamePk}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Watch this game on MLB.TV"
          >
            <img className="lnext__watchlogo" src="/icons/mlbtv-logo.svg" alt="Watch on MLB.TV" />
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      {children}
    </Card>
  )
}
