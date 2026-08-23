import { useState } from 'react'
import { rankAwards, parseAwardOrder, parseAwardCap } from '../../api/person/awards.js'
import { useCopy } from '../../copy/copyContext.js'
import { useMediaQuery, WIDE_QUERY } from '../../hooks/useMediaQuery.js'
import { teamAbbr, teamFullName, teamLogoUrl } from '../../lib/teams.js'

// Awards — the player page's career-honors section (api/person/awards.js's
// awardsView). Replaces the Trophy Case, which promoted ONE honor to a marquee
// and read two hand-kept major-league allowlists, so a decorated career showed
// a fragment of itself and a prospect's showed nothing at all.
//
// The shape is MLB.com's, deliberately: one table per award, columns Year /
// Team / MLB, the club and its parent MLB org printed on EVERY row rather than
// collapsed into a run. Nine identical "Los Angeles Angels · LAA" lines under a
// nine-time Silver Slugger is not redundancy to design away — it is the table
// saying, row by row, that none of those nine was won anywhere else. What is
// ours is the paper: a ruled ledger on manila, a tier-coloured rule under each
// award's name, and the club's own mark in front of its name so a career that
// moved reads as one at a glance.
//
// The MLB column replaced League: a reader knows what the Brewers' system
// looks like far better than which league voted, and for a MiLB award the old
// column mostly printed a dash anyway (see api/person/awards.js's orgIdFor).
//
// THE CAP IS ON TABLES, NEVER ON INFORMATION. Only the top few awards by the
// site owner's weight order get a table (three on a phone, six on a wide
// screen, both editable at /admin — ADR-0063). Everything else opens as an
// INDEX: one line each, carrying the count, every date and the league. An
// award won once is a single row, and a table drawn around a single row says
// nothing the line does not — so nothing is hidden by the cap, only ranked
// below it. Renders nothing when the player has no awards at all.
export function AwardsLedger({ ledger }) {
  const [open, setOpen] = useState(false)
  const { t } = useCopy()
  const wide = useMediaQuery(WIDE_QUERY)

  if (!ledger?.categories?.length) return null

  const order = parseAwardOrder(t('awards.order'))
  const desktopCap = parseAwardCap(t('awards.capDesktop'), 6)
  // A phone cap above the desktop cap would mean the narrow screen shows MORE
  // tables than the wide one. Clamped rather than rejected: the panel says so,
  // and a typo must not invert the layout.
  const phoneCap = Math.min(parseAwardCap(t('awards.capPhone'), 3), desktopCap)
  const cap = wide ? desktopCap : phoneCap

  const ranked = rankAwards(ledger.categories, order)
  const tabled = ranked.slice(0, cap)
  const rest = ranked.slice(cap)
  const restSelections = rest.reduce((n, c) => n + c.count, 0)

  return (
    <>
      <h3 className="section__title section__title--bar section__title--aside">
        <span>Awards</span>
        <em className="awards__tally">
          {tabled.length} of {ledger.totals.categories} · {ledger.totals.selections} selections
        </em>
      </h3>
      <div className="awards">
        {tabled.map((cat) => (
          <AwardTable key={cat.key} category={cat} />
        ))}

        {rest.length > 0 && !open && (
          <button type="button" className="awards__expand" onClick={() => setOpen(true)}>
            Show the other {rest.length} {rest.length === 1 ? 'award' : 'awards'} — {restSelections}{' '}
            {restSelections === 1 ? 'selection' : 'selections'}
          </button>
        )}
        {rest.length > 0 && open && (
          <>
            <AwardIndex categories={rest} />
            <button type="button" className="awards__collapse" onClick={() => setOpen(false)}>
              Show fewer
            </button>
          </>
        )}
      </div>
    </>
  )
}

