import { useMemo, useState } from 'react'
import { teammateCrossroads } from '../../api/formerTeammates.js'
import { splitDisplayName } from '../../api/person.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { SectionMasthead } from '../ui/SectionMasthead.jsx'

// The lineup page's FORMER TEAMMATES card and its ORG TIES fallback.
// Spoiler-free: rosters and team-season history carry no score, so both
// render openly like the opposing-pitcher line.

// Rows shown before "Show N more clubs" — a heavy shared history (two rosters
// that swapped a lot of players) can run to a dozen clubs.
const ROWS_SHOWN = 6

// The card as crossroads: one row per shared club (see teammateCrossroads),
// the club's logo and years in the middle, tonight's away players on the left
// and home players on the right, under a head that names each side. Two
// sections: "Facing a former club" (the club is one of tonight's own, so the
// row holds only the player who LEFT it) and
// "Teammates elsewhere" (they met on a third club). Every face shows: no
// "+N" and no "with N of tonight's …" count. A green position badge
// marks a starter; a row that plays out tonight is pinned first.
export function FormerTeammates({ pairs, startingIds, dayNight, away, home }) {
  const [showAll, setShowAll] = useState(false)
  const { former, elsewhere } = useMemo(
    () => teammateCrossroads(pairs, away.id, home.id, startingIds),
    [pairs, away.id, home.id, startingIds],
  )
  const total = former.length + elsewhere.length
  if (total === 0) return null
  const cap = showAll ? total : ROWS_SHOWN
  const formerShown = former.slice(0, cap)
  const elsewhereShown = elsewhere.slice(0, Math.max(0, cap - formerShown.length))
  const hidden = total - formerShown.length - elsewhereShown.length
  const anyStarting = [...former, ...elsewhere].some((r) =>
    [...r.away, ...r.home].some((p) => p.starting),
  )
  const head = <SectionMasthead as="h3" title="Former teammates" />
  return (
    <Card className="metric teammates" head={head} body="flush">
      <div className="metric__body">
        <div className="xroads__sides" aria-hidden="true">
          <span className="xroads__sidename">
            <TeamLogo teamId={away.id} name={away.teamName} size={20} />
            {away.teamName}
          </span>
          <span className="xroads__sidename xroads__sidename--home">
            {home.teamName}
            <TeamLogo teamId={home.id} name={home.teamName} size={20} />
          </span>
        </div>
        {anyStarting && (
          <p className="xroads__legend">
            <span className="xroads__legendmark" />
            {dayNight === 'day' ? 'Starting today' : 'Starting tonight'}
          </p>
        )}
        <RowGroup title="Facing a former club" rows={formerShown} />
        <RowGroup title="Teammates elsewhere" rows={elsewhereShown} />
        {hidden > 0 && (
          <Door layout="block" onClick={() => setShowAll(true)}>
            Show {hidden} more {hidden === 1 ? 'club' : 'clubs'}
          </Door>
        )}
      </div>
    </Card>
  )
}

function RowGroup({ title, rows }) {
  if (rows.length === 0) return null
  return (
    <section className="xroads__group">
      <SectionHead look="label">{title}</SectionHead>
      <ul className="xroads__list">
        {rows.map((r) => (
          <CrossroadsRow key={`${r.kind}-${r.club.teamId}`} row={r} />
        ))}
      </ul>
    </section>
  )
}

// One shared club as a tile: away side | club | home side. On a 'former' row
// one side is empty by construction (nobody on that club LEFT it). A tile with
// three or more faces on a side spans two tile tracks where the card is wide.
function CrossroadsRow({ row: r }) {
  const wide = Math.max(r.away.length, r.home.length) > 2
  // An empty side takes no room: the tile closes up to faces | club (or
  // club | faces), so the faces keep their side of the card.
  const oneSide = r.away.length === 0 ? ' xroads__row--homeonly' : r.home.length === 0 ? ' xroads__row--awayonly' : ''
  return (
    <li className={`xroads__row${wide ? ' xroads__row--wide' : ''}${oneSide}`}>
      {r.away.length > 0 && <Side players={r.away} align="end" />}
      <div className="xroads__club">
        <TeamLogo teamId={r.club.teamId} name={r.club.teamName} size={32} />
        <span className="xroads__clubname">
          {r.club.level === 'MLB' ? '' : `${r.club.level} `}
          {r.club.teamName}
        </span>
        <span className="xroads__years">{seasonRange(r.seasons)}</span>
      </div>
      {r.home.length > 0 && <Side players={r.home} align="start" />}
    </li>
  )
}

function Side({ players, align }) {
  return (
    <div className={`xroads__side xroads__side--${align}`}>
      {players.map((p) => (
        <Face key={p.id} player={p} />
      ))}
    </div>
  )
}

// A small headshot over the surname, the roster position as a badge on its
// corner — green when he starts.
function Face({ player: p }) {
  const { last } = splitDisplayName(p.name)
  return (
    <PlayerLink id={p.id} name={p.name} className="xroads__face">
      <span className="teammate__shotwrap">
        <Headshot personId={p.id} name={p.name} teamId={p.teamId} className="xroads__shot" />
        {p.pos && (
          <span className={`teammate__posbadge${p.starting ? ' teammate__posbadge--starting' : ''}`}>
            {posLabel(p.pos)}
          </span>
        )}
      </span>
      <span className="xroads__surname">{last}</span>
    </PlayerLink>
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

// [2022, 2023] -> "’22–’23"; [2021] -> "’21". Non-contiguous years still read as
// a min–max span (good enough for a caption).
function seasonRange(seasons) {
  const ys = [...(seasons ?? [])].sort((a, b) => a - b)
  if (ys.length === 0) return ''
  const yy = (y) => `’${String(y).slice(-2)}`
  return ys.length === 1 ? yy(ys[0]) : `${yy(ys[0])}–${yy(ys[ys.length - 1])}`
}
