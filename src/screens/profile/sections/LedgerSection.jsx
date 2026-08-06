import { useNav } from '../../../lib/nav.js'
import { logbookPath } from '../../../lib/route.js'

// The progress ledger — a ruled scorebook column of counts, in mono tabular
// figures.
//
// **Counts of your own things are the only numbers this page shows.** A stamp
// total, a number of games you have open, a number of days you agreed to see:
// each is a fact about you, and none of them came out of a ballpark. There is
// no game named here, no date's outcome, no matchup, no score — and there never
// may be (PRD §0 and invariants P6/P10). The ledger deliberately reads no game
// facts to produce these: the stamp count comes from your local collection, the
// games count from counting reveal KEY NAMES (never their values), the day
// count from the consent list.
//
// The Game Log row says **Game Log** and links to `/logbook`. "Logbook" is the
// code name only — route, modules, CSS classes and storage keys keep it; every
// user-visible string says Game Log (docs/game-log.md §2).
export function LedgerSection({ stampCount, gameCount, spoiledDayCount }) {
  const navigate = useNav()
  return (
    <section className="mytally__section">
      <h2 className="mytally__sectiontitle">Your ledger</h2>
      <dl className="mytally__ledger">
        <div className="mytally__ledgerrow">
          <dt>Games in your pencil</dt>
          <dd>{gameCount}</dd>
        </div>
        <div className="mytally__ledgerrow">
          <dt>Stamps in your Game Log</dt>
          <dd>{stampCount}</dd>
        </div>
        <div className="mytally__ledgerrow">
          <dt>Days you unsealed</dt>
          <dd>{spoiledDayCount}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="mytally__inlinebtn"
        onClick={() => navigate(logbookPath())}
      >
        Open your Game Log
      </button>
    </section>
  )
}
