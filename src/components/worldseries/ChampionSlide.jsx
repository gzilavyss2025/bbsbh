import { fetchSeasonAward } from '../../api/awards/history.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useSeriesLog } from '../../hooks/postseason/useSeriesLog.js'
import { TEAM_COLOR_PAIRS } from '../../lib/colors/brandColors.js'
import { useRouteLink } from '../../lib/nav.js'
import { mvpStatLine, MVP_PHOTOS, mvpPhotoUrl } from '../../lib/postseason/mvpLine.js'
import { decidedHero } from '../../lib/postseason/worldseries/hero.js'
import { seriesMode } from '../../lib/postseason/worldseries/mode.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'

const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']
// The MVP's three figures, in words a reader says: a hitter's average, hits and RBI; a pitcher's first three.
const LABEL = { AVG: 'avg', H: 'hits', RBI: 'RBI', HR: 'homers', BB: 'walks', IP: 'innings', 'W-L': 'record', ERA: 'ERA', K: 'strikeouts', SO: 'strikeouts' }
function threeFigures(stats) {
  const by = Object.fromEntries(stats)
  const pick = by.AVG != null ? ['AVG', 'H', 'RBI'] : stats.slice(0, 3).map(([k]) => k)
  return pick.filter((k) => by[k] != null).map((k) => [by[k], LABEL[k] ?? k])
}

// The decided World Series as a story slide, in the same template as a signing (StoryDeck.jsx): the
// clincher photo full bleed with the headline on it, then the MVP's line and the games on paper.
// The series page keeps its own hero (ChampionHero / DecidedHero).
export function ChampionSlide({ bracket }) {
  const ws = bracket.worldSeries
  const mode = seriesMode(ws)
  const season = bracket.season
  const link = useRouteLink()
  const { data: award } = useAsync(() => fetchSeasonAward('WSMVP', season), [season])
  const { data: log } = useSeriesLog(ws?.games ?? [])
  if (!mode) return null
  const mvp = award?.recipients?.[0] ?? null
  const hero = decidedHero(mode.series, mvp)
  if (!hero) return null
  const winner = teamClubNameShort(hero.winnerId)
  const loserId = mode.series.slots.map((x) => x.club.id).find((id) => id !== hero.winnerId)
  const pair = TEAM_COLOR_PAIRS[hero.winnerId]
  const photo = MVP_PHOTOS[season]
  const figures = mvp ? threeFigures(mvpStatLine(log?.stats?.lines, mvp.playerId)) : []
  const games = hero.days.filter((d) => d.kind === 'game' && d.winnerId)
  return (
    <article className="deck-sign" style={pair ? { '--club-a': pair[0], '--club-b': pair[1] } : undefined} aria-label={`${winner} win the World Series`}>
      <div className="deck-sign__photo">
        {photo && <img src={mvpPhotoUrl(photo.id, 1400).replace('h_1400', 'h_788').replace('g_center', 'g_faces')} alt="" decoding="async" fetchPriority="high" />}
        <div className="deck-sign__cap">
          <h2 className="deck-sign__head">{`${winner} win the World Series`}</h2>
        </div>
      </div>
      <div className="deck-sign__deal">
        {figures.length > 0 && (
          <dl className="deck-sign__terms">
            {figures.map(([v, k]) => <div key={k}><dd>{v}</dd><dt>{k}</dt></div>)}
          </dl>
        )}
        <p className="deck-sign__note">
          {mvp && <><PlayerLink id={mvp.playerId}>{mvp.name}</PlayerLink>{', Series MVP. '}</>}
          {`The ${winner} beat the ${teamClubNameShort(loserId)} in ${WORDS[hero.gamesPlayed] ?? hero.gamesPlayed}.`}
        </p>
        {games.length > 0 && (
          <ol className="deck-games" aria-label="Game by game">
            {games.map((d) => (
              <li key={d.key}>
                <a {...link(d.path)} className="deck-games__game">
                  <span className="deck-games__n">{`G${d.gameNumber}`}</span>
                  <TeamLogo teamId={d.winnerId} name="" size={22} />
                  <span className="sr-only">{`Game ${d.gameNumber}, won by ${teamClubNameShort(d.winnerId)}, lineups`}</span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  )
}
