import { useRef, useState } from 'react'
import { loadPlayerCore } from '../../api/player/core.js'
import { loadPlayerHistory, loadPositionScope } from '../../api/player/history.js'
import { useAsync } from '../../hooks/useAsync.js'
import { AwardsLedger } from '../../components/player/AwardsLedger.jsx'
import { CareerTimeline } from '../../components/player/CareerTimeline.jsx'
import { GameLink } from '../../components/player/GameLink.jsx'
import { LevelProgressionCard } from '../../components/player/LevelProgressionCard.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { PositionInnings } from '../../components/player/PositionInnings.jsx'
import { TransactionTimeline } from '../../components/transactions/TransactionTimeline.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { PlayerHubShell } from './PlayerHubShell.jsx'
import { SectionTitle, debutLabel } from './parts.jsx'

// Reads as the story of a rookie season: the MLB debut, first taking the field,
// then each milestone at the plate in the order it's likeliest to arrive. The
// debut row folds in "First Start" when the debut game was also his first start
// (see api/player/history.js), so the separate 'start' entry drops out then.
const FIRSTS_ORDER = ['debut', 'start', 'hit', 'xbh', 'hr', 'run', 'so']
// Pitching counterpart: the debut (a pitcher's first appearance), then each way
// an outing can go, ending with the first punch-out.
const PITCHER_FIRSTS_ORDER = ['debut', 'start', 'win', 'loss', 'save', 'so']

// The player hub's HISTORY tab — `/player/{id}/history`. The biographical
// archive: what he has won, then innings by position, then dated origin-story
// events (Firsts), then Path to the Majors' compact summary before Team
// History's expanded logo detail — summary before detail — then Transactions,
// the longest and most archival section, last.
//
// Awards leads because it is identity — "who is this guy" — the place it held on
// the single page, ahead of everything dated.
export function PlayerHistoryTab({ id, asOf, sportId }) {
  const core = useAsync(() => loadPlayerCore(id, asOf), [id, asOf])
  const history = useAsync(() => loadPlayerHistory(id, asOf), [id, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: core.loading || history.loading,
    error: core.error || history.error,
    data: core.data && history.data ? true : null,
    screenClass: 'player',
    noun: 'player',
    onBack: back,
  })
  if (gate) return gate

  const data = history.data
  const { bio } = data
  const firstsOrder = bio.isPitcher ? PITCHER_FIRSTS_ORDER : FIRSTS_ORDER
  const hasFirsts = data.firsts && firstsOrder.some((key) => data.firsts[key])

  return (
    <PlayerHubShell core={core.data} asOf={asOf} sportId={sportId} active="history">
      {/* No umbrella "Player history" heading over the five cards below: the tab
          bar names this section, and the heading printed its own tab's name back
          at the reader. Each card keeps its own title. */}
      <AwardsLedger ledger={data.awardLedger} />

      {data.positionInnings && (
        <PositionInningsCard pi={data.positionInnings} playerId={bio.id} />
      )}

      {hasFirsts && (
        <section>
          <SectionTitle title="Firsts" />
          <div className="player__splits">
            {firstsOrder.map((key) => {
              const f = data.firsts[key]
              if (!f) return null
              return (
                <div className="split" key={key}>
                  <div className="split__k">{f.label}</div>
                  <div className="split__row">
                    <GameLink path={f.path} className="split__v">
                      {debutLabel(f.date)}
                    </GameLink>
                    <span className="split__sub">
                      {f.batter ? (
                        <PlayerLink id={f.batter.id}>{f.batter.fullName}</PlayerLink>
                      ) : f.pitcher ? (
                        <PlayerLink id={f.pitcher.id}>{f.pitcher.fullName}</PlayerLink>
                      ) : (
                        f.oppName || f.oppAbbr
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Both cards belong to a player who HAS debuted. A pre-debut player's
          pair leads his Overview instead, where his path IS his page — see
          api/player/overview.js. */}
      {data.progression && (
        <LevelProgressionCard
          levels={data.progression.levels}
          debutYear={bio.debut ? Number(bio.debut.slice(0, 4)) : undefined}
        />
      )}

      {data.timeline && <CareerTimeline entries={data.timeline.entries} />}

      {data.transactions && <TransactionTimeline rows={data.transactions.rows} />}
    </PlayerHubShell>
  )
}

// Owns the position-innings scope toggle: the season scope arrives eager in
// `pi.initial`; the MLB/MiLB career scopes lazy-load once (then cache) on first
// toggle. The presentational diamond/boxes live in PositionInnings.
function PositionInningsCard({ pi, playerId }) {
  const [scope, setScope] = useState(pi.defaultScope)
  const [cache, setCache] = useState({ [pi.defaultScope]: pi.initial })
  const inFlight = useRef(new Set())

  const onScope = (next) => {
    setScope(next)
    if (cache[next] || inFlight.current.has(next)) return
    inFlight.current.add(next)
    loadPositionScope(playerId, next, pi).then((res) => {
      inFlight.current.delete(next)
      setCache((c) => ({ ...c, [next]: res }))
    })
  }

  // A scope with no cached data yet is mid-fetch — derive loading from that
  // (rather than a flag) so switching between two uncached scopes never flashes
  // an empty body for whichever one is showing.
  const active = cache[scope]
  return (
    <PositionInnings
      options={pi.options}
      scope={scope}
      onScope={onScope}
      loading={!active}
      fielding={active?.fielding ?? null}
      pitching={active?.pitching ?? null}
    />
  )
}
