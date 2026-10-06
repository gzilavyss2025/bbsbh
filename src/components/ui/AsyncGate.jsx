import { SiteHeader } from '../chrome/SiteHeader.jsx'
import { BackBtn } from '../chrome/BackBtn.jsx'
import { Loader } from './Loader.jsx'
import { EmptyState } from './state/EmptyState.jsx'
import { Notice } from './state/Notice.jsx'
import { Button } from './control/Button.jsx'

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
    // Sentence capitalization of a dynamic word, not a redundant re-uppercase
    // of a name/label the CSS invariant already handles.
    const capitalized = noun[0].toUpperCase() + noun.slice(1) // caps-js-exempt
    return (
      <div className={`screen ${screenClass}`}>
        <SiteHeader />
        <BackBtn onClick={onBack} />
        <Notice tone="error" className="asyncstatus__notice">
          {error ? `Couldn’t load this ${noun}. Try again.` : `${capitalized} not found.`}
        </Notice>
      </div>
    )
  }
  return null
}

// The inline counterpart to AsyncGate, for screens whose chrome (header,
// controls, an already-rendered list shell) stays on screen regardless of
// fetch state — only a status region needs to switch between a loader, an
// error hint, an empty state, or nothing. Unlike AsyncGate this is real JSX,
// dropped in place among a screen's other elements rather than replacing the
// whole render.
//
// `hasData` is the caller's own "is there something worth showing" signal —
// often `data && someArray.length > 0` rather than a bare `data` truthiness
// check (a resolved-but-empty response is not the same as "still loading").
// It also decides which of the two error treatments applies: a COLD error
// (no data ever landed) shows an error Notice (role="alert"), with a Retry
// Button as its action via `onRetry`; a STALE error (data already on screen,
// e.g. a live-game Refresh or a Standings date-jump that failed) shows the same
// Notice with role="status" via `staleErrorMessage` (#1132, N4) — omit it to
// render nothing for that case, matching screens where that combination can't
// happen. The empty branch is the shared EmptyState (#1132): a dashed inset, no
// `.hint` padding, so the parent owns the space around it.
export function AsyncStatus({
  loading,
  error,
  hasData,
  errorMessage = 'Couldn’t load. Try again.',
  staleErrorMessage,
  emptyMessage,
  onRetry,
}) {
  if (loading && !hasData) return <Loader />
  if (error && !hasData) {
    return (
      <Notice
        tone="error"
        className="asyncstatus__notice"
        action={onRetry && <Button onClick={onRetry}>Retry</Button>}
      >
        {errorMessage}
      </Notice>
    )
  }
  if (error && hasData && staleErrorMessage) {
    return (
      <Notice tone="error" role="status" className="asyncstatus__notice">
        {staleErrorMessage}
      </Notice>
    )
  }
  if (!loading && !error && !hasData && emptyMessage) {
    return <EmptyState>{emptyMessage}</EmptyState>
  }
  return null
}
