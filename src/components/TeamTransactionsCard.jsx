import { Fragment, useState } from 'react'
import { loadMoreTeamTransactions } from '../api/teamTransactions.js'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
// Full spelled-out dateline ("Sunday, July 12") per the locked design — the
// CSS applies the app's ALL-CAPS invariant, so this stays mixed-case here
// (no per-component .toUpperCase(), see ADR-0017 / check-name-casing.mjs).
function dateline(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[m - 1]} ${d}`
}

const BANNER_TONE = { in: 'banner--in', out: 'banner--out', move: 'banner--move' }
// Reuses the same three-tone system TransactionTimeline's own chips already
// use (add/out/move — field/clay/muted), mapped per story type rather than
// per row: an add-flavored story (a trade-in, a signing) reads green, a
// health/departure story (an IL placement, a suspension) reads clay, and a
// mixed/neutral one (a shuffle, a solo roster move) stays graphite.
const TYPE_TONE = {
  trade: 'add',
  signing: 'add',
  'injured-list': 'out',
  suspension: 'out',
  shuffle: 'move',
  'roster-move': 'move',
}

// One rail slot: kicker banner (In/Out/Up/Down/Up-Down/IL-N) over a headshot,
// a surname caption below that links to the player's page (same spoiler-safe
// PlayerLink treatment used everywhere else in the app).
function RailSlot({ slot }) {
  return (
    <div className="photorail__slot">
      <span className={`banner ${BANNER_TONE[slot.role] ?? 'banner--move'}`}>{slot.banner}</span>
      <Headshot personId={slot.playerId} name={slot.name} teamId={slot.tintTeamId} className="txstory__shot" />
      <PlayerLink id={slot.playerId} className="photo__cap">{slot.surname}</PlayerLink>
    </div>
  )
}

// A cutline's segment array — plain sentence text, with any segment carrying
// a playerId linked to that player's page (same PlayerLink treatment as the
// rail caption and TransactionTimeline's own linkifyNames). No bold/italic
// emphasis — every segment reads as ordinary sentence prose.
function Cutline({ segments }) {
  return (
    <p className="txstory__cutline">
      {segments.map((seg, i) =>
        seg.playerId ? (
          <PlayerLink key={i} id={seg.playerId}>{seg.text}</PlayerLink>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </p>
  )
}

function TxStory({ story }) {
  const tone = TYPE_TONE[story.type] ?? 'move'
  return (
    <div className="txstory">
      {story.rail.length > 0 && (
        <div className="photorail">
          {story.rail.map((slot, i) => (
            <RailSlot key={slot.playerId ?? i} slot={slot} />
          ))}
        </div>
      )}
      <span className={`txstory__type txstory__type--${tone}`}>{story.typeLabel}</span>
      <Cutline segments={story.cutline} />
    </div>
  )
}

// The team profile's Team Transactions card — a day-grouped, story-paired
// read of the club's roster-move feed (see .scratch/team-transactions/ for
// the full design). Spoiler-free (roster moves carry no score), so no
// SealBox is involved; `asOf` is purely temporal hygiene, matching
// TeamScoreCard/PostseasonOddsCard's own "through {asOf}" convention.
//
// `initialDays`/`initialCursor`/`initialHasMore` come from the page's own
// loadTeam() (the first loadMoreTeamTransactions page, fetched alongside
// everything else); the caller remounts this component on team/asOf change
// (key={`${teamId}-${asOf ?? ''}`}, the same technique TeamPage already uses
// for SeriesStrip) rather than syncing props via an effect. "Load more" pages
// further back on demand — the one place this card does its own fetching.
export function TeamTransactionsCard({ teamId, asOf, initialDays, initialCursor, initialHasMore }) {
  const [days, setDays] = useState(initialDays)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)

  if (!days.length) return null

  async function handleLoadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    const page = await loadMoreTeamTransactions(teamId, cursor, asOf)
    setDays((prev) => [...prev, ...page.days])
    setCursor(page.cursor)
    setHasMore(page.hasMore)
    setLoadingMore(false)
  }

  return (
    <section className="txcard" aria-label="Team Transactions">
      <div className="txcard__head">
        <span>Transactions</span>
        {asOf && <em>through {asOf}</em>}
      </div>
      {days.map((day) => (
        <div className="txday" key={day.date}>
          <div className="txday__date">{dateline(day.date)}</div>
          {day.stories.map((story) => (
            <TxStory key={story.id} story={story} />
          ))}
        </div>
      ))}
      {hasMore && (
        <button type="button" className="txcard__more" onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}
