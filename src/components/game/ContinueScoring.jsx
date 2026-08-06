import { useState } from 'react'
import { SignInButton, useAuth } from '@clerk/clerk-react'
import { useAsync } from '../../hooks/useAsync.js'
import { usePromptDismiss } from '../../hooks/preferences/usePromptDismiss.js'
import { useNav } from '../../lib/nav.js'
import { gamePath } from '../../lib/route.js'
import { humanDate } from '../../lib/dates.js'
import { countGamesInProgress } from '../../lib/account/localData.js'
import { browserStorage } from '../../lib/account/preferencesStorage.js'

// How many games in progress on THIS device earns the signed-out pitch below
// (PRD §6.2 row 3, `third-game`).
const THIRD_GAME_THRESHOLD = 3

// "Pick up your pencil" — the signed-in slate strip listing the user's own
// recently-scored games from the cloud scorebook index (api/reveal.js
// ?recent=1; written by RevealCloudSync alongside every reveal ratchet).
// Spoiler-free by construction: each entry is only the game's identity plus
// the user's OWN revealedThrough mark — how far they know they've gotten,
// never a score — so a card can say "through top 7" and deep-link straight
// to the next half without fetching a feed. Same lazy-import gate as
// AccountButton (this module touches Clerk hooks at its top level).
//
// A card leaves this strip two ways. Automatically, once a game is over and
// fully revealed — the server itself stops handing that entry back (see
// api/reveal.js's isFullyWrappedUp), so there is nothing to filter here.
// Manually, via the ✕ on each card (removeGame below) — DELETE only clears
// the scorebook-index entry, never the underlying reveal mark, so returning
// to the game directly still resumes exactly where the user left off.
//
// Signed OUT, the same slot instead pitches an account once this device
// holds three or more games in progress — "what the strip WOULD be" if the
// visitor signed in (PRD §6.2 row 3). One-shot via usePromptDismiss;
// `countGamesInProgress` counts reveal KEY NAMES only, never a half-index or
// a score (see localData.js's header) — the same posture as My Tally's own
// ledger. Only ever mounted at all when isClerkEnabled (GameSelect.jsx's lazy
// import), so there is no unconfigured-deploy branch to gate here.
export function ContinueScoring() {
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const recent = useAsync(
    () => (isSignedIn ? fetchRecent(getToken) : Promise.resolve([])),
    [isSignedIn, getToken],
  )
  const [pitchDismissed, dismissPitch] = usePromptDismiss('third-game')
  // Read once, at mount — matches ProfilePage's own "games in your pencil"
  // count; a live re-scan on every render would cost more than the number is
  // worth for a strip that already re-mounts on navigation.
  const [gameCount] = useState(() => countGamesInProgress(browserStorage()))

  // Optimistic local removal for the manual ✕: a gamePk lands here the moment
  // it's tapped, so the card is gone immediately rather than waiting on the
  // round trip — and stays gone even if a background reload() races back in
  // before the DELETE resolves.
  const [removedIds, setRemovedIds] = useState(() => new Set())
  const removeGame = (gamePk) => {
    setRemovedIds((prev) => new Set(prev).add(gamePk))
    deleteGame(getToken, gamePk).then((ok) => {
      if (!ok) {
        // The server never dropped it — put the card back rather than leave
        // the user believing a removal that didn't happen.
        setRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(gamePk)
          return next
        })
      }
    })
  }

  if (isSignedIn) {
    const games = (recent.data ?? []).filter((g) => !removedIds.has(g.gamePk))
    if (games.length === 0) return null
    return (
      <section className="continuebar" aria-label="Pick up your pencil">
        <h2 className="continuebar__label">Pick up your pencil</h2>
        <ul className="continuebar__list">
          {games.slice(0, 3).map((g) => (
            <li key={g.gamePk} className="continuebar__row">
              <ContinueCard game={g} />
              <button
                type="button"
                className="continuebar__delete"
                onClick={() => removeGame(g.gamePk)}
                aria-label={`Remove ${g.away} at ${g.home}, ${humanDate(g.date)}, from your pencil`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (!isLoaded || pitchDismissed || gameCount < THIRD_GAME_THRESHOLD) return null
  return (
    <section className="continuebar continuebar--pitch" aria-label="Sign in to carry your games">
      <p className="continuebar__pitchline caps-exempt">
        Three games in your pencil. Sign in and they&rsquo;ll be waiting on
        your other devices too.
      </p>
      <div className="continuebar__pitchactions">
        <SignInButton mode="modal">
          <button type="button" className="btn btn--account continuebar__pitchcta">
            Create account or sign in
          </button>
        </SignInButton>
        <button
          type="button"
          className="continuebar__dismiss"
          onClick={dismissPitch}
          aria-label="Dismiss this suggestion"
        >
          ✕
        </button>
      </div>
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

// The manual half of "delete games from my pencil" — removes just this game's
// scorebook-index entry (see api/reveal.js's DELETE handler). Resolves false
// on any failure so the caller can restore the optimistically-removed card.
async function deleteGame(getToken, gamePk) {
  try {
    const token = await getToken()
    const res = await fetch(`/api/reveal?gamePk=${gamePk}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
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
