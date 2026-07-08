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
import { CareerTimeline } from '../components/CareerTimeline.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Ledger } from '../components/Ledger.jsx'
import { PositionInnings } from '../components/PositionInnings.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
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
  return y ? `${MONTHS[Number(m) - 1].toUpperCase()} ${Number(d)}, ${y}` : ''
}
// Reads as the story of a rookie season: first taking the field, then each
// milestone at the plate in the order it's likeliest to arrive.
const FIRSTS_ORDER = ['start', 'hit', 'xbh', 'hr', 'run', 'so']
// Pitching counterpart: first taking the mound, then each way an outing can
// go, ending with the first punch-out.
const PITCHER_FIRSTS_ORDER = ['appearance', 'start', 'win', 'loss', 'save', 'so']

function draftLabel(draft) {
  if (!draft || !draft.year) return DASH
  if (!draft.round) return String(draft.year)
  return `${draft.year} · Rd ${draft.round}${draft.overall ? ` #${draft.overall}` : ''}`
}

export function PlayerPage({ id, asOf, sportId }) {
  const { loading, error, data } = useAsync(() => loadPlayer(id, asOf), [id, asOf])
  useDocumentTitle(data?.bio?.fullName || null)

  const back = () => window.history.back()

  const gate = AsyncGate({ loading, error, data, screenClass: 'player', noun: 'player', onBack: back })
  if (gate) return gate

  const { bio, blocks } = data
  const pitchBlock = blocks.find((b) => b.group === 'pitching')
  const heroPos = (bio.isPitcher && pitchBlock?.role) || bio.posAbbr || ''
  const hand = bio.isPitcher && !bio.twoWay
    ? bio.throws ? `Throws ${bio.throws}` : ''
    : [bio.bats && `Bats ${bio.bats}`, bio.throws && `Throws ${bio.throws}`].filter(Boolean).join(' / ')
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'
  // A debuted player currently in the minors (a demotion or an aging lifer's
  // last stop) has current-season tiles at his MiLB level — label it so a .310
  // AAA line isn't mistaken for a major-league one.
  const liveLevel = bio.debut && data.sportId !== 1 ? SPORT_LABEL[data.sportId] ?? '' : ''
  const { first: firstName, last: lastName } = splitDisplayName(bio.fullName)

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen player">
        {data.isAllStar && (
          <div className="allstar-banner" role="note">
            <span className="allstar-banner__star" aria-hidden="true">★</span>
            <span className="allstar-banner__text">{data.currentYear} All-Star</span>
            <span className="allstar-banner__star" aria-hidden="true">★</span>
          </div>
        )}
        <SiteHeader />
        <BackBtn onClick={back} />

        <header className="player__hero">
          <Headshot personId={bio.id} name={bio.fullName} />
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
              {hand && <> <span className="sep">·</span> {hand}</>}
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
          <Fact label="Draft" value={draftLabel(bio.draft)} />
        </div>

        {data.conversionNote && <p className="hint reg-convert">{data.conversionNote}</p>}

        {blocks.map((block) => (
          <section key={block.group}>
            {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

            <SectionTitle title="Current season" note={
              [
                liveLevel,
                block.group === 'pitching' && block.role ? roleWord(block.role) : null,
                enteringLabel,
              ].filter(Boolean).join(' · ')
            } />
            <div className="player__statgrid">
              {block.tiles.map((t) => (
                <div key={t.k} className={`stat${t.tone === 'run' ? ' stat--run' : ''}`}>
                  <div className="stat__v">{t.v}</div>
                  <div className="stat__k">{t.k}</div>
                </div>
              ))}
            </div>

            {block.arsenal && (
              <>
                <SectionTitle title="Pitches" />
                <Ledger
                  leftCols={1}
                  head={['Pitch', 'Velo', 'Usage']}
                  rows={block.arsenal.map((p) => ({
                    key: p.code,
                    cells: [
                      p.name.toUpperCase(),
                      p.velo != null ? <>{p.velo.toFixed(1)} <span className="pitch__unit">mph</span></> : DASH,
                      p.usage != null ? `${Math.round(p.usage * 100)}%` : DASH,
                    ],
                  }))}
                />
              </>
            )}

            {block.gameLog && (
              <>
                <SectionTitle title="Game log" note={`last ${block.gameLog.rows.length} · entering today`} />
                <Ledger
                  head={['Date', 'Opp', ...block.gameLog.columns]}
                  rows={block.gameLog.rows.map((r) => ({
                    key: r.date,
                    cells: [
                      r.date,
                      <>
                        {r.home ? 'vs' : '@'}{' '}
                        <GameLink path={r.boxscorePath}>{r.opp.toUpperCase()}</GameLink>
                      </>,
                      ...r.cells,
                    ],
                  }))}
                />
              </>
            )}

            {block.register && <CareerRegister register={block.register} />}

            {block.splits && (
              <>
                <SectionTitle title="Season splits" note={block.splitsLabel} />
                <div className="player__splits">
                  <SplitCard label={block.group === 'pitching' ? 'vs LHB' : 'vs LHP'} side={block.splits.left} />
                  <SplitCard label={block.group === 'pitching' ? 'vs RHB' : 'vs RHP'} side={block.splits.right} />
                </div>
              </>
            )}
          </section>
        ))}

        {data.positionInnings && (
          <PositionInningsCard pi={data.positionInnings} playerId={bio.id} />
        )}

        {data.timeline && bio.debut && <CareerTimeline entries={data.timeline.entries} />}

        {data.progression && bio.debut && (
          <LevelProgressionCard
            levels={data.progression.levels}
            debutYear={Number(bio.debut.slice(0, 4))}
          />
        )}

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
                          <PlayerLink id={f.batter.id}>{f.batter.fullName.toUpperCase()}</PlayerLink>
                        ) : (
                          f.oppAbbr
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <p className="hint hint--prose player__caveat">
          {asOf
            ? 'Season tiles, game log and past-year rows are frozen to “entering today.” The current-year row and the splits are full-season figures.'
            : 'Current-season figures (no game context).'}
        </p>
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
// MLB rows are inked, MiLB rows penciled with a level pill; a debuted player's
// pre-debut climb folds into one tappable row that expands to its seasons; the
// footer carries separate MLB and MiLB totals, and small post-debut stints ride
// a neutral caption beneath.
function CareerRegister({ register }) {
  const [climbOpen, setClimbOpen] = useState(false)
  const { columns, rows, climb, totals, footnote } = register

  const ledgerRows = rows.map((r) => ({
    key: r.key,
    className: r.tier === 'mlb' ? 'reg-mlb' : 'reg-milb',
    allStar: r.allStar,
    cells: [
      <>
        {r.year}
        {r.allStar && <span className="ledger__allstar" title="All Star">★</span>}
        {r.pill && <span className="reg-pill">{r.pill}</span>}
      </>,
      r.team || DASH,
      ...r.cells,
    ],
  }))

  if (climb) {
    ledgerRows.push({
      key: 'climb',
      className: 'reg-milb reg-climb',
      onClick: () => setClimbOpen((v) => !v),
      cells: [
        <span className="reg-climb__yr" key="yr">
          <span className="reg-climb__caret" aria-hidden="true">{climbOpen ? '▾' : '▸'}</span>
          {climb.yearText}
        </span>,
        <span className="reg-climb__note" key="note">
          Minors · {climb.subSeasons.length} {climb.subSeasons.length === 1 ? 'season' : 'seasons'}
        </span>,
        ...climb.cells,
      ],
      subRows: climbOpen
        ? climb.subSeasons.map((s) => ({
            key: s.key,
            className: 'reg-milb',
            label: `${s.year} · ${s.level}${s.team ? ' · ' + s.team : ''}`,
            cells: s.cells,
          }))
        : null,
    })
  }

  return (
    <>
      <SectionTitle title="Career" />
      <Ledger
        leftCols={2}
        head={['Year', 'Team', ...columns]}
        rows={ledgerRows}
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

function SectionTitle({ title, note }) {
  return (
    <h3 className="section__title">
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

function SplitCard({ label, side }) {
  return (
    <div className="split">
      <div className="split__k">{label}</div>
      <div className="split__row">
        <span className="split__v">{side.avg}</span>
        <span className="split__sub">{side.ops} OPS</span>
      </div>
    </div>
  )
}
