import { PressureMeter } from '../PressureMeter.jsx'

// One row of the lists under the win-probability plot (SwingLedger,
// TenseList): a button that picks the play on the chart, and a Watch button
// when the play has a clip. `lead` is what sits before the half-inning tag
// (the swing ledger's number and chip; nothing on the tense list). `label` is
// the pick button's whole accessible name, which carries the pressure words,
// since a button's own content is not read (the meter inside is decorative).
export function LedgerRow({ play, active, lead = null, tag, bars, desc, label, watchLabel, watchable, onPick, onWatch }) {
  return (
    <li className={`winprob__ledger-row${active ? ' is-active' : ''}`}>
      <button type="button" className="winprob__ledger-pick" aria-pressed={active} aria-label={label} onClick={() => onPick(play.idx)}>
        <span className="winprob__ledger-meta">
          {lead}
          <span className="t-label">{tag}</span>
          <PressureMeter bars={bars} decorative />
        </span>
        <span className="winprob__ledger-desc">{desc}</span>
      </button>
      {watchable && (
        <button type="button" className="winprob__ledger-watch" aria-label={watchLabel} onClick={onWatch}>
          <span aria-hidden="true">▶</span> Watch
        </button>
      )}
    </li>
  )
}
