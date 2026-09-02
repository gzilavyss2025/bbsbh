import { loadPlayerCore } from '../../api/player/core.js'
import { splitDisplayName } from '../../api/person.js'
import { loadPlayerStats } from '../../api/player/stats.js'
import { useAsync } from '../../hooks/useAsync.js'
import { CareerRegister } from '../../components/player/CareerRegister.jsx'
import { GameLog } from '../../components/player/GameLog.jsx'
import { SplitsSection, hasSplits } from '../../components/playerstats/SplitsSection.jsx'
import { PitcherWorkloadCard } from '../../components/playerstats/PitcherWorkloadCard.jsx'
import { RecentFormCard } from '../../components/playerstats/RecentFormCard.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { PlayerHubShell } from './PlayerHubShell.jsx'
import { monthDay } from './parts.jsx'

// The player hub's STATS tab — `/player/{id}/stats`. What he has actually done:
// the game log, the recent-form or workload card that summarizes it, the splits
// he has done it against, and the career register underneath.
//
// The `blocks.map` shape is load-bearing and unchanged from the single page: a
// two-way player has TWO stat blocks (batting, then pitching) and every section
// here belongs to one of them, so a section is drawn once per block rather than
// once per page.
export function PlayerStatsTab({ id, asOf, sportId }) {
  const core = useAsync(() => loadPlayerCore(id, asOf), [id, asOf])
  const stats = useAsync(() => loadPlayerStats(id, asOf), [id, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: core.loading || stats.loading,
    error: core.error || stats.error,
    data: core.data && stats.data ? true : null,
    screenClass: 'player',
    noun: 'player',
    onBack: back,
  })
  if (gate) return gate

  const data = stats.data
  const { bio, blocks } = data

  return (
    <PlayerHubShell core={core.data} asOf={asOf} sportId={sportId} active="stats">
      {blocks.map((block) => (
        <section key={block.group}>
          {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

          {block.gameLog && (
            <GameLog
              gameLog={block.gameLog}
              gameLogAlt={block.gameLogAlt}
              altLevel={block.gameLogAltLevel}
              note={data.onRehab ? 'MLB + rehab' : asOf ? `entering ${monthDay(asOf)}` : 'entering today'}
            />
          )}

          {/* Recent pitcher workload (gen-workload.mjs) — right after the
              Game log it summarizes; same current-day-only rule as
              FoulCard/Milestone Watch. It is handed the role the HERO prints
              (core.js's `heroRole`) rather than deriving its own, so the pinned
              header and this card cannot call the same man two different
              things — a closer's hero read CL while his card read reliever. */}
          {block.group === 'pitching' && (
            <PitcherWorkloadCard playerId={bio.id} asOf={asOf} role={core.data.heroRole} gameLog={block.gameLog} />
          )}

          {/* The hitter's occupant of the same slot — Recent form, his
              last-7/15/30 lines instead of a pitch-count ledger. Same
              current-day-only rule; MLB tiles only (a MiLB bat's lastXGames
              pull would answer with stale major-league rows or nothing). */}
          {block.group === 'hitting' && block.tileSportId === 1 && (
            <RecentFormCard playerId={bio.id} asOf={asOf} season={data.season} />
          )}

          {/* Splits — the handedness, situational and career-vs-opponent
              cards. The section's own component owns the three rules that
              keep them legible together (scope labels, an overall row under
              every table, a titled first card), and each card carries its own
              title, so the umbrella "Splits" heading that used to stand above
              them is gone: it named a group the three titles under it already
              named, once per block. */}
          {hasSplits(block, data.vsTeam) && (
            <SplitsSection
              block={block}
              vsTeam={data.vsTeam}
              season={data.season}
              asOf={asOf}
              personId={bio.id}
              playerSurname={splitDisplayName(bio.fullName).last}
            />
          )}

          {block.register && <CareerRegister register={block.register} />}
        </section>
      ))}
    </PlayerHubShell>
  )
}
