import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadMoreTeamTransactions } from '../api/teamTransactions.js'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { DeckNudge } from './DeckNudge.jsx'

// The deck's per-card scroll step (card width + gap, both from .txcard__scroll
// / .txstory in index.css) — DeckNudge's click target. Most cards are 320px
// (360px for a --wide 3-headshot rail), so this lands a click short of a
// full card on those; the deck's own scroll-snap settles the rest.
const CARD_STEP = 330

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
// a playerId or teamId linked to that player's/team's page (same PlayerLink/
// TeamLink treatment used elsewhere, e.g. TransactionTimeline's own
// linkifyNames). Only a player's name gets the bold "headline word"
// treatment (txstory__namelink, styled in index.css) — a team name is a
// plain link, so it doesn't compete with the player for emphasis.
function Cutline({ segments }) {
  return (
    <p className="txstory__cutline">
      {segments.map((seg, i) => {
        if (seg.playerId) {
          return <PlayerLink key={i} id={seg.playerId} className="txstory__namelink">{seg.text}</PlayerLink>
        }
        if (seg.teamId) {
          return <TeamLink key={i} id={seg.teamId}>{seg.text}</TeamLink>
        }
        return <Fragment key={i}>{seg.text}</Fragment>
      })}
    </p>
  )
}

// One swipeable card — its own dateline (consecutive cards can span
// different days once the day-header is gone), rail, type pill, cutline.
function TxStory({ story }) {
  const tone = TYPE_TONE[story.type] ?? 'move'
  // A 3-headshot rail (a shuffle, a multi-player trade) crowds the base
  // width's cutline wrap — a wider card for those specifically.
  const wide = story.rail.length >= 3
  return (
    <div className={`txstory${wide ? ' txstory--wide' : ''}`}>
      <div className="txstory__date">{dateline(story.date)}</div>
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

// How many story cards render up front, and how many more each lazy-load
// batch reveals — either from days already fetched (just widen the visible
// slice) or, once that's exhausted, from a fresh loadMoreTeamTransactions
// page. Both comfortably inside a phone's initial paint either way.
const INITIAL_CARDS = 12
const REVEAL_BATCH = 8

// The team profile's Team Transactions card — a horizontally swipeable strip
// of story cards (see .scratch/team-transactions/ for the original day-
// grouped design; reworked into a horizontal scroller per feedback so it
// reads as a deck to flip through on a touchscreen and uses the full card
// width at every viewport, rather than a vertical list capped to a reading
// column). Spoiler-free (roster moves carry no score), so no SealBox is
// involved; `asOf` is purely temporal hygiene, matching TeamScoreCard/
// PostseasonOddsCard's own "through {asOf}" convention.
//
// `initialDays`/`initialCursor`/`initialHasMore` come from the page's own
// loadTeam() (the first loadMoreTeamTransactions page, fetched alongside
// everything else); the caller remounts this component on team/asOf change
// (key={`${teamId}-${asOf ?? ''}`}, the same technique TeamPage already uses
// for SeriesStrip) rather than syncing props via an effect.
export function TeamTransactionsCard({ teamId, asOf, initialDays, initialCursor, initialHasMore }) {
  const [days, setDays] = useState(initialDays)
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INITIAL_CARDS)

  // The day-grouped pages flattened into one chronological story sequence —
  // each card carries its own date now that there's no shared day header.
  const flatStories = useMemo(
    () => days.flatMap((day) => day.stories.map((story) => ({ ...story, date: day.date }))),
    [days],
  )
  const visibleStories = flatStories.slice(0, visibleCount)

  const scrollRef = useRef(null)
  const sentinelRef = useRef(null)
  const loadingMoreRef = useRef(false)

  // Widens the visible slice (already-fetched days may hold more than's
  // currently shown) or, once that buffer is exhausted, fetches another
  // page of days. The ref closes the small gap before React commits the
  // loading state, preventing duplicate observer/button requests.
  const revealMore = useCallback(async () => {
    if (loadingMoreRef.current) return
    if (visibleCount < flatStories.length) {
      setVisibleCount((n) => n + REVEAL_BATCH)
      setLoadError(false)
      return
    }
    if (!hasMore) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadError(false)
    try {
      const page = await loadMoreTeamTransactions(teamId, cursor, asOf)
      setDays((prev) => [...prev, ...page.days])
      setCursor(page.cursor)
      setHasMore(page.hasMore)
      setVisibleCount((n) => n + REVEAL_BATCH)
    } catch {
      setLoadError(true)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [asOf, cursor, flatStories.length, hasMore, teamId, visibleCount])

  // A trailing sentinel inside the scroll row triggers revealMore once it's
  // within reach — a horizontal rootMargin lookahead so more cards are ready
  // before the user physically swipes to the end. The button rendered beside
  // it remains a keyboard-accessible fallback when the API is unavailable.
  useEffect(() => {
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) revealMore()
      },
      { root, rootMargin: '0px 320px 0px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [revealMore])

  if (!flatStories.length) return null

  return (
    <section className="txcard" aria-label="Team Transactions">
      <div className="txcard__head">
        <span>Transactions</span>
        <span className="txcard__headright">
          <DeckNudge scrollRef={scrollRef} cardStep={CARD_STEP} label="team transactions" />
          {asOf && <em>through {asOf}</em>}
        </span>
      </div>
      <div
        className="txcard__scroll"
        ref={scrollRef}
        role="region"
        aria-label="Team transaction stories"
        tabIndex={0}
      >
        {visibleStories.map((story) => (
          <TxStory key={story.id} story={story} />
        ))}
        {(visibleCount < flatStories.length || hasMore) && (
          <button
            type="button"
            className="txcard__more"
            onClick={revealMore}
            disabled={loadingMore}
            aria-live="polite"
          >
            {loadingMore ? 'Loading transactions…' : loadError ? 'Try loading again' : 'Load more transactions'}
          </button>
        )}
        <div className="txcard__sentinel" ref={sentinelRef} aria-hidden="true" />
      </div>
    </section>
  )
}
