import { useAuth } from '@clerk/clerk-react'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { humanDate } from '../lib/dates.js'

// "Pick up your pencil" — the signed-in slate strip listing the user's own
// recently-scored games from the cloud scorebook index (api/reveal.js
// ?recent=1; written by RevealCloudSync alongside every reveal ratchet).
// Spoiler-free by construction: each entry is only the game's identity plus
// the user's OWN revealedThrough mark — how far they know they've gotten,
// never a score — so a card can say "through top 7" and deep-link straight
// to the next half without fetching a feed. Same lazy-import gate as
// AccountButton (this module touches Clerk hooks at its top level).
export function ContinueScoring() {
  const { isSignedIn, getToken } = useAuth()
  const recent = useAsync(
    () => (isSignedIn ? fetchRecent(getToken) : Promise.resolve([])),
    [isSignedIn, getToken],
  )
  const games = recent.data ?? []
  if (!isSignedIn || games.length === 0) return null
  return (
    <section className="continuebar" aria-label="Pick up your pencil">
      <h2 className="continuebar__label">Pick up your pencil</h2>
      <ul className="continuebar__list">
        {games.slice(0, 3).map((g) => (
          <li key={g.gamePk}>
            <ContinueCard game={g} />
          </li>
        ))}
      </ul>
    </section>
  )
}

async function fetchRecent(getToken) {
  const token = await getToken()
  const res = await fetch('/api/reveal?recent=1', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.games) ? data.games : []
}

// halfIndex -> "top 7" / "bottom 3", the same 0-based tops-even/bottoms-odd
// convention as revealedThrough itself (see CONTEXT.md).
function halfPhrase(halfIndex) {
  const inning = Math.floor(halfIndex / 2) + 1
  return `${halfIndex % 2 === 0 ? 'top' : 'bottom'} ${inning}`
}

// Where the card lands: the next half to reveal, or the sealed box score
// once the whole regulation game is revealed (extras stay behind their own
// one-at-a-time gate either way — ADR-0008), or the away lineup when the
// game was opened but nothing revealed yet.
function resumeSection(revealedThrough, regulation) {
  if (!Number.isInteger(revealedThrough) || revealedThrough < 0) return 'lineup1'
  const next = revealedThrough + 1
  if (next >= (regulation || 9) * 2) return 'boxscore'
  return `${next % 2 === 0 ? 'top' : 'bottom'}${Math.floor(next / 2) + 1}`
}

function ContinueCard({ game }) {
  const navigate = useNav()
  const done = Number.isInteger(game.revealedThrough) && game.revealedThrough >= 0
  const progress = done
    ? `through ${halfPhrase(game.revealedThrough)}`
    : 'not started'
  return (
    <button
      type="button"
      className="continuebar__item"
      onClick={() =>
        navigate(
          gamePath(
            game.date,
            game.away,
            game.home,
            resumeSection(game.revealedThrough, game.regulation),
            game.gameNumber,
          ),
        )
      }
    >
      <span className="continuebar__matchup t-num">
        {game.away} @ {game.home}
        {game.gameNumber > 1 ? ` · G${game.gameNumber}` : ''}
      </span>
      <span className="continuebar__meta">
        {humanDate(game.date)} · {progress}
      </span>
      <span className="continuebar__chevron" aria-hidden="true">
        ›
      </span>
    </button>
  )
}
