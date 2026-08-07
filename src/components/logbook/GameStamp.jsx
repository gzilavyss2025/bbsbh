import { hasMonoLogo, teamLogoUrl } from '../../lib/teams.js'
import { stampInkFor, stampWinnerId } from '../../lib/stampInk.js'
import { stampInkOverrideFor } from '../../lib/stampInkTuning.js'
import { stampMarkPlacement } from '../../lib/stampLogoTuning.js'
import {
  INNER_RING_R,
  MARK_BOX,
  OUTER_RING_R,
  CLIP_R,
  LABEL_BASELINE,
  RING_FONT_SIZE,
  RING_TRACKING,
  RUN_BASELINE,
  RUN_X,
  STAMP_CENTER,
  STAMP_SIZE,
  labelType,
  markBoxX,
  ringLayout,
  runFontSize,
  stampDateText,
  stampIds,
  stampLabel,
  stampSeed,
} from '../../lib/stampArt.js'

// A Logbook game stamp (ADR-0035) — Concept 1, "The Cancellation", the locked
// design from PR #502. This file is a tracing of that art; every number it
// draws with comes from the pure module src/lib/stampArt.js, whose header
// records what is locked and why. Do not redesign here.
//
// ===========================================================================
// SPOILER CONTAINMENT — the only rule about this component that matters
// ===========================================================================
// A stamp IS a final score, by definition. That is the whole point of the
// artifact, and it is safe for exactly one reason: a stamp only exists for a
// game its owner already finished revealing (the server enforces that on every
// mint). So this component may render ONLY where every game shown is already
// one of the user's own stamps:
//
//   - src/components/StampGameButton.jsx  (itself only inside the box score's
//                                          SealBox reveal render function)
//   - src/screens/LogbookPage.jsx         (the collection)
//
// NEVER on the slate, never on a game card, never in "pick up your pencil"
// (ContinueScoring.jsx), never in any list of games the user has not revealed.
// scripts/check-stamp-surfaces.mjs fails `npm run lint` if that drifts.
//
// ===========================================================================
// One colour — and WHICH colour (ADR-0036's addendum)
// ===========================================================================
// A stamp is drawn in ONE ink, and that ink is the WINNING club's darkest brand
// colour by default: the mark a game leaves behind is in the colours of
// whoever won it, so a page of keepsakes reads as a season rather than as a
// print run. A club may override that automatic pick with its own hex
// (src/lib/data/stamp-ink.json, picked in /identity-lab's Stamp ink editor) —
// still walked through the SAME contrast floor, because that floor is about
// what a stamp needs to read at hairline widths, not about which colour a
// club owns. The pick itself is src/lib/stampInk.js — including why darkest
// rather than primary, and the contrast floor under it — and it is published
// here as `--stamp-ink` rather than as a `color`, so the CSS keeps the last
// word: a surface that wants its own ink (the un-minted preview in the mint
// card, pale as an un-inked die) simply sets `color` and wins. No winner on
// file — a tie, a suspended game, facts that never resolved — omits the
// property entirely and the stamp is pressed in the book's default navy.
//
// Everything else about the one-colour discipline is unchanged. Every element
// including the logos is `currentColor` — the stamp inherits its ink from
// whatever it sits on, so there are no opacity tricks and value contrast comes
// from stroke weight, size, and mass alone. The club marks are
// the project's precomputed mono knockout files (ADR-0031), which are white ink
// on transparent, i.e. already luminance masks: an <image> of one inside a
// <mask> over a currentColor rect recolours it to any single ink.
//
// Two consequences worth knowing before changing that recipe:
//
//   1. The <image> is an EXTERNAL reference, which resolves only while this SVG
//      is inline in the document. Rendered through an <img>, an OG card, or a
//      PNG export, external refs are blocked and the marks silently vanish —
//      any future export path must INLINE the mono markup instead. The
//      reference form is kept here deliberately, because it lets the browser
//      cache each club's file once across a whole Logbook grid.
//   2. Coverage is partial (MiLB especially), and a mask whose image 404s paints
//      nothing rather than falling back. Hence `hasMonoLogo` and the bold
//      abbreviation dropped into the same box — the documented fallback.
//
// WHERE a mark sits inside its slot is the one tunable part of the locked art:
// a club may carry a hand-picked scale/offset/rotation per SIDE, resolved by
// src/lib/stampLogoTuning.js and applied as a transform on the mask's <image>
// (the geometry, and why it clamps, is stampArt.js's "Per-club mark placement"
// block). Untuned clubs get a null transform and draw exactly as before. The
// visible rect is the whole stamp rather than the slot, so a tuned mark can be
// scaled or turned without the rect — or the mask's own region, pinned here in
// userSpaceOnUse for the same reason — cropping it back to the untuned box.
//
// Every <defs> id is suffixed per stamp instance, because SVG ids are global to
// the document and a Logbook grid puts dozens of these on one page.
//
// `game` is the shape api/stamps.js caches as `game:final:{gamePk}` — produced
// either by revealStampFacts (src/api/linescore.js, from a live feed) or by
// fetchStampGames (src/api/logbook.js, from the schedule). One shape, so the
// two sources cannot drift.
//
// `placements` and `inkOverride` are the lab's live-preview seam and nothing
// else. `placements` (`{ away, home }`) stands in for what stamp-logo-tuning.json
// holds, so /identity-lab's Stamp placement editor can show an unsaved edit on
// the real stamp instead of a mock-up. `inkOverride` does the same job for
// stamp-ink.json's per-club ink (src/lib/stampInkTuning.js): pass any string,
// including an EMPTY one, to force the preview to ignore the landed override
// and show what that draft (or clearing it back to automatic) would actually
// print. Every real caller omits both and reads the landed stores.
export function GameStamp({ game, seriesText = null, instanceId, className = '', title, placements, inkOverride }) {
  if (!game) return null

  const ids = stampIds(instanceId ?? game.gamePk)
  const venueText = game.venue ?? ''
  // A postseason game substitutes its series line for the date in the same
  // bottom-arc slot rather than stacking a second line — the ring only ever
  // carries one thing there.
  const bottomText = seriesText || stampDateText(game.date)
  const ring = ringLayout(venueText, bottomText)
  const label = stampLabel(game)
  const labelFont = labelType(label)
  const numSize = runFontSize(game.away?.runs, game.home?.runs)
  const runText = (runs) => (typeof runs === 'number' ? String(runs) : '—')
  // The winner's ink, or null for a game with no winner — which leaves the
  // property off entirely rather than writing an empty one, so the CSS
  // fallback in `.gamestamp` is what answers. A landed per-club override
  // (stamp-ink.json) wins over the automatic darkest-brand-colour pick;
  // `inkOverride`, when passed at all, wins over that landed value in turn.
  const winnerId = stampWinnerId(game)
  const overrideHex = inkOverride !== undefined ? inkOverride : stampInkOverrideFor(winnerId)
  const ink = stampInkFor(game, { overrideHex })

  const accessibleTitle =
    title ??
    `${game.away?.abbreviation ?? 'Away'} ${runText(game.away?.runs)} at ` +
      `${game.home?.abbreviation ?? 'Home'} ${runText(game.home?.runs)}, ` +
      `${venueText}, ${bottomText}`

  return (
    <svg
      viewBox={`0 0 ${STAMP_SIZE} ${STAMP_SIZE}`}
      className={`gamestamp ${className}`.trim()}
      role="img"
      {...(ink ? { style: { '--stamp-ink': ink } } : null)}
    >
      <title>{accessibleTitle}</title>
      <defs>
        {/* Rubber-stamp ink roughening: pure-vector displacement, no raster
            texture. The seed comes from the gamePk, so one game's chew is
            identical forever — a keepsake that re-roughened on every render
            wouldn't be one. */}
        <filter id={ids.ink} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.55"
            numOctaves="2"
            seed={stampSeed(game.gamePk)}
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>

        <path id={ids.arcTop} d={ring.arcTop} fill="none" />
        <path id={ids.arcBottom} d={ring.arcBottom} fill="none" />

        <clipPath id={ids.clip}>
          <circle cx={STAMP_CENTER} cy={STAMP_CENTER} r={CLIP_R} />
        </clipPath>

        <MarkMask id={ids.awayMask} teamId={game.away?.id} side="away" placement={placements?.away} />
        <MarkMask id={ids.homeMask} teamId={game.home?.id} side="home" placement={placements?.home} />
      </defs>

      <g filter={`url(#${ids.ink})`} fill="currentColor">
        {/* Chrome: the double bounding ring */}
        <circle
          cx={STAMP_CENTER}
          cy={STAMP_CENTER}
          r={OUTER_RING_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <circle
          cx={STAMP_CENTER}
          cy={STAMP_CENTER}
          r={INNER_RING_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Ring text: the venue up top, the date (or series line) below, each
            running its natural length in fixed-width mono — the typewriter
            rhythm the design settled on after rejecting a textLength force-fit.
            Both are rendered mixed-case and shouted by the app's global
            ALL-CAPS invariant, same as every other live value. */}
        <text
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontSize={RING_FONT_SIZE}
          fontWeight="400"
          letterSpacing={RING_TRACKING}
        >
          <textPath href={`#${ids.arcTop}`} startOffset="50%" textAnchor="middle">
            {venueText}
          </textPath>
        </text>
        <text
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontSize={RING_FONT_SIZE}
          fontWeight="400"
          letterSpacing={RING_TRACKING}
        >
          <textPath href={`#${ids.arcBottom}`} startOffset="50%" textAnchor="middle">
            {bottomText}
          </textPath>
        </text>
        <path d={ring.diamondLeft} />
        <path d={ring.diamondRight} />

        {/* Top half: the two club marks, clipped to the inner circle so they
            bleed off its left/right edge instead of sitting in a small box. */}
        <g clipPath={`url(#${ids.clip})`}>
          <ClubMark
            maskId={ids.awayMask}
            teamId={game.away?.id}
            abbreviation={game.away?.abbreviation}
            side="away"
          />
          <ClubMark
            maskId={ids.homeMask}
            teamId={game.home?.id}
            abbreviation={game.home?.abbreviation}
            side="home"
          />
        </g>

        {/* The app's own screen-print '@', sitting in the gap between the two
            marks — translucent, no ghost/misregistration layer. */}
        <g transform={`translate(${STAMP_CENTER},128) skewX(-8) rotate(-2)`}>
          <text
            x="0"
            y="0"
            textAnchor="middle"
            opacity="0.3"
            fontFamily='"Big Shoulders Display", "IBM Plex Sans Condensed", sans-serif'
            fontSize="50"
            fontWeight="900"
          >
            @
          </text>
        </g>

        {/* Bottom half: the run totals. No divider rule, no winner's underscore
            — both faces share one weight and size on purpose. */}
        <text
          x={RUN_X.away}
          y={RUN_BASELINE}
          textAnchor="middle"
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontSize={numSize}
          fontWeight="700"
        >
          {runText(game.away?.runs)}
        </text>
        <text
          x={RUN_X.home}
          y={RUN_BASELINE}
          textAnchor="middle"
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontSize={numSize}
          fontWeight="700"
        >
          {runText(game.home?.runs)}
        </text>

        {/* Game-state footer inside the bottom lens — extras/doubleheader facts
            only (stampArt.js's stampLabel); a plain nine-inning single game has
            nothing to say here, so nothing renders. */}
        {label && (
          <text
            x={STAMP_CENTER}
            y={LABEL_BASELINE}
            textAnchor="middle"
            fontFamily='"IBM Plex Mono", ui-monospace, monospace'
            fontSize={labelFont.size}
            fontWeight="400"
            letterSpacing={labelFont.tracking}
          >
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

// The <mask> half of one club mark. Emitted only when that club actually has a
// precomputed knockout file — otherwise there is nothing to mask and ClubMark
// draws the abbreviation instead.
//
// The mask REGION is stated in user space over the whole stamp rather than left
// to its default (the masked element's bounding box, grown 10%): the masked
// element is now the full-stamp rect below, and a region tied to a box would
// crop a club that scaled or turned its mark.
function MarkMask({ id, teamId, side, placement }) {
  if (!teamId || !hasMonoLogo(teamId)) return null
  const place = stampMarkPlacement(teamId, side, placement)
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={STAMP_SIZE} height={STAMP_SIZE}>
      <image
        href={teamLogoUrl(teamId, 'mono')}
        x={place.x}
        y={place.y}
        width={place.size}
        height={place.size}
        // Marks are not square (Brewers 157x172 portrait, Cubs 234x234), so the
        // slot is square and the mark letterboxes into it. Never assume aspect.
        preserveAspectRatio="xMidYMid meet"
        // Absent for a club with no tuning on file, so its markup is unchanged.
        {...(place.transform ? { transform: place.transform } : null)}
      />
    </mask>
  )
}

// The visible half: a currentColor rect punched by the mask above, or the club's
// bold abbreviation centered in the same slot when there is no mark to punch it.
//
// The rect is the whole stamp, not the mark's slot — the mask is what shapes it,
// and a rect the size of the untuned slot would clip a mark its club had scaled
// up or rotated. Nothing paints outside the mark either way, and the enclosing
// <g> is clipped to the inner circle regardless.
//
// The abbreviation fallback is deliberately NOT tuned: placement tunes the
// knockout mark, and a club drawing this has none.
function ClubMark({ maskId, teamId, abbreviation, side }) {
  if (teamId && hasMonoLogo(teamId)) {
    return (
      <rect
        x="0"
        y="0"
        width={STAMP_SIZE}
        height={STAMP_SIZE}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    )
  }
  if (!abbreviation) return null
  return (
    <text
      x={markBoxX(side) + MARK_BOX.size / 2}
      y={MARK_BOX.y + MARK_BOX.size / 2 + 18}
      textAnchor="middle"
      fontFamily='"IBM Plex Mono", ui-monospace, monospace'
      fontSize="46"
      fontWeight="700"
    >
      {abbreviation}
    </text>
  )
}
