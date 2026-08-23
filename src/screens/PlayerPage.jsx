import { useState, useRef } from 'react'
import { loadPlayer, loadPositionScope } from '../api/loadPlayer.js'
import { splitDisplayName } from '../api/person.js'
import { fetchPersonStats } from '../api/person-fetch.js'
import { leagueLogoUrl, SPORT_LABEL, isMlbTeamId } from '../lib/teams.js'
import { headerThemeFor, headerThemeClass, headerThemeStyle, themeKeyFor } from '../lib/headerTheme.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { LinkScope } from '../lib/nav.jsx'
import { Headshot } from '../components/player/Headshot.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { CareerRegister } from '../components/player/CareerRegister.jsx'
import { GameLog } from '../components/player/GameLog.jsx'
import { GameLink } from '../components/player/GameLink.jsx'
import { LevelProgressionCard } from '../components/player/LevelProgressionCard.jsx'
import { MilestoneWatchCard } from '../components/playerstats/MilestoneWatchCard.jsx'
import { AwardsLedger } from '../components/player/AwardsLedger.jsx'
import { CareerTimeline } from '../components/player/CareerTimeline.jsx'
import { TransactionTimeline } from '../components/transactions/TransactionTimeline.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { PositionInnings } from '../components/player/PositionInnings.jsx'
import { SplitsSection, hasSplits } from '../components/playerstats/SplitsSection.jsx'
import { StatcastPercentiles } from '../components/charts/StatcastPercentiles.jsx'
import { AdvancedStatsCard } from '../components/player/AdvancedStatsCard.jsx'
import { ProspectCard } from '../components/playerstats/ProspectCard.jsx'
import { PitchMix } from '../components/charts/PitchMix.jsx'
import { BattedBallMix } from '../components/charts/BattedBallMix.jsx'
import { SimilarPitchers } from '../components/playercard/SimilarPitchers.jsx'
import { SimilarHitters } from '../components/playercard/SimilarHitters.jsx'
import { FoulCard } from '../components/playerstats/FoulCard.jsx'
import { PitcherWorkloadCard } from '../components/playerstats/PitcherWorkloadCard.jsx'
import { PlayerContractCard } from '../components/playerstats/PlayerContractCard.jsx'
import { RecentFormCard } from '../components/playerstats/RecentFormCard.jsx'
import { PlayerPhotosRail } from '../components/player/PlayerPhotosRail.jsx'
import { PlayerHighlightsRail } from '../components/player/PlayerHighlightsRail.jsx'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsOfBanner } from '../components/seal/AsOfBanner.jsx'
import { BackBtn } from '../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../components/ui/AsyncGate.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}
function debutLabel(iso) {
  const [y, m, d] = (iso || '').split('-')
  return y ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}
// Reads as the story of a rookie season: the MLB debut, first taking the field,
// then each milestone at the plate in the order it's likeliest to arrive. The
// debut row folds in "First Start" when the debut game was also his first start
// (see loadPlayer), so the separate 'start' entry drops out in that case.
const FIRSTS_ORDER = ['debut', 'start', 'hit', 'xbh', 'hr', 'run', 'so']
// Pitching counterpart: the debut (a pitcher's first appearance), then each way
// an outing can go, ending with the first punch-out.
const PITCHER_FIRSTS_ORDER = ['debut', 'start', 'win', 'loss', 'save', 'so']

function draftLabel(draft, signedYear) {
  if (draft && draft.year) {
    if (!draft.round) return String(draft.year)
    return `${draft.year} · Rd ${draft.round}${draft.overall ? ` #${draft.overall}` : ''}`
  }
  if (signedYear) return `Signed ${signedYear}`
  return DASH
}

