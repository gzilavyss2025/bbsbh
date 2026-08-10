import { memo, useState } from 'react'
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
import { headerThemeFor, headerThemeStyle, headerThemeClass, themeKeyFor } from '../../lib/headerTheme.js'

// The pre-scoring reference for a half: both teams' lineup cards + the fielding
// side's alignment as they stand ENTERING it (subs through first pitch only).
// Factored out because two layouts render it — inline in the half-inning on a
// phone (staged around the seal), and as a right-column card on the wide layout.
// Spoiler-free: revealedThrough is threaded straight into defenseEntering/
// lineupEntering below, which enforce the gate themselves (ADR-0010).
//
// `treatment` (optional, `{away, home}` jersey-treatment keys — InningViewer's
// own `winProbTreatment`, ADR-0030 footing) feeds each team's card the SAME
// curated bar/accent/text triad TeamInfo.jsx and BoxScore.jsx's team cards
// already wear (headerTheme.js) — identity-only, never anything reveal-
// related. Absent treatment (an older caller, or a club with no curated
// triad) falls back to the CSS defaults, same navy chrome as before.
export function EnteringReference({ feed, inning, half, battingSide, awayName, homeName, awayId, homeId, treatment, prospectsData, rookiesData, isMlb, revealedThrough }) {
  const fieldingSide = battingSide === 'away' ? 'home' : 'away'
  return (
    <>
      <LineupSection
        feed={feed}
        inning={inning}
        half={half}
        awayName={awayName}
        homeName={homeName}
        awayId={awayId}
        homeId={homeId}
        treatment={treatment}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        isMlb={isMlb}
        revealedThrough={revealedThrough}
      />
      <DefenseSection
        feed={feed}
        inning={inning}
        half={half}
        fieldingSide={fieldingSide}
        fieldingName={battingSide === 'away' ? homeName : awayName}
        fieldingTeamId={battingSide === 'away' ? homeId : awayId}
        fieldingTreatment={treatment?.[fieldingSide]}
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
// TITLES NAME THE TOPIC, NOT THE MOMENT — "Defensive alignment", not
// "Defensive alignment entering the Top 7th", and the same for LineupSection
// below. Both used to spell the half out, on the argument that a card sitting
// UNDER the play-by-play once revealed (ADR-0010) could otherwise read as
// current rather than as the state the half opened in. That argument does not
// survive contact with the page it is on: the half is already named in the
// navigator above ("Top 7th"), on the half's own title bar, and in the URL —
// three times before the reader reaches this card. A fourth reading, on a card
// whose every row is a pre-pitch fact, was restating the obvious in the one
// place the wide layout has least room for it (the reference rail's 328px
// track, where it wrapped). The SEMANTICS are untouched: these are still
// defenseEntering/lineupEntering, still the state entering the half, still
// caller-gated to the reader's own next half. Only the label got shorter.
//
// "Defensive alignment" rather than the bare word "Defense" is a separate and
// still-live distinction: "Defense" doubles as this app's own runs-allowed
// sense elsewhere (StatBox's R/H/E row) — see
// .scratch/pbp-scoring-review/issues/05-substitution-surface-asymmetries.md.
// Memoized (both sections): the caller-gated entering selectors below walk the
// whole game's plays, and these two cards hang off InningViewer, which
// re-renders on every live report during a live game. The reveal mark is a prop,
// so the memo comparison covers the gate itself.
export const DefenseSection = memo(function DefenseSection({ feed, inning, half, fieldingSide, fieldingName, fieldingTeamId, fieldingTreatment, revealedThrough }) {
  const [open, setOpen] = useState(true)
  const defense = defenseEntering(feed, fieldingSide, inning, half, revealedThrough)
  if (!defense || defense.length === 0) return null
  // The same curated bar/accent/text triad TeamInfo.jsx and BoxScore.jsx's own
  // .bs__defensecard already wear (headerTheme.js, ADR-0030) — this card is
  // the innings view's copy of that exact markup, so it reads for free off
  // the same `.is-themed .halfdefense__title` rule 09-team-info.css already
  // carries; no new CSS needed here.
  const theme = headerThemeFor(fieldingTeamId, themeKeyFor(fieldingTeamId, fieldingSide, fieldingTreatment))
  return (
    <section className={`halfdefense ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
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
          crop="bar"
          className="metricbar__logo"
        />
        Defensive alignment
        <span className="halfdefense__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <DefenseDiamond defense={defense} />}
    </section>
  )
})

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

export const LineupSection = memo(function LineupSection({ feed, inning, half, awayName, homeName, awayId, homeId, treatment, prospectsData, rookiesData, isMlb, revealedThrough }) {
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
        Lineups
        <span className="lineupcard__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="lineupcard__teams">
          <LineupTeam name={awayName || 'Away'} teamId={awayId} side="away" treatment={treatment?.away} slots={away ?? []} prospectsData={prospectsData} rookiesData={rookiesData} isMlb={isMlb} upNextLabels={upNextLabels('away')} />
          <LineupTeam name={homeName || 'Home'} teamId={homeId} side="home" treatment={treatment?.home} slots={home ?? []} prospectsData={prospectsData} rookiesData={rookiesData} isMlb={isMlb} upNextLabels={upNextLabels('home')} />
        </div>
      )}
    </section>
  )
})

// One team's lineup column: the club's own bar — the SAME curated bar/accent/
// text triad TeamInfo.jsx and BoxScore.jsx's team cards already wear
// (headerTheme.js, ADR-0030), not a one-off tint — captioned with the club
// name, its knockout mark right-aligned against the bar's edge, then a
// numbered list of its nine batting slots. Each row reads name(s) on the left
// and the standing occupant's jersey number + fielding position right-aligned
// on a shared column. An empty side (a thin MiLB feed that never posted a
// lineup) is dropped rather than shown as a bare header. `upNextLabels`, when
// set, maps the up-to-three slots leading off this team's own next half to
// their "Due up"/"On deck"/"In the hole" label (see LineupSection above).
function LineupTeam({ name, teamId, side, treatment, slots, prospectsData, rookiesData, isMlb, upNextLabels }) {
  if (slots.length === 0) return null
  const theme = headerThemeFor(teamId, themeKeyFor(teamId, side, treatment))
  return (
    <div className={`lineupteam ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <h5 className="lineupteam__name">
        <span className="lineupteam__namelabel">{name} Lineup</span>
        <TeamLogo teamId={teamId} name={name} size={20} variant="mono" crop="bar" className="metricbar__logo" />
      </h5>
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
