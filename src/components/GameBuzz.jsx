import { useState } from 'react'
import { fetchGameBuzz } from '../api/buzz.js'
import { useAsync } from '../hooks/useAsync.js'
import { Loader } from './Loader.jsx'

// How many posts show before folding the rest behind a Show-more button —
// same collapsed-list idiom as the Insights card's INSIGHTS_SHOWN
// (BoxScore.jsx). Posts already arrive engagement-ranked (see buzz.js), so
// the cap keeps the best ones on top without dropping anything.
const BUZZ_SHOWN = 4

// GAME NOTES buzz: the night's best Bluesky posts about this game, to crib the
// storytelling numbers onto paper. Score-revealing (post text states the
// final), so `GameBuzzCard` is only ever rendered from inside the box score's
// own SealBox reveal branch — it carries no seal of its own. The fetch still
// only mounts once that branch runs, so no request for spoiler content fires
// until the user taps the one box-score seal — same discipline as the
// reveal-only selectors, just sharing the box score's single tap instead of
// asking for a second one. See src/api/buzz.js and docs/game-buzz.md.

function clockTime(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Mounted only after reveal → the useAsync fetch fires on reveal, never before.
function GameBuzzList({ feed }) {
  const { loading, error, data, reload } = useAsync(() => fetchGameBuzz(feed), [feed])
  const [showAll, setShowAll] = useState(false)

  if (loading) return <Loader size="inline" />
  if (error) {
    return (
      <div className="buzz__state">
        <p className="hint hint--error">Couldn&apos;t reach Bluesky.</p>
        <button type="button" className="btn" onClick={reload}>
          Retry
        </button>
      </div>
    )
  }
  if (!data || data.length === 0) {
    return (
      <p className="hint hint--prose">
        No buzz found for this game&apos;s window — thin at minor-league parks and for
        games older than a week or so.
      </p>
    )
  }

  const shown = showAll ? data : data.slice(0, BUZZ_SHOWN)
  const hiddenCount = data.length - shown.length

  return (
    <>
      <ul className="buzz__list">
        {shown.map((p) => (
          <li className="buzz__post" key={p.url}>
            <div className="buzz__meta">
              <a
                className="buzz__handle"
                href={p.url}
                target="_blank"
                rel="noreferrer"
              >
                @{p.handle}
              </a>
              {p.createdAt && <span className="buzz__time">{clockTime(p.createdAt)}</span>}
              <span className="buzz__eng" aria-label="engagement">
                ♥{p.metrics.likes} ↺{p.metrics.reshares}
              </span>
            </div>
            <p className="buzz__text">{p.text}</p>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button type="button" className="bs__noteMore" onClick={() => setShowAll(true)}>
          Show {hiddenCount} more {hiddenCount === 1 ? 'post' : 'posts'}
        </button>
      )}
    </>
  )
}

// The Bluesky buzz card, folded into the box score's own reveal — see the
// module doc above for why it carries no seal of its own anymore.
export function GameBuzzCard({ feed }) {
  return (
    <section className="buzz">
      <div className="buzz__head">
        <h3 className="buzz__title">Game buzz</h3>
        <span className="buzz__note">Bluesky · for your GAME NOTES</span>
      </div>
      <div className="buzz__body">
        <GameBuzzList feed={feed} />
      </div>
    </section>
  )
}
