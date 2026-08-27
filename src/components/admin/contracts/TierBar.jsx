// Region 1 of the contract identity workbench: the three tabs, the progress
// count, and the shortcut sheet.
//
// The tabs are the three MODES, not the three confidence tiers, because a tier
// does not tell a reviewer what they are about to be asked. Every fuzzy row
// already has somebody assigned, so that tier is one question — is this right.
// Ambiguous and unresolved-with-a-shortlist are the same question as each
// other, so they share a tab. What is left has no shortlist at all.
import { MODES, MODE_CHOOSE, MODE_COLD, MODE_CONFIRM, MODE_LABEL } from '../../../lib/admin/contractGroups.js'

const BLURB = {
  [MODE_CONFIRM]: 'already assigned',
  [MODE_CHOOSE]: 'pick from a shortlist',
  [MODE_COLD]: 'nothing to rank',
}

const SHORTCUTS = [
  ['↓ ↑', 'Next / previous group'],
  ['1 – 9', 'Pick that candidate'],
  ['Enter', 'Primary action for the group — again to move on'],
  ['Shift + Enter', 'Primary action, this row only'],
  ['X', 'No match exists'],
  ['S', 'Skip to the next group'],
  ['/', 'Search the record deck'],
  ['?', 'This sheet'],
  ['Esc', 'Close the sheet, or leave a text box'],
]

export function TierBar({
  mode,
  onMode,
  counts,
  sessionResolved,
  resolvedTotal,
  totalRows,
  showReviewed,
  onShowReviewed,
  shortcutsOpen,
  onShortcuts,
}) {
  return (
    <header className="cwb__tierbar">
      <div className="cwb__tabs" role="tablist" aria-label="Review mode">
        {MODES.map((m) => {
          const c = counts[m] ?? { open: 0, rows: 0, openGroups: 0 }
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={m === mode}
              className={`cwb__tab${m === mode ? ' cwb__tab--on' : ''}`}
              onClick={() => onMode(m)}
            >
              <span className="cwb__tabname">{MODE_LABEL[m]}</span>
              <span className="cwb__tabcount caps-exempt">
                {c.open} open · {c.openGroups} groups
              </span>
              <span className="cwb__tabblurb caps-exempt">{BLURB[m]}</span>
            </button>
          )
        })}
      </div>

      <div className="cwb__progress">
        <p className="cwb__progressline caps-exempt">
          {sessionResolved} resolved this session · {resolvedTotal} of {totalRows} rows reviewed
        </p>
        <label className="cwb__toggle caps-exempt">
          <input
            type="checkbox"
            checked={showReviewed}
            onChange={(e) => onShowReviewed(e.target.checked)}
          />{' '}
          Show reviewed groups
        </label>
        <button
          type="button"
          className="cwb__disclose"
          aria-expanded={shortcutsOpen}
          onClick={() => onShortcuts(!shortcutsOpen)}
        >
          ? Shortcuts
        </button>
      </div>

      {shortcutsOpen && (
        <dl className="cwb__sheet">
          {SHORTCUTS.map(([key, what]) => (
            <div key={key} className="cwb__sheetrow">
              <dt className="cwb__key">{key}</dt>
              <dd className="cwb__what caps-exempt">{what}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}
