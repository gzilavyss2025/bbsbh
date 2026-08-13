import { memo } from 'react'
import { halfIndex } from '../../api/select.js'
import { HalfInning } from '../../components/inning/HalfInning.jsx'

// A no-op stand-in for HalfInning's onReveal, which HalfInning calls directly
// (not via `?.()`) both from SealBox's onReveal and from PlayByPlay's
// onStepComplete — so a presentationOnly render can't simply omit the prop
// without risking a crash the moment a preview page happens to mount already
// revealed (see the header comment below).
function noop() {}

// One half-inning "page": the play-by-play card (HalfInning, inside its
// SealBox). Pulled out of InningViewer.jsx so InningPageTurn can mount two of
// these at once during a forward navigation — the outgoing half and an inert
// preview of the incoming one — without duplicating this markup.
//
// A thin wrapper now — the stat/WPA row this page used to build only while
// NOT windowed (StatBox, AbsCard, WinProbChart, DueUpNextCard) moved
// permanently into the reference panel's ARMS tab (ReferencePanel.jsx), for
// every half, live or historical, rather than being built here and hidden.
//
// `presentationOnly` is for exactly that preview instance: it renders the
// SAME real (possibly still-sealed) content the interactive instance would —
// SealBox's own render-function-only-once-revealed gate (ADR-0002) is what
// keeps a sealed preview spoiler-safe, not this flag — but mutes every
// callback that would otherwise feed back into useRevealProgress state
// (onReveal, onStepInfo), so a preview mount/unmount can never itself advance
// the reveal mark or double-report a step. It is not a second reveal
// boundary; see ADR-0024. This holds regardless of `windowed`/`stacked` —
// PlayByPlay only ever runs inside HalfInning's SealBox render function, and
// a sealed preview never invokes that function at all.
// Memoized — the one boundary on this page that matters most. Everything under
// it (HalfInning, its SealBox, PlayByPlay's per-render passes over the whole
// play-by-play) is the most expensive subtree in the app, and InningViewer above
// it re-renders on every scorebug snapshot, step report and live-edge check.
// Every prop here is either a value, a memoized derivation, or one of
// InningViewer's three stable report-back handlers, so the comparison only
// misses when something real changed. Those handlers take this page's own
// half-index as their first argument — that is what lets them stay stable up
// there while still telling one half's report from another's.
//
// This changes nothing about what is computed or when: memo can only SKIP a
// render whose props are identical to the last one. A sealed half stays sealed,
// `revealedThrough` is a compared prop, and SealBox's render-function gate
// (ADR-0002) and the key-driven remount are untouched.
export const InningPage = memo(function InningPage({
  feed,
  inning,
  half,
  meta,
  revealedThrough,
  onReveal,
  callouts,
  vsTeam,
  highlights,
  atBatCountFor,
  windowed = false,
  focusStep = null,
  onFocusInfo,
  onStepInfo,
  onRunsSoFar,
  onLiveState,
  presentationOnly = false,
}) {
  const idx = halfIndex(inning, half)
  const revealed = idx <= revealedThrough
  const isNextToReveal = idx === revealedThrough + 1
  const battingSide = half === 'top' ? 'away' : 'home'

  return (
    <div className="inning">
      {/* The three report-backs are tagged with this page's own half-index on
          the way up, so InningViewer's handlers can stay stable across
          renders. Rebuilding these wrappers each render costs nothing:
          HalfInning is not a memo boundary, and neither it nor PlayByPlay
          lists them in an effect's dependencies. */}
      <HalfInning
        feed={feed}
        inning={inning}
        half={half}
        battingSide={battingSide}
        label={half === 'top' ? 'Top' : 'Bottom'}
        awayName={meta.away.clubName}
        homeName={meta.home.clubName}
        awayId={meta.away.id}
        homeId={meta.home.id}
        revealed={revealed}
        isNextToReveal={isNextToReveal}
        revealedThrough={revealedThrough}
        onReveal={presentationOnly ? noop : onReveal}
        callouts={callouts}
        vsTeam={vsTeam}
        highlights={highlights}
        revealedAtBatCount={atBatCountFor(inning, half)}
        windowed={windowed}
        focusStep={focusStep}
        onFocusInfo={presentationOnly ? undefined : onFocusInfo}
        onStepInfo={presentationOnly ? undefined : (info) => onStepInfo?.(idx, info)}
        onRunsSoFar={presentationOnly ? undefined : (runs, hits) => onRunsSoFar?.(idx, runs, hits)}
        onLiveState={presentationOnly ? undefined : (data) => onLiveState?.(idx, data)}
      />
    </div>
  )
})
