import { loadPlayerCore } from '../../api/player/core.js'
import { loadPlayerAnalytics } from '../../api/player/analytics.js'
import { SPORT_LABEL } from '../../lib/teams.js'
import { useAsync } from '../../hooks/useAsync.js'
import { StatcastPercentiles } from '../../components/charts/StatcastPercentiles.jsx'
import { AdvancedStatsCard } from '../../components/player/AdvancedStatsCard.jsx'
import { ProspectCard } from '../../components/playerstats/ProspectCard.jsx'
import { PitchMix } from '../../components/charts/PitchMix.jsx'
import { CommandMap } from '../../components/charts/CommandMap.jsx'
import { BattedBallMix } from '../../components/charts/BattedBallMix.jsx'
import { SimilarPitchers } from '../../components/playercard/SimilarPitchers.jsx'
import { SimilarHitters } from '../../components/playercard/SimilarHitters.jsx'
import { FoulCard } from '../../components/playerstats/FoulCard.jsx'
import { SprayMapSection } from '../../components/playerstats/SprayMapSection.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { PlayerHubShell } from './PlayerHubShell.jsx'
import { SectionTitle } from './parts.jsx'

// The player hub's ANALYTICS tab — `/player/{id}/analytics`. What is under the
// numbers on the Overview: the Prospect card below the majors, Statcast
// percentiles and the advanced rates above them, the season's fouls, what a
// pitcher throws or a hitter hits, and the three players whose profile looks
// most like his.
//
// Role-agnostic, like every other tab here: a pitcher's page renders this same
// shelf, and the `blocks.map` two-block shape is what lets a two-way player have
// one of each.
export function PlayerAnalyticsTab({ id, asOf, sportId }) {
  const core = useAsync(() => loadPlayerCore(id, asOf), [id, asOf])
  const analytics = useAsync(() => loadPlayerAnalytics(id, asOf), [id, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: core.loading || analytics.loading,
    error: core.error || analytics.error,
    data: core.data && analytics.data ? true : null,
    screenClass: 'player',
    noun: 'player',
    onBack: back,
  })
  if (gate) return gate

  const data = analytics.data
  const { bio, blocks } = data
  const status = core.data.rosterStatus
  const club = status ? null : bio.team
  // The Prospect Card only earns a spot on this shelf when it has something to
  // say — a rank pill, a real standing/unqualified reading, or a real age-edge
  // fact. An untracked, unranked MiLB player with none of those still gets the
  // plain empty shelf, same as before this card existed — bbsbh genuinely has
  // no prospect-relevant data on him to show.
  const showProspectCard = Boolean(
    data.sportId !== 1 &&
      data.prospectCard &&
      (core.data.prospectRank ||
        core.data.orgProspectRank ||
        data.prospectCard.state !== 'none' ||
        data.prospectCard.ageEdge),
  )

  return (
    <PlayerHubShell core={core.data} asOf={asOf} sportId={sportId} active="analytics">
      {blocks.map((block) => (
        <section key={block.group}>
          {/* The tab bar names this section now, so there is no umbrella
              "Analytics" heading here: it would print the tab's own name once
              per block, which reads as ANALYTICS … ANALYTICS on a two-way
              player. What carries the structure is the pair below it — the
              BATTING / PITCHING block title, and each card's own title. */}
          {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

          {/* The one card that fills this shelf below the majors — MLB-only
              Statcast/Advanced/Foul/BattedBall all render nothing for a
              MiLB block, same as before; this is what replaces that gap. */}
          {showProspectCard && block.group === data.prospectCardGroup && (
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
            />
          )}

          <StatcastPercentiles savant={block.savant} raw={block.savantRaw} group={block.group} />

          {/* The rates behind the headline tiles (a pitcher's FIP/ERA−/
              K%/BB%; a hitter's wOBA/wRC+/discipline) — beside Statcast's
              percentiles as its absolute-numbers sibling. */}
          <AdvancedStatsCard adv={block.advanced} />

          {/* Season foul-ball line (gen-fouls.mjs) — a current-day-only
              card that hides under a spoiler asOf cutoff, like the
              Milestone Watch projection. */}
          <FoulCard playerId={bio.id} group={block.group} asOf={asOf} />

          {block.arsenal && (
            <>
              <SectionTitle title="Pitches" note="share of pitches · avg velo" />
              <PitchMix arsenal={block.arsenal} heat={block.heat} tto={block.arsenalTto} />
            </>
          )}

          {/* Directly under the arsenal it completes: that card says WHAT he
              throws and HOW HARD, this says WHERE HE PUTS IT. Below Triple-A
              there is no pitch tracking, so there is no grid and the card
              renders nothing rather than an empty zone. */}
          {block.command && (
            <>
              <SectionTitle title="Command" note="where each pitch goes" />
              <CommandMap
                entry={block.command}
                level={block.tileSportId === 1 ? 'mlb' : 'aaa'}
                throws={block.command.throws}
              />
            </>
          )}

          {/* The hitter's counterpart to the pitch mix — what happens when
              he connects, in the same bar-over-rows dress (BattedBallMix
              reuses the pitchmix classes on purpose). Shares the Advanced
              card's fetch; null below the balls-in-play floor. */}
          {block.battedBall && (
            <>
              <SectionTitle title="Batted balls" note="share of contact · average when hit" />
              <BattedBallMix battedBall={block.battedBall} />
            </>
          )}

          {/* Where that contact GOES — the season spray map, directly under
              the mix that says what kind of contact it was. Self-contained
              (it owns its own section title and its own fetch) and it stands
              itself down for a pitcher, a spoiler `asOf`, or a batter under
              the balls-in-play floor. */}
          <SprayMapSection playerId={bio.id} group={block.group} asOf={asOf} />

          {/* Directly under the mix it's derived from — the three players
              whose own profile looks most like the rows just above, which
              only reads as an answer if the question is still on screen.
              A pitcher's neighbours are arsenal-space (what he throws, see
              lib/pitcherSimilarity.js); a hitter's are Statcast-skill-space
              (how he hits, see lib/hitterSimilarity.js). Renders nothing
              below the sample floors or when nobody clears the match floor.
              NO section note, unlike its neighbours: what "closest" is
              measured on now lives in the card's own legend, which names the
              actual inputs (SimilarPlayerGrid.jsx). */}
          {block.similar?.length > 0 && (
            block.group === 'pitching' ? (
              <>
                <SectionTitle title="Pitches like" />
                <SimilarPitchers similar={block.similar} />
              </>
            ) : (
              <>
                <SectionTitle title="Hits like" />
                <SimilarHitters similar={block.similar} />
              </>
            )
          )}
        </section>
      ))}
    </PlayerHubShell>
  )
}
