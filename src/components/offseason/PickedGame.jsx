import { useMemo, useState } from 'react'
import { fetchMilbPool, pickGame, poolGamePath, reasonLine, seedFrom } from '../../api/milbPool.js'
import { useAsync } from '../../hooks/useAsync.js'
import { readRevealMarkFor } from '../../hooks/useRevealProgress.js'
import { useRouteLink } from '../../lib/nav.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { SPORT_LABEL } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// ONE MORE GAME — the lead of the minor levels' offseason page, issue #1077.
//
// The page beneath this says what became of the people a reader watched all
// summer. This says the season is still there to be scored. It is the whole
// argument of the design study's recommended concept: a scorer in November does
// not want a highlight reel or a standings table, they want a game and a blank
// sheet, and there are 1,881 of them at High-A alone that nobody has opened.
//
// A CARD THAT KEEPS ITS PROMISE. Every game offered here has been checked
// against its own feed by scripts/gen-milb-pool.mjs — plays placed in innings,
// nine in both batting orders, a pitcher a side — because a minor-league
// schedule row cannot say whether a game was even played, let alone scored.
// "Lineups posted" on the meta line is therefore a fact about this game rather
// than a hope, and it is the line that distinguishes this card from the empty
// slate it replaces.
//
// AND SAYS WHY THIS ONE. A uniformly random game can be ordinary; the reason
// line is what answers "why am I being shown this". Every version of it counts
// CAREERS — a prospect board, a player who reached the majors, a season that
// finished higher than it started — and never anything that happened in the
// game. That is not a stylistic preference. A pool secretly dealt by drama, or
// a line hinting at a close finish, would be the page reading the result it
// refuses to show (research.md §5.6); the facts here are all true before the
// first pitch (api/milbPool.js holds the full ordering).
//
// THE SEAL IS THE ORDINARY ONE. This links to the game's first lineup page at
// the same address the slate's own cards build, so the game opens sealed under
// the same `revealedThrough` mark as any other. Nothing here reveals, consents
// or persists; the card's only state is which game of the deck is face up.
export function PickedGame({ sportId, season, dateStr }) {
  const { data } = useAsync(() => fetchMilbPool(sportId), [sportId])
  const [step, setStep] = useState(0)
  const linkProps = useRouteLink()

  // The day and the level, so one visit deals one game — and so two tabs open
  // on the same slate agree about which. `step` is the reader walking the deck.
  const seed = useMemo(() => seedFrom(`${dateStr ?? ''}|${sportId}`), [dateStr, sportId])
  const picked = useMemo(
    () =>
      pickGame(data?.games, {
        seed,
        step,
        // A game with a reveal mark on it is one this device has already
        // opened. Offering it as a fresh sealed game would be a promise broken
        // on the first tap.
        isStarted: (pk) => readRevealMarkFor(pk) >= 0,
      }),
    [data, seed, step],
  )

  // A pool from a different season than the page is naming is not a near-miss,
  // it is the wrong year: a level's winter opens hours before the night's
  // generator run, so the file on disk is last season's until it does. Same
  // check, and the same silence, as the promotions list beneath.
  if (!picked || data?.season !== season) return null

  const { game, started } = picked
  const label = SPORT_LABEL[sportId] ?? ''
  const reason = reasonLine(game.why)

  return (
    <section className="pgame" aria-label={`A ${label} game from the ${season} season`}>
      <div className="pgame__card">
        <div className="pgame__clubs">
          <Club club={game.away} />
          <span className="pgame__at">
            <span aria-hidden="true">@</span>
            <span className="sr-only">at</span>
          </span>
          <Club club={game.home} />
        </div>

        {/* What the reader is being promised, in the words the app uses for it
            everywhere else. A game carrying this device's own progress cannot
            promise it, and says the true thing instead. */}
        <p className="pgame__seal">{started ? 'Your progress applies' : 'Score sealed'}</p>

        {reason && <p className="pgame__why">{reason}</p>}

        <p className="pgame__meta">
          <span>{humanDateWithYear(game.date)}</span>
          <span className="pgame__dot" aria-hidden="true">
            ·
          </span>
          {game.venue && (
            <>
              <span>{game.venue}</span>
              <span className="pgame__dot" aria-hidden="true">
                ·
              </span>
            </>
          )}
          <span>Lineups posted</span>
        </p>

        <div className="pgame__actions">
          <a className="btn btn--ink pgame__go" {...linkProps(poolGamePath(game))}>
            Score this game
          </a>
          <button type="button" className="btn pgame__another" onClick={() => setStep((n) => n + 1)}>
            Another game
          </button>
        </div>
      </div>
    </section>
  )
}

// One club: its mark, its own name, and the organisation it belongs to. The
// parent org is there because at this level it is half of who a club is — a
// reader knows the Brewers long before they know the Timber Rattlers — and
// because it is the only thing on the card a reader can use to recognise a
// league they have never followed.
function Club({ club }) {
  return (
    <span className="pgame__club">
      <TeamLogo teamId={club.id} name={club.name} size={56} />
      <span className="pgame__lines">
        <span className="pgame__name">{club.name}</span>
        {club.orgName && <span className="pgame__org">{club.orgName}</span>}
      </span>
    </span>
  )
}
