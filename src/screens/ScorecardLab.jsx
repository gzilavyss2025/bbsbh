import { useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { Scorecard } from './Scorecard.jsx'

// Hidden dev harness for building the Numbers Game "22" scorecard in isolation —
// reached at /scorecard-lab, linked from nowhere in the app. It feeds the sheet
// mock, spoiler-free data only (no feed, no network), so it renders anywhere,
// including the sandbox, and lets us iterate on the layout and look-and-feel
// before wiring the finished sheet into the game view (see the milestone plan).
export function ScorecardLab() {
  useDocumentTitle('Scorecard Lab')
  const [side, setSide] = useState('top')

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Scorecard Lab</h1>
      </header>
      <p className="hint">
        Milestone 1 — the empty Numbers Game “22” template. A dev harness; not
        linked anywhere in the app.
      </p>

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

      <Scorecard side={side} />
    </div>
  )
}