// One award, one table. The name and its occurrence count share a line, a
// short tier-coloured rule sits under both (the same divider the retired
// marquee used, run full width here because it heads a table), then the rows.
function AwardTable({ category }) {
  return (
    <section className="awardblk">
      <div className="awardblk__head">
        <h4 className="awardblk__name">{category.label}</h4>
        <span className={`awardblk__count tier-${category.tier}`}>×{category.count}</span>
      </div>
      <span className={`awardblk__rule tier-${category.tier}`} aria-hidden="true" />
      <table className="awardtbl">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Team</th>
            <th scope="col" className="awardtbl__lgcol">
              MLB
            </th>
          </tr>
        </thead>
        <tbody>
          {category.rows.map((row, i) => (
            <tr key={`${row.date}-${i}`}>
              <td className="awardtbl__yr">{row.when}</td>
              <td className="awardtbl__tm">
                <TeamCell row={row} />
              </td>
              <td className="awardtbl__lg">
                <OrgChip orgId={row.orgId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// The club's mark ahead of its name. Decorative: the name is right beside it,
// so an empty alt keeps a screen reader from hearing the club twice. A feed row
// with no club (some writers' awards carry none) prints the em dash the rest of
// the app uses for "not posted", never a broken image.
//
// The NAME comes from teams.js where the id is a club we know, not from the
// feed: the awards feed abbreviates ("LA Angels", "Rancho Cuca."), and a table
// that prints the club on every row should print what the rest of the app calls
// it. teamFullName is MLB-only and returns null for an affiliate, which falls
// back to the feed's own short name — the usual MiLB degradation, and the right
// one here, since "Rancho Cuca." is still what that club is called on its own
// page.
function TeamCell({ row }) {
  const src = row.teamId ? teamLogoUrl(row.teamId) : null
  const name = (row.teamId && teamFullName(row.teamId)) || row.teamName
  if (!name) return <span className="awardtbl__none">—</span>
  return (
    <span className="awardtbl__club">
      {src && <img className="awardtbl__mark" src={src} alt="" loading="lazy" />}
      <span>{name}</span>
    </span>
  )
}

// The parent MLB org's own abbreviation (MIL) — an MLB award's own club, or a
// MiLB award's affiliate resolved up to whichever org fielded that club that
// season (api/person/awards.js's orgIdFor + loadPlayer.js's historical
// refinement). A dimmed dash for the rare club neither resolves.
function OrgChip({ orgId }) {
  const abbr = orgId ? teamAbbr({ id: orgId }) : ''
  if (!abbr) return <span className="awardtbl__chip awardtbl__chip--none">—</span>
  return <span className="awardtbl__chip">{abbr}</span>
}

// Everything below the cap, grouped by tier in weight order: name, count, every
// date, the org. Same information a table carries, one line per award
// instead of a table per award.
function AwardIndex({ categories }) {
  const groups = []
  for (const cat of categories) {
    const last = groups[groups.length - 1]
    if (last && last.tier === cat.tier) last.rows.push(cat)
    else groups.push({ tier: cat.tier, rows: [cat] })
  }
  return (
    <div className="awardidx">
      {groups.map((g, i) => (
        <section className="awardidx__group" key={`${g.tier}-${i}`}>
          <p className="awardidx__label">
            <span>{TIER_LABEL[g.tier] ?? 'Also won'}</span>
            <span className="awardidx__rule" aria-hidden="true" />
            <span className="awardidx__n">{g.rows.length}</span>
          </p>
          <span className={`awardblk__rule tier-${g.tier}`} aria-hidden="true" />
          {g.rows.map((cat) => (
            <div className="awardidx__row" key={cat.key}>
              <div className="awardidx__top">
                <span className="awardidx__nm">{cat.label}</span>
                <span className={`awardidx__ct tier-${cat.tier}`}>×{cat.count}</span>
              </div>
              <div className="awardidx__btm">
                <span className="awardidx__when">{cat.rows.map((r) => r.when).join(', ')}</span>
                <OrgChip orgId={cat.rows[0].orgId} />
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

const TIER_LABEL = {
  yearEnd: 'Year-end hardware',
  allStar: 'All-Star',
  press: 'Press & peers',
  inSeason: 'In-season',
  intl: 'International',
  minors: 'Minor league',
  other: 'Also won',
}
