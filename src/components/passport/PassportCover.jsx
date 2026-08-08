import { useId } from 'react'
import { PAGE_ASPECT } from '../../lib/passportLayout.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { hasMonoLogo, teamAbbr, teamChipColors, teamFullName, teamLogoUrl } from '../../lib/teams.js'
import { TallyWordmark } from '../chrome/TallyBrand.jsx'
import { leagueMarkBox, leagueMarkUrl } from './leagueMarks.js'

// The Logbook passport book's FRONT COVER (ADR-0035, the passport-book
// redesign). A real passport cover is one board of one colour with everything
// on it foil-stamped in a single second colour — no photographs, no gradients,
// no third ink. This is that, and it is a real button: tapping it opens the
// book.
//
// ===========================================================================
// Which book, and whose colours — the `book` prop (ADR-0036's shelf)
// ===========================================================================
// A book is `{ id, state, title, subtitle, coverTeamId, createdAt, updatedAt }`
// (src/lib/books.js) — already sanitized by whoever calls this component, so
// this file trusts the shape rather than re-validating it, but still treats a
// missing or partially-shaped `book` as a degrade case, not a crash, the same
// posture it already held for an unrecognised team id.
//
//   - `book?.coverTeamId`, when it is a real positive integer, picks whose
//     colours paint the board. Anything else — no `book` at all (every caller
//     before this feature shipped a shelf UI), or a `book` with no cover pick
//     yet — falls back to EXACTLY today's behaviour, `useFavoriteTeam()`, so a
//     not-yet-customized book still themes off the user's own club with zero
//     regression for anyone who never touches the new feature.
//   - `book?.title` prints in the `.passcover__title` slot in place of the
//     literal "Game Log"; `book?.subtitle` prints in `.passcover__club` in
//     place of the resolved club's full name. Both are empty-string-safe
//     (books.js's own contract: an empty string means "use the default word
//     at render time", which is exactly this component's job — see the two
//     `||` fallbacks below).
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

// ===========================================================================
// The league marks — a cover that carries no club at all
// ===========================================================================
// `book.coverMark` (src/lib/books.js) is 'team' | 'mlb' | 'milb'. 'team' is
// everything above and everything this component ever did before the cover
// picker shipped; the other two swap the club crest for a LEAGUE mark and take
// the board from `book.coverColor` (one of three house tokens) instead of from
// a club. A record carrying neither field normalizes to `'team' + null`, which
// is why an untouched book is byte-for-byte what it always drew.
//
// The two league marks are precomputed by scripts/gen-league-logos.mjs through
// the SAME src/lib/logoMono.js pipeline as a club's, so warning (1) above
// applies to them identically: the <image> resolves only while this SVG is
// inline. They differ from a club mark in one way that matters here — MLB is a
// near-square badge and MiLB a wide wordmark — so they get their own viewBox
// (leagueMarks.js) rather than letterboxing into the square CREST_BOX below.

// The club crest's user-space box. Square, because a mono mark is not
// (Brewers 157x172 portrait, Cubs 234x234) and letterboxes into whatever slot
// it is given — never assume aspect.
const CREST_BOX = 100

