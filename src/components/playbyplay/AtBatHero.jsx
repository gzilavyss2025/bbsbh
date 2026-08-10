import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherPhoto } from './PitcherNotice.jsx'

// The focused plate appearance's header (ADR-0043) — focus mode only, threaded
// down through AtBatCard as `focusHeader`.
//
// This REPLACES the card's ordinary `.pbp__top` name row rather than sitting
// above it, which is the difference between this and the AtBatMatchup strip it
// grew out of. That strip was additive, so the batter's name was printed twice
// on the one card the whole screen is built around — the header said YELICH and
// the line under it said Yelich, Christian LF. Here the header owns the
// identity outright: the name, the position, the pinch-runner chain, and the
// RBI chip all move up into it, and AtBatCard renders no second copy.
//
// Deliberately asymmetric. The batter is who the reader is penciling, so he
// takes the larger headshot rung (--shot-sm) and display-scale type; the
// pitcher is context and takes the smallest rung (--shot-2xs) at label scale.
// Sizing carries the hierarchy so the "vs" doesn't have to shout it.
//
// Every value arrives already resolved and already reveal-gated on the entry —
// same discipline as the rest of this feed. Headshots use the shared
// PitcherPhoto fallback chain (silo -> milb -> team logo -> monogram), so a
// MiLB game with no portrait degrades to a mark rather than a hole.
export function AtBatHero({ batter, pitcher, batSide, rbi, pinchRunners, battingTeamId, pitchingTeamId }) {
  const replaced = pinchRunners && pinchRunners.length > 0
  return (
    <div className="abhero">
      <div className="abhero__shot abhero__shot--bat">
        <PitcherPhoto personId={batter.id} name={batter.last} teamId={battingTeamId} />
      </div>
      <div className="abhero__who">
        <span className={`abhero__name ${replaced ? 'pbp__replaced' : ''}`}>
          <PlayerLink id={batter.id}>{batter.last}</PlayerLink>
        </span>
        <span className="abhero__meta">
          {batter.pos && <span className="abhero__pos">{batter.pos}</span>}
          {batSide && <span className="abhero__hand">{batSide}HB</span>}
          {rbi > 0 && <span className="pbp__rbi abhero__rbi">{rbi} RBI</span>}
        </span>
        {/* The pinch-runner chain, penciled in under the batter he took over
            for — the same crossed-out-and-replaced convention .pbp__top used,
            kept here because this header is now the card's only name row. */}
        {pinchRunners?.map((pr, i) => (
          <span
            key={pr.id}
            className={`abhero__pr ${i < pinchRunners.length - 1 ? 'pbp__replaced' : ''}`}
          >
            <PlayerLink id={pr.id}>{pr.last}</PlayerLink>
            <span className="abhero__pos">PR</span>
          </span>
        ))}
      </div>
      <span className="abhero__vs" aria-hidden="true">
        vs
      </span>
      {pitcher && (
        <>
          <div className="abhero__arm">
            <span className="abhero__armname">
              <PlayerLink id={pitcher.id}>{pitcher.last}</PlayerLink>
            </span>
            {pitcher.hand && <span className="abhero__pos">{pitcher.hand}HP</span>}
          </div>
          <div className="abhero__shot abhero__shot--arm">
            <PitcherPhoto personId={pitcher.id} name={pitcher.last} teamId={pitchingTeamId} />
          </div>
        </>
      )}
    </div>
  )
}
