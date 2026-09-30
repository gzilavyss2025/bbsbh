// The parts both postseason series pages draw the same way: the finished
// page (PostseasonSeriesPage.jsx, a series from postseason-history.json) and
// the live page (postseason-live/LiveSeriesPage.jsx, a series heading into a
// cutoff date, #1224). One copy, so the two pages cannot drift apart. Each
// part draws only what its caller hands it; neither page's spoiler footing
// changes here.
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// The night's single most memorable moment, headshot-led — same idea as
// BoxScore.jsx's own PlayOfTheGame (the full box score's "real" version this
// mirrors), sized up to fill this ledger entry's wide second column instead
// of the flip card's compact text-only line (GameResultFace renders that
// version elsewhere; here it's suppressed via `hidePlayOfGame` so the two
// don't double up). Hidden entirely when WPA isn't available (most MiLB
// parks) or box-score resolution failed for this game.
export function SeriesPlayOfTheGame({ potg, awayAbbr, homeAbbr }) {
  if (!potg?.desc) return null
  const halfLabel = potg.half === 'top' ? 'Top' : 'Bottom'
  const hasScore = potg.awayScore != null && potg.homeScore != null
  return (
    <div className="psseries__potg">
      <h4 className="psseries__potgTitle">Play of the game</h4>
      <div className="psseries__potgBody">
        <Headshot
          personId={potg.batterId}
          name={potg.batterName}
          teamId={potg.batterTeamId}
          className="psseries__potgShot"
        />
        <div className="psseries__potgMain">
          {potg.batterName && (
            <div className="psseries__potgWho">
              <PlayerLink id={potg.batterId} className="psseries__potgName">
                {potg.batterName}
              </PlayerLink>
              {(potg.batterTeamAbbr || potg.batterPos) && (
                <span className="psseries__potgMeta">
                  {[potg.batterTeamAbbr, potg.batterPos].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )}
          <p className="psseries__potgDesc">
            {potg.inning != null && (
              <span className="psseries__potgWhen">
                {halfLabel} {ordinal(potg.inning)}{' '}
              </span>
            )}
            {potg.desc}
            {hasScore && (
              <span className="psseries__potgScore">
                {' '}
                {awayAbbr} {potg.awayScore}, {homeAbbr} {potg.homeScore}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

// SERIES LEADER AGATE — the batting/pitching boards for JUST this series,
// deliberately NOT the shared TeamLeaders featured-card layout. TeamLeaders
// solves "pick your player out of a league of strangers" (headshot hero,
// chaser ranks, team filters); this board only ever holds players from the
// two clubs that just played each other, over a 2-7 game sample. So it
// renders as newspaper box-score agate instead: each category is one ruled
// line — the scorer's stat code (HR/RBI/AVG/…) hanging in a left rail, the
// series leader inked with the big mono figure, and the runners-up as a
// run-in agate line beneath, values and all. Tiny club marks tell the two
// sides apart (the info the old showTeamAbbr={false} pass threw away), so
// "the losing side owned the batting board" is legible at a glance.
// Categories with no qualifying player in this thin sample (no saves in a
// sweep, nobody past the AVG floor — see api/postseasonSeries.js) are
// already empty arrays and simply don't render a line; a board with zero
// lines renders nothing at all. Title uses the same label head (SectionHead)
// as "Game by game" above and the base TeamLeaders board it replaced, so the
// page's section headers all read as one family.
export function SeriesLeaderBoard({ title, categories, byCategory }) {
  const ranked = categories
    .map((category) => ({ category, entries: byCategory[category.key] ?? [] }))
    .filter((r) => r.entries.length > 0)
  if (ranked.length === 0) return null
  return (
    <Card body="flush" className="psseries__lboard">
      <SectionHead look="label">{title}</SectionHead>
      <div className="psseries__lrows">
        {ranked.map(({ category, entries }) => (
          <SeriesLeaderLine key={category.key} category={category} entries={entries} />
        ))}
      </div>
    </Card>
  )
}

// One category's agate line. `entries` is already ranked and capped (see
// loadSeriesStats), so rank is positional — no rank numerals, exactly like
// printed agate ("HR — Chourio 3, Suzuki 2…"). Every runner-up shows its
// value, so a tie is self-evident from the figures; when the featured
// leader's value is matched below, a small "tied" margin note under the
// stat code says why this name is up top anyway (first by the ranker's
// tiebreak, not sole leader). Deliberately no favoriteTeamId highlight — see
// the component-level comment above.
function SeriesLeaderLine({ category, entries }) {
  const [leader, ...chasers] = entries
  const leaderTied = chasers.length > 0 && chasers[0].value === leader.value
  return (
    <div className="psseries__lcat">
      {/* The scorer's code carries the category for sighted users; aria-label
          swaps in the full name ("Home runs") for assistive tech. When the
          top value is matched below, a small "tied" margin note rides under
          the code — in the rail, like a scorer's annotation, so it never
          crowds a long leader name off the line. */}
      <span className="psseries__lkey" aria-label={category.label} title={category.label}>
        {category.short}
        {leaderTied && (
          <span className="psseries__ltied" aria-hidden="true">
            tied
          </span>
        )}
      </span>
      <div className="psseries__lmain">
        <div className="psseries__ltop">
          <TeamLogo teamId={leader.teamId} name={teamClubNameShort(leader.teamId)} size={18} />
          <PlayerLink id={leader.id} className="psseries__lname">
            {leader.name}
          </PlayerLink>
          <span className="psseries__lval">{leader.display}</span>
        </div>
        {chasers.length > 0 && (
          <p className="psseries__lchase">
            {chasers.map((e, i) => (
              <span key={e.id} className="psseries__lchaser">
                <TeamLogo teamId={e.teamId} name={teamClubNameShort(e.teamId)} size={13} />
                <PlayerLink id={e.id} className="psseries__lchasername">
                  {e.name}
                </PlayerLink>
                <span className="psseries__lchaserval">{e.display}</span>
                {/* The agate separator rides inside the chip so a wrap can
                    leave a dot at a line's end but never start one with it. */}
                {i < chasers.length - 1 && (
                  <span className="psseries__ldot" aria-hidden="true">
                    ·
                  </span>
                )}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}

// One team's series roster — every player who dressed for at least one game
// of the series (see loadSeriesStats/rosterEntry), split into position
// players and pitchers, each already in scorebook defensive order (see
// buildRosters/POSITION_ORDER in postseasonSeries.js). Deliberately no
// favoriteTeamId highlight here: this is a reference list of who was ON the
// roster, not a ranked/comparative board like the result banner or the
// leader sections above it.
export function RosterCard({ teamId, roster }) {
  const positionPlayers = roster?.positionPlayers ?? []
  const pitchers = roster?.pitchers ?? []
  if (positionPlayers.length === 0 && pitchers.length === 0) return null
  return (
    <Card body="flush" className="psseries__rostercard">
      <div className="psseries__rosterhead">
        <TeamLogo teamId={teamId} name={teamClubNameShort(teamId)} size={24} />
        <span className="psseries__rosterteam">{teamClubNameShort(teamId)} roster</span>
      </div>
      {positionPlayers.length > 0 && <RosterGroup title="Position players" rows={positionPlayers} />}
      {pitchers.length > 0 && <RosterGroup title="Pitchers" rows={pitchers} />}
    </Card>
  )
}

// Same bordered-card/hairline-divided row list as the Team page's Current
// Roster (.thub-roster/.thub-row — see RosterList in TeamPage.jsx): jersey
// number, name, a position badge, and a trailing chevron affordance. Kept as
// its own scoped `psseries__roster*` class family rather than importing
// TeamPage's classes directly (same convention AllStarRostersPage's
// `.allstarrosters__rows` already follows — a shared visual idiom, not a
// shared stylesheet dependency), since this row carries none of the Current
// Roster's live-context badges (WAR, All-Star star, injured mark, prospect/
// rookie pills) — none of that applies to a decades-old completed series.
// Every player who dressed renders, in the order `rows` already arrives in.
function RosterGroup({ title, rows }) {
  return (
    <div className="psseries__rostergroup">
      <h4 className="psseries__rostergrouptitle">{title}</h4>
      <ul className="psseries__rosterlist">
        {rows.map((p) => (
          <li key={p.id} className="psseries__rosterrow">
            <span className="psseries__rosternum">{p.jersey}</span>
            <PlayerLink id={p.id} className="psseries__rostername">
              {p.name}
            </PlayerLink>
            <span className="psseries__rosterpos">{p.position}</span>
            <span className="psseries__rosterchev">›</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
