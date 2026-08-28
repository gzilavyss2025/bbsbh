import { loadPlayerCore } from '../api/player/core.js'
import { loadPlayerOverview } from '../api/player/overview.js'
import { fetchPersonStats } from '../api/person-fetch.js'
import { SPORT_LABEL, isMlbTeamId } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { playerTabPath } from '../lib/route.js'
import { GameLink } from '../components/player/GameLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { CareerTimeline } from '../components/player/CareerTimeline.jsx'
import { LevelProgressionCard } from '../components/player/LevelProgressionCard.jsx'
import { GameLog } from '../components/player/GameLog.jsx'
import { StatcastPercentiles } from '../components/charts/StatcastPercentiles.jsx'
import { ProspectCard } from '../components/playerstats/ProspectCard.jsx'
import { AwardsLedger } from '../components/player/AwardsLedger.jsx'
import { MilestoneWatchCard } from '../components/playerstats/MilestoneWatchCard.jsx'
import { PlayerContractCard } from '../components/playerstats/PlayerContractCard.jsx'
import { PlayerPhotosRail } from '../components/player/PlayerPhotosRail.jsx'
import { PlayerHighlightsRail } from '../components/player/PlayerHighlightsRail.jsx'
import { ChevronLink } from '../components/ui/ChevronLink.jsx'
import { AsyncGate } from '../components/ui/AsyncGate.jsx'
import { PlayerHubShell } from './player/PlayerHubShell.jsx'
import { PitcherWorkloadCard } from '../components/playerstats/PitcherWorkloadCard.jsx'
import { gameLogDoorLabel } from './player/overviewPreview.js'
import { DASH, Fact, SectionTitle, StatGrid, debutLabel, isoToday, monthDay, roleWord } from './player/parts.jsx'

// The player hub's OVERVIEW tab — the bare `/player/{id}`, and the tab the
// other three hang off (screens/player/PlayerHubShell.jsx). Who he is now: the
// fact grid, this season's tiles with their league-rank chips and any other
// level he has played at this year, a taste of the game log, his contract,
// a taste of the analytics shelf, what he is closing in on, his award count,
// and the season's pictures — each preview ending in a door into the tab
// that holds the whole thing (the same "preview + door, never a smaller
// duplicate" convention the team hub's Overview uses, TeamPage.jsx).
//
// Everything a preview points at moved to a tab of its own, each with its own
// loader and its own route: the game log / splits / career register to
// `/stats`, the Statcast/prospect card and arsenal shelf to `/analytics`, the
// full awards ledger, firsts, path and transactions to `/history`. See
// src/api/player/context.js for the data rules and docs/player-hub.md for the
// tab map.
const PREVIEW_STATCAST_ROWS = 3
const PREVIEW_AWARD_CHIPS = 4
const PREVIEW_PHOTOS = 6
const PREVIEW_HIGHLIGHTS = 6

