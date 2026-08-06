import { useId } from 'react'
import { PAGE_ASPECT } from '../../lib/passportLayout.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { hasMonoLogo, teamAbbr, teamChipColors, teamFullName, teamLogoUrl } from '../../lib/teams.js'
import { TallyWordmark } from '../chrome/TallyBrand.jsx'

// The Logbook passport book's FRONT COVER (ADR-0035, the passport-book
// redesign). A real passport cover is one board of one colour with everything
// on it foil-stamped in a single second colour — no photographs, no gradients,
// no third ink. This is that, painted in the user's favourite club's primary
// brand colour, and it is a real button: tapping it opens the book.
//
// ===========================================================================
// Where the two colours come from — one chain, never a palette of our own
// ===========================================================================
// `teamChipColors` (src/lib/teams.js) is the single resolver, and it is the
// right one rather than `teamPrimaryColor` because it answers BOTH halves of
// the cover in one call:
//
//   • `.primary` — the club's own primary brand colour, resolved through the
//     one colour chain (resolveTeamColorPair -> TEAM_COLOR_PAIRS, then
//     brandColors.js's milbBrandPair for an affiliate). Nothing is hardcoded
//     here and no hex is invented; see src/lib/CLAUDE.md.
//   • `.text`   — the foil. `readableTextColor` (src/lib/contrast.js) picks
//     whichever of the app's OWN two text tokens (--text-on-ink #FBF6E9 /
//     --text-heading #16222F, mirrored as hex there because contrast math
//     needs literal values) contrasts better against that primary.
//
// That second point is what makes an ARBITRARY club colour safe. Clubs run
// from near-black (Padres brown, Rays navy) to bright (Giants orange, Marlins
// blue), and "white foil always works" is false for half of them. Picking the
// better of the two by WCAG ratio has a computable worst case: the two tokens
// cross over at a background luminance of ~0.199, where BOTH sit at 3.8:1 —
// so the foil is never worse than 3.8:1 against any club colour that exists or
// ever could. Everything this cover stamps onto the board is therefore held to
// the 3:1 non-text / large-text AA bar and no lower: the two marks are art,
// and every line of type on the board is >=20px at --w-bold (past the 18.66px
// bold large-text threshold). Do NOT add small copy to the board — put it
// under the cover, on paper, where the normal 4.5:1 bar can actually be met.
//
// A club the chain has no colour for at all (an unaffiliated/complex-league
// id) returns null, and the component then sets NO custom properties: the CSS
// fallbacks paint the app's own navy board with paper-coloured foil. That is a
// deliberate look — the house cover — not a broken one.
//
// ===========================================================================
// The two knockout marks
// ===========================================================================
// TALLY: `TallyWordmark` draws every path with `fill="currentColor"`, so it is
// already knockout-ready — inheriting the foil colour is the whole treatment,
// no filter and no new prop on TallyBrand.jsx. (`TallyBaseballMark` is NOT:
// its ball and tally squares are painted from a hardcoded clay gradient plus
// #F7EEE2, so it cannot go one-colour without a new prop over there. The
// wordmark is the cleaner mark for a cover anyway — a passport says its issuer
// in words.)
//
// CLUB: the sanctioned mechanism is the precomputed mono knockout file
// (ADR-0031, src/lib/logoMono.js, public/data/logos/mono/) drawn as an
// <image> inside an SVG <mask> over a currentColor rect — the exact recipe
// GameStamp.jsx documents, reused here rather than re-derived. `filter:
// brightness(0) invert(1)` is forbidden for this (ADR-0031: it crushes a
// mark's own light-filled interior detail into a blob); the one narrow
// exception that ADR grants is a hover state on .gamestory__link, not this.
//
// Two warnings carried over from GameStamp.jsx's header, because they apply
// here identically:
//
//   1. The <image> is an EXTERNAL reference and resolves only while this SVG
//      is inline in the document. Rendered through an <img>, an OG card, or a
//      PNG export it is silently blocked and the mark vanishes — any future
//      export of the cover must INLINE the mono markup instead.
//   2. Every <defs> id is suffixed per instance (useId), because SVG ids are
//      global to the document and a cover can share a page with a Logbook grid
//      full of stamps.
//
// And the fallback: mono coverage is partial by design, and a mask whose image
// 404s paints NOTHING rather than degrading (which is why `hasMonoLogo` is
// asked in advance instead of leaning on TeamLogo's variant -> base chain —
// see TeamLogo.jsx's own two-step degrade, which does not apply inside a
// mask). A club with no knockout mark wears its abbreviation, foil-stamped in
// the same slot, exactly as GameStamp does; a club with no abbreviation either
// gets no crest at all and the cover reads as the wordmark alone. Never a
// broken image, never an invented mark.

// The club crest's user-space box. Square, because a mono mark is not
// (Brewers 157x172 portrait, Cubs 234x234) and letterboxes into whatever slot
// it is given — never assume aspect.
const CREST_BOX = 100

export function PassportCover({ onOpen }) {
  const { favoriteTeamId } = useFavoriteTeam()
  const colors = teamChipColors(favoriteTeamId)
  const maskId = `passcover-crest-${useId().replace(/:/g, '')}`

  const abbr = teamAbbr({ id: favoriteTeamId })
  const clubName = teamFullName(favoriteTeamId)
  const hasMark = Boolean(favoriteTeamId) && hasMonoLogo(favoriteTeamId)

  // The page aspect is imported, never restated, so a cover and the pages it
  // opens onto can't drift apart. Passed as a custom property rather than a
  // hardcoded `aspect-ratio` so src/lib/passportLayout.js stays the one place
  // the book's geometry is written down.
  const style = { '--passport-aspect': PAGE_ASPECT }
  if (colors) {
    style['--cover-ink'] = colors.primary
    style['--cover-foil'] = colors.text
  }

  return (
    <button
      type="button"
      className="passcover"
      style={style}
      onClick={onOpen}
      // The accessible name says what the control DOES, and contains the word
      // the foot of the cover shows (ADR-0017's button-copy convention).
      aria-label="Open your Game Log"
    >
      {/* No knockout mark AND no abbreviation (an unrecognised id) — the crest
          slot is dropped entirely rather than left as an empty square, and the
          cover reads as the wordmark alone. */}
      {(hasMark || abbr) && (
        <span className="passcover__crest">
          {hasMark ? (
            <svg
              viewBox={`0 0 ${CREST_BOX} ${CREST_BOX}`}
              className="passcover__mark"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <mask id={maskId}>
                  <image
                    href={teamLogoUrl(favoriteTeamId, 'mono')}
                    x="0"
                    y="0"
                    width={CREST_BOX}
                    height={CREST_BOX}
                    // Marks are not square (Brewers 157x172 portrait, Cubs
                    // 234x234), so the slot is square and the mark letterboxes
                    // into it. Never assume aspect.
                    preserveAspectRatio="xMidYMid meet"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width={CREST_BOX}
                height={CREST_BOX}
                fill="currentColor"
                mask={`url(#${maskId})`}
              />
            </svg>
          ) : (
            <span className="passcover__abbr">{abbr}</span>
          )}
        </span>
      )}

      <TallyWordmark
        height={28}
        title=""
        aria-hidden="true"
        className="passcover__wordmark"
        tight
      />

      <span className="passcover__title">Game Log</span>

      {/* MiLB ids have no name in the static table and answer null — the line
          is dropped rather than filled with a placeholder. */}
      {clubName && <span className="passcover__club">{clubName}</span>}

      <span className="passcover__rule" aria-hidden="true" />
      <span className="passcover__open">Open</span>
    </button>
  )
}
