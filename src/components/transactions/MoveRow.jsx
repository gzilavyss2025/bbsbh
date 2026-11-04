import { Component, Fragment, Suspense, useMemo } from 'react'
import { lazyNamed } from '../../lib/react/lazyNamed.js'
import { reportCrash } from '../../lib/crash/report.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { fetchNotableLists, isMajorMove } from '../../api/transactions/major.js'
import { monthName } from '../../lib/time/months.js'
import { isMlbTeamId, teamAbbr, teamPrimaryColor } from '../../lib/teams.js'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { ReplyQuotes, moveAnchor, useReplies } from './ReplyQuote.jsx'
// The player notes and their sheet load on their own, off the first load: a
// ledger row draws its plain sentence until they arrive.
const WireFacts = lazyNamed(() => import('./WireFacts.jsx'), 'WireFacts')

// A notes chunk that fails to load (a 404 after a deploy, a phone gone offline)
// leaves the row its plain sentence, never takes the ledger down
// (player/next/SlotBoundary.js is the same rule for a player-page card).
class WireFactsBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // The crash signal (#2514): the kind only, never the error (lib/crash/report.js).
    reportCrash({ kind: 'render' })
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

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
// A roster move and its date carry no score (see
// api/transactions/leagueFeed.js), so nothing below is wrapped in a SealBox and
// none is wanted.

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

// Spelled-out dateline. Mixed-case here on purpose: the CSS applies the
// app's ALL-CAPS invariant, never a per-component .toUpperCase() (ADR-0017 /
// check-name-casing.mjs).
//
// `datelineParts` is the same walk stopped one step early, for the day
// markers that write the date abbreviated and stacked.
// One weekday table and one month table for every surface, so a deck tab and
// a wire row can never name the same day differently.
export function datelineParts(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(date.getTime())) return { weekday: '', month: '', day: d }
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
  return { weekday, month: monthName(date.getUTCMonth()), day: d }
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
// `tail` is prose that runs on after the sentence in the same paragraph: a
// single player's background note on the offseason ledger (WireFacts.jsx).
export function Cutline({ segments, className = 'wire__cutline', linked = true, tail = null }) {
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
      {tail && <span className="wire__tail"> {tail}</span>}
    </p>
  )
}

