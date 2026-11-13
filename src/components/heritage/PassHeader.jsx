import { useState } from 'react'
import { leagueMarkUrl } from '../passport/leagueMarks.js'
import { SecondaryMark } from './SecondaryMark.jsx'
import { passRecordText } from '../../lib/heritage/pass.js'
import { Stack } from '../ui/layout/Stack.jsx'

export function PassHeader({ game, model, records }) {
  const [failed, setFailed] = useState(null)
  const markUrl = leagueMarkUrl(model.leagueMark)
  const occasion = model.classification
    ? [model.levelName, model.postseason ? model.occasion : ''].filter(Boolean).join(' · ')
    : model.occasion
  return (
    <header className="heritagepass__head">
      <div className="heritagepass__league" aria-label={model.competition}>
        <PassClub side="away" game={game} record={records?.away} />
        <span className="heritagepass__league-emblem">
          {markUrl && failed !== markUrl ? (
            <img src={markUrl} alt={model.competition} onError={() => setFailed(markUrl)} />
          ) : <span>{model.leagueMark === 'mlb' ? 'MLB' : model.leagueMark === 'milb' ? 'MiLB' : model.competition}</span>}
        </span>
        <PassClub side="home" game={game} record={records?.home} />
      </div>
      {occasion && (
        <div className="heritagepass__ribbon">
          {/* A banner (Gary, 2026-11-12): swallow-tail ends folded behind a cream
              band with a fine inner border; the folds are the only solid ink. */}
          <svg viewBox="0 0 320 44" preserveAspectRatio="none" aria-hidden="true">
            <path d="M1 12 H30 V42 H1 L12 27 Z" fill="var(--bg-canvas)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M319 12 H290 V42 H319 L308 27 Z" fill="var(--bg-canvas)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M18 36 L30 42 V36 Z M302 36 L290 42 V36 Z" fill="currentColor" />
            <rect x="18" y="2" width="284" height="34" fill="var(--bg-canvas)" stroke="currentColor" strokeWidth="1.5" />
            <rect x="22.5" y="6.5" width="275" height="25" fill="none" stroke="currentColor" strokeWidth="0.75" />
          </svg>
          <p className="heritagepass__occasion">
            {occasion}{(model.seriesGame ?? model.seasonGame) && ` · Game ${model.seriesGame ?? model.seasonGame}`}
          </p>
        </div>
      )}
    </header>
  )
}

function PassClub({ side, game, record }) {
  const team = game[side]
  const text = passRecordText(record)
  return (
    <Stack gap="tight" className="heritagepass__club">
      <SecondaryMark key={`${side}-${team.id}`} team={team} date={game.date} />
      {text && <span className="heritagepass__record" aria-label={`${team.name || team.abbreviation} record ${text}`}>{text}</span>}
    </Stack>
  )
}