export function PlayerPage({ id, asOf, sportId }) {
  const { loading, error, data } = useAsync(() => loadPlayer(id, asOf), [id, asOf])
  useDocumentTitle(data?.bio?.fullName || null)

  const back = () => window.history.back()

  const gate = AsyncGate({ loading, error, data, screenClass: 'player', noun: 'player', onBack: back })
  if (gate) return gate

  const { bio, blocks } = data
  const pitchBlock = blocks.find((b) => b.group === 'pitching')
  // A free agent / retired / released player (see api/person.js's
  // rosterStatusView). `bio.team` is still populated for him — the API points a
  // player with no club at the last one he had — so everything club-shaped on
  // this hero reads through `club` instead, which goes null the moment he is on
  // nobody's roster. He gets the league mark and the status word in place of a
  // club he isn't on.
  const status = data.rosterStatus
  const club = status ? null : bio.team
  // Not tied to any one game, so the player page always wears the club's
  // Main/Home triad — the same identity-only theme TeamHubShell resolves for
  // its own hub header. Null (no curated triad for this club, or no club at
  // all) leaves the page on the app's default navy chrome, same fallback
  // headerTheme.js guarantees everywhere else.
  const theme = headerThemeFor(club?.id, themeKeyFor(club?.id, 'home', 'main'))
  const heroPos = bio.twoWay ? 'DH/P' : (bio.isPitcher && pitchBlock?.role) || bio.posAbbr || ''
  const hand = bio.isPitcher && !bio.twoWay
    ? bio.throws ? `Throws ${bio.throws}` : ''
    : [bio.bats && `Bats ${bio.bats}`, bio.throws && `Throws ${bio.throws}`].filter(Boolean).join(' / ')
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'
  const { first: firstName, last: lastName } = splitDisplayName(bio.fullName)
  // What actually has to fit on the hero's one line is surname + jersey
  // number ("Contreras" alone fits; "Contreras #24" doesn't), so the
  // long-name step-down keys on their combined length — see
  // .player__name-last--long. Eleven units is where the base size starts
  // ellipsizing at phone width.
  const nameUnits = lastName.length + (bio.number ? String(bio.number).length + 1 : 0)
  const firstsOrder = bio.isPitcher ? PITCHER_FIRSTS_ORDER : FIRSTS_ORDER
  const hasFirsts = data.firsts && firstsOrder.some((key) => data.firsts[key])
  const hasPlayerHistory = Boolean(
    data.positionInnings || hasFirsts || (data.progression && bio.debut) || (data.timeline && bio.debut) || data.transactions,
  )
  // The Prospect Card itself only earns a spot on the Analytics shelf when it
  // has something to say — a rank pill, a real standing/unqualified reading,
  // or a real age-edge fact. An untracked, unranked MiLB player with none of
  // those still gets the plain empty shelf, same as before this card existed
  // — bbsbh genuinely has no prospect-relevant data on him to show.
  const showProspectCard = Boolean(
    data.sportId !== 1 &&
      data.prospectCard &&
      (data.prospectRank || data.orgProspectRank || data.prospectCard.state !== 'none' || data.prospectCard.ageEdge),
  )

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className={`screen player ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
        <SiteHeader />
        {data.isAllStar && (
          <div className="allstar-banner" role="note">
            <span className="allstar-banner__star" aria-hidden="true">★</span>
            <span className="allstar-banner__text">{data.currentYear} All-Star</span>
            <span className="allstar-banner__star" aria-hidden="true">★</span>
          </div>
        )}
        {/* startingToday: he's announced as TODAY's probable starter for the
            club that has him on rehab/the IL — MLB posts that days before it
            files the activation transaction the banners are otherwise keyed
            on, so showing "Rehab Assignment"/"Injured List" the day he's
            about to take the mound would be stale on its face. See
            loadPlayer.js. */}
        {data.onRehab && !data.startingToday && (
          <div className="rehab-banner" role="note">
            <span className="rehab-banner__mark" aria-hidden="true">✚</span>
            <span className="rehab-banner__text">
              Rehab Assignment{data.rehab?.name ? ` · ${data.rehab.name}` : ''}
            </span>
          </div>
        )}
        {data.onIL && !data.startingToday && (
          <div className="il-banner" role="note">
            <span className="il-banner__mark" aria-hidden="true">✚</span>
            <span className="il-banner__text">
              Injured List{data.il?.days ? ` · ${data.il.days}-Day` : ''}
            </span>
          </div>
        )}
        {data.lastPlayedYear && (
          <div className="lastplayed-banner" role="note">
            <span className="lastplayed-banner__text">Last played in {data.lastPlayedYear}</span>
          </div>
        )}
        <BackBtn onClick={back} />

        <header className="player__hero">
          {/* No club, no club-colored wash behind the face — and `isMlb` is
              passed explicitly because it normally derives from the teamId
              that just went null, and a debuted player must keep skipping the
              stale `milb` prospect-photo rung (see Headshot). */}
          <Headshot
            personId={bio.id}
            name={bio.fullName}
            teamId={club?.parentOrgId ?? club?.id}
            isMlb={isMlbTeamId(club?.id) || Boolean(status && bio.debut)}
          />
          <div className="player__ident">
            <h1 className="player__name">
              {firstName && <span className="player__name-first">{firstName}</span>}
              {/* A long surname-plus-number would ellipsize at phone width —
                  step the display size down instead of truncating the man's
                  own name on his own page. */}
              <span className={`player__name-last${nameUnits >= 11 ? ' player__name-last--long' : ''}`}>
                {lastName}
                {bio.number && <span className="player__num">#{bio.number}</span>}
              </span>
            </h1>
            {/* Two lines, not one run-on list. The old single line ran
                position · hand · club · pill through mid-dots and wrapped
                wherever it ran out of room, which stranded a separator at the
                end of line one ("SP · THROWS R ·") and dropped the club into
                the position of an afterthought. The club is the identity half
                of a player's card, so it gets its own line under the
                attributes — and the wrap can no longer split a dot from what
                it separates, because line one is the only line with dots. */}
            <p className="player__meta">
              {heroPos && <span className="player__pos">{heroPos}</span>}
              {hand && <> <span className="sep">·</span> <span className="player__hand">{hand}</span></>}
            </p>
            {(club || status || data.prospectRank || data.orgProspectRank) && (
              <p className="player__clubline">
                {club && (
                  <TeamLink id={club.id} className="player__team">{club.name}</TeamLink>
                )}
                {status && <span className="player__status">{status.label}</span>}
                {data.prospectRank && (
                  <span className="prospectpill">
                    <img src={leagueLogoUrl()} alt="" className="prospectpill__logo" />
                    #{data.prospectRank} PROSPECT
                  </span>
                )}
                {data.orgProspectRank && (
                  <span className="prospectpill">
                    <TeamLogo
                      teamId={club?.parentOrgId ?? club?.id}
                      name={club?.parentOrgName ?? club?.name}
                      size={12}
                    />
                    #{data.orgProspectRank} PROSPECT
                  </span>
                )}
              </p>
            )}
          </div>
          {club && (
            <TeamLink id={club.id} className="player__herologo" ariaLabel={club.name}>
              <TeamLogo teamId={club.id} name={club.name} size={56} />
              {club.parentOrgId && (
                <TeamLogo
                  teamId={club.parentOrgId}
                  name={club.parentOrgName}
                  variant="wordmark"
                  size={20}
                  className="player__herologo-affiliate"
                />
              )}
            </TeamLink>
          )}
          {/* The league mark stands in for the club crest — the slot has to hold
              something or the hero's third column collapses and the name jumps
              right, and MLB's own mark is the honest answer for a player who
              belongs to no club. Not a link: there's no club page to open. */}
          {status && (
            <span className="player__herologo player__herologo--league">
              <img src={leagueLogoUrl()} alt="" className="player__leaguemark" />
            </span>
          )}
        </header>

        {data.timeline && !bio.debut && <CareerTimeline entries={data.timeline.entries} />}

        {data.progression && !bio.debut && (
          <LevelProgressionCard levels={data.progression.levels} />
        )}

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

        {/* Awards stays here as identity — "who is this guy" — ahead of the
            stat tables; a player with none renders nothing and the page falls
            straight through into stats. Milestone Watch and Firsts used to sit
            in this zone too, but neither is backward-looking the way this is:
            Milestone Watch is a forward-looking pace fact that previews the
            Career register's totals row (now sits between Game log and the
            register, below), and Firsts is a set of dated origin-story events
            that reads better beside Team History / Path to the Majors /
            Transactions (now opens that archive, below).

            One of the eight club-barred top-level sections, unlike the Trophy
            Case it replaces: that was a compact card in the achievements zone,
            this is a content-rich block on the footing of Career stats and
            Game log. Hence section__title--bar here, and the --aside modifier
            for its counts. */}
        <AwardsLedger ledger={data.awardLedger} />

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
                (loadPlayer skips the fetch). */}
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
                read off the register below. Full-season figures, so labeled
                "this season", not the main tiles' frozen "entering today". */}
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

            {/* Analytics — Statcast, Advanced, Foul Balls, Pitches, Pitches
                Like, under one umbrella label; each still carries its own
                section title underneath it. */}
            <SectionTitle title="Analytics" bar />

            {/* The one card that fills this shelf below the majors — MLB-only
                Statcast/Advanced/Foul/BattedBall all render nothing for a
                MiLB block, same as before; this is what replaces that gap. */}
            {showProspectCard && block.group === data.prospectCardGroup && (
              <ProspectCard
                view={data.prospectCard}
                level={SPORT_LABEL[data.sportId] ?? ''}
                group={block.group}
                badge={{
                  rank: data.prospectRank,
                  orgRank: data.orgProspectRank,
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

            {/* Directly under the mix it's derived from — the three players
                whose own profile looks most like the rows just above, which
                only reads as an answer if the question is still on screen.
                A pitcher's neighbours are arsenal-space (what he throws, see
                lib/pitcherSimilarity.js); a hitter's are Statcast-skill-space
                (how he hits, see lib/hitterSimilarity.js). Renders nothing
                below the sample floors or when nobody clears the match floor.
                NO section note, unlike its neighbours: what "closest" is
                measured on now lives in the card's own legend, which names the
                actual inputs (SimilarPlayerGrid.jsx). The note that used to be
                here said "closest Statcast profiles", a phrase a reader had no
                way to check, and then briefly "3 closest", which only counted
                cards already on screen. */}
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
                FoulCard/Milestone Watch. */}
            {block.group === 'pitching' && (
              <PitcherWorkloadCard playerId={bio.id} asOf={asOf} />
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
                every table, a titled first card); PlayerPage keeps only the
                bar-wearing top-level heading. */}
            {hasSplits(block, data.vsTeam) && (
              <>
                <SectionTitle title="Splits" bar />
                <SplitsSection
                  block={block}
                  vsTeam={data.vsTeam}
                  season={data.season}
                  asOf={asOf}
                />
              </>
            )}

            {/* A bridge between current pace (Game log, above) and career
                totals (the Career register, just below) — "X shy of Y" reads
                as a caption for the totals row it now sits above. */}
            <MilestoneWatchCard
              playerId={bio.id}
              asOf={asOf}
              milestones={block.milestones}
              groupLabel={blocks.length > 1 ? block.title : null}
            />

            {block.register && <CareerRegister register={block.register} />}
          </section>
          )
        })}

        {/* Photos + Highlights — both only for a player who has appeared in
            an MLB game this season (the primary block's tileStat resolving
            to MLB is loadPlayer's own signal for that, see its comment at the
            liveLevel derivation above) and only on the bare current-day view.
            Photos has no precompute to cut to a spoiler asOf; Highlights
            COULD technically filter its static file to `clip.date <= asOf`
            but deliberately doesn't (see PlayerHighlightsRail's issue) — same
            `!asOf` gate, for v1 simplicity and consistency with the box
            score/team rail's "decided games only" footing rather than a
            dated cutoff. `primaryBlock`/the gate is computed once and shared
            by both sections rather than duplicated. Each renders nothing
            itself if it turns up empty. */}
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

        {/* Player History — the biographical archive: Innings by position,
            then dated origin-story events (Firsts), then Path to the
            Majors' compact summary before Team History's expanded logo
            detail — summary before detail — then Transactions, the longest
            and most archival section, last. Only the umbrella heading here
            wears the club bar (section__title--bar) — the five sub-card
            headings underneath stay plain, same as Analytics's and
            Splits's own sub-cards. */}
        {hasPlayerHistory && <SectionTitle title="Player history" bar />}

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

        {data.progression && bio.debut && (
          <LevelProgressionCard
            levels={data.progression.levels}
            debutYear={Number(bio.debut.slice(0, 4))}
          />
        )}

        {data.timeline && bio.debut && <CareerTimeline entries={data.timeline.entries} />}

        {data.transactions && <TransactionTimeline rows={data.transactions.rows} />}

        {asOf && (
          <p className="hint hint--prose player__caveat">
            Season tiles, game log and past-year rows are frozen to “entering {monthDay(asOf)}.”
            The current-year row, the splits and the Advanced rates are full-season figures.
          </p>
        )}

        <AsOfBanner asOf={asOf} sportId={sportId} />
      </div>
    </LinkScope>
  )
}

function roleWord(role) {
  return role === 'SP' ? 'starter' : role === 'CL' ? 'closer' : 'reliever'
}


// Fetches this player's own this-season MLB game list (gamePk + date) and
// hands it to PlayerPhotosRail for the live walk-back. A dedicated fetch
// rather than reusing block.gameLog's rows: that log is truncated to a
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

// The five-tile "Current season" grid — shared by the main tiles and each
// promoted other-level tile row (see block.otherLevels).
function StatGrid({ tiles }) {
  return (
    <div className="player__statgrid">
      {tiles.map((t) => (
        <div key={t.k} className={`stat${t.tone === 'run' ? ' stat--run' : ''}`}>
          <div className="stat__v">{t.v}</div>
          <div className="stat__k">{t.k}</div>
        </div>
      ))}
    </div>
  )
}

// `bar` marks one of the page's eight top-level sections (2026 Stats,
// Analytics, Game log, Splits, Career stats, Player history — Recent
// workload / Recent form and Photos opt in the same way from their own
// components; the workload/form pair share one slot, split by group) so it
// wears the club bar (.section__title--bar in index.css); their sub-card
// headings underneath render through this same component without it.
// `aside` puts a control (the Career register's MLB-only pill) on the far end
// of the bar, the way SectionMasthead carries the lineup page's toggles.
function SectionTitle({ title, note, primary = false, bar = false, aside = null }) {
  return (
    <h3
      className={`section__title${primary ? ' section__title--primary' : ''}${bar ? ' section__title--bar' : ''}${aside ? ' section__title--aside' : ''}`}
    >
      <span>{title}</span>
      {note && <em>{note}</em>}
      {aside}
    </h3>
  )
}

function Fact({ label, value, mono = false, wide = false }) {
  return (
    <div className={`fact${wide ? ' fact--wide' : ''}`}>
      <div className="fact__label">{label}</div>
      <div className={`fact__value${value === DASH ? ' fact__na' : ''}`}>
        {mono ? <span className="mono">{value}</span> : value}
      </div>
    </div>
  )
}
