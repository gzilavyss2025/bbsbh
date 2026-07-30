import { useState } from 'react'
import { TeamTreatmentMark } from '../components/TeamTreatmentMark.jsx'
import { TallyLockup } from '../components/TallyBrand.jsx'
import { defaultTreatmentFor } from '../lib/teams.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'

const LAB_GAMES = [
  {
    id: 'live',
    state: 'live',
    status: 'Live',
    inning: 'Bot 7',
    away: { id: 158, abbreviation: 'MIL', location: 'Milwaukee', mascot: 'Brewers', score: 4 },
    home: { id: 109, abbreviation: 'AZ', location: 'Arizona', mascot: 'D-backs', score: 2 },
  },
  {
    id: 'delay',
    state: 'delay',
    status: 'Rain delay',
    inning: 'Mid 5',
    away: { id: 112, abbreviation: 'CHC', location: 'Chicago', mascot: 'Cubs', score: 1 },
    home: { id: 138, abbreviation: 'STL', location: 'St. Louis', mascot: 'Cardinals', score: 1 },
  },
  {
    id: 'final',
    state: 'final',
    status: 'Game complete',
    inning: 'Final',
    away: { id: 136, abbreviation: 'SEA', location: 'Seattle', mascot: 'Mariners', score: 5 },
    home: { id: 140, abbreviation: 'TEX', location: 'Texas', mascot: 'Rangers', score: 3 },
  },
  {
    id: 'extras',
    state: 'extras',
    status: 'Extra innings',
    inning: 'Final 12',
    away: { id: 121, abbreviation: 'NYM', location: 'New York', mascot: 'Mets', score: 6 },
    home: { id: 144, abbreviation: 'ATL', location: 'Atlanta', mascot: 'Braves', score: 5 },
  },
]

const VARIANTS = [
  {
    id: 'ledger',
    label: 'A · Ledger rail',
    note: 'Ruled rows make each club and score read like a compact scorebook entry.',
  },
  {
    id: 'stamp',
    label: 'B · Scorer stamp',
    note: 'A clipped status docket separates game state from a bolder, horizontal score.',
  },
]

export function GameCardLab() {
  useDocumentTitle('Scores Unlocked Card Lab')
  const [scoresUnlocked, setScoresUnlocked] = useState(true)

  return (
    <main className="screen screen--gamecardlab">
      <header className="gamecardlab__header">
        <TallyLockup height={24} />
        <span className="gamecardlab__kicker">Dev-only card study</span>
        <h1>Scores Unlocked</h1>
        <p>
          Two restrained score treatments using the live slate card’s existing
          proportions, uniform-linked logo tiles, and paper-scorebook language.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={scoresUnlocked}
          className={`daystate__chip daystate__chip--live${
            scoresUnlocked ? ' daystate__chip--live-on' : ''
          }`}
          onClick={() => setScoresUnlocked((value) => !value)}
          data-testid="game-card-lab-unlock"
        >
          <span className="daystate__dot" aria-hidden="true" />
          Scores Unlocked · {scoresUnlocked ? 'On' : 'Off'}
        </button>
        <p className="gamecardlab__gate-note" role="status">
          {scoresUnlocked
            ? 'Score treatments are mounted for this consented lab view.'
            : 'Score treatments are absent from the DOM.'}
        </p>
      </header>

      <div className="gamecardlab__compare" aria-label="Game card design variants">
        {VARIANTS.map((variant) => (
          <section
            className={`gamecardlab__variant gamecardlab__variant--${variant.id}`}
            key={variant.id}
            data-testid={`game-card-variant-${variant.id}`}
          >
            <header className="gamecardlab__varianthead">
              <h2>{variant.label}</h2>
              <p>{variant.note}</p>
            </header>
            <div className="gamecardlab__stack">
              {LAB_GAMES.map((game) => (
                <LabGameCard
                  key={game.id}
                  game={game}
                  variant={variant.id}
                  scoresUnlocked={scoresUnlocked}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

function LabGameCard({ game, variant, scoresUnlocked }) {
  return (
    <article className={`gamecard gamecardlab__card gamecardlab__card--${game.state}`}>
      <div className="gamecard__teams">
        <span className="gamecard__atmark" aria-hidden="true">
          <span className="gamecard__atmark-ghost">@</span>
          <span className="gamecard__atmark-ink">@</span>
        </span>
        <LabTeamMark team={game.away} side="away" />
        <LabTeamMark team={game.home} side="home" />
        <LabTeamName team={game.away} side="away" />
        <LabTeamName team={game.home} side="home" />
      </div>

      {scoresUnlocked &&
        (variant === 'ledger' ? (
          <LedgerScore game={game} />
        ) : (
          <StampScore game={game} />
        ))}

      <div className="gamecard__meta gamecardlab__meta">
        <span>MLB</span>
        <span className="gamecard__metaright">
          {game.state === 'live'
            ? 'Live'
            : game.state === 'delay'
              ? 'Delayed'
              : 'Final'}
        </span>
      </div>
    </article>
  )
}

function LabTeamMark({ team, side }) {
  return (
    <TeamTreatmentMark
      teamId={team.id}
      name={`${team.location} ${team.mascot}`}
      treatment={defaultTreatmentFor(team.id, side, '2026-07-30')}
      side={side}
      size={56}
      block="gamecard__logobox"
      className={`gamecard__logobox--${side}`}
    />
  )
}

function LabTeamName({ team, side }) {
  return (
    <span className={`gamecard__name gamecard__name--${side}`}>
      <span className="gamecard__loc">{team.location}</span>
      <span className="gamecard__mascot">{team.mascot}</span>
    </span>
  )
}

function StateMark({ game, className = '' }) {
  return (
    <span className={`gamecardlab__state gamecardlab__state--${game.state} ${className}`}>
      {game.status}
    </span>
  )
}

function LedgerScore({ game }) {
  return (
    <div className="scoreledger" data-testid="lab-score-treatment">
      <div className="scoreledger__rows">
        {[game.away, game.home].map((team) => (
          <div className="scoreledger__row" key={team.id}>
            <span className="scoreledger__abbr">{team.abbreviation}</span>
            <span className="scoreledger__rule" aria-hidden="true" />
            <span className="scoreledger__number">{team.score}</span>
          </div>
        ))}
      </div>
      <div className="scoreledger__edge">
        <StateMark game={game} />
        <span className="scoreledger__inning">{game.inning}</span>
      </div>
    </div>
  )
}

function StampScore({ game }) {
  return (
    <div className="scorestamp" data-testid="lab-score-treatment">
      <div className="scorestamp__docket">
        <StateMark game={game} />
        <span className="scorestamp__inning">{game.inning}</span>
      </div>
      <div className="scorestamp__score" aria-label={`${game.away.abbreviation} ${game.away.score}, ${game.home.abbreviation} ${game.home.score}`}>
        <span className="scorestamp__team">
          <span>{game.away.abbreviation}</span>
          <strong>{game.away.score}</strong>
        </span>
        <span className="scorestamp__divider" aria-hidden="true" />
        <span className="scorestamp__team">
          <span>{game.home.abbreviation}</span>
          <strong>{game.home.score}</strong>
        </span>
      </div>
    </div>
  )
}
