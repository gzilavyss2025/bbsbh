import { useEffect, useMemo } from 'react'
import { selectPrePitchChanges, selectHalfStartingPitcher, selectIsFreshPitcher, halfIndex } from '../../api/select.js'
import { computePitcherLines } from '../../api/pitchers.js'
import { battingSlot, pitchingChangePitcher } from '../../api/playbyplay.js'
import { selectDueUpNow } from '../../api/dueup.js'
import { preGameAvg, computeBatterLine } from '../../api/boxscore.js'
import { highlightsByPlayId } from '../../api/highlights.js'
import { ordinal } from '../../lib/format.js'
import { SealBox } from '../SealBox.jsx'
import { PlayByPlay } from '../playbyplay/PlayByPlay.jsx'
import { PreHalfCallouts } from './PreHalfCallouts.jsx'
import { EnteringReference } from './EnteringReference.jsx'
import { FielderNotice } from '../playbyplay/FielderNotice.jsx'
import { PitcherNotice } from '../playbyplay/PitcherNotice.jsx'
import { BatterNotice } from '../playbyplay/BatterNotice.jsx'
import { UpNextBatters } from '../playbyplay/UpNextBatters.jsx'

export function HalfInning({
  feed,
  inning,
  half,
  battingSide,
  label,
  battingAbbr,
  pitchingAbbr,
  awayName,
  homeName,
  awayId,
  homeId,
  revealed,
  isNextToReveal,
  revealedThrough,
  onReveal,
  prospectsData,
  rookiesData,
  isMlb,
  callouts,
  workload,
  workloadGameDate,
  vsTeam,
  highlights,
  revealedAtBatCount,
  focusOne,
  focusStep,
  focusCursor,
  onFocusInfo,
  onStepInfo,
  onRunsSoFar,
  onLiveState,
}) {
  // At-bat stepping (ADR-0016): a half being stepped through one plate
  // appearance at a time (the floating bar's "Next at-bat" button) has
  // revealedAtBatCount > 0 before it's fully committed. An already-committed
  // half (revealed) always shows everything regardless.
  const stepping = !revealed && revealedAtBatCount > 0
  // True from the FIRST at-bat step onward, not just once the half is fully
  // committed — the lineups/defense reference (below) moves into its own
  // card the moment any of this half is showing, so a half being stepped
  // through one at-bat at a time already reads like a fully revealed one
  // instead of flipping layouts only on the very last tap.
  const startedRevealing = revealed || revealedAtBatCount > 0

  // Persistent "Now Pitching" card (in addition to Margin Notes — see
  // InningViewer): the arm this half OPENS with, shown at the top of the half
  // for as long as it's reachable (revealed || isNextToReveal — same gate as
  // everything else above the seal, ADR-0010's footing), from
  // selectHalfStartingPitcher (spoiler-safe, correct before any of the half is
  // revealed).
  //
  // It names the half's STARTING pitcher and keeps naming him, deliberately.
  // A mid-half change belongs in the feed, at the moment it happens, and
  // already renders there as this same PitcherNotice card (PlayByPlay's
  // `pitching_substitution` branch). This header used to be overridden by a
  // `livePitcher` that PlayByPlay reported back as changes were revealed —
  // which put the reliever's card in TWO places at once and, on a half
  // revealed all at once, pinned the last arm of the inning above at-bat cards
  // the starter had pitched: the top of the page contradicting the first card
  // under it. The same "header, not feed" division is why computeHalfInningFeed
  // drops a PRE-pitch change from the feed (see its anyPitchInHalf guard) and
  // why PrePitchChanges drops one from the staged list; the live override was
  // the one piece pulling the other way.
  //
  // Focus mode narrows WHEN this persistent card shows, not what it names:
  // the ordinary stacked page still pins it at the top of the half for the
  // whole time the half is on screen (a normal section header). Focus mode
  // shows one at-bat at a time, and re-announcing the same starter above
  // every card the reader steps to reads as the banner "coming back" — so
  // there it's gone the moment the reader has stepped past the half's first
  // at-bat (focusCursor > 0). A mid-half change still gets its own
  // announcement at the right moment either way, via the `pitching_substitution`
  // card above, never this one — that's the "or the first at-bat for the new
  // pitcher" half of the rule, and it needs no extra gate here.
  const showNowPitching = !focusOne || focusCursor === 0
  const nowPitching = selectHalfStartingPitcher(feed, inning, half, revealedThrough)

  // "Now pitching" only fits the moment an arm actually takes the mound: the
  // game's first half for each team, or one that opens with a change. The far
  // more common case — the same reliever/starter carrying over from the half
  // before, same team's previous half of the same parity (a team only pitches
  // every OTHER half) — reads as "Pitching for..." instead, since nothing just
  // happened. See selectIsFreshPitcher (select.js); the comparison is against
  // the previous same-parity half's own starter, so with the header pinned to
  // this half's starter the label is now a fixed structural fact rather than
  // something that flips as you step.
  const isFreshPitcher = selectIsFreshPitcher(feed, inning, half, revealedThrough, nowPitching?.id)
  const nowPitchingLabel = isFreshPitcher ? 'Now pitching' : 'Pitching'

  // How many pitches he'd thrown in THIS GAME entering this half — clamped to
  // halfIndex(inning, half) - 1 (through the previous half only), which is
  // always <= the real revealedThrough since this half is only reachable at
  // all once that half is (ADR-0010's footing), so this needs no separate
  // gate of its own. computePitcherLines is the same running-line builder the
  // Pitchers table uses.
  const enteringPitchLines = useMemo(
    () => computePitcherLines(feed, halfIndex(inning, half) - 1),
    [feed, inning, half],
  )
  const enteringPitches = nowPitching
    ? [...enteringPitchLines.away, ...enteringPitchLines.home].find((r) => r.id === nowPitching.id)?.pitches
    : null
  const entering =
    enteringPitches != null ? { pitches: enteringPitches, halfLabel: `the start of the ${ordinal(inning)}` } : null

  // The persistent scorebug HUD (src/components/Scorebug.jsx): a batter/
  // pitcher/bases/outs snapshot reported UP to InningViewer, which owns
  // whether it's actually mounted. `hasContent` is the SAME `revealed ||
  // isNextToReveal` gate every other above-the-seal card on this half already
  // uses (the Now Pitching card, the pre-pitch staging list) — a half the
  // user has merely jumped past via RollingLine's navigator, without
  // revealing it or its predecessor, reports nothing at all rather than an
  // "entering" snapshot that would misrepresent a half that isn't actually
  // current.
  //
  // `composeLive(live)` folds PlayByPlay's own cap-respecting snapshot (bases/
  // outs/pitches-since-the-last-mid-half-change/current batter id) together
  // with this half's already-computed entering baseline (nowPitching,
  // enteringPitches) and, when nothing has been revealed in the half yet
  // (`live` null), the spoiler-safe due-up batter (selectDueUpNow — same tier
  // as nowPitching, safe before any of the half is revealed). A mid-half
  // pitching change resets the pitch count to his own tally since entering
  // (deliberately not carrying forward an earlier stint's count — see
  // deriveLiveState's own doc).
  const hasContent = revealed || isNextToReveal
  const battingLineFor = (id) => {
    const box = feed?.liveData?.boxscore?.teams?.[battingSide]?.players?.[`ID${id}`]
    if (!box) return null
    // Reveal-gated, NOT box.stats.batting (the always-live true line — see
    // computeBatterLine's doc for why reading that directly here would show
    // a batter's actual current-game at-bats before the user has revealed
    // any of them, e.g. "0-5" before his first plate appearance of the night).
    const { hits, atBats } = computeBatterLine(feed, id, revealedThrough)
    if (atBats > 0 || hits > 0) return `${hits}-${atBats}`
    return preGameAvg(box)
  }
  const composeLive = (live) => {
    const bases = live?.bases ?? { first: false, second: false, third: false }
    const outs = live?.outs ?? 0
    let batter = null
    // Once the last visible at-bat has actually FINISHED (batterDone — false
    // only for a mid-count stoppage, where the same guy is still up) and the
    // half isn't over, the "current" batter is whoever's next in the order,
    // not the one who just finished (e.g. showing the batter who just
    // doubled forever instead of advancing to the next slot).
    //
    // NOT IN FOCUS MODE, where that same advance is a contradiction. The whole
    // screen is built around ONE at-bat card, and the band sits directly above
    // it: the hero named ABRAMS while the band beside it said "2. ORTIZ", who
    // has not batted. The scorebug's job there is to caption the card under it,
    // and who's up next is already answered — in more detail, with three names
    // — by DueUpConsole in the same row. The pitch count is untouched either
    // way: it stays the tally AFTER the at-bat on screen finished, which is
    // what a scorer writes down.
    if (!focusOne && live?.batter && live.batterDone && outs < 3) {
      const finishedSlot = battingSlot(feed, battingSide, live.batter.id)
      const nextSlot = finishedSlot != null ? (finishedSlot >= 9 ? 1 : finishedSlot + 1) : null
      const upcoming =
        nextSlot != null
          ? selectDueUpNow(feed, inning, half, revealedThrough, 9)?.batters?.find((b) => b.slot === nextSlot)
          : null
      if (upcoming) batter = { order: upcoming.slot, last: upcoming.last, line: battingLineFor(upcoming.id) }
    }
    if (!batter && live?.batter) {
      const slot = battingSlot(feed, battingSide, live.batter.id)
      batter = { order: slot ?? '', last: live.batter.last, line: battingLineFor(live.batter.id) }
    } else if (!batter) {
      const due = selectDueUpNow(feed, inning, half, revealedThrough, 1)?.batters?.[0]
      if (due) batter = { order: due.slot, last: due.last, line: battingLineFor(due.id) }
    }
    let pitcher = null
    if (live?.midHalfPitcherId != null) {
      const p = pitchingChangePitcher(feed, live.midHalfPitcherId)
      if (p) pitcher = { last: p.name.split(',')[0], pitches: live.pitchesSoFar ?? 0 }
    } else if (nowPitching) {
      pitcher = { last: nowPitching.name.split(',')[0], pitches: (enteringPitches ?? 0) + (live?.pitchesSoFar ?? 0) }
    }
    // The half is over (3rd out) but the user hasn't navigated to the next
    // one yet — this half's batter/pitcher/bases/outs no longer describe
    // anything current, and the NEXT half's don't exist yet either. Rather
    // than freeze on the half that just ended, blank the batter/pitcher and
    // bases/outs and point the inning/half indicator at what's coming next.
    if (outs >= 3) {
      return {
        bases: { first: false, second: false, third: false },
        outs: 0,
        batter: null,
        pitcher: null,
        inning: half === 'top' ? inning : inning + 1,
        half: half === 'top' ? 'bottom' : 'top',
      }
    }
    return { bases, outs, batter, pitcher, inning, half }
  }

  // The entering-state fallback: fires once (and again on any dep change)
  // for as long as PlayByPlay hasn't mounted yet (`!startedRevealing`).
  // The moment stepping starts, PlayByPlay mounts inside the SealBox below
  // and its OWN onLiveState effect takes over reporting (child effects run
  // before a parent's in the same commit, so there's no stale overwrite the
  // render stepping actually begins).
  useEffect(() => {
    if (startedRevealing) return
    onLiveState?.(hasContent ? composeLive(null) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedRevealing, hasContent, feed, inning, half, revealedThrough, nowPitching, enteringPitches, battingSide])

  // The lineups + defense as they stand ENTERING this half — the pre-scoring
  // reference (see EnteringReference). On a phone it's positioned by reveal
  // state: ABOVE the seal (staged inside the SAME card as the play-by-play,
  // ahead of tapping to reveal) while NOTHING in the half has been revealed
  // yet, then in its OWN separate card BELOW the play-by-play's card from the
  // first at-bat step onward (startedRevealing) — the just-scored at-bats
  // read as their own distinct unit rather than sharing a card with the
  // staging reference. Only for a half the user has reached; a half further
  // out stays fully sealed — its "entering" state would leak the intervening
  // subs, and defenseEntering/lineupEntering (called inside EnteringReference,
  // given revealedThrough below) enforce that themselves now rather than
  // relying solely on the isNextToReveal / startedRevealing checks below,
  // which remain only to choose where it renders. On the wide layout both
  // inline copies are hidden (.half__entering / .halfentering) and the same
  // reference rides its own card in the right column instead.
  const enteringReference = (
    <EnteringReference
      feed={feed}
      revealedThrough={revealedThrough}
      inning={inning}
      half={half}
      battingSide={battingSide}
      awayName={awayName}
      homeName={homeName}
      awayId={awayId}
      homeId={homeId}
      prospectsData={prospectsData}
      rookiesData={rookiesData}
      isMlb={isMlb}
    />
  )

  return (
    <>
      <section className="half">
        <h3 className="half__title">
          <span className="half__titlemain">
            {label} {ordinal(inning)}
          </span>
          <span className="half__meta">
            <span className="half__team">
              {battingAbbr || (battingSide === 'away' ? 'Away' : 'Home')} bats{' '}
              <span className="half__dot" aria-hidden="true">•</span>{' '}
              {pitchingAbbr || (battingSide === 'away' ? 'Home' : 'Away')} pitches
            </span>
          </span>
        </h3>

        {/* Persistent Now Pitching card — see the comment above nowPitching. */}
        {(revealed || isNextToReveal) && nowPitching && showNowPitching && (
          <PitcherNotice
            pitcher={nowPitching}
            teamId={battingSide === 'away' ? homeId : awayId}
            teamName={battingSide === 'away' ? homeName : awayName}
            className="pitchernotice--pbp"
            label={nowPitchingLabel}
            entering={entering}
          />
        )}

        {/* Who's due up to face him — gone the moment reveal starts, same
            gate as PrePitchChanges/the entering reference below. */}
        {!startedRevealing && isNextToReveal && (
          <UpNextBatters
            feed={feed}
            inning={inning}
            half={half}
            revealedThrough={revealedThrough}
            teamId={battingSide === 'away' ? awayId : homeId}
          />
        )}

        {/* The pre-half callout strip — the "entering this half" season-context
            cards (starter team record, leading-after checkpoint, inning run
            differential; see api/prehalf-callouts.js). Above the seal like the
            pre-pitch list, and it STAYS above the results once revealed (it
            reads as staging either way). Gated to a reached half, same contract
            as the entering cards below; the note that reads tonight's score
            gates itself further on revealedThrough inside the builder.

            NOT IN FOCUS MODE, where it MOVED rather than went away: it renders
            in the Arms tab instead, merged into MarginNotes' ranked list
            (ReferencePanel's Section). This used to be a `display: none` in
            styles/focus/stage.css, which meant `buildPreHalfCallouts` ran
            TWICE on every step — once here for a strip nobody could see, once
            there for the tab that actually shows it. Same gate, moved to where
            it costs nothing. Visibility only either way: the builder's own
            revealedThrough gate is untouched and still the thing standing
            between this and a score (see its header). */}
        {(revealed || isNextToReveal) && !focusOne && (
          <PreHalfCallouts
            feed={feed}
            bundle={callouts}
            inning={inning}
            half={half}
            revealedThrough={revealedThrough}
            workload={workload}
            gameDate={workloadGameDate}
          />
        )}

        {/* Reached but nothing revealed yet: the sub-announced list stages the
            half before tapping to reveal the results. Same startedRevealing
            gate as the entering reference just below — once stepping begins,
            a defensive change in this list also starts showing up as its own
            FielderNotice in the live feed (PlayByPlay.jsx), so leaving this
            gated on bare `!revealed` (true for the whole stepping window, not
            just before the first tap) duplicated it: the same "now playing"
            card twice, once staged here and once for real in the feed. See
            selectPrePitchChanges for why the pre-pitch list is spoiler-free,
            and only for the immediate next half. */}
        {!startedRevealing && isNextToReveal && (
          <PrePitchChanges
            feed={feed}
            inning={inning}
            half={half}
            battingId={battingSide === 'away' ? awayId : homeId}
            battingName={battingSide === 'away' ? awayName : homeName}
            pitchingId={battingSide === 'away' ? homeId : awayId}
            pitchingName={battingSide === 'away' ? homeName : awayName}
          />
        )}

        {/* The lineups/defense reference stays staged ABOVE the seal, inside
            this same card, only for as long as NOTHING in the half has been
            revealed yet — the moment stepping starts (startedRevealing), it
            moves BELOW into its own standalone card instead (see the bottom
            of this component), matching the fully-revealed layout from the
            first at-bat tap on, not just once the half is fully committed.

            Neither placement exists in focus mode — the same lineups and
            defense are the LINEUPS and FIELD tabs of the reference panel
            there, one tap away and never both at once. Formerly a
            `display: none` on `.half__entering`/`.halfentering`
            (styles/focus/stage.css), which still paid for lineupEntering and
            defenseEntering walking the whole game's plays, twice, on every
            step. The selectors keep their own ADR-0010 reveal gate regardless
            of who calls them; this only decides whether anyone does. */}
        {!startedRevealing && isNextToReveal && !focusOne && (
          <div className="half__entering">{enteringReference}</div>
        )}

        <SealBox
          forceRevealed={startedRevealing}
          onReveal={stepping ? undefined : () => onReveal(inning, half)}
          coverless
        >
          {() => {
            // guid -> highlight clip lookup (see api/highlights.js), built here
            // rather than by the caller so it stays reveal-only in the same
            // textual sense as the rest of this render function — never at
            // render top-level or in an eager useMemo (ADR-0001).
            const highlightsMap = highlightsByPlayId(highlights)
            return (
              // Statcast superlatives (fastest pitch, hardest/longest ball)
              // used to sit below this feed; they now render in StatBox.jsx,
              // right under the ABS row, so they're at the top of the half's
              // content with the rest of the totals instead of wherever the
              // feed happened to end.
              <PlayByPlay
                feed={feed}
                inning={inning}
                half={half}
                battingSide={battingSide}
                pitchingName={battingSide === 'away' ? homeName : awayName}
                pitchingTeamId={battingSide === 'away' ? homeId : awayId}
                battingName={battingSide === 'away' ? awayName : homeName}
                battingTeamId={battingSide === 'away' ? awayId : homeId}
                callouts={callouts}
                vsTeam={vsTeam}
                highlightsMap={highlightsMap}
                stepCap={stepping ? revealedAtBatCount : null}
                focusOne={focusOne}
                focusStep={focusStep}
                onFocusInfo={onFocusInfo}
                onRunsSoFar={onRunsSoFar}
                onStepInfo={onStepInfo}
                onStepComplete={() => onReveal(inning, half)}
                onLiveState={(live) => onLiveState?.(composeLive(live))}
              />
            )
          }}
        </SealBox>
      </section>

      {/* From the first at-bat step onward (startedRevealing — see above), the
          lineups/defense move into their OWN card below the play-by-play's
          card rather than waiting for the half to be fully committed —
          hidden at the wide breakpoint, where the right-column reference band
          (.innings__ref-lineups / .innings__ref-defense) already covers this
          same content — and absent outright in focus mode, where the reference
          panel's own tabs cover it (see the staged copy above). */}
      {startedRevealing && !focusOne && (
        <section className="half halfentering">{enteringReference}</section>
      )}
    </>
  )
}

// Subs announced before this half's first pitch — rendered above the SealBox
// (not inside it), gated by the caller to the half the user is about to reveal.
// See selectPrePitchChanges for why this is spoiler-free. Every entering change
// stages here as a matching headshot card, in the order it was announced: a
// fresh fielder or position switch ("now playing" — FielderNotice) and a
// pinch-hitter ("now batting" — BatterNotice). A pre-pitch PITCHING change is
// deliberately NOT re-rendered here — the persistent Now Pitching card above
// (see nowPitching in HalfInning) already names the incoming pitcher via the
// same underlying identity (selectHalfStartingPitcher reads the half's first
// play's matchup.pitcher, which already reflects a pre-pitch change), so a
// second identical card here would just duplicate it. A defensive/pinch-hitter
// card keys off the PITCHING/BATTING team respectively. On reveal each is
// superseded by its live counterpart — the defensive change by its own leading
// feed card, the pinch-hitter by his at-bat card — which is why the caller
// drops this whole block once stepping starts (startedRevealing). Anything
// that still can't resolve to a card (e.g. a pre-pitch pinch RUNNER,
// vanishingly rare) falls to the plain text list.
function PrePitchChanges({ feed, inning, half, battingId, battingName, pitchingId, pitchingName }) {
  const changes = selectPrePitchChanges(feed, inning, half)
  const cards = changes.filter((c) => c.fielder || c.batter)
  const rest = changes.filter((c) => c.text)
  if (cards.length === 0 && rest.length === 0) return null
  return (
    <div className="prepitch">
      {cards.map((c, i) => {
        if (c.batter) {
          return (
            <BatterNotice
              key={`c-${i}`}
              batter={c.batter}
              teamId={battingId}
              teamName={battingName}
              className="pitchernotice--pbp"
            />
          )
        }
        return (
          <FielderNotice
            key={`c-${i}`}
            fielder={c.fielder}
            teamId={pitchingId}
            teamName={pitchingName}
            className="pitchernotice--pbp"
          />
        )
      })}
      {rest.length > 0 && (
        <ul className="prepitch__list">
          {rest.map((c, i) => (
            <li className="prepitch__item" key={i}>
              {c.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
