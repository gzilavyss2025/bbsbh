import { useMemo } from 'react'
import { teammateLadder } from '../../api/formerTeammates.js'
import { splitDisplayName } from '../../api/person.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { SectionMasthead } from '../ui/SectionMasthead.jsx'
import { Ladder } from './ladder/Ladder.jsx'
import { seasonRange } from './ladder/layout.js'

// The lineup page's FORMER TEAMMATES card and its ORG TIES fallback.
// Spoiler-free: rosters and team-season history carry no score, so both
// render openly like the opposing-pitcher line.

// The card as the Ladder (#1352, see teammateLadder): away players, the clubs
// they shared, home players, a line per pair. Every player and every club shows
// once, with no door and no "+N". A tie to tonight's own org is a badge on the
// player who left it (solid: the club itself; dashed: its farm system only). A
// green position badge marks a starter; a group with a pair who both start is
// pinned first.
export function FormerTeammates({ pairs, startingIds, dayNight, away, home }) {
  const ladder = useMemo(
    () =>
      teammateLadder(pairs, away.id, home.id, startingIds, {
        [away.id]: away.teamName,
        [home.id]: home.teamName,
      }),
    [pairs, away.id, home.id, away.teamName, home.teamName, startingIds],
  )
  if (Object.keys(ladder.players).length === 0) return null
  const head = <SectionMasthead as="h3" title="Former teammates" />
  return (
    <Card className="metric teammates" head={head} body="flush">
      <div className="metric__body">
        <Ladder ladder={ladder} dayNight={dayNight} away={away} home={home} />
      </div>
    </Card>
  )
}

// "Milwaukee Brewers system — Biloxi Shuckers, AA ’19" — the one-line story
// under an org-tie card. Unlike a teammate caption (two players, one shared
// club) this is one player and the OPPONENT's org, so it leads with the org
// rather than a level label.
function orgTieCaption(t) {
  return `${t.orgName || 'Opponent'} system — ${t.teamName}, ${t.level} ${seasonRange(t.seasons)}`
}

// The ORG TIES fallback for a matchup with no literal former-teammate pairs
// (see orgTiesFor) — "this player has a history in the org tonight's opponent
// belongs to," even without ever sharing a roster with anyone playing
// tonight. Reuses the group card's column-of-headshots + shared-club layout
// (teammate--group) since it's the same shape with N pinned at 1. Hidden when
// there are no ties — which is the common case, since the generator only
// falls back to this when the real Former Teammates card came up empty.
export function OrgTies({ ties }) {
  if (!ties || ties.length === 0) return null
  return (
    <section className="teammates">
      <SectionHead look="label">Org ties</SectionHead>
      <p className="hint">No shared roster tonight — but these players have history in the other side&rsquo;s organization.</p>
      <ul className="teammates__grid">
        {ties.map((t) => (
          <Card as="li" key={`${t.player.id}-${t.orgId}`} className="teammate teammate--group" body="flush">
            <div className="teammate__group">
              <TeammateHalf
                id={t.player.id}
                name={t.player.name}
                pos={t.player.pos}
                teamId={t.rosterTeamId}
              />
            </div>
            <div className="teammate__mid">
              <TeamLogo teamId={t.orgId} name={t.orgName} size={32} />
              <span className="teammate__years">{seasonRange(t.seasons)}</span>
            </div>
            <span className="teammate__caption">{orgTieCaption(t)}</span>
          </Card>
        ))}
      </ul>
    </section>
  )
}

// A pitcher's roster position is already the plain "P" abbreviation (no
// SP/RP split) at the source, but normalize defensively anyway — the badge
// should never show anything longer than that for a pitcher.
const posLabel = (pos) => (pos === 'SP' || pos === 'RP' ? 'P' : pos)

// One player's headshot over his two-line name (first name small, surname
// big) — the same treatment as the player page's hero, shrunk to fit a card —
// with his roster position as a small badge floating on the headshot's
// bottom-left corner.
function TeammateHalf({ id, name, pos, teamId }) {
  const { first, last } = splitDisplayName(name)
  return (
    <PlayerLink id={id} name={name} className="teammate__half">
      <span className="teammate__shotwrap">
        <Headshot personId={id} name={name} teamId={teamId} className="teammate__shot" />
        {pos && <span className="teammate__posbadge">{posLabel(pos)}</span>}
      </span>
      <span className="teammate__name">
        {first && <span className="teammate__name-first">{first}</span>}
        <span className="teammate__name-last">{last}</span>
      </span>
    </PlayerLink>
  )
}
