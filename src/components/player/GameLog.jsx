import { useState } from 'react'
import { GameLink } from './GameLink.jsx'

// The player page's game-by-game log. A player who split real season time
// between two levels (buildBlock's `otherLevels` gate, api/person/activity.js —
// the same threshold that promotes a second "Current season" tile) gets a
// second, single-level log for the level Game log doesn't lead with, behind a
// toggle pill in the same "MLB only" idiom CareerRegister uses. Own component,
// own state, for the same reason CareerRegister is one: PlayerPage can't add a
// hook past its `if (gate) return gate` loading gate, so per-block toggle state
// has to live in a child instead.
export function GameLog({ gameLog, gameLogAlt, altLevel, note }) {
  const [showAlt, setShowAlt] = useState(false)
  const active = showAlt && gameLogAlt ? gameLogAlt : gameLog
  if (!active) return null

  return (
    <>
      <h3 className="section__title section__title--bar section__title--aside">
        <span>Game log</span>
        <em>{`last ${active.rows.length} · ${note}`}</em>
        {gameLogAlt && (
          <button
            type="button"
            className="mastheadpill"
            aria-pressed={showAlt}
            onClick={() => setShowAlt((v) => !v)}
          >
            <span className="mastheadpill__dot" aria-hidden="true" />
            {altLevel} log
          </button>
        )}
      </h3>
      <ul className="gamelog">
        {active.rows.map((r) => (
          <li className="gamelog__row" key={r.gamePk ?? r.date}>
            <div className="gamelog__meta">
              <span className="gamelog__date">{r.date}</span>
              <span className="gamelog__opp">
                {r.home ? 'vs' : '@'}{' '}
                <GameLink path={r.boxscorePath}>{r.opp}</GameLink>
                {r.level && <span className="gamelog__level">{r.level}</span>}
                {r.qs && <span className="gamelog__qs" title="Quality start">QS</span>}
              </span>
            </div>
            <div className="gamelog__line">{r.line}</div>
          </li>
        ))}
      </ul>
    </>
  )
}
