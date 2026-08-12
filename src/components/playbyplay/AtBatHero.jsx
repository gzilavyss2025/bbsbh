import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherPhoto } from './PitcherNotice.jsx'
import { BallGlyph } from '../game/BoxScoreSkeleton.jsx'

// The focused plate appearance's header (ADR-0043) — focus mode only, threaded
// down through AtBatCard as `focusHeader`.
//
// This REPLACES the card's ordinary `.pbp__top` name row rather than sitting
// above it, which is the difference between this and the AtBatMatchup strip it
// grew out of. That strip was additive, so the batter's name was printed twice
// on the one card the whole screen is built around — the header said YELICH and
// the line under it said Yelich, Christian LF. Here the header owns the
// identity outright: the name, the position, and the pinch-runner chain all
// move up into it, and AtBatCard renders no second copy. The RBI count does
// NOT live here — it rides instead in PlayByPlay.jsx's own play-notation pill
// beside the diamond, next to the result code it belongs to (FC, 1B, …)
// rather than up here beside the batter's name.
//
// Batter and pitcher read as equals here — same headshot rung (--shot-sm), same
// full-name/jersey/position shape (EnteringReference.jsx's lineup-row
// convention: jersey number before position, not after). The batter drops his
// batting-side hand (RHB/LHB is a bio fact the box score already carries, and
// crowded the card without pulling its weight); the pitcher keeps his — RHP/
// LHP IS his position here, not a separate fact bolted onto it. Center glyph
// is the loading skeleton's own rolling baseball (BoxScoreSkeleton.jsx),
// frozen on one frame — the two men facing off, not a word between them.
//
// Every value arrives already resolved and already reveal-gated on the entry —
// same discipline as the rest of this feed. Headshots use the shared
// PitcherPhoto fallback chain (silo -> milb -> team logo -> monogram), so a
// MiLB game with no portrait degrades to a mark rather than a hole.
// First name, mobile-hidden (see .abhero__namefirst — last name only fits
// this card's width beside two portraits below the wide breakpoint), plus
// last name. The trailing space rides inside the first-name span itself so
// hiding it on mobile doesn't leave a stray gap before the surname.
function NameParts({ id, first, last }) {
  return (
    <PlayerLink id={id}>
      {first && <span className="abhero__namefirst">{first} </span>}
      <span className="abhero__namelast">{last}</span>
    </PlayerLink>
  )
}

export function AtBatHero({ batter, pitcher, pinchRunners, battingTeamId, pitchingTeamId }) {
  const replaced = pinchRunners && pinchRunners.length > 0
  return (
    <div className="abhero">
      <div className="abhero__shot abhero__shot--bat">
        <PitcherPhoto personId={batter.id} name={batter.last} teamId={battingTeamId} />
      </div>
      <div className="abhero__who">
        <span className={`abhero__name ${replaced ? 'pbp__replaced' : ''}`}>
          <NameParts id={batter.id} first={batter.first} last={batter.last} />
        </span>
        <span className="abhero__meta">
          {batter.jersey ? <span className="abhero__jersey">{batter.jersey}</span> : null}
          {batter.pos && <span className="abhero__pos">{batter.pos}</span>}
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
      <BallGlyph className="abhero__vs" />
      {pitcher && (
        <>
          <div className="abhero__arm">
            <span className="abhero__armname">
              <NameParts id={pitcher.id} first={pitcher.first} last={pitcher.last} />
            </span>
            <span className="abhero__meta abhero__meta--arm">
              {pitcher.jersey ? <span className="abhero__jersey">{pitcher.jersey}</span> : null}
              {pitcher.hand && <span className="abhero__pos">{pitcher.hand}HP</span>}
            </span>
          </div>
          <div className="abhero__shot abhero__shot--arm">
            <PitcherPhoto personId={pitcher.id} name={pitcher.last} teamId={pitchingTeamId} />
          </div>
        </>
      )}
    </div>
  )
}
