import { memo } from 'react'
import { halfIndex } from '../../api/select.js'
import { StatBox, AbsCard } from '../../components/gamehud/StatBox.jsx'
import { DueUpNextCard } from '../../components/playbyplay/DueUpNextCard.jsx'
import { HalfInning } from '../../components/inning/HalfInning.jsx'
import { WinProbChart } from '../../components/charts/WinProbChart.jsx'

// A no-op stand-in for HalfInning's onReveal, which HalfInning calls directly
// (not via `?.()`) both from SealBox's onReveal and from PlayByPlay's
// onStepComplete — so a presentationOnly render can't simply omit the prop
// without risking a crash the moment a preview page happens to mount already
// revealed (see the header comment below).
function noop() {}

// One half-inning "page": the play-by-play card (HalfInning, inside its
// SealBox) plus the stat/WPA row beneath it. Pulled out of InningViewer.jsx
// so InningPageTurn can mount two of these at once during a forward
// navigation — the outgoing half and an inert preview of the incoming one —
// without duplicating this markup.
//
// `presentationOnly` is for exactly that preview instance: it renders the
// SAME real (possibly still-sealed) content the interactive instance would —
// SealBox's own render-function-only-once-revealed gate (ADR-0002) is what
// keeps a sealed preview spoiler-safe, not this flag — but mutes every
// callback that would otherwise feed back into useRevealProgress state
// (onReveal, onStepInfo), so a preview mount/unmount can never itself advance
// the reveal mark or double-report a step. It is not a second reveal
// boundary; see ADR-0024.
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
  isMlb,
  revealedThrough,
  onReveal,
  prospectsData,
  rookiesData,
  callouts,
  workload,
  workloadGameDate,
  vsTeam,
  highlights,
  atBatCountFor,
  focusOne = false,
  focusStep = null,
  focusCursor = null,
  onFocusInfo,
  onStepInfo,
  onRunsSoFar,
  onLiveState,
  getDerived,
  runExpectancy,
  winProbPoints,
  winProbBigPlays,
  winProbTreatment,
  presentationOnly = false,
}) {
  const idx = halfIndex(inning, half)
  const revealed = idx <= revealedThrough
  const isNextToReveal = idx === revealedThrough + 1
  const battingSide = half === 'top' ? 'away' : 'home'

  return (
    <>
      {/* .inning goes display:contents at the phone breakpoint (index.css) so
          its children become direct flex items of .innings__grid, orderable
          ahead of/behind .innings__row2 independently of source order — the
          wrapper element itself has to exist for that rule to have anything
          to select. */}
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
          battingAbbr={half === 'top' ? meta.away.abbreviation : meta.home.abbreviation}
          pitchingAbbr={half === 'top' ? meta.home.abbreviation : meta.away.abbreviation}
          awayName={meta.away.clubName}
          homeName={meta.home.clubName}
          awayId={meta.away.id}
          homeId={meta.home.id}
          revealed={revealed}
          isNextToReveal={isNextToReveal}
          revealedThrough={revealedThrough}
          onReveal={presentationOnly ? noop : onReveal}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          isMlb={isMlb}
          callouts={callouts}
          workload={workload}
          workloadGameDate={workloadGameDate}
          vsTeam={vsTeam}
          highlights={highlights}
          revealedAtBatCount={atBatCountFor(inning, half)}
          focusOne={focusOne}
          focusStep={focusStep}
          focusCursor={focusCursor}
          onFocusInfo={presentationOnly ? undefined : onFocusInfo}
          onStepInfo={presentationOnly ? undefined : (info) => onStepInfo?.(idx, info)}
          onRunsSoFar={presentationOnly ? undefined : (runs, hits) => onRunsSoFar?.(idx, runs, hits)}
          onLiveState={presentationOnly ? undefined : (data) => onLiveState?.(idx, data)}
        />
      </div>

      {/* Row 3: the R/H/E/LOB + pitch-stat card for the half being viewed,
          beside the win-probability chart. */}
      <div className="innings__row2">
        {/* Left column: the stat card, then a preview of who's due up when
            the OTHER team's next half starts — dueup.js's own gate keeps
            this null until that half is actually the user's next one to
            reveal (see DueUpNextCard's header comment), so it appears right
            as the "NEXT >" nav does. Same display:contents-on-phone trick
            as .innings__row2-right below: this wrapper only exists as a
            layout box at the wide breakpoint. */}
        <div className="innings__row2-left">
          <StatBox
            className="innings__statbox"
            placeholder
            feed={feed}
            inning={inning}
            half={half}
            battingSide={battingSide}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            awayFranchise={meta.away.franchiseName || meta.away.abbreviation}
            homeFranchise={meta.home.franchiseName || meta.home.abbreviation}
            getDerived={getDerived}
            revealed={revealed}
            runExpectancy={runExpectancy}
          />
          <DueUpNextCard
            feed={feed}
            inning={inning}
            half={half}
            revealedThrough={revealedThrough}
            awayId={meta.away.id}
            homeId={meta.home.id}
            awayName={meta.away.clubName}
            homeName={meta.home.clubName}
          />
        </div>
        {/* Wide layout only: ABS Challenges moves here, above the chart,
            instead of trailing the pitch-stat grid on the left — see
            AbsCard's own header comment. On a phone this wrapper is
            display:contents (index.css) so WinProbChart falls back into
            the same single flex column as everything else, with the
            phone's own ABS copy staying inline inside StatBox. */}
        <div className="innings__row2-right">
          <AbsCard
            feed={feed}
            inning={inning}
            half={half}
            revealed={revealed}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
          />
          <WinProbChart
            points={winProbPoints}
            bigPlays={winProbBigPlays}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            awayId={meta.away.id}
            homeId={meta.home.id}
            awayTreatment={winProbTreatment?.away}
            homeTreatment={winProbTreatment?.home}
            partial
          />
        </div>
      </div>
    </>
  )
})
