import { Fragment } from 'react'
import { teamAbbr, teamPrimaryColor } from '../../lib/teams.js'
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
// Everything below is spoiler-free by construction — a roster move and its date
// carry no score (see api/transactions/leagueFeed.js) — so nothing here is
// wrapped in a SealBox and none is wanted.

// A story's rail runs one to three faces. Two is the whole in-and-out of a
// move and covers 33 of 35 stories in a measured window outright; the two
// three-face shuffles lose a photo, never a name — the cutline still bolds
// everyone. A third face would push the row past the sentence beside it.
const FACES_PER_ROW = 2

const BANNER_TONE = { in: 'banner--in', out: 'banner--out', move: 'banner--move' }
// The same per-story tone map the team page's card uses, so an add-flavoured
// story reads green and a health/departure one reads clay on both surfaces.
//
// `roster-move` is deliberately absent, and that absence is the rule: it is
// the pipeline's DEFAULT type, so on a real 48 hours it labelled 16 of 35 rows
// "Roster move" beside a banner already reading Up, Down, In or IL-60. A label
// on every row is not a label — it is noise with a heading's weight. What is
// left flags the rows worth a second look (a trade, an injured list, a
// shuffle) and stays silent on the routine ones.
const TYPE_TONE = {
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
// Spelled-out dateline, matching the team card's. Mixed-case here on purpose:
// the CSS applies the app's ALL-CAPS invariant, never a per-component
// .toUpperCase() (ADR-0017 / check-name-casing.mjs).
export function dateline(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[m - 1]} ${d}`
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
// the row's subject rather than an extra. `tab="games"` because that is the
// tab the club's own Transactions card lives on — TeamLink's header asks a
// caller whose subject IS one tab's content to say so, instead of landing the
// reader on an Overview preview of what they just tapped out of.
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
// keeps its type label — "Roster shuffle" beside one Up chip reads correctly,
// and two chips plus a mark plus an abbreviation plus a label do not fit 288px
// without wrapping the kicker onto a second line.
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
            tab="games"
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
