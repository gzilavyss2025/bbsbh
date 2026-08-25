import { Fragment } from 'react'
import { isMlbTeamId, teamAbbr, teamPrimaryColor } from '../../lib/teams.js'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// One roster-move story, and the day-grouping helpers around it. Extracted from
// the slate's wide surface when the phone got a SECOND presentation of the
// same feed: the two differ in where the ledger sits and how it is opened, never
// in what a move looks like — so a move is drawn in exactly one place. The wide
// surface is now WireRail.jsx (beside the games) and the phone's is WireDock.jsx
// (the bottom-anchored sheet). Both import from here; neither re-derives.
//
// It is also where the PRIMITIVES a roster move is drawn from live, for every
// surface and not only these two: the tone maps, the dateline, and the cutline
// renderer. The club deck (TeamTransactionsCard.jsx) and the club ledger page
// (screens/team/TeamTransactionsPage.jsx) keep their own layout — a deck and a
// page are not a wire — but they import the parts that MUST agree from here.
// They kept private copies of all four until the club surfaces were folded
// in — byte-identical, and free to drift: a banner tone or a dateline could
// have changed on one surface and not the other, and nothing would have
// caught it.
//
// Everything below is spoiler-free by construction — a roster move and its date
// carry no score (see api/transactions/leagueFeed.js) — so nothing here is
// wrapped in a SealBox and none is wanted.

// A story's rail runs one to three faces. Two is the whole in-and-out of a
// move and covers 33 of 35 stories in a measured window outright; the two
// three-face shuffles lose a photo, never a name — the cutline still bolds
// everyone. A third face would push the row past the sentence beside it.
const FACES_PER_ROW = 2

