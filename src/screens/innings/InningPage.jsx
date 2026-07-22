import { halfIndex } from '../../api/select.js'
import { StatBox, AbsCard } from '../../components/StatBox.jsx'
import { DueUpNextCard } from '../../components/DueUpNextCard.jsx'
import { HalfInning } from '../../components/HalfInning.jsx'
import { WinProbChart } from '../../components/WinProbChart.jsx'

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
// (onReveal, onStepInfo, onSteppedThrough), so a preview mount/unmount can
// never itself advance the reveal mark or double-report a step. It is not a
// second reveal boundary; see ADR-0024.
export function InningPage({
  feed,
  inning,
  half,
  meta,
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
  onStepInfo,
  onSteppedThrough,
  getDerived,
  runExpectancy,
  winProbPoints,
  winProbBigPlays,
  statBoxRef,
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
          callouts={callouts}
          workload={workload}
          workloadGameDate={workloadGameDate}
          vsTeam={vsTeam}
          highlights={highlights}
          revealedAtBatCount={atBatCountFor(inning, half)}
          onStepInfo={presentationOnly ? undefined : onStepInfo}
          onSteppedThrough={presentationOnly ? undefined : onSteppedThrough}
        />
      </div>

      {/* Row 3: the R/H/E/LOB + pitch-stat card for the half being viewed,
          beside the win-probability chart. */}
      <div className="innings__row2" ref={presentationOnly ? undefined : statBoxRef}>
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
            awayLocation={meta.away.locationName || meta.away.abbreviation}
            homeLocation={meta.home.locationName || meta.home.abbreviation}
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
            partial
          />
        </div>
      </div>
    </>
  )
}
