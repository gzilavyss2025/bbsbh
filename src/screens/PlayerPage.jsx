import { loadPlayerCore } from '../api/player/core.js'
import { loadPlayerOverview } from '../api/player/overview.js'
import { fetchPersonStats } from '../api/person-fetch.js'
import { SPORT_LABEL } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { GameLink } from '../components/player/GameLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { CareerTimeline } from '../components/player/CareerTimeline.jsx'
import { LevelProgressionCard } from '../components/player/LevelProgressionCard.jsx'
import { MilestoneWatchCard } from '../components/playerstats/MilestoneWatchCard.jsx'
import { PlayerContractCard } from '../components/playerstats/PlayerContractCard.jsx'
import { PlayerPhotosRail } from '../components/player/PlayerPhotosRail.jsx'
import { PlayerHighlightsRail } from '../components/player/PlayerHighlightsRail.jsx'
import { AsyncGate } from '../components/ui/AsyncGate.jsx'
import { PlayerHubShell } from './player/PlayerHubShell.jsx'
import { DASH, Fact, SectionTitle, StatGrid, debutLabel, isoToday, monthDay, roleWord } from './player/parts.jsx'

// The player hub's OVERVIEW tab — the bare `/player/{id}`, and the tab the
// other three hang off (screens/player/PlayerHubShell.jsx). Who he is now: the
// fact grid, his contract, this season's tiles with their league-rank chips and
// any other level he has played at this year, what he is closing in on, and the
// season's pictures.
//
// Everything else moved to a tab of its own, each with its own loader and its
// own route: the game log / splits / career register to `/stats`, the Statcast
// and arsenal shelf to `/analytics`, the awards, firsts, path and transactions
// to `/history`. See src/api/player/context.js for the data rules.

function draftLabel(draft, signedYear) {
  if (draft && draft.year) {
    if (!draft.round) return String(draft.year)
    return `${draft.year} · Rd ${draft.round}${draft.overall ? ` #${draft.overall}` : ''}`
  }
  if (signedYear) return `Signed ${signedYear}`
  return DASH
}

