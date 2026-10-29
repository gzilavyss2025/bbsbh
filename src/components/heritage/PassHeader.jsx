import { useState } from 'react'
import { leagueMarkUrl } from '../passport/leagueMarks.js'
import { SecondaryMark } from './SecondaryMark.jsx'

export function PassHeader({ game, model }) {
  const [failed, setFailed] = useState(null)
  const markUrl = leagueMarkUrl(model.leagueMark)
  const occasion = model.classification
    ? [model.levelName, model.postseason ? model.occasion : ''].filter(Boolean).join(' · ')
    : model.occasion
  return (
    <header className="heritagepass__head">
      <div className="heritagepass__league" aria-label={model.competition}>
        <SecondaryMark key={`away-${game.away.id}`} team={game.away} date={game.date} />
        <span className="heritagepass__league-emblem">
          {markUrl && failed !== markUrl ? (
            <img src={markUrl} alt={model.competition} onError={() => setFailed(markUrl)} />
          ) : <span>{model.leagueMark === 'mlb' ? 'MLB' : model.leagueMark === 'milb' ? 'MiLB' : model.competition}</span>}
        </span>
        <SecondaryMark key={`home-${game.home.id}`} team={game.home} date={game.date} />
      </div>
      {occasion && (
        <div className="heritagepass__ribbon">
          <svg viewBox="0 0 310 38" preserveAspectRatio="none" aria-hidden="true">
            <path d="M16 2 H294 L303 10 L309 19 L303 28 L294 36 H16 L7 28 L1 19 L7 10 Z" fill="var(--bg-canvas)" stroke="currentColor" strokeWidth="1.5" />
            <path d="M18 6 H292 M18 32 H292" fill="none" stroke="currentColor" strokeWidth="0.4" />
          </svg>
          <p className="heritagepass__occasion">
            {occasion}{model.seriesGame && ` · Game ${model.seriesGame}`}
          </p>
        </div>
      )}
    </header>
  )
}
