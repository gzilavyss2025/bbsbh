import { useEffect, useMemo } from 'react'
import { selectPrePitchChanges, selectHalfStartingPitcher, selectIsFreshPitcher, halfIndex } from '../../api/select.js'
import { computePitcherLines, pitcherHandoffs, pitcherLineAt, halfClosingPitcher } from '../../api/pitchers.js'
import { battingSlot, pitchingChangePitcher } from '../../api/playbyplay.js'
import { selectDueUpNow } from '../../api/dueup.js'
import { preGameAvg, computeBatterLine } from '../../api/boxscore.js'
import { highlightsByPlayId } from '../../api/highlights.js'
import { ordinal } from '../../lib/format.js'
import { SealBox } from '../SealBox.jsx'
import { PlayByPlay } from '../playbyplay/PlayByPlay.jsx'
import { FielderNotice } from '../playbyplay/FielderNotice.jsx'
import { PitcherNotice } from '../playbyplay/PitcherNotice.jsx'
import { BatterNotice } from '../playbyplay/BatterNotice.jsx'
import { FinalizedLineCard } from '../playbyplay/PitcherHandoffCard.jsx'
import { UpNextBatters } from '../playbyplay/UpNextBatters.jsx'

export function HalfInning({
  feed,
  inning,
  half,
  battingSide,
  label,
  awayName,
  homeName,
  awayId,
  homeId,
  revealed,
  isNextToReveal,
  revealedThrough,
  onReveal,
  callouts,
  vsTeam,
  highlights,
  revealedAtBatCount,
  windowed,
  focusStep,
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
  // WHILE WINDOWED IT IS AN ANNOUNCEMENT, NOT A HEADER. A stacked half pins it
  // at the top for as long as the half is on screen (a normal section header,
  // exactly as described above — every card there has `AtBatHero`, so the
  // stacked reader meets the arm's name over and over regardless). Windowed,
  // it shows in ONE state — a half that opens with an arm that just took the
  // mound (`isFreshPitcher`), before the reader has unveiled anything of it —
  // and drops it the instant the first at-bat opens. Two things decide that,
  // and they pull in opposite directions:
  //
  // WHY IT IS NOT THE HEADER WHILE WINDOWED. Once an at-bat is up, the card is
  // the THIRD naming of the same man in the same eyeful:
  //
  //   1. the console band's pitcher row — "DOBBINS  P: 0"
  //   2. this card — a full kraft panel, "NOW PITCHING FOR THE CARDINALS /
  //      DOBBINS, HUNTER  40  RHP"
  //   3. AtBatHero, which REPLACES the at-bat card's own name row and owns the
  //      matchup identity outright — his portrait beside the batter's, both
  //      named (ADR-0043's "the header now owns the identity").
  //
  // It used to narrow to `focusCursor === 0` on the argument that the banner
  // should not come back above every card the reader steps to. That was the
  // right instinct applied one step short: cursor 0 IS the half's first at-bat,
  // the frame where the hero has already taken the identity over. So the card
  // was at its most redundant in the one state it appeared in — which is why
  // `!startedRevealing` below, and not a cursor, is the gate. It is the exact
  // gate `PrePitchChanges` two blocks down already carries, and for the same
  // reason: both stage a half nothing has been unveiled of yet, and both step
  // aside for the at-bat rather than sitting above it. This card is now simply
  // the pitching-change member of that staged set, which is where the division
  // of labour between the two already said it belonged.
  //
  // WHY IT IS NOT DROPPED OUTRIGHT EITHER, which is where this landed first.
  // The argument for dropping it was that a mid-half change belongs in the feed
  // and already renders there as this same PitcherNotice (PlayByPlay's
  // `pitching_substitution` branch), so the arm that CHANGES still announces
  // itself. That is true of a change made MID-half and false of one made
  // BETWEEN halves: `computeHalfInningFeed` drops a pre-pitch change from the
  // feed (its `anyPitchInHalf` guard) and `PrePitchChanges` drops it from the
  // staged list, both for the same reason — this card already names him. With
  // this card gone while windowed, all three were silent, and the most common
  // pitching change in baseball, the one made between innings, announced itself
  // NOWHERE. The reader met the new arm as a different face in the hero, after
  // the pitch they were about to write down. The header/feed division is intact;
  // this is the one thing that division makes THIS card solely responsible for.
  //
  // `isFreshPitcher` (not "was there a substitution") is the test on purpose: it
  // is the app's existing answer to "did an arm just take the mound", already
  // driving the label two blocks down, so the card and its own words cannot
  // disagree. It is true of the game's first half for each club too — a starter
  // taking the mound is exactly the moment "Now pitching for..." is for.
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
  // Header while stacked, announcement while windowed — see the long note
  // above `nowPitching`. Both still sit behind the caller's own
  // `revealed || isNextToReveal` gate at the render site.
  const showNowPitching = !windowed || (isFreshPitcher && !startedRevealing)

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

  // Deferred final-line cards: a pitcher who departed during the PREVIOUS
  // half this same team pitched (same half label — a team pitches every
  // OTHER half), whose runners resolved exactly as THAT half ended
  // (pitcherHandoffs' resolvedAtHalfEnd — see api/pitchers.js). A resolution
  // that instead landed mid-half, with more of that half still to reveal
  // afterward, already rendered in-feed there (PlayByPlay.jsx's own pass);
  // this is only the half-end case, moved to the top of the NEXT page per
  // the user's ask. Always safe to compute with no extra gate: `revealed ||
  // isNextToReveal` on THIS half already implies revealedThrough >=
  // halfIndex(inning, half) - 1 >= halfIndex(inning - 1, half), so the half
  // these handoffs and their resolving plays live in is always already fully
  // revealed by the time this one is reachable at all.
  const deferredFinals = useMemo(() => {
    if (inning <= 1) return []
    return pitcherHandoffs(feed, inning - 1, half, battingSide).filter((h) => h.resolvedAtHalfEnd)
  }, [feed, inning, half, battingSide])

  // The pitcher who threw the PREVIOUS half's own last play, when he isn't
  // THIS half's starter — the ordinary clean between-innings change, which
  // never touches pitcherHandoffs since nothing about it happened mid-half.
  // Same reachability footing as deferredFinals above: always safe once this
  // half is (revealed || isNextToReveal).
  const closingPitcher = useMemo(() => {
    if (inning <= 1) return null
    const closer = halfClosingPitcher(feed, inning - 1, half, battingSide)
    return closer && closer.pitcherId !== nowPitching?.id ? closer : null
  }, [feed, inning, half, battingSide, nowPitching?.id])

  // Both kinds of "who just left" notice, in one chronological list — a
  // handoff's own departure always precedes the half's closing pitcher (who
  // by definition pitched its very last play). Same FinalizedLineCard either
  // way; only which cut freezes his line differs.
  const finalLineNotices = [
    ...deferredFinals.map((h) => ({
      key: `handoff-${h.incomingPitcherId}`,
      pitcherId: h.departingPitcherId,
      side: h.side,
      cutAtBatIndex: h.resolutionAtBatIndex,
    })),
    ...(closingPitcher
      ? [
          {
            key: `closer-${closingPitcher.pitcherId}`,
            pitcherId: closingPitcher.pitcherId,
            side: closingPitcher.side,
            cutAtBatIndex: closingPitcher.lastAtBatIndex,
          },
        ]
      : []),
  ]

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
    // NOT WHILE WINDOWED, where that same advance is a contradiction. The
    // whole screen is built around ONE at-bat card, and the band sits directly
    // above it: the hero named ABRAMS while the band beside it said
    // "2. ORTIZ", who has not batted. The scorebug's job there is to caption
    // the card under it, and who's up next is already answered — in more
    // detail, with three names — by DueUpConsole in the same row (which shows
    // only while `currentSealed`, the windowed case). The pitch count is
    // untouched either way: it stays the tally AFTER the at-bat on screen
    // finished, which is what a scorer writes down.
    if (!windowed && live?.batter && live.batterDone && outs < 3) {
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

  return (
    <>
      <section className="half">
        {/* THE MASTHEAD IS THE BAND NOW, ALWAYS, so this title stands down to a
            heading nothing draws — the half was already named by
            `.inningnav__label` ("TOP 1ST") and by the console band's own
            inning number and arrow, and the two portraits on AtBatHero (on
            every card now) name the batter's club and the arm's. ADR-0043
            gives the band the masthead signature `.half__title` used to
            carry, deliberately — so this is the copy with nothing left to
            say, for a stacked half as much as a windowed one.

            KEPT AS A HEADING, not deleted. It is the half's <h3> in the
            document outline, and dropping the element outright would leave the
            stage's one region unlabelled for a screen reader while sighted
            readers still have the other namings. `.sr-only` (01-base.css)
            keeps it announced and takes no space. */}
        <h3 className="sr-only">
          {label} {ordinal(inning)}
        </h3>

        {/* The Now Pitching card: a persistent header while stacked, and a
            one-state announcement while windowed. See the comment above
            `nowPitching` for both halves of that. */}
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

        {/* Every pitcher who's now done for this team from the previous half
            it pitched — see finalLineNotices above. Same reachability gate as
            the Now Pitching card above it. */}
        {(revealed || isNextToReveal) &&
          finalLineNotices.map((n) => {
            const line = pitcherLineAt(feed, n.side, n.pitcherId, n.cutAtBatIndex, halfIndex(inning - 1, half))
            return line ? (
              <FinalizedLineCard key={n.key} line={line} teamId={battingSide === 'away' ? homeId : awayId} />
            ) : null
          })}

        {/* Who's due up to face him — gone the moment reveal starts, same
            gate as PrePitchChanges below. */}
        {!startedRevealing && isNextToReveal && (
          <UpNextBatters
            feed={feed}
            inning={inning}
            half={half}
            revealedThrough={revealedThrough}
            teamId={battingSide === 'away' ? awayId : homeId}
          />
        )}

        {/* Reached but nothing revealed yet: the sub-announced list stages the
            half before tapping to reveal the results. Same startedRevealing
            gate as the entering reference used to carry — once stepping
            begins, a defensive change in this list also starts showing up as
            its own FielderNotice in the live feed (PlayByPlay.jsx), so leaving
            this gated on bare `!revealed` (true for the whole stepping
            window, not just before the first tap) duplicated it: the same
            "now playing" card twice, once staged here and once for real in
            the feed. See selectPrePitchChanges for why the pre-pitch list is
            spoiler-free, and only for the immediate next half. */}
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

        {/* The pre-half callout strip and the entering lineups/defense
            reference both used to stage inline here for a reached-but-
            unrevealed half. Both are gone from this card now — the console
            chrome is unconditional, so the ARMS tab (pre-half notes, merged
            into MarginNotes) and the LINEUPS/FIELD tabs (the entering
            reference) already cover every half, live or historical, one tap
            away. Nothing here duplicated them for nothing to see; see
            ReferencePanel.jsx's Section function. */}

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
                windowed={windowed}
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
