import { selectPrePitchChanges } from '../api/select.js'
import { highlightsByPlayId } from '../api/highlights.js'
import { ordinal } from '../lib/format.js'
import { SealBox } from './SealBox.jsx'
import { PitchColorsKey } from './StrikeZone.jsx'
import { PlayByPlay } from './PlayByPlay.jsx'
import { PreHalfCallouts } from './PreHalfCallouts.jsx'
import { EnteringReference } from './EnteringReference.jsx'
import { FielderNotice } from './FielderNotice.jsx'

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
  vsTeam,
  highlights,
  revealedAtBatCount,
  onStepInfo,
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
          />
        )}

        {/* Reached but still sealed: the sub-announced list stages the half
            before tapping to reveal the results, same as ever. See
            selectPrePitchChanges for why the pre-pitch list is spoiler-free,
            and only for the immediate next half. */}
        {!revealed && isNextToReveal && (
          <PrePitchChanges
            feed={feed}
            inning={inning}
            half={half}
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
                onStepInfo={onStepInfo}
                onStepComplete={() => onReveal(inning, half)}
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
// (not inside it), gated by the caller to the half the user is about to
// reveal. See selectPrePitchChanges for why this is spoiler-free. A pitching
// substitution is excluded here — it gets its own notification card in row 2's
// StatBox slot instead (see StatBox.jsx). A defensive sub/switch gets the same
// "now playing" FielderNotice card as its mid-inning counterpart (PlayByPlay.jsx)
// — a fresh fielder or a position change is worth exactly as much notice
// between halves as it is mid-inning, so neither stays a plain list line.
// Only offensive_substitution (a pinch hitter/runner announced pre-pitch)
// still falls to the plain list — it's covered by its own at-bat card or
// PinchRunNotice once the half is revealed.
function PrePitchChanges({ feed, inning, half, pitchingName }) {
  const changes = selectPrePitchChanges(feed, inning, half).filter(
    (c) => c.eventType !== 'pitching_substitution',
  )
  if (changes.length === 0) return null
  const cards = changes.filter((c) => c.fielder)
  const rest = changes.filter((c) => !c.fielder)
  return (
    <div className="prepitch">
      {cards.map((c, i) => (
        <FielderNotice
          key={`f-${i}`}
          fielder={c.fielder}
          teamName={pitchingName}
          className="pitchernotice--pbp"
        />
      ))}
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
