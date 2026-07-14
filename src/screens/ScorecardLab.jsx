import { useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useAsync } from '../hooks/useAsync.js'
import { Loader } from '../components/Loader.jsx'
import { Scorecard } from './Scorecard.jsx'
import { loadScorecardGame, scorecardFull } from '../api/loadScorecard.js'

// Hidden dev harness for building the Numbers Game "22" scorecard in isolation —
// reached at /scorecard-lab, linked from nowhere in the app. It renders two ways:
//
//  • Bare (/scorecard-lab) — the empty Milestone 1 template, spoiler-free mock
//    labels only, no network, so it renders anywhere including the sandbox.
//  • With a game (/scorecard-lab?game={gamePk}) — pulls that game's PRE-PITCH
//    reference data (lineup, defense, umpires, starters, header) via
//    api/loadScorecard.js and pencils it in. Only spoiler-free staging data is
//    fetched; the at-bat grid / pitcher line / scoreboard stay blank by hand.
//
// Iterate on layout and look-and-feel here before wiring the finished sheet into
// the game view.

// The `?game=` gamePk the URL arrived with, if any (bare number, e.g. 776001).
function initialGamePk() {
  const raw = new URLSearchParams(window.location.search).get('game') ?? ''
  return /^\d+$/.test(raw) ? raw : ''
}

export function ScorecardLab() {
  useDocumentTitle('Scorecard Lab')
  const [side, setSide] = useState('top')
  // The committed gamePk that's actually loaded (empty = show the template);
  // `draft` is the in-progress input before Load is pressed.
  const [gamePk, setGamePk] = useState(initialGamePk)
  const [draft, setDraft] = useState(initialGamePk)

  const loaded = useAsync(
    () => (gamePk ? loadScorecardGame(gamePk) : Promise.resolve(null)),
    [gamePk],
  )
  const view = gamePk ? scorecardFull(loaded.data, side) : null

  const load = (e) => {
    e.preventDefault()
    const pk = /^\d+$/.test(draft.trim()) ? draft.trim() : ''
    setGamePk(pk)
    // Keep the URL shareable/reloadable without pushing a history entry.
    const url = pk ? `/scorecard-lab?game=${pk}` : '/scorecard-lab'
    window.history.replaceState({}, '', url)
  }

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Scorecard Lab</h1>
      </header>
      <p className="hint">
        A dev harness; not linked anywhere in the app. Load a gamePk to render the
        WHOLE game on the sheet — every plate appearance in its batting-order row ×
        inning cell, plus the linescore. Full-reveal, nothing sealed (this is the
        lab, not the game view). Leave it blank for the empty template.
      </p>

      <form className="sc-labload" onSubmit={load}>
        <label className="sc-labload__label" htmlFor="sc-gamepk">
          gamePk
        </label>
        <input
          id="sc-gamepk"
          className="sc-labload__input"
          inputMode="numeric"
          placeholder="e.g. 776001"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn">
          Load
        </button>
        {gamePk && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setDraft('')
              setGamePk('')
              window.history.replaceState({}, '', '/scorecard-lab')
            }}
          >
            Clear
          </button>
        )}
      </form>

      <div className="sc-labctl" role="group" aria-label="Half of inning">
        <button
          type="button"
          className={`btn ${side === 'top' ? '' : 'btn--ghost'}`}
          aria-pressed={side === 'top'}
          onClick={() => setSide('top')}
        >
          Top
        </button>
        <button
          type="button"
          className={`btn ${side === 'bottom' ? '' : 'btn--ghost'}`}
          aria-pressed={side === 'bottom'}
          onClick={() => setSide('bottom')}
        >
          Bottom
        </button>
      </div>

      {gamePk && loaded.loading && <Loader />}
      {gamePk && loaded.error && (
        <p className="hint hint--error" role="status">
          Couldn’t load game {gamePk}. Check the gamePk and your connection.
        </p>
      )}

      <Scorecard side={side} view={view} />
    </div>
  )
}
