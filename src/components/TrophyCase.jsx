import { useState } from 'react'

// Trophy Case — the player page's career-honors card (api/person.js's
// trophyCaseView): a marquee for the single most prestigious honor
// (`hero`), then everything else — in-season honors, Year-End Awards,
// All-Star — as ledger groups below it. No per-award icon: a lettered
// badge reads as a generic avatar no matter which two letters go inside
// it, so the marquee is pure typographic hierarchy (an eyebrow, the
// headline, a short tier-coloured rule, then the honor's own dates); a
// ledger row's tier reads from a background tint, not an icon or a rail.
// Every date renders, uncapped — a decorated veteran's dates are real
// information, never hidden behind a "+N more". Dense careers (see
// COLLAPSE_THRESHOLD) open the ledger collapsed to a one-line-per-group
// tally with a real "show everything" action, so a 40-honor case doesn't
// dominate the page by default the way an always-open list would. Renders
// nothing when the player has neither a hero nor any groups.
const COLLAPSE_THRESHOLD = 16

export function TrophyCase({ trophyCase }) {
  const [expanded, setExpanded] = useState(false)
  if (!trophyCase?.hero) return null
  const { hero, groups } = trophyCase

  const remaining = groups.reduce((n, g) => n + g.count, 0)
  const dense = remaining > COLLAPSE_THRESHOLD

  return (
    <div className="trophycase">
      <h3 className="section__title"><span>Trophy Case</span></h3>
      <Marquee hero={hero} />
      {dense && !expanded ? (
        <Tally groups={groups} remaining={remaining} onExpand={() => setExpanded(true)} />
      ) : (
        <>
          {groups.map((g) => (
            <Group key={g.key} group={g} />
          ))}
          {dense && (
            <button type="button" className="ledger-collapse" onClick={() => setExpanded(false)}>
              Show fewer
            </button>
          )}
        </>
      )}
    </div>
  )
}

const HERO_TIER = { hardware: 'hw', allstar: 'as', inseason: 'is' }

function Marquee({ hero }) {
  const tier = HERO_TIER[hero.kind]
  // "Most frequent" only means something once there's a second honor to
  // have lost the comparison — a lone Player of the Week is this player's
  // ONE honor so far, same footing as a lone Gold Glove, not a special
  // "nothing else to compare it to" case.
  const eyebrow = hero.kind === 'inseason' && hero.row.count > 1 ? 'Most frequent honor' : 'Career-defining honor'
  const name = hero.kind === 'allstar' ? `★ ${hero.row.label}` : hero.row.label
  return (
    <div className="plaque">
      <p className={`plaque-eyebrow tier-${tier}`}>{eyebrow}</p>
      <p className="plaque-name">{name}</p>
      <span className={`plaque-rule tier-${tier}`} aria-hidden="true" />
      <p className="plaque-years">{hero.row.dates.join(', ')}</p>
    </div>
  )
}

function Tally({ groups, remaining, onExpand }) {
  return (
    <>
      <div className="ledger-tally">
        {groups.map((g) => (
          <div className="ledger-tally__row" key={g.key}>
            <span>{g.label}</span>
            <b>{g.count}</b>
          </div>
        ))}
      </div>
      <button type="button" className="ledger-expand" onClick={onExpand}>
        Show full trophy case — {remaining} honors
      </button>
    </>
  )
}

function Group({ group }) {
  return (
    <div className="ledger-group">
      <p className="ledger-taglabel">{group.label}</p>
      <div className="ledger-rows">
        {group.rows.map((r) => (
          <Row key={r.key} row={r} isAllStar={group.key === 'allStar'} />
        ))}
      </div>
    </div>
  )
}

function Row({ row, isAllStar }) {
  const multi = row.dates.length > 1
  const cls = ['ledger-row', multi ? 'multi' : 'single', isAllStar && 'is-allstar'].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <span className="lbl">{row.label}</span>
      <span className="val">{row.dates.join(', ')}</span>
    </div>
  )
}
