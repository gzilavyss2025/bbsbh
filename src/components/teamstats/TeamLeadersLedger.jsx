import { useMemo } from 'react'
import { computeLeaders, positionTag } from '../../api/teamLeaders.js'
import { SectionTitle } from '../ui/SectionTitle.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { InjuredMark } from '../badges/InjuredMark.jsx'
import { ChevronLink } from '../ui/ChevronLink.jsx'

// TEAM LEADERS, LEDGER FORM — the team hub's own rendering of a club's
// per-category leaders: two labelled blocks, BATTING over PITCHING, one ruled
// row per category (short label, leader, value). No headshots, no runners-up,
// no deck.
//
// It exists because the card board this replaced on the hub could not show both
// halves of the game at once. TeamLeaders' featured card is ~180px tall, so the
// hub's 440px column fits two of them; the Overview showed three (all hitters,
// the first three of a mixed six) and the Numbers tab put six in a horizontal
// deck whose second card was already off-screen. A reader saw hitting and had
// no way to know pitching was there. Twelve ledger rows cost less height than
// two of those cards, so "half of this is pitching" is visible rather than
// three swipes away.
//
// The CARD board is not gone and was not wrong — it is what
// /team/{id}/leaders and the league/level/org boards still render (see
// TeamLeaders.jsx). A page whose whole job is leaders has the room for a face
// and four chasers per category; a hub section that is one module among a dozen
// does not. Same pool, same computeLeaders, same descriptors — only the
// density differs.
//
// Spoiler-free on the same footing as TeamLeaders: season aggregates, never a
// score, so nothing here is sealed (api/spoiler-manifest.json, ADR-0034).

// One block's rows: the leader (rank 1 only) of each category, in the order the
// descriptor list gives them. A category nobody qualifies for is DROPPED rather
// than rendered with a dash — thin MiLB feeds routinely have no qualified
// pitcher at all, and a column of "—" reads as broken rather than as absent
// (the same choice TeamLeaders makes for an empty category).
function leadersOf(pool, categories) {
  return categories
    .map((category) => ({ category, entry: computeLeaders(pool, category, { limit: 1 })[0] }))
    .filter((row) => row.entry != null)
}

// `pool`: normalized PoolPlayer[] (api/teamLeaders.js). `hitting`/`pitching`:
// the descriptor list for each block — the hub passes a PREFIX of
// LEDGER_HITTING/LEDGER_PITCHING, three a side on the Overview's door and all
// six on the Numbers tab. `onSeeAll` renders the header's "See all ›" door and
// `secondaryAction` any extra link beside it (the hub's "Org leaders ›").
// `injuredIds`: a Set of person ids on the club's IL, flagging a leader with
// the shared inline ✚ mark; null where the caller has not fetched one.
//
// Every row's shaping — the ranking, the formatting, and the RHP/LHP tag — is
// api/teamLeaders.js's, so this file stays render-only and that logic stays
// testable by the pure node:test suite, which cannot import JSX.
export function TeamLeadersLedger({
  pool,
  hitting,
  pitching,
  title = 'Team leaders',
  onSeeAll = null,
  secondaryAction = null,
  injuredIds = null,
}) {
  const blocks = useMemo(
    () =>
      [
        { key: 'batting', label: 'Batting', rows: leadersOf(pool, hitting) },
        { key: 'pitching', label: 'Pitching', rows: leadersOf(pool, pitching) },
      ].filter((block) => block.rows.length > 0),
    [pool, hitting, pitching],
  )

  if (blocks.length === 0) return null

  return (
    <div className="tledg">
      <SectionTitle
        title={title}
        action={
          onSeeAll || secondaryAction ? (
            <span className="tledg__actions">
              {onSeeAll && <ChevronLink onClick={onSeeAll}>See all</ChevronLink>}
              {secondaryAction}
            </span>
          ) : null
        }
      />
      <div className="tledg__blocks">
        {blocks.map((block) => (
          <section key={block.key} className="tledg__block">
            <h4 className="tledg__block-title">{block.label}</h4>
            <ul className="tledg__rows">
              {block.rows.map(({ category, entry }) => {
                const tag = positionTag(entry, category.group)
                return (
                  <li key={category.key} className="tledg__row">
                    <span className="tledg__cat">{category.short}</span>
                    {/* Name and tag share one flex child so the tag rides with
                        the name and a long name still ellipsises against it,
                        instead of the tag being pushed into the value. */}
                    <span className="tledg__who">
                      <PlayerLink id={entry.id} className="tledg__name">
                        {entry.name}
                      </PlayerLink>
                      {tag && <span className="tledg__pos">{tag}</span>}
                      <InjuredMark hurt={injuredIds?.has(entry.id)} />
                    </span>
                    <span className="tledg__val">{entry.display}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
