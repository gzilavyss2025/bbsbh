import { SiteHeader } from './SiteHeader.jsx'
import { BackBtn } from './BackBtn.jsx'
import { Loader } from './Loader.jsx'

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
        <Loader />
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

// The inline counterpart to AsyncGate, for screens whose chrome (header,
// controls, an already-rendered list shell) stays on screen regardless of
// fetch state — only a status region needs to switch between a loader, an
// error hint, an empty hint, or nothing. Unlike AsyncGate this is real JSX,
// dropped in place among a screen's other elements rather than replacing the
// whole render.
//
// `hasData` is the caller's own "is there something worth showing" signal —
// often `data && someArray.length > 0` rather than a bare `data` truthiness
// check (a resolved-but-empty response is not the same as "still loading").
// It also decides which of the two error treatments applies: a COLD error
// (no data ever landed) shows a blocking hint, optionally with a Retry button
// via `onRetry`; a STALE error (data already on screen, e.g. a live-game
// Refresh or a Standings date-jump that failed) shows a smaller non-blocking
// notice via `staleErrorMessage` — omit it to render nothing for that case, matching
// screens where that combination can't happen.
export function AsyncStatus({
  loading,
  error,
  hasData,
  errorMessage = 'Couldn’t load. Try again.',
  staleErrorMessage,
  emptyMessage,
  emptyProse = false,
  onRetry,
}) {
  if (loading && !hasData) return <Loader />
  if (error && !hasData) {
    return (
      <>
        <p className="hint hint--error" role="status">
          {errorMessage}
        </p>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </>
    )
  }
  if (error && hasData && staleErrorMessage) {
    return (
      <p className="hint hint--error" role="status">
        {staleErrorMessage}
      </p>
    )
  }
  if (!loading && !error && !hasData && emptyMessage) {
    return <p className={emptyProse ? 'hint hint--prose' : 'hint'}>{emptyMessage}</p>
  }
  return null
}
