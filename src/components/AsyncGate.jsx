import { SiteHeader } from './SiteHeader.jsx'
import { BackBtn } from './BackBtn.jsx'

// The cold-load loading/error/not-found screen shared by PlayerPage and
// TeamPage: while there's no data yet, show "Loading {noun}…"; if the fetch
// settles with nothing, show a retry-or-not-found message. Call as a plain
// function (not JSX) and early-return its result when non-null — once `data`
// exists it returns null and the caller renders its own content instead.
export function AsyncGate({ loading, error, data, screenClass, noun, onBack }) {
  if (loading && !data) {
    return (
      <div className={`screen ${screenClass}`}>
        <SiteHeader />
        <BackBtn onClick={onBack} />
        <p className="hint">Loading {noun}…</p>
      </div>
    )
  }
  if (!data) {
    const capitalized = noun[0].toUpperCase() + noun.slice(1)
    return (
      <div className={`screen ${screenClass}`}>
        <SiteHeader />
        <BackBtn onClick={onBack} />
        <p className="hint hint--error">
          {error ? `Couldn’t load this ${noun}. Try again.` : `${capitalized} not found.`}
        </p>
      </div>
    )
  }
  return null
}
