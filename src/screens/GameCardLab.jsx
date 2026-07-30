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
    inning: { number: 7, half: 'bottom' },
    away: { id: 158, abbreviation: 'MIL', location: 'Milwaukee', mascot: 'Brewers', runs: 4, hits: 7, errors: 0 },
    home: { id: 109, abbreviation: 'AZ', location: 'Arizona', mascot: 'D-backs', runs: 2, hits: 5, errors: 1 },
  },
  {
    id: 'delay',
    state: 'delay',
    status: 'Rain delay',
    inning: { number: 5, half: 'top' },
    away: { id: 112, abbreviation: 'CHC', location: 'Chicago', mascot: 'Cubs', runs: 1, hits: 4, errors: 0 },
    home: { id: 138, abbreviation: 'STL', location: 'St. Louis', mascot: 'Cardinals', runs: 1, hits: 3, errors: 0 },
  },
  {
    id: 'final',
    state: 'final',
    status: 'Game complete',
    inning: { label: 'Final' },
    away: { id: 136, abbreviation: 'SEA', location: 'Seattle', mascot: 'Mariners', runs: 5, hits: 9, errors: 1 },
    home: { id: 140, abbreviation: 'TEX', location: 'Texas', mascot: 'Rangers', runs: 3, hits: 6, errors: 0 },
  },
  {
    id: 'extras',
    state: 'extras',
    status: 'Extra innings',
    inning: { label: 'Final 12' },
    away: { id: 121, abbreviation: 'NYM', location: 'New York', mascot: 'Mets', runs: 6, hits: 11, errors: 0 },
    home: { id: 144, abbreviation: 'ATL', location: 'Atlanta', mascot: 'Braves', runs: 5, hits: 10, errors: 1 },
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
          The selected Ledger Rail treatment, using the live slate card’s existing
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

      <section className="gamecardlab__variant" data-testid="game-card-variant-ledger">
        <header className="gamecardlab__varianthead">
          <h2>Ledger rail</h2>
          <p>Runs, hits, and errors read across ruled scorebook rows; arrows mark the active half.</p>
        </header>
        <div className="gamecardlab__stack">
          {LAB_GAMES.map((game) => (
            <LabGameCard key={game.id} game={game} scoresUnlocked={scoresUnlocked} />
          ))}
        </div>
      </section>
    </main>
  )
}

function LabGameCard({ game, scoresUnlocked }) {
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

      {scoresUnlocked && <LedgerScore game={game} />}

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
      <div
        className="scoreledger__table"
        role="table"
        aria-label={`${game.away.abbreviation} ${game.away.runs}, ${game.home.abbreviation} ${game.home.runs}`}
      >
        <div className="scoreledger__header" role="row" aria-hidden="true">
          <span />
          <span>R</span>
          <span>H</span>
          <span>E</span>
        </div>
        {[game.away, game.home].map((team) => (
          <div className="scoreledger__row" role="row" key={team.id}>
            <span className="scoreledger__abbr" role="rowheader">{team.abbreviation}</span>
            <span className="scoreledger__number scoreledger__number--runs" role="cell">{team.runs}</span>
            <span className="scoreledger__number" role="cell">{team.hits}</span>
            <span className="scoreledger__number" role="cell">{team.errors}</span>
          </div>
        ))}
      </div>
      <div className="scoreledger__edge">
        <StateMark game={game} />
        <InningMark inning={game.inning} />
      </div>
    </div>
  )
}

function InningMark({ inning }) {
  if (inning.label) return <span className="scoreledger__inning">{inning.label}</span>
  const top = inning.half === 'top'
  const label = `${top ? 'Top' : 'Bottom'} ${inning.number}`
  return (
    <span className="scoreledger__inning" aria-label={label}>
      <span className="scoreledger__arrow" aria-hidden="true">{top ? '▲' : '▼'}</span>
      {inning.number}
    </span>
  )
}
