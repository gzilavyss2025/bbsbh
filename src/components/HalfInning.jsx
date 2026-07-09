import { selectPrePitchChanges } from '../api/select.js'
import { revealDerived } from '../api/derive.js'
import { SealBox } from './SealBox.jsx'
import { StrikeZoneLegend } from './StrikeZone.jsx'
import { PlayByPlay } from './PlayByPlay.jsx'
import { StatcastCard } from './StatcastCard.jsx'
import { EnteringReference } from './EnteringReference.jsx'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

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
  revealed,
  isNextToReveal,
  revealedThrough,
  getDerived,
  onReveal,
  prospectsData,
  callouts,
}) {
  // The lineups + defense as they stand ENTERING this half — the pre-scoring
  // reference (see EnteringReference). On a phone it's positioned by reveal
  // state: ABOVE the seal while the half is still sealed (stage the sheet before
  // tapping), then BELOW the play-by-play once revealed (out of the way of the
  // results). Only for a half the user has reached; a half further out stays
  // fully sealed — its "entering" state would leak the intervening subs, and
  // defenseEntering/lineupEntering (called inside EnteringReference, given
  // revealedThrough below) enforce that themselves now rather than relying
  // solely on the !revealed && isNextToReveal / revealed checks below, which
  // remain only to choose ABOVE vs BELOW the seal. On the wide layout this
  // inline copy is hidden (.half__entering) and the same reference rides its
  // own card in the right column instead.
  const enteringCards = (
    <div className="half__entering">
      <EnteringReference
        feed={feed}
        revealedThrough={revealedThrough}
        inning={inning}
        half={half}
        battingSide={battingSide}
        awayName={awayName}
        homeName={homeName}
        prospectsData={prospectsData}
      />
    </div>
  )

  return (
    <section className="half">
      <h3 className="half__title">
        {label} {ordinal(inning)}
        <span className="half__team">
          {battingAbbr || (battingSide === 'away' ? 'Away' : 'Home')} bats{' '}
          <span className="half__dot" aria-hidden="true">•</span>{' '}
          {pitchingAbbr || (battingSide === 'away' ? 'Home' : 'Away')} pitches
        </span>
      </h3>

      {/* Reached but still sealed: the lineups/defense sit ABOVE the seal, with
          the pre-pitch change list, so the scorer stages the half before
          tapping to reveal the results. See selectPrePitchChanges for why the
          pre-pitch list is spoiler-free, and only for the immediate next half. */}
      {!revealed && isNextToReveal && (
        <>
          <PrePitchChanges
            feed={feed}
            inning={inning}
            half={half}
            pitchingName={battingSide === 'away' ? homeName : awayName}
          />
          {enteringCards}
        </>
      )}

      <SealBox
        forceRevealed={revealed}
        onReveal={() => onReveal(inning, half)}
        coverless
      >
        {() => {
          // Computed only on reveal (the play-by-play + Statcast half of the
          // former single seal; the R/H/E summary is the row-2 StatBox card).
          const d = revealDerived(getDerived(), inning, half)
          return (
            <>
              {/* The pitch-color key, once right above the sealed reveal
                  content it decodes — the ladder dots and every strike-zone
                  diagram below share this legend. */}
              <StrikeZoneLegend />
              <PlayByPlay
                feed={feed}
                inning={inning}
                half={half}
                battingSide={battingSide}
                callouts={callouts}
              />
              {/* Statcast superlatives for the half — the game-notes numbers
                  (fastest pitch, hardest/longest ball), sat below the feed.
                  Tracking data is often absent at MiLB levels, so the row only
                  renders when the feed carried it. Same reveal path as above. */}
              {(d.maxVelo != null || d.hardestHit != null || d.longestHit != null) && (
                <div className="statcast">
                  {d.maxVelo != null && (
                    <StatcastCard
                      label="Fastest pitch"
                      value={d.maxVelo.toFixed(1)}
                      unit="MPH"
                      who={d.maxVeloPlayer}
                      detail={d.maxVeloType}
                    />
                  )}
                  {d.hardestHit != null && (
                    <StatcastCard
                      label="Hardest hit"
                      value={d.hardestHit.toFixed(1)}
                      unit="MPH"
                      who={d.hardestHitPlayer}
                    />
                  )}
                  {d.longestHit != null && (
                    <StatcastCard
                      label="Longest ball"
                      value={Math.round(d.longestHit)}
                      unit="FT"
                      who={d.longestHitPlayer}
                    />
                  )}
                </div>
              )}
            </>
          )
        }}
      </SealBox>

      {/* Revealed: the same cards drop BELOW the play-by-play (see enteringCards). */}
      {revealed && enteringCards}
    </section>
  )
}

// Subs/pitching changes announced before this half's first pitch — rendered
// above the SealBox (not inside it), gated by the caller to the half the user
// is about to reveal. See selectPrePitchChanges for why this is spoiler-free.
function PrePitchChanges({ feed, inning, half, pitchingName }) {
  const changes = selectPrePitchChanges(feed, inning, half)
  if (changes.length === 0) return null
  return (
    <div className="prepitch">
      <ul className="prepitch__list">
        {changes.map((c, i) => (
          <li className="prepitch__item" key={i}>
            {c.eventType === 'pitching_substitution' && c.pitcher ? (
              <span className="prepitch__pitching">
                <span className="prepitch__now">
                  Now pitching{pitchingName ? ` for the ${pitchingName}` : ''}:
                </span>{' '}
                <span className="prepitch__pitcher">
                  {c.pitcher.name}
                  {c.pitcher.jersey ? ` ${c.pitcher.jersey}` : ''}
                  {c.pitcher.hand ? ` | ${c.pitcher.hand}HP` : ''}
                </span>
              </span>
            ) : (
              c.text
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
