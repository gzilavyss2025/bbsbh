import '../../styles/26g-command-received.css'
import { useState } from 'react'
import { CAUSATION_NOTE, commandReceivedFor } from '../../api/commandReceived.js'
import { attributionFor } from '../../api/targetCommand.js'
import { PlayerLink } from '../player/PlayerLink.jsx'

// COMMAND RECEIVED — the staff that threw to this catcher, ranked by how close
// they finished to his target while he was the one holding it.
//
// A PLAIN RANKED LIST, not a chart, and deliberately so. The other two
// OpenCommand cards on this app are a pitcher's own: a strip of ranks and a
// cloud of dots. This one is a roster read — "who hit the spot for him, and who
// did not" — and the honest form for a ranked list of names is a ranked list of
// names. There is no new visualisation primitive here and none is wanted.
//
// THE FOOTER IS THE POINT, NOT A DISCLAIMER. A list of pitchers under a
// catcher's name reads as a catcher's skill unless something says otherwise,
// and this figure is mostly the PITCHER's own aim. So the sentence naming that
// is required copy (api/commandReceived.js's CAUSATION_NOTE) and it is printed,
// not tucked into a tooltip nobody on a phone can open.
//
// THE BAR IS THE CATCHER'S OWN SEASON, not the league. Each row's mark sits
// left or right of the median of every pitch thrown to HIM, so the list reads
// as "sharper than the rest of this staff" rather than as a league ranking —
// which is the pitcher's own Target Command card's job, and which this list
// would be quietly mistaken for if it borrowed a league scale.
//
// Renders nothing for a player who never caught, a season outside OpenCommand's
// coverage, or a catcher with no arm over the pitch floor.

// Enough to read the shape of a staff without turning the tab into a table. A
// catcher's list runs to 27 arms; the rest open on request.
const PREVIEW_ROWS = 8

export function CommandReceivedCard({ data, personId, season }) {
  const [all, setAll] = useState(false)
  const view = commandReceivedFor(data, personId, season)
  if (!view) return null

  const credit = attributionFor(data)
  const rows = all ? view.pitchers : view.pitchers.slice(0, PREVIEW_ROWS)
  const hidden = view.pitchers.length - rows.length
  // The widest miss on the list sets the bar scale, so the longest bar always
  // reaches the end of its track and a staff that clusters tightly still reads
  // as a spread rather than as eight identical stubs.
  const worst = Math.max(...view.pitchers.map((p) => p.miss))
  const best = Math.min(...view.pitchers.map((p) => p.miss))
  const span = worst - best || 1

  return (
    <div className="cmdrecv">
      <h3 className="section__title">
        <span>Command received</span>
        <em>inches from his target</em>
      </h3>

      <p className="cmdrecv__season">
        <strong>{view.miss}&#8243;</strong> across {view.pitches.toLocaleString()} pitches caught
      </p>

      <ol className="cmdrecv__list">
        {rows.map((p) => (
          <li key={p.id} className="cmdrecv__row">
            <span className="cmdrecv__rank">{p.rank}</span>
            <span className="cmdrecv__name">
              <PlayerLink id={p.id}>{p.name}</PlayerLink>
            </span>
            <span className="cmdrecv__track" aria-hidden="true">
              <span
                className={`cmdrecv__bar${p.better ? ' cmdrecv__bar--better' : ''}`}
                style={{ '--bar-width': `${Math.max(6, ((p.miss - best) / span) * 100)}%` }}
              />
            </span>
            <span className="cmdrecv__miss">{p.miss.toFixed(1)}</span>
            <span className="cmdrecv__n">{p.pitches.toLocaleString()}</span>
          </li>
        ))}
      </ol>

      {hidden > 0 && (
        <button type="button" className="plink cmdrecv__more" onClick={() => setAll(true)}>
          All {view.pitchers.length} pitchers &#8250;
        </button>
      )}

      <p className="cmdrecv__note">{CAUSATION_NOTE}</p>

      <p className="pctstrip__source cmdrecv__source">
        <a href={credit.href} rel="noreferrer noopener" target="_blank">
          {credit.text}
        </a>
      </p>
    </div>
  )
}
