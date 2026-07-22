import { defenseEntering } from '../api/defense.js'
import { lineupEntering } from '../api/battingorder.js'
import { prospectBadge } from '../api/prospects.js'
import { showRookiePill } from '../api/rookies.js'
import { ordinal } from '../lib/format.js'
import { PlayerLink } from './PlayerLink.jsx'
import { DefenseDiamond } from './DefenseDiamond.jsx'
import { ProspectPill } from './ProspectPill.jsx'
import { RookiePill } from './RookiePill.jsx'

// The pre-scoring reference for a half: both teams' lineup cards + the fielding
// side's alignment as they stand ENTERING it (subs through first pitch only).
// Factored out because two layouts render it — inline in the half-inning on a
// phone (staged around the seal), and as a right-column card on the wide layout.
// Spoiler-free: revealedThrough is threaded straight into defenseEntering/
// lineupEntering below, which enforce the gate themselves (ADR-0010).
export function EnteringReference({ feed, inning, half, battingSide, awayName, homeName, prospectsData, rookiesData, isMlb, revealedThrough }) {
  return (
    <>
      <LineupSection
        feed={feed}
        inning={inning}
        half={half}
        awayName={awayName}
        homeName={homeName}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        isMlb={isMlb}
        revealedThrough={revealedThrough}
      />
      <DefenseSection
        feed={feed}
        inning={inning}
        half={half}
        fieldingSide={battingSide === 'away' ? 'home' : 'away'}
        fieldingName={battingSide === 'away' ? homeName : awayName}
        revealedThrough={revealedThrough}
      />
    </>
  )
}

// The fielding team's defensive alignment ENTERING this half, drawn as the
// scorebook diamond and captioned with the fielding side. Shows the state at
// first pitch (defenseEntering) — a change made during the half stays sealed.
// defenseEntering itself enforces the reveal gate given revealedThrough (see
// api/enteringHalf.js's safeToShowEntering), returning null past it, so this
// is safe to call outside the seal regardless of caller diligence.
export function DefenseSection({ feed, inning, half, fieldingSide, fieldingName, revealedThrough }) {
  const defense = defenseEntering(feed, fieldingSide, inning, half, revealedThrough)
  if (!defense || defense.length === 0) return null
  return (
    <section className="halfdefense">
      <h4 className="halfdefense__title">
        {fieldingName ? `${fieldingName} ` : ''}defense
      </h4>
      <DefenseDiamond defense={defense} />
    </section>
  )
}

// Both teams' lineup cards as they stand ENTERING this half — the nine
// batting-order slots per side, each name with its jersey number and fielding
// position, subs (pinch-hitter/runner/double-switch) folded in through first
// pitch only (lineupEntering). Rendered outside the seal: lineupEntering
// itself enforces the reveal gate given revealedThrough, same as
// DefenseSection above — it's the reference you copy onto the sheet before
// scoring.
export function LineupSection({ feed, inning, half, awayName, homeName, prospectsData, rookiesData, isMlb, revealedThrough }) {
  const away = lineupEntering(feed, 'away', inning, half, revealedThrough)
  const home = lineupEntering(feed, 'home', inning, half, revealedThrough)
  if ((!away || away.length === 0) && (!home || home.length === 0)) return null
  return (
    <section className="lineupcard">
      <div className="lineupcard__teams">
        <LineupTeam name={awayName || 'Away'} slots={away ?? []} prospectsData={prospectsData} rookiesData={rookiesData} isMlb={isMlb} />
        <LineupTeam name={homeName || 'Home'} slots={home ?? []} prospectsData={prospectsData} rookiesData={rookiesData} isMlb={isMlb} />
      </div>
    </section>
  )
}

// One team's lineup column: the club name spelled out, then a numbered list of
// its nine batting slots. Each row reads name(s) on the left and the standing
// occupant's jersey number + fielding position right-aligned on a shared column.
// An empty side (a thin MiLB feed that never posted a lineup) is dropped rather
// than shown as a bare header.
function LineupTeam({ name, slots, prospectsData, rookiesData, isMlb }) {
  if (slots.length === 0) return null
  return (
    <div className="lineupteam">
      <h5 className="lineupteam__name">{name} Lineup</h5>
      <ol className="lineupcard__list">
        {slots.map((s) => {
          const cur = s.entries[s.entries.length - 1] // standing occupant
          return (
            <li className="lineupcard__row" key={s.slot}>
              <span className="lineupcard__slot">{s.slot}</span>
              <span className="lineupcard__names">
                {s.entries.map((e, i) => (
                  <LineupName key={i} entry={e} />
                ))}
                <ProspectPill {...prospectBadge(prospectsData, cur.id)} />
                <RookiePill active={showRookiePill(rookiesData, cur.id, isMlb)} />
              </span>
              <span className="lineupcard__meta">
                {cur.jersey ? (
                  <span className="lineupcard__jersey">{cur.jersey}</span>
                ) : null}
                {cur.position ? (
                  <span className="lineupcard__pos">{cur.position}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// One batting-order slot's name stack — struck through when replaced, tagged
// with the inning he entered while he's the standing occupant. Jersey/position
// are pulled up to the row's right-aligned meta column, so this renders name +
// enter-tag only. Mirrors DefenseDiamond's DefenseName styling.
function LineupName({ entry }) {
  const entered = entry.inning != null && !entry.replaced
  return (
    <span
      className={`lineupcard__name ${entry.replaced ? 'lineupcard__name--out' : ''} ${
        entered ? 'lineupcard__name--in' : ''
      }`}
    >
      <PlayerLink id={entry.id}>
        {entry.last}
        {entry.first ? `, ${entry.first}` : ''}
      </PlayerLink>
      {entry.inning != null && (
        <span className="lineupcard__enter">({ordinal(entry.inning)})</span>
      )}
    </span>
  )
}
