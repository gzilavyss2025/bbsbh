import { fetchGameBuzz } from '../api/buzz.js'
import { useAsync } from '../hooks/useAsync.js'
import { SealBox } from './SealBox.jsx'

// GAME NOTES buzz: the night's best Bluesky posts about this game, to crib the
// storytelling numbers onto paper. Score-revealing (post text states the
// final), so it lives behind its own seal in the box score. The fetcher below
// only mounts inside the SealBox reveal branch, so no request for spoiler
// content fires until the user taps — same discipline as the reveal-only
// selectors. See src/api/buzz.js and docs/game-buzz.md.

function clockTime(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Mounted only after reveal → the useAsync fetch fires on reveal, never before.
function GameBuzzList({ feed }) {
  const { loading, error, data, reload } = useAsync(() => fetchGameBuzz(feed), [feed])

  if (loading) return <p className="hint buzz__loading">Loading…</p>
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

  return (
    <ul className="buzz__list">
      {data.map((p) => (
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
  )
}

// The little hidden card in the box score. Heading + caption stay spoiler-free;
// the seal hides the posts (and defers their fetch) until the tap.
export function GameBuzzCard({ feed }) {
  return (
    <section className="buzz">
      <div className="buzz__head">
        <h3 className="buzz__title">Game buzz</h3>
        <span className="buzz__note">Bluesky · for your GAME NOTES</span>
      </div>
      <SealBox label="Tap to reveal the game buzz">
        {() => <GameBuzzList feed={feed} />}
      </SealBox>
    </section>
  )
}
