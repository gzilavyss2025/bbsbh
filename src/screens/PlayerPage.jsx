import { useState, useRef } from 'react'
import { loadPlayer, loadPositionScope } from '../api/loadPlayer.js'
import { splitDisplayName } from '../api/person.js'
import { leagueLogoUrl, SPORT_LABEL } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { LinkScope } from '../lib/nav.jsx'
import { useNav } from '../lib/nav.js'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { LevelProgressionCard } from '../components/LevelProgressionCard.jsx'
import { MilestoneWatchCard } from '../components/MilestoneWatchCard.jsx'
import { TrophyCase } from '../components/TrophyCase.jsx'
import { CareerTimeline } from '../components/CareerTimeline.jsx'
import { TransactionTimeline } from '../components/TransactionTimeline.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Ledger, spanCell } from '../components/Ledger.jsx'
import { PositionInnings } from '../components/PositionInnings.jsx'
import { SplitsVsTeam } from '../components/SplitsVsTeam.jsx'
import { StatcastPercentiles } from '../components/StatcastPercentiles.jsx'
import { FoulCard } from '../components/FoulCard.jsx'
import { PitcherWorkloadCard } from '../components/PitcherWorkloadCard.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsOfBanner } from '../components/AsOfBanner.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

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
  const heroPos = bio.twoWay ? 'DH/P' : (bio.isPitcher && pitchBlock?.role) || bio.posAbbr || ''
  const hand = bio.isPitcher && !bio.twoWay
    ? bio.throws ? `Throws ${bio.throws}` : ''
    : [bio.bats && `Bats ${bio.bats}`, bio.throws && `Throws ${bio.throws}`].filter(Boolean).join(' / ')
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'
  const { first: firstName, last: lastName } = splitDisplayName(bio.fullName)

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen player">
        <SiteHeader />
        {data.isAllStar && (
          <div className="allstar-banner" role="note">
            <span className="allstar-banner__star" aria-hidden="true">★</span>
            <span className="allstar-banner__text">{data.currentYear} All-Star</span>
            <span className="allstar-banner__star" aria-hidden="true">★</span>
          </div>
        )}
        {data.onRehab && (
          <div className="rehab-banner" role="note">
            <span className="rehab-banner__mark" aria-hidden="true">✚</span>
            <span className="rehab-banner__text">
              Rehab Assignment{data.rehab?.name ? ` · ${data.rehab.name}` : ''}
            </span>
          </div>
        )}
        {data.onIL && (
          <div className="il-banner" role="note">
            <span className="il-banner__mark" aria-hidden="true">✚</span>
            <span className="il-banner__text">
              Injured List{data.il?.days ? ` · ${data.il.days}-Day` : ''}
            </span>
          </div>
        )}
        <AsOfBanner asOf={asOf} />
        <BackBtn onClick={back} />

        <header className="player__hero">
          <Headshot personId={bio.id} name={bio.fullName} teamId={bio.team?.parentOrgId ?? bio.team?.id} />
          <div className="player__ident">
            <h1 className="player__name">
              {firstName && <span className="player__name-first">{firstName}</span>}
              <span className="player__name-last">
                {lastName}
                {bio.number && <span className="player__num">#{bio.number}</span>}
              </span>
            </h1>
            <p className="player__meta">
              {heroPos && <span className="player__pos">{heroPos}</span>}
              {hand && <> <span className="sep">·</span> <span className="player__hand">{hand}</span></>}
              {bio.team && (
                <> <span className="sep">·</span>{' '}
                  <TeamLink id={bio.team.id} className="player__team">{bio.team.name}</TeamLink>
                </>
              )}
              {data.prospectRank && (
                <> <span className="sep">·</span>{' '}
                  <span className="prospectpill">
                    <img src={leagueLogoUrl()} alt="" className="prospectpill__logo" />
                    #{data.prospectRank} PROSPECT
                  </span>
                </>
              )}
              {data.orgProspectRank && (
                <> <span className="sep">·</span>{' '}
                  <span className="prospectpill">
                    <TeamLogo
                      teamId={bio.team?.parentOrgId ?? bio.team?.id}
                      name={bio.team?.parentOrgName ?? bio.team?.name}
                      size={12}
                    />
                    #{data.orgProspectRank} PROSPECT
                  </span>
                </>
              )}
            </p>
          </div>
          {bio.team && (
            <TeamLink id={bio.team.id} className="player__herologo">
              <TeamLogo teamId={bio.team.id} name={bio.team.name} size={56} />
              {bio.team.parentOrgId && (
                <TeamLogo
                  teamId={bio.team.parentOrgId}
                  name={bio.team.parentOrgName}
                  variant="wordmark"
                  size={20}
                  className="player__herologo-affiliate"
                />
              )}
            </TeamLink>
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
        </div>

        {data.conversionNote && <p className="hint reg-convert">{data.conversionNote}</p>}

        {/* Trophy Case stays here as identity — "who is this guy" — ahead of
            the stat tables; a player with none renders nothing and the page
            falls straight through into stats. Milestone Watch and Firsts used
            to sit in this zone too, but neither is backward-looking the way
            Trophy Case is: Milestone Watch is a forward-looking pace fact
            that previews the Career register's totals row (now sits between
            Game log and the register, below), and Firsts is a set of dated
            origin-story events that reads better beside Team History / Path
            to the Majors / Transactions (now opens that archive, below). */}
        <TrophyCase trophyCase={data.trophyCase} />

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
              title="Current season"
              primary
              note={
                [
                  liveLevel,
                  block.group === 'pitching' && block.role ? roleWord(block.role) : null,
                  enteringLabel,
                ].filter(Boolean).join(' · ')
              }
            />
            <StatGrid tiles={block.tiles} />

            {/* No header — sitting right beneath Current season's tiles,
                a vs-LHP/RHP (or vs-LHB/RHB) breakdown of the same season
                is self-explanatory without its own "Season splits" label.
                .player__seasonsplits just gives it breathing room off the
                stat grid above — neither carries its own margin, so with
                no SectionTitle between them the two cards would touch. */}
            {block.splits && (
              <div className="player__seasonsplits">
                <Ledger
                  leftCols={1}
                  head={['Split', block.group === 'pitching' ? 'BF' : 'AB', 'AVG/OBP/OPS', 'HR', 'RBI', 'XBH', 'SO%', 'BB%']}
                  rows={[
                    { key: 'l', label: block.group === 'pitching' ? 'vs LHB' : 'vs LHP', side: block.splits.left },
                    { key: 'r', label: block.group === 'pitching' ? 'vs RHB' : 'vs RHP', side: block.splits.right },
                  ].map(({ key, label, side }) => ({
                    key,
                    cells: [label, side.count, side.slash, side.hr, side.rbi, side.xbh, side.soPct, side.bbPct],
                  }))}
                />
              </div>
            )}

            {/* An up-and-down player's OTHER level(s) this season (e.g. a big
                leaguer's AAA line) — promoted beside the main tiles instead of
                buried in the register footnote. Full-season figures, so labeled
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

            {/* Career splits vs the club this player's team is next facing (a
                finger-scrollable strip to pick a different opponent), ahead of
                Statcast's season-long percentiles — "how's he done against
                tonight's opponent" is the more second-screen-shaped question
                than a percentile chip that won't move start to start.
                Rendered in the primary stat block only, per the card's spec. */}
            {data.vsTeam && block.group === data.vsTeam.group && (
              <SplitsVsTeam vsTeam={data.vsTeam} season={data.season} asOf={asOf} />
            )}

            <StatcastPercentiles savant={block.savant} group={block.group} />

            {/* Season foul-ball line (gen-fouls.mjs) + recent pitcher
                workload (gen-workload.mjs) — both current-day-only cards
                that hide under a spoiler asOf cutoff, like the Milestone
                Watch projection. */}
            <FoulCard playerId={bio.id} group={block.group} asOf={asOf} />
            {block.group === 'pitching' && (
              <PitcherWorkloadCard playerId={bio.id} asOf={asOf} />
            )}

            {block.arsenal && (
              <>
                <SectionTitle title="Pitches" />
                <Ledger
                  leftCols={1}
                  head={['Pitch', 'Velo', 'Usage']}
                  rows={block.arsenal.map((p) => ({
                    key: p.code,
                    cells: [
                      p.name,
                      p.velo != null ? <>{p.velo.toFixed(1)} <span className="pitch__unit">mph</span></> : DASH,
                      p.usage != null ? `${Math.round(p.usage * 100)}%` : DASH,
                    ],
                  }))}
                />
              </>
            )}

            {block.gameLog && (
              <>
                <SectionTitle title="Game log" note={`last ${block.gameLog.rows.length} · ${data.onRehab ? 'MLB + rehab' : 'entering today'}`} />
                <ul className="gamelog">
                  {block.gameLog.rows.map((r) => (
                    <li className="gamelog__row" key={r.gamePk ?? r.date}>
                      <div className="gamelog__meta">
                        <span className="gamelog__date">{r.date}</span>
                        <span className="gamelog__opp">
                          {r.home ? 'vs' : '@'}{' '}
                          <GameLink path={r.boxscorePath}>{r.opp}</GameLink>
                          {r.level && <span className="gamelog__level">{r.level}</span>}
                        </span>
                      </div>
                      <div className="gamelog__line">{r.line}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* A bridge between current pace (Game log, just above) and career
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

        {data.positionInnings && (
          <PositionInningsCard pi={data.positionInnings} playerId={bio.id} />
        )}

        {/* The biographical archive: dated origin-story events (Firsts) open
            it, then Path to the Majors' compact summary before Team History's
            expanded logo detail — summary before detail — then Transactions,
            the longest and most archival section, last. */}
        {data.firsts && (bio.isPitcher ? PITCHER_FIRSTS_ORDER : FIRSTS_ORDER).some((key) => data.firsts[key]) && (
          <section>
            <SectionTitle title="Firsts" />
            <div className="player__splits">
              {(bio.isPitcher ? PITCHER_FIRSTS_ORDER : FIRSTS_ORDER).map((key) => {
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
            Season tiles, game log and past-year rows are frozen to “entering today.” The current-year row and the splits are full-season figures.
          </p>
        )}
      </div>
    </LinkScope>
  )
}

function roleWord(role) {
  return role === 'SP' ? 'starter' : role === 'CL' ? 'closer' : 'reliever'
}

// A plain, spoiler-safe link to a game's (sealed) box score — the game-log
// opponent and the MLB-debut fact. Mirrors PlayerLink/TeamLink: no underline at
// rest, renders plain children when no path could be resolved.
function GameLink({ path, className = '', children }) {
  const navigate = useNav()
  if (!path) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={() => navigate(path)}
    >
      {children}
    </button>
  )
}

// The unified MLB + MiLB career table (see api/person.js careerRegisterView).
// MLB rows are inked, MiLB rows penciled with a level pill beside the team —
// every season the player climbed is its own row; the footer carries separate
// MLB and MiLB totals, and small post-debut stints ride a neutral caption beneath.
// The secondary pitching columns that drop out on a phone (see the Ledger's
// hideNarrow + the col-narrow-hide media query) — the essentials (G, W–L/SV,
// ERA, IP, WHIP) stay; GS, K and BB return once there's room.
const NARROW_HIDE_COLS = new Set(['GS', 'K', 'BB'])

function CareerRegister({ register }) {
  const { columns, rows, totals, footnote } = register
  // +2 for the leading Year + Team columns this table prepends to the stat cells.
  const hideNarrow = columns
    .map((c, i) => (NARROW_HIDE_COLS.has(c) ? i + 2 : -1))
    .filter((i) => i >= 0)

  const ledgerRows = rows.map((r) => ({
    key: r.key,
    className: r.tier === 'mlb' ? 'reg-mlb' : r.tier === 'gap' ? 'reg-gap' : 'reg-milb',
    allStar: r.allStar,
    cells: r.gap
      ? [
          <>{r.year}</>,
          // A gap year (see missingSeasonRows) has no team or stat line — its
          // note ("Injured — missed season" / "Did not play") spans the rest
          // of the row (spanCell) instead of sitting in one `nowrap` cell
          // beside a run of dashes, so the sentence wraps within the table's
          // width rather than forcing horizontal scroll on a phone.
          spanCell(<span className="reg-gap__note">{r.note}</span>),
        ]
      : [
          <>
            {r.year}
            {r.allStar && <span className="ledger__allstar" title="All Star">★</span>}
          </>,
          <>
            {r.team || DASH}
            {r.pill && <span className="reg-pill">{r.pill}</span>}
          </>,
          ...r.cells,
        ],
  }))

  return (
    <>
      <SectionTitle title="Career" />
      <Ledger
        leftCols={2}
        head={['Year', 'Team', ...columns]}
        rows={ledgerRows}
        hideNarrow={hideNarrow}
        totals={totals.map((t) => ({
          label: t.label,
          cells: t.cells,
          className: t.tier === 'mlb' ? 'reg-mlb' : 'reg-milb',
        }))}
      />
      {footnote && <p className="hint reg-footnote">{footnote}</p>}
    </>
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

function SectionTitle({ title, note, primary = false }) {
  return (
    <h3 className={`section__title${primary ? ' section__title--primary' : ''}`}>
      <span>{title}</span>
      {note && <em>{note}</em>}
    </h3>
  )
}

function Fact({ label, value, mono = false }) {
  return (
    <div className="fact">
      <div className="fact__label">{label}</div>
      <div className={`fact__value${value === DASH ? ' fact__na' : ''}`}>
        {mono ? <span className="mono">{value}</span> : value}
      </div>
    </div>
  )
}

