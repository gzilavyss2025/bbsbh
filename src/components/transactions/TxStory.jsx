import { BANNER_TONE, Cutline, TYPE_TONE } from './MoveRow.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Card } from '../ui/frame/Card.jsx'

// One roster-move story drawn as a CARD — a headshot rail with surname
// captions over a type pill and the cutline. The club deck
// (TeamTransactionsCard.jsx) flips through these sideways; the club ledger
// page (screens/team/TeamTransactionsPage.jsx) stacks them down the page.
// Split out of the deck when the page arrived, for the same reason MoveRow.jsx
// was split out of the rail: the two surfaces differ in how a card is reached,
// never in what one looks like.
//
// The tone maps and the cutline renderer come from MoveRow.jsx, which is where
// every roster-move surface reads them — see its header.
//
// Spoiler-free by construction: a roster move and its date carry no score
// (api/transactions/leagueFeed.js), so there is no SealBox here.

// Above this many headshots the rail stops floating and lays out as a
// full-measure strip instead (.photorail--strip). The number is a measurement,
// not a taste call: at --shot-sm-w with a 6px gap a rail is `60n - 6` px wide,
// against the 340px of measure a --wide card has. A 4th photo leaves the
// cutline ~96px to wrap in, a 5th leaves ~36px, and a 6th is wider than the
// card outright — and a RIGHT float wider than its container overflows to the
// LEFT, which is what used to paint a big shuffle's photos over its own
// sentence and across the neighbouring card. Three still leaves a readable
// ~156px, so the magazine-caption float this deck was designed around is
// untouched for the ~95% of stories at or below it.
const RAIL_FLOAT_MAX = 3

// One rail slot: kicker banner (In/Out/Up/Down/Up-Down/IL-N) over a headshot,
// a surname caption below that links to the player's page (same spoiler-safe
// PlayerLink treatment used everywhere else in the app).
//
// `tintTeamId` is the MLB parent org for every slot, prospects included, so
// `isMlb` must come from the slot itself — Headshot's teamId-derived default
// would read a farmhand as a major-leaguer and skip his MiLB photo rung.
function RailSlot({ slot }) {
  return (
    <div className="photorail__slot">
      <span className={`banner ${BANNER_TONE[slot.role] ?? 'banner--move'}`}>{slot.banner}</span>
      <Headshot
        personId={slot.playerId}
        name={slot.name}
        teamId={slot.tintTeamId}
        isMlb={slot.isMlb ?? false}
        className="txstory__shot"
      />
      <PlayerLink id={slot.playerId} className="photo__cap">{slot.surname}</PlayerLink>
    </div>
  )
}

// The card itself. It carries NO dateline of its own: both surfaces group by
// day around it (the page's own heading), which is
// what took 950 of 3,199 repeated datelines off the club surfaces — 29.7% of
// cards restated the date of the card immediately before them, measured over
// the shipped 2026 club files.
export function TxStory({ story }) {
  const tone = TYPE_TONE[story.type]
  // A 3-headshot rail (a shuffle, a multi-player trade) crowds the base
  // width's cutline wrap — a wider card for those specifically. Still worth it
  // once the rail goes to a strip: the extra 40px buys a fourth slot per row
  // and shortens the long cutline those stories carry.
  const wide = story.rail.length >= 3
  const strip = story.rail.length > RAIL_FLOAT_MAX
  return (
    <Card as="div" body="flush" className={`txstory${wide ? ' txstory--wide' : ''}`}>
      {story.rail.length > 0 && (
        <div className={`photorail${strip ? ' photorail--strip' : ''}`}>
          {story.rail.map((slot, i) => (
            <RailSlot key={slot.playerId ?? i} slot={slot} />
          ))}
        </div>
      )}
      {tone && <span className={`txstory__type txstory__type--${tone}`}>{story.typeLabel}</span>}
      <Cutline segments={story.cutline} className="txstory__cutline" />
    </Card>
  )
}
