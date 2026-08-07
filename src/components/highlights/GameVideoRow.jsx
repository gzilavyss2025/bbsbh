import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  formatClipDuration,
  highlightPoster,
  selectCondensedGame,
  selectGameClips,
} from '../../api/highlights.js'
import { HighlightClipCard } from './HighlightClipCard.jsx'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'

// The box score's video row: MLB's condensed game on the left, this game's own
// highlight reel scrolling on the right, sitting between the line score and the
// by-inning digest. On a phone the two stack in that order — the duo/col
// wrappers are `display: contents` below the wide breakpoint, so this is the
// same collapse every other box-score pairing gets for free.
//
// SPOILER RULE, and it is the whole safety story: this component is only ever
// rendered from INSIDE BoxScore's SealBox reveal function, never above or
// outside it. A clip title narrates the outcome ("Luis Torrens' three-run home
// run") and a poster is a picture of the play, so nothing here may reach the
// DOM before the tap. It calls the reveal-only selectors on its own inputs
// rather than taking them precomputed — its render top-level IS post-reveal,
// the same footing GamePhotosStrip stands on (see that component's header).
// Mounting it anywhere else would break ADR-0001, and no prop can save it.
//
// `items` is the raw `content` array GameView already fetched for the Play of
// the Game button — this is a second READ of that one fetch, not a second
// request.
//
// Both halves degrade INDEPENDENTLY, and both absences are routine rather than
// edges: MLB posts the condensed cut about half an hour after the final out, so
// a live game has clips and no condensed game, and a MiLB park has no content
// package at all. Whichever half survives takes the full row (that's
// `.bs__duo > :only-child`), and with neither the row doesn't render.
export function GameVideoRow({ items }) {
  const [open, setOpen] = useState(null)

  const condensed = useMemo(() => selectCondensedGame(items), [items])
  // The raw `content` items carry an `image.cuts[]` ladder rather than a
  // resolved poster URL, which is what a static team-file clip stores and what
  // HighlightClipCard expects — resolved here so the card stays dumb about
  // where its clip came from.
  const cards = useMemo(
    () => selectGameClips(items).map((item) => ({ item, poster: highlightPoster(item), title: item.title })),
    [items],
  )
  const condensedPoster = condensed ? highlightPoster(condensed) : null
  const runtime = formatClipDuration(condensed?.duration)

  if (!condensed && cards.length === 0) return null

  return (
    <>
      <div className="bs__duo">
        {condensed && (
          <div className="bs__col">
            <HighlightClipCard
              clip={{ poster: condensedPoster, title: condensed.title }}
              variant="feature"
              label={`Condensed Game${runtime ? ` (${runtime})` : ''}`}
              onOpen={() => setOpen(condensed)}
            />
          </div>
        )}
        {cards.length > 0 && (
          <div className="bs__col">
            <ClipRail cards={cards} onOpen={setOpen} />
          </div>
        )}
      </div>
      {open && <HighlightSheet item={open} onClose={() => setOpen(null)} />}
    </>
  )
}

// The reel itself. Same shell shape as the team hub's photo/highlight rails —
// a scroll-snapping track between two nav buttons — but anchored at the START
// and never re-anchored: those rails show a season and open on the newest clip
// at the right edge, while this one is a single game and reads first inning
// first, like the line score above it.
function ClipRail({ cards, onOpen }) {
  const trackRef = useRef(null)
  const [canScroll, setCanScroll] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cards.length])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => {
      setAtStart(el.scrollLeft <= 1)
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
    }
    update()
    el.addEventListener('scroll', update)
    return () => el.removeEventListener('scroll', update)
  }, [cards.length, canScroll])

  const scroll = (dir) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <div className="cliprail">
      {canScroll && (
        <button
          type="button"
          className="cliprail__nav"
          onClick={() => scroll(-1)}
          disabled={atStart}
          aria-label="Scroll to earlier highlights"
        >
          &lsaquo;
        </button>
      )}
      <div className="cliprail__track" ref={trackRef}>
        {cards.map((card, i) => (
          // `id` is the content item's readable slug and was unique across the
          // whole live sweep (see classifyHighlight's note on clipId); the
          // index tail is belt-and-braces for a game where MLB repeats one.
          <HighlightClipCard
            key={`${card.item.id ?? 'clip'}-${i}`}
            clip={card}
            onOpen={() => onOpen(card.item)}
          />
        ))}
      </div>
      {canScroll && (
        <button
          type="button"
          className="cliprail__nav"
          onClick={() => scroll(1)}
          disabled={atEnd}
          aria-label="Scroll to later highlights"
        >
          &rsaquo;
        </button>
      )}
    </div>
  )
}
