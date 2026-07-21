import { useState } from 'react'
import { selectPrePitchChanges, selectHalfStartingPitcher } from '../api/select.js'
import { highlightsByPlayId } from '../api/highlights.js'
import { ordinal } from '../lib/format.js'
import { SealBox } from './SealBox.jsx'
import { PitchColorsKey } from './StrikeZone.jsx'
import { PlayByPlay } from './PlayByPlay.jsx'
import { PreHalfCallouts } from './PreHalfCallouts.jsx'
import { EnteringReference } from './EnteringReference.jsx'
import { FielderNotice } from './FielderNotice.jsx'
import { PitcherNotice } from './PitcherNotice.jsx'
import { BatterNotice } from './BatterNotice.jsx'

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
  callouts,
  workload,
  workloadGameDate,
  vsTeam,
  highlights,
  revealedAtBatCount,
  onStepInfo,
  onSteppedThrough,
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
  // InningViewer): who's actually on the mound as of what's been revealed,
  // shown at the top of the half for as long as this half is reachable
  // (revealed || isNextToReveal — same gate as everything else above the
  // seal, ADR-0010's footing). `enteringPitcher` is the spoiler-safe default
  // (the half's starting pitcher, from selectHalfStartingPitcher — correct
  // even before any of the half is revealed); `livePitcher` overrides it once
  // PlayByPlay reports a pitching change it has actually revealed (see its
  // onCurrentPitcher). The `.inning` wrapper's key={inning-half} remount
  // (InningViewer, ADR-0002) resets this state fresh on every half, so it
  // never carries a stale pitcher across navigation.
  const enteringPitcher = selectHalfStartingPitcher(feed, inning, half, revealedThrough)
  const [livePitcher, setLivePitcher] = useState(null)
  const nowPitching = livePitcher ?? enteringPitcher

  // "Now pitching" only fits the moment an arm actually takes the mound: the
  // game's first half for each team, or a live mid-half substitution
  // (livePitcher set). The far more common case — the same reliever/starter
  // carrying over from the half before, same team's previous half of the
  // same parity (a team only pitches every OTHER half) — reads as "Pitching
  // for..." instead, since nothing just happened.
  const previousEnteringPitcher =
    inning > 1 ? selectHalfStartingPitcher(feed, inning - 1, half, revealedThrough) : null
  const isFreshPitcher =
    livePitcher != null || inning === 1 || previousEnteringPitcher?.id !== enteringPitcher?.id
  const nowPitchingLabel = isFreshPitcher ? 'Now pitching' : 'Pitching'

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
      prospectsData={prospectsData}
      rookiesData={rookiesData}
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
        {(revealed || isNextToReveal) && nowPitching && (
          <PitcherNotice
            pitcher={nowPitching}
            teamName={battingSide === 'away' ? homeName : awayName}
            className="pitchernotice--pbp"
            label={nowPitchingLabel}
          />
        )}

        {/* The pre-half callout strip — the "entering this half" season-context
            cards (starter team record, leading-after checkpoint, inning run
            differential; see api/prehalf-callouts.js). Above the seal like the
            pre-pitch list, and it STAYS above the results once revealed (it
            reads as staging either way). Gated to a reached half, same contract
            as the entering cards below; the note that reads tonight's score
            gates itself further on revealedThrough inside the builder. */}
        {(revealed || isNextToReveal) && (
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
            battingName={battingSide === 'away' ? awayName : homeName}
            pitchingName={battingSide === 'away' ? homeName : awayName}
          />
        )}

        {/* The lineups/defense reference stays staged ABOVE the seal, inside
            this same card, only for as long as NOTHING in the half has been
            revealed yet — the moment stepping starts (startedRevealing), it
            moves BELOW into its own standalone card instead (see the bottom
            of this component), matching the fully-revealed layout from the
            first at-bat tap on, not just once the half is fully committed. */}
        {!startedRevealing && isNextToReveal && (
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
              // The pitch-color key now lives behind the "Pitch colors" button
              // at the FOOT of this card (see PitchColorsKey below), not up in
              // the header. Statcast superlatives (fastest pitch, hardest/
              // longest ball) used to sit below this feed; they now render in
              // StatBox.jsx, right under the ABS row, so they're at the top of
              // the half's content with the rest of the totals instead of
              // wherever the feed happened to end.
              <PlayByPlay
                feed={feed}
                inning={inning}
                half={half}
                battingSide={battingSide}
                pitchingName={battingSide === 'away' ? homeName : awayName}
                pitchingTeamId={battingSide === 'away' ? homeId : awayId}
                battingName={battingSide === 'away' ? awayName : homeName}
                callouts={callouts}
                vsTeam={vsTeam}
                highlightsMap={highlightsMap}
                stepCap={stepping ? revealedAtBatCount : null}
                onCurrentPitcher={setLivePitcher}
                onStepInfo={onStepInfo}
                onStepComplete={() => {
                  onReveal(inning, half)
                  // Only fires for an actual at-bat-by-at-bat finish (see
                  // PlayByPlay's onStepComplete doc) — a direct "Rest of
                  // half" tap commits via onReveal alone and never steps, so
                  // it never lands here. Distinct from onReveal because the
                  // caller uses it to scroll to the totals the user just
                  // finished stepping toward, not every commit path.
                  onSteppedThrough?.()
                }}
              />
            )
          }}
        </SealBox>

        {/* The pitch-color key: a static legend, no game data, so it's
            spoiler-free and can sit at the foot of the card regardless of
            reveal state — moved down here from the header so it reads next
            to the pitch dots it explains rather than beside the team names. */}
        <PitchColorsKey className="half__pitchkeyfoot" />
      </section>

      {/* From the first at-bat step onward (startedRevealing — see above), the
          lineups/defense move into their OWN card below the play-by-play's
          card rather than waiting for the half to be fully committed —
          hidden at the wide breakpoint, where the right-column reference band
          (.innings__ref-lineups / .innings__ref-defense) already covers this
          same content. */}
      {startedRevealing && <section className="half halfentering">{enteringReference}</section>}
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
function PrePitchChanges({ feed, inning, half, battingName, pitchingName }) {
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
              teamName={battingName}
              className="pitchernotice--pbp"
            />
          )
        }
        return (
          <FielderNotice
            key={`c-${i}`}
            fielder={c.fielder}
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
