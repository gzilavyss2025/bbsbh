import { Fragment } from 'react'
import { TeamLogo } from './TeamLogo.jsx'
import { PlayerLink } from './PlayerLink.jsx'

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
// signings, call-ups, options, waivers, releases, the draft, major awards and
// (for a prospect) the climb up the farm system, NEWEST first so it reads
// top-to-bottom as most-recent to least-recent (see api/person.js
// transactionTimelineView for the curation that trims the raw feed's IL /
// number-change noise). Rendered as a vertical timeline: a graphite rail down
// the middle with a tone-colored node per move — field green when a club gained
// him, clay when one lost him, amber for an award, neutral for a lateral move —
// the date penciled to its left, then a type chip, the club's mark, and the
// description (with any other players in a trade linked to their pages). A year
// label sits on the rail wherever the year turns over.
// Degrades to nothing when no moves survived curation (common off MLB / for a
// raw rookie who's only ever been signed).
export function TransactionTimeline({ rows }) {
  if (!rows?.length) return null
  let lastYear = null
  return (
    <section className="txntl">
      <h3 className="section__title"><span>Transactions</span></h3>
      <ol className="txntl__track">
        {rows.map((r, i) => {
          const showYear = r.year !== lastYear
          lastYear = r.year
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
    </section>
  )
}