// A cutline cut at its semicolons, one clause per player: the wide card's
// paragraphs. Each clause gets its capital and its full stop back.
function splitClauses(segments) {
  const out = [[]]
  const push = (seg) => {
    const clause = out[out.length - 1]
    if (!clause.some((c) => c.text.trim())) {
      const t = seg.text.trimStart()
      if (!t) return
      seg = { ...seg, text: t.charAt(0).toUpperCase() + t.slice(1) } // caps-js-exempt: sentence case for a split clause
    }
    clause.push(seg)
  }
  for (const seg of segments ?? []) {
    if (seg.playerId || seg.teamId || !seg.text.includes(';')) {
      push(seg)
      continue
    }
    const pieces = seg.text.split(';')
    push({ text: pieces[0] + '.' })
    for (const piece of pieces.slice(1)) {
      out.push([])
      push({ text: piece })
    }
  }
  return out.filter((c) => c.length)
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

// `marks` is the offseason ledger's row: a bigger club mark, and on a trade
// the other club's mark beside it (the first club the cutline names). `line`
// is that ledger's minor move (transactions/major.js): the same row with no
// faces, so a routine move reads as one entry rather than a card. `date` turns
// on the player's background under the sentence (WireFacts.jsx). `quotes` are
// the moves this one replies to (ReplyQuote.jsx), drawn above its kicker;
// `day` is the row's own date, which a same-day quote leaves off.
// `factsStory` is the story with its club filled in, for the notes (MoveItems).
export function MoveRow({ story, compact = false, marks = false, line = false, date = null, quotes = null, day = null, factsStory = story }) {
  const tone = TYPE_TONE[story.type]
  const abbr = teamAbbr({ id: story.teamId })
  const lead = compact ? story.rail?.[0] : null
  const markSize = marks ? 28 : 18
  const partnerId =
    marks && story.type === 'trade'
      ? story.cutline?.find((seg) => seg.teamId && seg.teamId !== story.teamId)?.teamId
      : null
  return (
    <li
      className={`wire__row${compact ? ' wire__row--compact' : ''}${line ? ' wire__row--line' : ''}`}
      id={moveAnchor(story.id)}
      data-move-row=""
      // The spine is the club's own colour, decorative and text-free — no
      // contrast floor applies to it, and none of the row's copy sits on it.
      style={{ '--wire-club': teamPrimaryColor(story.teamId) || 'var(--graphite)' }}
    >
      {!compact && !line && (
        <div className="wire__faces">
          {story.rail.slice(0, marks ? story.rail.length : FACES_PER_ROW).map((slot, i) => (
            <Face key={slot.playerId ?? i} slot={slot} />
          ))}
        </div>
      )}
      <div className="wire__body">
        <ReplyQuotes quotes={quotes} date={day} />
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
            <TeamLogo teamId={story.teamId} size={markSize} className="wire__mark" />
            <span>{abbr}</span>
          </TeamLink>
          {partnerId && (
            <TeamLink id={partnerId} tab={clubTabFor(partnerId)} className="wire__club" ariaLabel={`${teamAbbr({ id: partnerId })} transactions`}>
              <TeamLogo teamId={partnerId} size={markSize} className="wire__mark" />
            </TeamLink>
          )}
          {tone && (
            <span className={`wire__type wire__type--${tone}`}>{story.typeLabel}</span>
          )}
        </div>
        {date ? (
          <WireFactsBoundary fallback={<Cutline segments={story.cutline} />}>
            <Suspense fallback={<Cutline segments={story.cutline} />}>
              {/* A 27th man's trip is told in his note, so even a one-line row runs it on. */}
              <WireFacts story={factsStory} date={date} line={line && !quotes?.some((q) => q.game)}>
                {(tail, notes, toggle) =>
                  notes?.size > 1 ? (
                    <>
                      <Cutline segments={story.cutline} tail={tail} className="wire__cutline wire__cutline--joined" />
                      <div className="wire__split">
                        {splitClauses(story.cutline).map((clause, i, all) => {
                          const id = clause.find((seg) => seg.playerId)?.playerId
                          const note = notes.get(id)
                          return (
                            <Cutline
                              key={i}
                              segments={clause}
                              tail={<>{note && `${note} `}{i === all.length - 1 && toggle}</>}
                            />
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <Cutline segments={story.cutline} tail={tail} />
                  )
                }
              </WireFacts>
            </Suspense>
          </WireFactsBoundary>
        ) : (
          <Cutline segments={story.cutline} />
        )}
      </div>
    </li>
  )
}

// Which moves are major: null until the notable lists arrive, when every row
// draws as a card.
function useIsMajor() {
  const { data: lists } = useAsync(() => fetchNotableLists(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  return lists ? (story) => isMajorMove(story, { lists, favoriteTeamId }) : null
}

// The ordered run of datelines and stories, drawn identically on every surface.
// The caller owns the <ul> — its ref, its clamp, its scrolling; only what goes
// INSIDE it is shared, which is the whole point of this module. `compact` is
// passed straight through to MoveRow; a dateline is the same either way.
//
// THE WIRE STANDARD lives here, so every surface that draws moves gets it
// (the player page's moves module is the one exception; it draws its own):
// a major move (transactions/major.js) is a full card and the rest one line
// each, and every row carries its player notes (WireFacts.jsx).
// Replies are found among the items drawn here, so every quote's original is on
// the page to scroll to.
export function MoveItems({ items, compact = false, marks = false, teamId = null }) {
  const isMajor = useIsMajor()
  // A club ledger's stories carry no club (`teamId`); the replies and the notes
  // both need it, so it is filled in once, here. The row itself still draws the
  // story as it came, so a club's own page grows no mark of its own on every row.
  const filled = useMemo(
    () => (teamId ? items.map((i) => (i.kind === 'story' && i.story.teamId == null ? { ...i, story: { ...i.story, teamId } } : i)) : items),
    [items, teamId],
  )
  const replies = useReplies(filled)
  return filled.map((item, n) =>
    item.kind === 'date' ? (
      <li className="wire__date" key={item.key}>
        <span className="wire__dateline">{dateline(item.date)}</span>
        <span className="wire__rule" aria-hidden="true" />
      </li>
    ) : (
      <MoveRow key={item.key} story={items[n].story} factsStory={item.story} compact={compact} marks={marks} line={isMajor ? !isMajor(item.story) : false} date={item.date} quotes={replies[item.story.id]} day={item.date} />
    ),
  )
}
