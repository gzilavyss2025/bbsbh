import { useState } from 'react'
import '../../styles/26e-contract-history.css'
import { contractHistoryView } from '../../api/person/contract/history.js'
import { SectionTitle } from '../../screens/player/parts.jsx'
import { teamFullName } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// CONTRACT HISTORY — the money half of a career, season by season, newest
// first. Arbitration cases, extensions, free-agency signings and the season
// salary that followed each of them, back to 1991 where the record starts
// (api/contractsHistory.js, ADR-0067).
//
// This file only draws. Every decision about what a row SAYS — which of the
// four source vocabularies it speaks, how its money reads, and the rows whose
// terms are simply missing — lives in api/person/contract/history.js, where it
// is pure and unit-tested. That split is the same one PlayerContractCard keeps
// with person/contract/view.js beside it.
//
// THE SHAPE IS A LEDGER, NOT A TIMELINE. A career's money is a column of
// figures a reader scans down, comparing one season to the next, so the
// figures line up in a mono column on the right and the deal that caused each
// one sits on the left. The transaction timeline next to it draws a rail and a
// node per move because a move is an event; a salary is a row in a book.
//
// A season carries up to three rows and usually two — the deal, then what the
// deal paid. The club's mark heads the season rather than repeating on every
// row, because the rows inside one season are nearly always the same club's.
//
// Renders NOTHING for a player with no record. Most of the 6,052 players with
// any contract history have a handful of rows, thousands of players have none
// at all, and a player page must be complete without this card.
export function ContractHistoryLedger({ rows }) {
  const [expanded, setExpanded] = useState(false)
  const view = contractHistoryView(rows)
  if (!view.seasons.length) return null

  // WHY THIS COLLAPSES. The deepest career in the data carries 27 rows across
  // 26 seasons, and this is a phone-first page: printed in full, a long career
  // pushes every card under it off the bottom of a very long scroll for a
  // reader who came to see this season. Six seasons is about one screenful on
  // an iPhone, and the newest seasons are the ones a reader is looking for, so
  // the rest stays one tap away — the same "cap the display, never the
  // information" convention the Awards index and the transaction timeline use.
  //
  // The cap only applies when it saves more than a single season: hiding one
  // season behind a control costs a tap and buys two lines of scroll back.
  const dense = view.seasons.length > SEASONS_VISIBLE + 1
  const seasons = dense && !expanded ? view.seasons.slice(0, SEASONS_VISIBLE) : view.seasons

  return (
    <section className="cthist">
      <SectionTitle title="Contract history" note={tally(view)} />
      <ol className="cthist__seasons">
        {seasons.map((season) => (
          <SeasonBlock key={season.season ?? 'undated'} season={season} />
        ))}
      </ol>
      {dense &&
        (expanded ? (
          <button type="button" className="cthist__toggle" onClick={() => setExpanded(false)}>
            Show fewer
          </button>
        ) : (
          <button type="button" className="cthist__toggle" onClick={() => setExpanded(true)}>
            Show all {view.seasons.length} seasons
          </button>
        ))}
    </section>
  )
}

const SEASONS_VISIBLE = 6

// "13 seasons · 21 records" — the aside on the card's own heading, so the
// collapsed view still says how deep the record goes.
function tally(view) {
  const seasons = view.seasons.length
  return `${seasons} ${seasons === 1 ? 'season' : 'seasons'} · ${view.rows} ${view.rows === 1 ? 'record' : 'records'}`
}

// One season: the year and the club that season's deal names, then its rows.
// A season made only of salary rows has no club at all — every salaries row in
// the source carries a null teamId — so the year stands alone rather than
// borrowing a club from a neighbouring season it may not belong to.
function SeasonBlock({ season }) {
  const clubName = season.teamId ? teamFullName(season.teamId) : null
  return (
    <li className="cthist__season">
      <div className="cthist__head">
        <span className="cthist__year">{season.season ?? '—'}</span>
        {season.teamId && (
          <span className="cthist__club">
            <TeamLogo teamId={season.teamId} name={clubName ?? ''} size={18} />
            <span className="cthist__clubname">{clubName}</span>
          </span>
        )}
      </div>
      <ul className="cthist__rows">
        {season.rows.map((row) => (
          <Row key={row.key} row={row} />
        ))}
      </ul>
    </li>
  )
}

// One record. The kind on the left, the figure on the right, and whatever else
// the source recorded on a line beneath both. A row with no figure prints its
// own honest sentence there instead — never an empty line, and never a dash
// standing in for a fact nobody has.
function Row({ row }) {
  // A detail with no key is already a phrase ("club option", "opt-out") and
  // prints on its own; the rest read as label-then-value.
  const supporting = row.details.map((d) => (d.k ? `${d.k} ${d.v}` : d.v)).join(' · ')
  return (
    <li className={`cthist__row cthist__row--${row.kind}`}>
      <span className="cthist__kind">{row.label}</span>
      <span className="cthist__figure">
        {row.headline ? (
          row.amount == null ? row.headline : <data value={row.amount}>{row.headline}</data>
        ) : null}
      </span>
      {(supporting || row.note) && (
        <span className="cthist__sub">
          {supporting}
          {supporting && row.note ? ' · ' : null}
          {row.note && <em className="cthist__none">{row.note}</em>}
        </span>
      )}
      {/* A fuzzy row is one the identity match could not pin to this player
          outright. Saying so is cheaper than a wrong contract read as fact. */}
      {row.confidence === 'fuzzy' && <span className="cthist__fuzzy">Match unconfirmed</span>}
    </li>
  )
}
