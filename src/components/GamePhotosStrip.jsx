import { useEffect, useRef, useState } from 'react'
import { fetchGamePhotos } from '../api/gamePhotos.js'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { gamePhotosPath } from '../lib/route.js'
import { SectionMasthead } from './SectionMasthead.jsx'

// This game's high-res photo thumbnails, capped by the same navy/gold
// masthead as Lineup Strength / Bullpen Tonight, with a "VIEW ALL" shortcut
// to the full Game Photos page (`GamePhotosPage.jsx`, `/photos/{gamePk}`)
// pre-loaded to this game. Each thumbnail opens its original full-resolution
// file directly, same as the Game Photos grid.
//
// The strip packs into columns of 1 row on phone / 3 rows from the wide
// breakpoint up (`.photostrip__body`'s media query in index.css — BoxScore.jsx
// renders this stacked under Three Stars in the box score's right-hand
// column, where the extra rows fill the space that column's shorter content
// leaves beside the left column's Decisions/Game Score) and scrolls
// horizontally through however many photos the game has. Square nav arrows
// (same idiom as SeasonSeriesStrip) appear only when the strip actually
// overflows AND the device has a mouse/trackpad (`.photostrip__nav`'s own
// `(hover: hover)` media query) — a touchscreen already swipes it natively,
// so permanently-visible arrows there would just be clutter.
//
// SPOILER RULE: `fetchGamePhotos` is deliberately NOT reveal-only in
// api/gamePhotos.js's own sense (it carries no SealBox of its own — see that
// module's header) because a recap/celebration photo narrates the outcome
// just by looking at it, same risk as a highlight clip's title. This
// component is therefore only ever rendered from inside BoxScore's SealBox
// reveal function (BoxScore.jsx), never above/outside it — the seal is what
// keeps it safe, not anything in here. Renders nothing while loading, on
// fetch failure, or for a game with no editorial photo package yet.
export function GamePhotosStrip({ gamePk }) {
  const navigate = useNav()
  const { data: photos } = useAsync(() => fetchGamePhotos(gamePk), [gamePk])
  const stripRef = useRef(null)
  const [canScroll, setCanScroll] = useState(false)

  // Re-checked on resize/row-count change since the wide breakpoint's extra
  // rows can turn an overflowing phone-width strip into one that already
  // fits, and vice versa.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [photos?.length])

  if (!photos || photos.length === 0) return null

  const scroll = (dir) => {
    const el = stripRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="metriccard photostrip">
      <SectionMasthead title="Photos">
        <button
          type="button"
          className="photostrip__viewall"
          onClick={() => navigate(gamePhotosPath(gamePk))}
        >
          View all
          {/* Same external-link glyph as the masthead's own Watch button
              (GameView.jsx's WatchButton, .watchbtn__ext) — this hands off to
              a whole other page, not an inline action, same as that one hands
              off to MLB.TV. */}
          <span className="photostrip__viewallarrow" aria-hidden="true">↗</span>
        </button>
      </SectionMasthead>
      <div className="metriccard__body photostrip__wrap">
        {canScroll && (
          <button
            type="button"
            className="photostrip__nav photostrip__nav--left"
            onClick={() => scroll(-1)}
            aria-label="Scroll to earlier photos"
          >
            &#8249;
          </button>
        )}
        <div className="photostrip__body" ref={stripRef}>
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.original}
              target="_blank"
              rel="noreferrer"
              className="photostrip__thumb"
              aria-label="Open full-resolution photo in a new tab"
            >
              <img src={photo.thumb} alt="" loading="lazy" />
            </a>
          ))}
        </div>
        {canScroll && (
          <button
            type="button"
            className="photostrip__nav photostrip__nav--right"
            onClick={() => scroll(1)}
            aria-label="Scroll to more photos"
          >
            &#8250;
          </button>
        )}
      </div>
    </section>
  )
}
