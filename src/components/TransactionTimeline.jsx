import { Fragment, useState } from 'react'
import { TeamLogo } from './identity/TeamLogo.jsx'
import { PlayerLink } from './identity/PlayerLink.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// Wrap each other-player's name in a trade description with a link to his page.
// `links` are the {id, fullName} of the OTHER players in the swap (resolved by
// the caller); their names appear verbatim in the league's free-text
// description, so a split on the name alternation interleaves the links in.
function linkifyNames(text, links) {
  const named = (links ?? []).filter((p) => p?.id && p.fullName)
  if (!named.length) return text
  const escaped = named.map((p) => p.fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'g'))
  const idByName = new Map(named.map((p) => [p.fullName, p.id]))
  return parts.map((part, i) =>
    idByName.has(part) ? (
      <PlayerLink key={i} id={idByName.get(part)}>{part}</PlayerLink>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

// The career roster-move ledger at the foot of the player page — trades,
// signings, call-ups, options, waivers, releases, injured-list stints, the
// draft and (for a prospect) the climb up the farm system, NEWEST first so it
// reads top-to-bottom as most-recent to least-recent (see api/person.js
// transactionTimelineView for the curation that trims the raw feed's
// number-change / roster-status noise and folds the IL rows into one row per
// stint). Career honors live in the Trophy Case card instead,
// not here. Rendered as a vertical timeline: a graphite rail down the middle
// with a tone-colored node per move — field green when a club gained him, clay
// when one lost him, neutral for a lateral move — the date penciled to its
// left, then a type chip, the club's mark, and the description (with any
// other players in a trade linked to their pages). A year label sits on the
// rail wherever the year turns over.
// Degrades to nothing when no moves survived curation (common off MLB / for a
// raw rookie who's only ever been signed). A long career's full ledger can run
// dozens of rows deep, so it opens collapsed to the most recent VISIBLE_LIMIT
// with a real "show all" action — never an always-open list dominating the
// bottom of the page (same convention as Trophy Case's dense-career collapse).
//
// That collapse STRETCHES rather than truncating blind, because IL stints ride
// this timeline now and a tenured star who hasn't changed clubs in years can
// have nothing else on top: measured against live feeds, five of the top five
// rows are IL stints for Christian Yelich and Mookie Betts, four of five for
// Aaron Judge and Gerrit Cole. Cutting at five would turn a career ledger into
// an injury log for exactly the players most likely to be looked up. So the
// collapsed view runs down to the first roster move, in strict
// reverse-chronological order (never reordered — that would make the dates
// jump), bounded by VISIBLE_CEILING so a long injury run can't prise the card
// open anyway. Worst case in the sample was Yelich, at seven rows.
const VISIBLE_LIMIT = 5
const VISIBLE_CEILING = 8

function collapsedCount(rows) {
  const firstMove = rows.findIndex((r) => r.code !== 'IL')
  if (firstMove < 0) return VISIBLE_LIMIT
  return Math.min(Math.max(VISIBLE_LIMIT, firstMove + 1), VISIBLE_CEILING)
}

export function TransactionTimeline({ rows }) {
  const [expanded, setExpanded] = useState(false)
  if (!rows?.length) return null
  const shown = collapsedCount(rows)
  const dense = rows.length > shown
  const visible = dense && !expanded ? rows.slice(0, shown) : rows
  // Precompute the year-divider flag per row (rather than mutating a `let`
  // while mapping) so this stays a pure render pass.
  const withYearFlag = visible.map((r, i) => ({
    row: r,
    showYear: i === 0 || r.year !== visible[i - 1].year,
  }))
  return (
    <section className="txntl">
      <h3 className="section__title"><span>Transactions</span></h3>
      <ol className="txntl__track">
        {withYearFlag.map(({ row: r, showYear }, i) => {
          return (
            <Fragment key={`${r.date}-${r.code}-${i}`}>
              {showYear && (
                <li className="txntl__yr" aria-hidden="true"><span>{r.year}</span></li>
              )}
              <li className={`txntl__item txntl__item--${r.tone}`}>
                <time className="txntl__date">{monthDay(r.date)}</time>
                <div className="txntl__main">
                  <div className="txntl__head">
                    <span className={`txntl__chip txntl__chip--${r.tone}`}>{r.label}</span>
                    {r.club && (
                      <span className="txntl__club">
                        <TeamLogo teamId={r.club.id} name={r.club.name} size={16} />
                      </span>
                    )}
                  </div>
                  <p className="txntl__desc">{linkifyNames(r.description, r.links)}</p>
                </div>
              </li>
            </Fragment>
          )
        })}
      </ol>
      {dense && (expanded ? (
        <button type="button" className="txntl-collapse" onClick={() => setExpanded(false)}>
          Show fewer
        </button>
      ) : (
        <button type="button" className="txntl-expand" onClick={() => setExpanded(true)}>
          Show all {rows.length} transactions
        </button>
      ))}
    </section>
  )
}