// `preview` draws the same board with nothing behind it: the cover picker
// needs a live picture of what it is about to write, and a SECOND cover
// renderer is the one way this could ever show something the book itself does
// not. A disabled button is not focusable, which is what makes `aria-hidden`
// legitimate here — the picker names the choice around it.
export function PassportCover({ book, onOpen, preview = false }) {
  // Called unconditionally (react-hooks/rules-of-hooks) even for a book with
  // its own cover pick — cheap (localStorage-backed, already memoized by
  // usePreferences), and the one branch below that needs it is itself
  // conditional on `book`, which is NOT known before this hook runs.
  const { favoriteTeamId } = useFavoriteTeam()

  // The one id every visible thing on the board resolves from — colour,
  // crest, and abbreviation alike, so a customized cover reads as ONE club's
  // identity rather than someone else's colours behind a stranger's crest.
  // A `book` with no cover pick, or no `book` at all (every caller before the
  // shelf UI existed), is exactly today's cover: the user's own favourite.
  const hasCoverPick = Number.isInteger(book?.coverTeamId) && book.coverTeamId > 0
  const teamId = hasCoverPick ? book.coverTeamId : favoriteTeamId

  // A league mark is the whole identity of the cover it sits on, so it
  // suppresses the club entirely — colours, crest and the club-name subtitle
  // alike. `coverTeamId` is kept on the record through all of it, so switching
  // back to a club crest never asks the user to re-pick the club.
  const leagueMark = book?.coverMark === 'mlb' || book?.coverMark === 'milb' ? book.coverMark : null
  const leagueBox = leagueMark ? leagueMarkBox(leagueMark) : null
  const leagueHref = leagueMark ? leagueMarkUrl(leagueMark) : null

  const colors = leagueMark ? null : teamChipColors(teamId)
  const maskId = `passcover-crest-${useId().replace(/:/g, '')}`

  const abbr = leagueMark ? '' : teamAbbr({ id: teamId })
  const clubName = leagueMark ? '' : teamFullName(teamId)
  const hasMark = !leagueMark && Boolean(teamId) && hasMonoLogo(teamId)

  // '' is a valid, meaningful value from books.js's own contract ("use the
  // default word at render time") — never something invented on the record's
  // behalf, and this is the render time that contract points to.
  const title = book?.title || 'Game Log'
  const subtitleContent = book?.subtitle || clubName

  // The page aspect is imported, never restated, so a cover and the pages it
  // opens onto can't drift apart. Passed as a custom property rather than a
  // hardcoded `aspect-ratio` so src/lib/passportLayout.js stays the one place
  // the book's geometry is written down.
  const style = { '--passport-aspect': PAGE_ASPECT }
  if (colors) {
    style['--cover-ink'] = colors.primary
    style['--cover-foil'] = colors.text
  }

  // A league-mark board is a token pair, so it is set by a class rather than
  // an inline hex — the colour stays in the stylesheet where check-contrast.mjs
  // can reach it. An unrecognised `coverColor` never gets here (books.js
  // sanitizes it to null); null means the kraft board, the house default.
  const boardClass = leagueMark ? ` passcover--board-${book.coverColor ?? 'kraft'}` : ''

  return (
    <button
      type="button"
      className={`passcover${boardClass}`}
      style={style}
      onClick={preview ? undefined : onOpen}
      disabled={preview || undefined}
      aria-hidden={preview || undefined}
      // The accessible name says what the control DOES, and contains the word
      // the foot of the cover shows (ADR-0017's button-copy convention).
      aria-label="Open your Game Log"
    >
      {/* A league mark in place of the club crest. Same mask-over-currentColor
          recipe as the club mark below, on the mark's OWN viewBox — a square
          slot would shrink the MiLB wordmark to a sliver. Dropped, not faked,
          if this build has no art for it. */}
      {leagueMark && leagueBox && leagueHref && (
        <span className={`passcover__crest passcover__crest--${leagueMark}`}>
          <svg
            viewBox={leagueBox.join(' ')}
            className="passcover__mark passcover__mark--league"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <mask id={maskId}>
                <image
                  href={leagueHref}
                  x={leagueBox[0]}
                  y={leagueBox[1]}
                  width={leagueBox[2]}
                  height={leagueBox[3]}
                  preserveAspectRatio="xMidYMid meet"
                />
              </mask>
            </defs>
            <rect
              x={leagueBox[0]}
              y={leagueBox[1]}
              width={leagueBox[2]}
              height={leagueBox[3]}
              fill="currentColor"
              mask={`url(#${maskId})`}
            />
          </svg>
        </span>
      )}

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
                    href={teamLogoUrl(teamId, 'mono')}
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

      <span className="passcover__title">{title}</span>

      {/* Empty for a book with no custom subtitle AND a MiLB club (no name in
          the static table, answers null) — the line is dropped rather than
          filled with a placeholder, same as before this prop existed. */}
      {subtitleContent && <span className="passcover__club">{subtitleContent}</span>}

      <span className="passcover__rule" aria-hidden="true" />
      <span className="passcover__open">Open</span>
    </button>
  )
}
