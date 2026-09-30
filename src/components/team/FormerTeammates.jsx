import { useMemo, useState } from 'react'
import { groupTeammateCards, splitOldClubTies } from '../../api/formerTeammates.js'
import { splitDisplayName } from '../../api/person.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { SectionMasthead } from '../ui/SectionMasthead.jsx'

// The lineup page's FORMER TEAMMATES card and its ORG TIES fallback (moved out
// of TeamInfo.jsx). Spoiler-free: rosters and team-season history carry no
// score, so both render openly like the opposing-pitcher line.

// Show only the first handful up front — a heavy shared history (two rosters
// that have swapped a lot of players) can run to dozens of cards — and let a
// button reveal the rest rather than dumping them all in the page's height.
const TEAMMATES_SHOWN = 5
// Cap the headshots inside one GROUP card (a big reunion can run to a dozen+
// spokes) so the tile stays a glance, not a scroll of its own.
const GROUP_MATES_SHOWN = 6

// Pins a pair/group whose players are BOTH in tonight's starting lineups above
// everything else, ranked score included — the connection is about to play
// out for real, pitch by pitch, on the user's own scoresheet, which is a
// better fact than anything the static score can express.
const TONIGHT_BOOST = 1000

function isCardTonight(card, startingIds) {
  if (!startingIds) return false
  if (card.kind === 'group') {
    return startingIds.has(card.anchor.id) && card.mates.some((m) => startingIds.has(m.id))
  }
  return startingIds.has(card.a.id) && startingIds.has(card.b.id)
}

// "MLB teammates, Colorado Rockies ’17–’21" — the one-line story under a card,
// and the ONLY place a card states its club's years (the logo above carries no
// years, so the card says it once). A pair that shares a second club names it
// too: "…; also AAA, Albuquerque Isotopes ’16". The global ALL-CAPS rule (see
// index.css) renders it uppercase; write it in natural case here.
function clubClause(club) {
  const label = club.level === 'MLB' ? 'MLB teammates' : `${club.level} teammates`
  return `${label}, ${club.teamName} ${seasonRange(club.seasons)}`
}

function pairCaption(clubs) {
  const [first, second] = clubs
  if (!first) return ''
  if (!second) return clubClause(first)
  return `${clubClause(first)}; also ${second.level}, ${second.teamName} ${seasonRange(second.seasons)}`
}

// "Goldschmidt’s MLB teammates, St. Louis Cardinals ’23–’24" — a group card
// names its anchor, so the card says whose teammates the other faces were.
function groupCaption(c) {
  const { last } = splitDisplayName(c.anchor.name)
  const level = c.club.level === 'MLB' ? 'MLB' : c.club.level
  return `${last}’s ${level} teammates, ${c.club.teamName} ${seasonRange(c.seasons)}`
}

// One card per pair of players — one from each club — who were once
// teammates on a THIRD club, tiling 2–3 to a row depending on width, ranked
// by how interesting the connection is (see formerTeammatePairs' `score`). A
// real hub-and-spokes reunion collapses into a single GROUP card (see
// groupTeammateCards). A tie made only on one of tonight's two clubs is not a
// card: it is one line in the "Facing a former club" list at the top (see
// splitOldClubTies), since "he used to play here" needs no wall of faces.
// Hidden when there are no ties. `pairs` is order-independent and deduped
// (see formerTeammatePairs), so this reads the same on either club's page.
export function FormerTeammates({ pairs, startingIds, dayNight, awayTeamId, homeTeamId }) {
  const [showAll, setShowAll] = useState(false)
  const { cards, oldClub } = useMemo(() => {
    const split = splitOldClubTies(pairs, awayTeamId, homeTeamId)
    const grouped = groupTeammateCards(split.pairs).map((c) => ({
      ...c,
      tonight: isCardTonight(c, startingIds),
    }))
    grouped.sort(
      (x, y) =>
        y.score + (y.tonight ? TONIGHT_BOOST : 0) - (x.score + (x.tonight ? TONIGHT_BOOST : 0)),
    )
    return { cards: grouped, oldClub: split.oldClub }
  }, [pairs, startingIds, awayTeamId, homeTeamId])
  // `pairs` always runs (away player, home player) — see formerTeammatePairs'
  // header — so any id that ever shows up as an `a` belongs to the away club
  // and any `b` to the home club, regardless of which side's page is asking.
  // Feeds each headshot's solid team-color background (see TeammateHalf) so a
  // headshot always reads as "this is a Team A face" at a glance.
  const sideTeamId = useMemo(() => {
    const awayIds = new Set(pairs.map((p) => p.a.id))
    return (id) => (awayIds.has(id) ? awayTeamId : homeTeamId)
  }, [pairs, awayTeamId, homeTeamId])
  if (cards.length === 0 && oldClub.length === 0) return null
  const shown = showAll ? cards : cards.slice(0, TEAMMATES_SHOWN)
  const hidden = cards.length - shown.length
  const startingLabel = dayNight === 'day' ? 'Starting today' : 'Starting tonight'
  const head = <SectionMasthead as="h3" title="Former teammates" />
  return (
    <Card className="metric teammates" head={head} body="flush">
      <div className="metric__body">
        <OldClubList lines={oldClub} />
        {/* A CSS multi-column "waterfall" rather than a grid: a big reunion card
            can run much taller than a plain pair card, and a grid stretches
            every OTHER card in that row to match. Each card just flows into
            whichever column has room next, so one tall card never drags its
            row-mates' height with it. */}
        {shown.length > 0 && (
          <ul className="teammates__grid">
            {shown.map((c) =>
              c.kind === 'group' ? (
                <GroupCard
                  key={`g-${c.anchor.id}-${c.club.teamId}`}
                  card={c}
                  startingLabel={startingLabel}
                  sideTeamId={sideTeamId}
                />
              ) : (
                <PairCard
                  key={`${c.a.id}-${c.b.id}`}
                  card={c}
                  startingLabel={startingLabel}
                  sideTeamId={sideTeamId}
                />
              ),
            )}
          </ul>
        )}
        {hidden > 0 && (
          <Door layout="block" onClick={() => setShowAll(true)}>
            Show {hidden} more former {hidden === 1 ? 'teammate' : 'teammates'}
          </Door>
        )}
      </div>
    </Card>
  )
}