// The door itself — same shared ChevronLink the team hub's PreviewDoor
// builds on, so the two hubs' doors can't drift into two different-looking
// controls.
function PreviewDoor({ label, onClick }) {
  return (
    <div className="thub-door">
      <ChevronLink onClick={onClick}>{label}</ChevronLink>
    </div>
  )
}

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
  const navigate = useNav()
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
  const retired = status?.state === 'retired'
  const club = status ? null : bio.team
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'
  // The game-log preview's own note — the Stats tab's own wording
  // ("entering today"/"entering Jul 5"), not the tiles' "season to date".
  const gameLogNote = asOf ? `entering ${monthDay(asOf)}` : 'entering today'
  // Every door goes through playerTabPath -> linkQuery, so a dated link's
  // `?d=` (the spoiler cutoff) and `?s=` survive the jump — the same rule
  // the team hub's own doors follow (TeamPage.jsx).
  const go = (tab) => navigate(playerTabPath(id, tab, { d: asOf, s: sportId }))

  // The Analytics preview's Prospect Card teaser only earns a spot when it has
  // something to say — same gate PlayerAnalyticsTab's full card uses.
  const showProspectCard = Boolean(
    data.sportId !== 1 &&
      data.prospectCard &&
      (core.data.prospectRank ||
        core.data.orgProspectRank ||
        data.prospectCard.state !== 'none' ||
        data.prospectCard.ageEdge),
  )

  return (
    <PlayerHubShell core={core.data} asOf={asOf} sportId={sportId} active="overview">
      {/* A player who has not debuted leads with his path rather than with a
          major-league fact grid. Both cards move to the History tab the day he
          does debut — see api/player/overview.js. */}
      {data.timeline && <CareerTimeline entries={data.timeline.entries} />}
      {data.progression && <LevelProgressionCard levels={data.progression.levels} />}

      <div className="factgrid">
        <Fact label="Ht / Wt" value={bio.heightWeight} />
        <Fact
          label={retired ? 'Age at retirement' : 'Age'}
          value={retired ? status.retiredAge ?? DASH : bio.age}
          mono
        />
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

      {data.conversionNote && <p className="hint reg-convert">{data.conversionNote}</p>}

      {/* Season tiles + rank chips + other-level rows + a game-log taste,
          one section per stat block (batting, then pitching for a two-way
          player). The Contract card and the Analytics/Milestone pair sit
          OUTSIDE this loop (below), per the approved page order — a two-way
          player still gets two of each, just not interleaved with each
          other's tiles. */}
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

            {/* Game log preview — the last 3 rows, the exact row rendering
                the Stats tab's GameLog draws in full, at a `limit` this
                Overview asks for. The door counts the SEASON, not the 3 rows
                shown (gameLogDoorLabel, overviewPreview.js).

                A PITCHER TAKES THE MOUND CARD IN THIS SLOT INSTEAD, and it is
                a replacement rather than an addition. A hitter plays every day,
                so his last three lines answer "how is he going" and the preview
                above is the whole read. A pitcher works every fifth or sixth
                day, so his last three lines never say the thing a scorer wants
                the moment a reliever starts throwing: did he pitch yesterday.
                The mound card carries those same three outings AND that read,
                so rendering both would print the same three games twice. Same
                slot, same door, same count of sections as a hitter's — the
                pitcher's half just answers the question his position asks.

                The card self-fetches its own static file, so this costs the
                Overview no request; it takes the preview rows it would have
                drawn anyway.

                TWO DEGRADES, and they are different. workload.json is built
                from the thirty active MLB rosters, so a pitcher can have a game
                log and NO workload record — one optioned down mid-season is
                exactly that — and then the card renders nothing while the
                counted door still stands, which is the right outcome: the Stats
                tab still has his log to show. A pitcher with no game log either
                (a Triple-A arm) never enters this branch at all, and the whole
                slot including its door is absent, as it already was. Verified
                against both. */}
            {block.gameLogPreview && (
              <>
                {block.group === 'pitching' ? (
                  <PitcherWorkloadCard
                    playerId={bio.id}
                    asOf={asOf}
                    role={core.data.heroRole}
                    gameLog={block.gameLogPreview}
                  />
                ) : (
                  <GameLog gameLog={block.gameLogPreview} note={gameLogNote} limit={3} />
                )}
                <PreviewDoor
                  label={gameLogDoorLabel(block.seasonGames)}
                  onClick={() => go('stats')}
                />
              </>
            )}
          </section>
        )
      })}

      {/* A player with a major-league contract whose club is an affiliate is
          optioned down, not a minor leaguer — the card labels its figures so
          the deal is not read as what he draws at that level. */}
      <PlayerContractCard
        contract={data.contract}
        optioned={Boolean(data.contract && bio.debut && club && !isMlbTeamId(club.id))}
      />

      {/* Analytics preview — Statcast's top 3 percentile bars for an MLB
          batter/pitcher, or the Prospect Card's one-line teaser below the
          majors. The two are mutually exclusive per block (Savant carries no
          MiLB rows, and the Prospect Card only renders below the majors), so
          nothing here decides which one a block gets — the data already
          says so. */}
      {blocks.map((block) => (
        <section key={`analytics-${block.group}`}>
          {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

          {!retired && block.savant && (
            <StatcastPercentiles
              savant={block.savant}
              raw={block.savantRaw}
              median={block.savantMedian}
              group={block.group}
              limit={PREVIEW_STATCAST_ROWS}
            />
          )}

          {!retired && showProspectCard && block.group === data.prospectCardGroup && (
            <ProspectCard
              view={data.prospectCard}
              level={SPORT_LABEL[data.sportId] ?? ''}
              group={block.group}
              badge={{
                rank: core.data.prospectRank,
                orgRank: core.data.orgProspectRank,
                orgTeamId: club?.parentOrgId ?? club?.id,
                orgTeamName: club?.parentOrgName ?? club?.name,
              }}
              preview
            />
          )}

          {!retired && (block.savant || (showProspectCard && block.group === data.prospectCardGroup)) && (
            <PreviewDoor label="Full analytics" onClick={() => go('analytics')} />
          )}

          {/* What this season is heading toward — "X shy of Y", the forward-
              looking caption for the tiles above it. */}
          <MilestoneWatchCard
            playerId={bio.id}
            asOf={asOf}
            milestones={block.milestones}
            groupLabel={blocks.length > 1 ? block.title : null}
          />
        </section>
      ))}

      {/* Awards — compact count chips ("All-Star ×3"), never the full ledger
          (that stays History's alone). Renders nothing for a player with no
          awards. */}
      <AwardsLedger ledger={data.awardLedger} preview limit={PREVIEW_AWARD_CHIPS} />
      {data.awardLedger?.categories?.length > 0 && (
        <PreviewDoor label="History" onClick={() => go('history')} />
      )}

      {/* Photos + Highlights — both only for a player who has appeared in
          an MLB game this season (the primary block's tiles resolving to MLB
          is the loader's own signal for that, see the liveLevel derivation
          above) and only on the bare current-day view. Photos has no
          precompute to cut to a spoiler asOf; Highlights COULD technically
          filter its static file to `clip.date <= asOf` but deliberately
          doesn't (see PlayerHighlightsRail's issue) — same `!asOf` gate, for
          v1 simplicity and consistency with the box score/team rail's
          "decided games only" footing rather than a dated cutoff. Each
          renders nothing itself if it turns up empty. Both are capped to one
          row here (`limit`), each with its own in-place "See all" — there is
          no separate media tab to link out to, so it expands rather than
          navigating (unlike every other door above). */}
      {!asOf && bio.debut && (() => {
        const primaryGroup = bio.isPitcher ? 'pitching' : 'hitting'
        const primaryBlock = blocks.find((b) => b.group === primaryGroup) ?? blocks[0]
        if (primaryBlock?.tileSportId !== 1) return null
        return (
          <>
            <PlayerPhotosSection playerId={bio.id} group={primaryGroup} season={data.season} />
            <PlayerHighlightsRail playerId={bio.id} teamId={club?.id} limit={PREVIEW_HIGHLIGHTS} />
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
  return <PlayerPhotosRail personId={playerId} games={rows} limit={PREVIEW_PHOTOS} />
}