export function PlayerPage({ id, asOf, sportId }) {
  const core = useAsync(() => loadPlayerCore(id, asOf), [id, asOf])
  const overview = useAsync(() => loadPlayerOverview(id, asOf), [id, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: core.loading || overview.loading,
    error: core.error || overview.error,
    data: core.data && overview.data ? true : null,
    screenClass: 'player',
    noun: 'player',
    onBack: back,
  })
  if (gate) return gate

  const data = overview.data
  const { bio, blocks } = data
  const status = core.data.rosterStatus
  const club = status ? null : bio.team
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'

  return (
    <PlayerHubShell core={core.data} asOf={asOf} sportId={sportId} active="overview">
      {/* A player who has not debuted leads with his path rather than with a
          major-league fact grid. Both cards move to the History tab the day he
          does debut — see api/player/overview.js. */}
      {data.timeline && <CareerTimeline entries={data.timeline.entries} />}
      {data.progression && <LevelProgressionCard levels={data.progression.levels} />}

      <div className="factgrid">
        <Fact label="Ht / Wt" value={bio.heightWeight} />
        <Fact label="Age" value={bio.age} mono />
        <Fact label="Born" value={bio.born} />
        <Fact
          label="MLB Debut"
          value={
            bio.debut
              ? data.debutBoxscorePath
                ? <GameLink path={data.debutBoxscorePath}>{debutLabel(bio.debut)}</GameLink>
                : debutLabel(bio.debut)
              : DASH
          }
        />
        <Fact label="Bats / Throws" value={`${bio.bats || DASH} / ${bio.throws || DASH}`} />
        <Fact label="Draft" value={draftLabel(bio.draft, bio.signedYear)} />
        {/* Where he last was, for the unrostered only — the fact the hero
            stopped implying, now said outright under a label that can't be
            misread as "his team". Spans the grid because a seventh cell
            would otherwise leave a rule-colored hole beside it. */}
        {status?.lastTeam && (
          <Fact
            label="Last Team"
            wide
            value={
              <TeamLink id={status.lastTeam.id} className="player__team">
                {status.lastTeam.name}
              </TeamLink>
            }
          />
        )}
      </div>

      <PlayerContractCard contract={data.contract} />

      {data.conversionNote && <p className="hint reg-convert">{data.conversionNote}</p>}

      {blocks.map((block) => {
        // A debuted player whose current-season tiles are at a MiLB level (an
        // aging lifer or a full-season option-down with no MLB games this year)
        // gets that level labeled, so a .310 AAA line isn't mistaken for a
        // major-league one. An up-and-down player's tiles resolve to MLB
        // (block.tileSportId === 1), so no label — his MiLB half shows as its
        // own promoted tile row below.
        const liveLevel =
          bio.debut && block.tileSportId && block.tileSportId !== 1
            ? SPORT_LABEL[block.tileSportId] ?? ''
            : ''
        return (
          <section key={block.group}>
            {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

            <SectionTitle
              title={`${data.currentYear} Stats`}
              primary
              bar
              note={
                [
                  liveLevel,
                  block.group === 'pitching' && block.role ? roleWord(block.role) : null,
                  enteringLabel,
                ].filter(Boolean).join(' · ')
              }
            />
            <StatGrid tiles={block.tiles} />

            {/* League-rank chips right under the tiles they contextualize —
                "1st in NL ERA" is the second-screen fact a reader wants next
                to the raw 1.63. Top-10 ranks only (see pitchingRanksView);
                current-day only, so the strip vanishes under a spoiler asOf
                (the loader skips the fetch). */}
            {block.ranks && (
              <p className="leaguerank">
                {block.ranks.items.map((it) => (
                  <span className="leaguerank__chip" key={it.label}>
                    <strong className="leaguerank__ord">{it.text}</strong>
                    {` ${block.ranks.league} · ${it.label}`}
                  </span>
                ))}
              </p>
            )}

            {/* An up-and-down player's OTHER level(s) this season (e.g. a big
                leaguer's AAA line) — promoted beside the main tiles rather than
                read off the career register on the Stats tab. Full-season
                figures, so labeled "this season", not the main tiles' frozen
                "entering today". */}
            {block.otherLevels?.map((lvl) => (
              <div className="player__otherlevel" key={lvl.sportId}>
                <SectionTitle
                  title={lvl.level}
                  note={[
                    block.group === 'pitching' && lvl.role ? roleWord(lvl.role) : null,
                    'this season',
                  ].filter(Boolean).join(' · ')}
                />
                <StatGrid tiles={lvl.tiles} />
              </div>
            ))}

            {/* What this season is heading toward — "X shy of Y", the forward-
                looking caption for the tiles above it. */}
            <MilestoneWatchCard
              playerId={bio.id}
              asOf={asOf}
              milestones={block.milestones}
              groupLabel={blocks.length > 1 ? block.title : null}
            />
          </section>
        )
      })}

      {/* Photos + Highlights — both only for a player who has appeared in
          an MLB game this season (the primary block's tiles resolving to MLB
          is the loader's own signal for that, see the liveLevel derivation
          above) and only on the bare current-day view. Photos has no
          precompute to cut to a spoiler asOf; Highlights COULD technically
          filter its static file to `clip.date <= asOf` but deliberately
          doesn't (see PlayerHighlightsRail's issue) — same `!asOf` gate, for
          v1 simplicity and consistency with the box score/team rail's
          "decided games only" footing rather than a dated cutoff. Each
          renders nothing itself if it turns up empty. */}
      {!asOf && bio.debut && (() => {
        const primaryGroup = bio.isPitcher ? 'pitching' : 'hitting'
        const primaryBlock = blocks.find((b) => b.group === primaryGroup) ?? blocks[0]
        if (primaryBlock?.tileSportId !== 1) return null
        return (
          <>
            <PlayerPhotosSection playerId={bio.id} group={primaryGroup} season={data.season} />
            <PlayerHighlightsRail playerId={bio.id} teamId={club?.id} />
          </>
        )
      })()}
    </PlayerHubShell>
  )
}

// Fetches this player's own this-season MLB game list (gamePk + date) and
// hands it to PlayerPhotosRail for the live walk-back. A dedicated fetch
// rather than reusing the Stats tab's game log: that log is truncated to a
// display-sized "last N" and tracks the player's CURRENT-ACTIVITY level,
// which can be MiLB for an optioned big leaguer even in a season he's
// appeared in the majors — this always wants his full MLB (sportId 1) log.
// Excludes today's game (a mid-game row can appear in the log before the
// game is final) — the same "no still-live game" guarantee TeamPhotosRail
// gets for free from its already-decided-games-only `seasonGames` list.
function PlayerPhotosSection({ playerId, group, season }) {
  const { data: games } = useAsync(
    () => fetchPersonStats(playerId, { type: 'gameLog', group, season, sportId: 1 }),
    [playerId, group, season],
  )
  if (!games) return null
  const today = isoToday()
  const rows = games
    .filter((s) => s.game?.gamePk && s.date && s.date !== today)
    .map((s) => ({ gamePk: s.game.gamePk, apiDate: s.date }))
    .sort((a, b) => (a.apiDate < b.apiDate ? -1 : a.apiDate > b.apiDate ? 1 : 0))
  if (!rows.length) return null
  return <PlayerPhotosRail personId={playerId} games={rows} />
}
