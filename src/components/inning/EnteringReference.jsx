import { useState } from 'react'
import { defenseEntering } from '../../api/defense.js'
import { lineupEntering } from '../../api/battingorder.js'
import { selectDueUpNext } from '../../api/dueup.js'
import { prospectBadge } from '../../api/prospects.js'
import { showRookiePill } from '../../api/rookies.js'
import { ordinal } from '../../lib/format.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { DefenseDiamond } from '../scoring/DefenseDiamond.jsx'
import { ProspectPill } from '../badges/ProspectPill.jsx'
import { RookiePill } from '../badges/RookiePill.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The pre-scoring reference for a half: both teams' lineup cards + the fielding
// side's alignment as they stand ENTERING it (subs through first pitch only).
// Factored out because two layouts render it — inline in the half-inning on a
// phone (staged around the seal), and as a right-column card on the wide layout.
// Spoiler-free: revealedThrough is threaded straight into defenseEntering/
// lineupEntering below, which enforce the gate themselves (ADR-0010).
export function EnteringReference({ feed, inning, half, battingSide, awayName, homeName, awayId, homeId, prospectsData, rookiesData, isMlb, revealedThrough }) {
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
        fieldingTeamId={battingSide === 'away' ? homeId : awayId}
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
//
// The title names the MOMENT, not just the topic — "Defensive alignment
// entering the Top 7th" rather than the bare word "Defense", which read as
// current/live once this card moved below the play-by-play on reveal
// (ADR-0010), sitting under a card that might already show a mid-inning
// defensive change. "Defensive alignment" also reads less ambiguously than
// "Defense" on its own, which doubles as this app's own runs-allowed sense
// elsewhere (StatBox's R/H/E row) — see
// .scratch/pbp-scoring-review/issues/05-substitution-surface-asymmetries.md.
export function DefenseSection({ feed, inning, half, fieldingSide, fieldingName, fieldingTeamId, revealedThrough }) {
  const [open, setOpen] = useState(true)
  const defense = defenseEntering(feed, fieldingSide, inning, half, revealedThrough)
  if (!defense || defense.length === 0) return null
  return (
    <section className="halfdefense">
      <button
        type="button"
        className="halfdefense__title"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <TeamLogo
          teamId={fieldingTeamId}
          name={fieldingName}
          size={22}
          variant="mono"
          className="metricbar__logo"
        />
        Defensive alignment entering the {half === 'top' ? 'Top' : 'Bottom'} {ordinal(inning)}
        <span className="halfdefense__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <DefenseDiamond defense={defense} />}
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
//
// The fielding side (the OTHER team from battingSide) also gets a "due up" /
// "on deck" / "in the hole" pill on whichever of its own already-listed slots
// lead off ITS next half — selectDueUpNext (same primitive DueUpNextCard's
// separate stat-row card uses) carries its own spoiler gate, so this needs no
// gate of its own: it simply returns null until the preview is safe to show
// (current half fully revealed), same moment DueUpNextCard's own card would
// appear.
//
// Carries its own "entering the Top 7th" masthead now (same treatment as
// DefenseSection's, .lineupcard__title mirrors .halfdefense__title) rather
// than relying on a caller-supplied title — the wide layout used to bolt on
// its own bare "Lineups" heading (InningViewer.jsx) while the phone's inline
// placement (HalfInning.jsx's .halfentering) had no title at all, so the two
// layouts disagreed on whether this needed a heading, and neither one named
// the moment.
const UP_NEXT_LABELS = ['Due up', 'On deck', 'In the hole']

export function LineupSection({ feed, inning, half, awayName, homeName, prospectsData, rookiesData, isMlb, revealedThrough }) {
  const [open, setOpen] = useState(true)
  const away = lineupEntering(feed, 'away', inning, half, revealedThrough)
  const home = lineupEntering(feed, 'home', inning, half, revealedThrough)
  if ((!away || away.length === 0) && (!home || home.length === 0)) return null
  const dueUpNext = selectDueUpNext(feed, inning, half, revealedThrough, 3)
  const upNextLabels = (side) => {
    if (dueUpNext?.battingSide !== side) return null
    const bySlot = new Map(dueUpNext.batters.map((b, i) => [b.slot, UP_NEXT_LABELS[i]]))
    return bySlot
  }
  return (
    <section className="lineupcard">
      <button
        type="button"
        className="lineupcard__title"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Lineups entering the {half === 'top' ? 'Top' : 'Bottom'} {ordinal(inning)}
        <span className="lineupcard__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="lineupcard__teams">
          <LineupTeam name={awayName || 'Away'} slots={away ?? []} prospectsData={prospectsData} rookiesData={rookiesData} isMlb={isMlb} upNextLabels={upNextLabels('away')} />
          <LineupTeam name={homeName || 'Home'} slots={home ?? []} prospectsData={prospectsData} rookiesData={rookiesData} isMlb={isMlb} upNextLabels={upNextLabels('home')} />
        </div>
      )}
    </section>
  )
}

// One team's lineup column: the club name spelled out, then a numbered list of
// its nine batting slots. Each row reads name(s) on the left and the standing
// occupant's jersey number + fielding position right-aligned on a shared column.
// An empty side (a thin MiLB feed that never posted a lineup) is dropped rather
// than shown as a bare header. `upNextLabels`, when set, maps the up-to-three
// slots leading off this team's own next half to their "Due up"/"On deck"/
// "In the hole" label (see LineupSection above).
function LineupTeam({ name, slots, prospectsData, rookiesData, isMlb, upNextLabels }) {
  if (slots.length === 0) return null
  return (
    <div className="lineupteam">
      <h5 className="lineupteam__name">{name} Lineup</h5>
      <ol className="lineupcard__list">
        {slots.map((s) => {
          const cur = s.entries[s.entries.length - 1] // standing occupant
          const upNextLabel = upNextLabels?.get(s.slot)
          return (
            <li className="lineupcard__row" key={s.slot}>
              <span className="lineupcard__slot">{s.slot}</span>
              <span className="lineupcard__names">
                {s.entries.map((e, i) => (
                  <LineupName key={i} entry={e} />
                ))}
                <ProspectPill {...prospectBadge(prospectsData, cur.id)} />
                <RookiePill active={showRookiePill(rookiesData, cur.id, isMlb)} />
                {upNextLabel && (
                  <span className="duepill">
                    {upNextLabel === 'Due up' && <span aria-hidden="true">&larr; </span>}
                    {upNextLabel}
                  </span>
                )}
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
