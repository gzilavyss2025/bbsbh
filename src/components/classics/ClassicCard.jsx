import { useState } from 'react'
import { rollClassic } from '../../api/classics/deck.js'
import { fetchClassicFacts } from '../../api/classics/reason.js'
import { poolGamePath } from '../../api/milbPool.js'
import { useAsync } from '../../hooks/useAsync.js'
import { readRevealMarkFor } from '../../hooks/useRevealProgress.js'
import { useRouteLink } from '../../lib/nav.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'

// A CLASSIC TO SCORE — one old MLB game, dealt face up (issue #1525, slice 2).
//
// The deck (api/classics/deck.js) deals on who played, never on what happened
// (ADR-0080), and neither it nor the facts call below can carry a score: both
// requests name a `fields=` list with no score key in it. This card therefore
// shows two clubs, a date and a park, and a seal strip that is true because
// nothing here knows the result.
//
// THE SEAL IS THE ORDINARY ONE. The button opens the game's first lineup page
// at the address the slate's own cards build, so the game is sealed under the
// same `revealedThrough` mark as any other. The BOX tab of a classic opens by
// its date (ADR-0117) and this card does not change that. Nothing here reveals
// or persists; the card's only state is which game of the deck is face up.
//
// It wears PickedGame's `.pgame*` sheet (styles/78-offseason.css) on purpose: a
// dealt game is one card in two places, and one sheet keeps it so.
export function ClassicCard({ seed = 0, era = null, teamId = null, kicker = 'A classic to score' }) {
  const [step, setStep] = useState(0)
  const linkProps = useRouteLink()
  // The deal and its facts are one load, so the card never paints clubs with no
  // park or a park with the wrong clubs. A new filter or step is a new deal.
  const { data, loading } = useAsync(async () => {
    const dealt = await rollClassic({ seed, step, era, teamId, isStarted: (pk) => readRevealMarkFor(pk) >= 0 })
    if (!dealt) return null
    // No facts is a card with abbreviations and no park or reason line, not no card.
    const bare = { away: { id: null, name: dealt.game.away.abbr }, home: { id: null, name: dealt.game.home.abbr }, venue: '', reason: null }
    return { ...dealt, facts: (await fetchClassicFacts(dealt.game.pk).catch(() => null)) ?? bare }
  }, [seed, step, era, teamId])

  if (!data?.facts) {
    return loading ? <section className="pgame" aria-busy="true" aria-label={kicker} /> : null
  }

  const { game, started, facts } = data
  return (
    <section className="pgame" aria-label={kicker}>
      <Card as="div" body="flush" className="pgame__card">
        <p className="pgame__org">{kicker}</p>
        <div className="pgame__clubs">
          <Club club={facts.away} />
          <span className="pgame__at">
            <span aria-hidden="true">@</span>
            <span className="sr-only">at</span>
          </span>
          <Club club={facts.home} />
        </div>

        <p className="pgame__seal">{started ? 'Your progress applies' : 'Score sealed'}</p>
        {facts.reason && <p className="pgame__why">{facts.reason}</p>}

        <p className="pgame__meta">
          <span>{humanDateWithYear(game.date)}</span>
          {facts.venue && (
            <>
              <span className="pgame__dot" aria-hidden="true">
                ·
              </span>
              <span>{facts.venue}</span>
            </>
          )}
        </p>

        {/* No .pgame__actions: test/cluster-migration pins that class to one site, so the card keeps its margin here. */}
        <Cluster gap="base" style={{ marginTop: 'var(--space-4)' }}>
          <a className="btn btn--ink pgame__go" {...linkProps(poolGamePath(game))}>
            {started ? 'Pick up where you left off' : 'Score a classic'}
          </a>
          <button type="button" className="btn pgame__another" onClick={() => setStep((n) => n + 1)}>
            Deal another
          </button>
        </Cluster>
      </Card>
    </section>
  )
}

function Club({ club }) {
  return (
    <span className="pgame__club">
      <TeamLogo teamId={club.id} name={club.name} size={56} />
      <span className="pgame__lines">
        <span className="pgame__name">{club.name}</span>
      </span>
    </span>
  )
}