export const BANNER_TONE = { in: 'banner--in', out: 'banner--out', move: 'banner--move' }
// The per-story tone map every roster-move surface reads — so an
// add-flavoured story is green and a health/departure one is clay on the wire,
// in the dock, on the club deck and on the club's own ledger page.
//
// `roster-move` is deliberately absent, and that absence is the rule: it is
// the pipeline's DEFAULT type, so a label on it says only that the row is a
// roster move, which is what the whole surface is. Measured twice, on both
// sides: over a real 48 hours league-wide it labelled 16 of 35 rows, and over
// the shipped 2026 club files it labels 1,138 of 3,199 stories (36%) — 5 of
// the Brewers' first 12 cards. A label on a third of the rows is not a label,
// it is noise with a heading's weight. What is left flags the rows worth a
// second look (a trade, an injured list, a shuffle) and stays silent on the
// routine ones.
export const TYPE_TONE = {
  trade: 'add',
  signing: 'add',
  'injured-list': 'out',
  suspension: 'out',
  shuffle: 'move',
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Spelled-out dateline. Mixed-case here on purpose: the CSS applies the
// app's ALL-CAPS invariant, never a per-component .toUpperCase() (ADR-0017 /
// check-name-casing.mjs).
//
// `datelineParts` is the same walk stopped one step early, for the day
// markers that write the date abbreviated and stacked (TxStory.jsx's DayTab).
// One weekday table and one month table for every surface, so a deck tab and
// a wire row can never name the same day differently.
export function datelineParts(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return { weekday: WEEKDAYS[date.getUTCDay()], month: MONTHS[m - 1], day: d }
}
export function dateline(iso) {
  const { weekday, month, day } = datelineParts(iso)
  return `${weekday}, ${month} ${day}`
}
// The days flattened into one ordered run of datelines and stories, so a
// surface can render, scroll or clip anywhere in the run without having to
// reason about which day a row belongs to.
export function flattenDays(days) {
  const items = []
  for (const day of days ?? []) {
    if (!day.stories?.length) continue
    items.push({ kind: 'date', key: `d-${day.date}`, date: day.date, count: day.stories.length })
    for (const story of day.stories) {
      items.push({ kind: 'story', key: story.id, story, date: day.date })
    }
  }
  return items
}

// The first `n` stories, with their datelines — and never a dateline left
// standing over nothing, which is what a naive slice produces whenever the cut
// lands on a day's first story. The rail's collapsed state is the only caller;
// the dock shows every story it has.
export function takeStories(items, n) {
  const out = []
  let seen = 0
  for (const item of items) {
    if (item.kind === 'story') {
      if (seen >= n) break
      seen += 1
    }
    out.push(item)
  }
  while (out.length && out[out.length - 1].kind === 'date') out.pop()
  return out
}

// A cutline's segments — plain prose, with any segment carrying a playerId or
// teamId linked. Identical treatment to the team card's, including the rule
// that only a player's name takes the bold headline weight so a club name
// beside it doesn't compete.
//
// `linked={false}` renders the same sentence with no anchors at all, which is
// what the dock's one-line rail wants: the rail IS a single expand control, and
// an anchor nested inside a button is neither valid HTML nor reliably tappable.
export function Cutline({ segments, className = 'wire__cutline', linked = true }) {
  return (
    <p className={className}>
      {(segments ?? []).map((seg, i) => {
        if (linked && seg.playerId) {
          return (
            <PlayerLink key={i} id={seg.playerId} className="wire__namelink">{seg.text}</PlayerLink>
          )
        }
        if (linked && seg.teamId) return <TeamLink key={i} id={seg.teamId}>{seg.text}</TeamLink>
        return <Fragment key={i}>{seg.text}</Fragment>
      })}
    </p>
  )
}

// The flat sentence a cutline reads as, for the two places that can hold no
// markup: the rail's single line, and the accessible name of the control
// around it.
export function cutlineText(segments) {
  return (segments ?? []).map((seg) => seg.text).join('')
}

// `tintTeamId` is the MLB parent org for every slot, prospects included, so
// `isMlb` has to come off the slot itself — Headshot's teamId-derived default
// would read a farmhand as a major-leaguer and skip his MiLB photo rung. Same
// trap the team card's RailSlot documents; same fix.
function Face({ slot }) {
  return (
    <div className="wire__face">
      <span className={`banner ${BANNER_TONE[slot.role] ?? 'banner--move'}`}>{slot.banner}</span>
      <Headshot
        personId={slot.playerId}
        name={slot.name}
        teamId={slot.tintTeamId}
        isMlb={slot.isMlb ?? false}
        className="wire__shot"
      />
    </div>
  )
}

// The owning club is the one name the cutline never carries, so this link is
// the row's subject rather than an extra. It goes to the club's own roster-move
// ledger (`/team/{id}/transactions`), which is a page holding one thing.
//
// It used to go to the Games tab, on the reasoning that the club's Transactions
// deck lives there. True, and not enough: that deck is the LAST section of that
// tab, under the series strip, every game of the season, the highlights rail
// and the photos rail. A reader who tapped a club to read the move they had
// just seen landed at the top of a very long page with four sections between
// them and it. Right tab, wrong place on it.
//
// `compact` is the WIRE RAIL's row (WireRail.jsx): the same story with the
// photo rail dropped and the leading banner moved up beside the club. It is a
// width decision, not a taste one — the rail is 288px, and a 33px face column
// plus its gap leaves about 220px for a sentence that runs to 104 characters.
// The photo is what gives way because it is the only part carrying nothing the
// cutline does not already say: the cutline still bolds every name. The banner
// moves rather than goes, because "did he come up or go down?" is the one thing
// a reader wants before reading the sentence, and it survives in one chip.
//
// Only the FIRST banner rides along. A shuffle's second slot loses its chip and
// keeps its type label — "Roster shuffle" beside one In chip reads correctly,
// and two chips plus a mark plus an abbreviation plus a label do not fit 288px
// without wrapping the kicker onto a second line.
// `TeamLink`'s `tab` for the club chip. `transactions` is the club's own
// roster-move ledger — but that page reads only the MLB-org nightly file
// (`screens/team/data/loadTransactions.js`) and resolves empty for a farm
// club, so a MiLB story would land its own club chip on a page it just
// disproved. Send those to the hub's front door instead, same as any other
// caller with no tab opinion; the MLB fold-up keeps the real ledger.
function clubTabFor(teamId) {
  return isMlbTeamId(teamId) ? 'transactions' : 'overview'
}

export function MoveRow({ story, compact = false }) {
  const tone = TYPE_TONE[story.type]
  const abbr = teamAbbr({ id: story.teamId })
  const lead = compact ? story.rail?.[0] : null
  return (
    <li
      className={`wire__row${compact ? ' wire__row--compact' : ''}`}
      data-move-row=""
      // The spine is the club's own colour, decorative and text-free — no
      // contrast floor applies to it, and none of the row's copy sits on it.
      style={{ '--wire-club': teamPrimaryColor(story.teamId) || 'var(--graphite)' }}
    >
      {!compact && (
        <div className="wire__faces">
          {story.rail.slice(0, FACES_PER_ROW).map((slot, i) => (
            <Face key={slot.playerId ?? i} slot={slot} />
          ))}
        </div>
      )}
      <div className="wire__body">
        <div className="wire__kicker">
          {lead && (
            <span className={`banner ${BANNER_TONE[lead.role] ?? 'banner--move'}`}>
              {lead.banner}
            </span>
          )}
          <TeamLink
            id={story.teamId}
            tab={clubTabFor(story.teamId)}
            className="wire__club"
            ariaLabel={`${abbr} transactions`}
          >
            <TeamLogo teamId={story.teamId} size={18} className="wire__mark" />
            <span>{abbr}</span>
          </TeamLink>
          {tone && (
            <span className={`wire__type wire__type--${tone}`}>{story.typeLabel}</span>
          )}
        </div>
        <Cutline segments={story.cutline} />
      </div>
    </li>
  )
}

// The ordered run of datelines and stories, drawn identically on every surface.
// The caller owns the <ul> — its ref, its clamp, its scrolling; only what goes
// INSIDE it is shared, which is the whole point of this module. `compact` is
// passed straight through to MoveRow; a dateline is the same either way.
export function MoveItems({ items, compact = false }) {
  return items.map((item) =>
    item.kind === 'date' ? (
      <li className="wire__date" key={item.key}>
        <span className="wire__dateline">{dateline(item.date)}</span>
        <span className="wire__rule" aria-hidden="true" />
        <span className="wire__count">{item.count}</span>
      </li>
    ) : (
      <MoveRow key={item.key} story={item.story} compact={compact} />
    ),
  )
}