// "Facing a former club": one line per player who once played for one of
// tonight's two clubs — "Ali Sánchez · C — Boston Red Sox ’25". The club's
// logo leads the line, so the eye can find "the ex-Red Sox" at a glance.
function OldClubList({ lines }) {
  if (lines.length === 0) return null
  return (
    <section className="oldclub">
      <SectionHead look="label">Facing a former club</SectionHead>
      <ul className="oldclub__list">
        {lines.map((l) => (
          <li key={`${l.player.id}-${l.club.teamId}`} className="oldclub__row">
            <TeamLogo teamId={l.club.teamId} name={l.club.teamName} size={24} />
            <span className="oldclub__text">
              <PlayerLink id={l.player.id} name={l.player.name} className="oldclub__name">
                {l.player.name}
              </PlayerLink>
              {l.player.pos && <span className="oldclub__pos">{posLabel(l.player.pos)}</span>}
              <span className="oldclub__club">
                {l.club.level === 'MLB' ? '' : `${l.club.level} `}
                {l.club.teamName} {seasonRange(l.seasons)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// A plain 1-vs-1 former-teammate card: a tile on Card (#1113, slice C3).
function PairCard({ card: c, startingLabel, sideTeamId }) {
  return (
    <Card as="li" className="teammate" body="flush">
      {c.tonight && <span className="teammate__badge">{startingLabel}</span>}
      <TeammateHalf id={c.a.id} name={c.a.name} pos={c.a.pos} teamId={sideTeamId(c.a.id)} />
      <div className="teammate__mid">
        <div className="teammate__logos">
          {c.clubs.slice(0, 2).map((club) => (
            <TeamLogo key={club.teamId} teamId={club.teamId} name={club.teamName} size={28} />
          ))}
        </div>
      </div>
      <TeammateHalf id={c.b.id} name={c.b.name} pos={c.b.pos} teamId={sideTeamId(c.b.id)} />
      <span className="teammate__caption">{pairCaption(c.clubs)}</span>
    </Card>
  )
}

// A hub-and-spokes reunion card. The ANCHOR (the one player every other face
// shared the club with) stands alone in the first column behind a rule, so
// the card reads "this player, and his teammates" rather than a flat row of
// equals. The club's logo rides in the caption, not a third column, so the
// spokes keep the width for two headshots a row on a narrow tile. Starts capped to GROUP_MATES_SHOWN spokes with a "+N more
// teammates" button that reveals the rest of the headshots in place.
function GroupCard({ card: c, startingLabel, sideTeamId }) {
  const [expanded, setExpanded] = useState(false)
  const shownMates = expanded ? c.mates : c.mates.slice(0, GROUP_MATES_SHOWN)
  const moreCount = c.mates.length - shownMates.length
  return (
    <Card as="li" className="teammate teammate--hub" body="flush">
      {c.tonight && <span className="teammate__badge">{startingLabel}</span>}
      <div className="teammate__anchor">
        <TeammateHalf
          id={c.anchor.id}
          name={c.anchor.name}
          pos={c.anchor.pos}
          teamId={sideTeamId(c.anchor.id)}
        />
      </div>
      {/* WHOSE roster each face is on tonight gets easy to lose past a couple
          of rows — hence the per-player club color (see TeammateHalf). */}
      <div className="teammate__group">
        {shownMates.map((m) => (
          <TeammateHalf key={m.id} id={m.id} name={m.name} pos={m.pos} teamId={sideTeamId(m.id)} />
        ))}
      </div>
      <span className="teammate__caption teammate__caption--logo">
        <TeamLogo teamId={c.club.teamId} name={c.club.teamName} size={20} />
        {groupCaption(c)}
      </span>
      {moreCount > 0 && (
        <button
          type="button"
          className="teammate__groupmore"
          onClick={() => setExpanded(true)}
        >
          +{moreCount} more {moreCount === 1 ? 'teammate' : 'teammates'}
        </button>
      )}
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

// [2022, 2023] -> "’22–’23"; [2021] -> "’21". Non-contiguous years still read as
// a min–max span (good enough for a caption).
function seasonRange(seasons) {
  const ys = [...(seasons ?? [])].sort((a, b) => a - b)
  if (ys.length === 0) return ''
  const yy = (y) => `’${String(y).slice(-2)}`
  return ys.length === 1 ? yy(ys[0]) : `${yy(ys[0])}–${yy(ys[ys.length - 1])}`
}
