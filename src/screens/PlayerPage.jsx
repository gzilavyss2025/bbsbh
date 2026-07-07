import {
  fetchPerson,
  fetchPersonStats,
  fetchGamesByPk,
  fetchAllStarRosterIds,
} from '../api/mlb.js'
import {
  personBio,
  personSportId,
  aggregateSplits,
  pitcherRole,
  buildBlock,
} from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { LinkScope } from '../lib/nav.jsx'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLink } from '../components/TeamLink.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}
function debutLabel(iso) {
  const [y, m, d] = (iso || '').split('-')
  return y ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}
function draftLabel(draft) {
  if (!draft || !draft.year) return DASH
  if (!draft.round) return String(draft.year)
  return `${draft.year} · Rd ${draft.round}${draft.overall ? ` #${draft.overall}` : ''}`
}

// Assemble the full player view — bio + one stat block (two for a two-way
// player). Stats are cut off at the day BEFORE the game date ("entering today")
// when reached from a game (`asOf` set); a bare link defaults to current stats.
async function loadPlayer(id, asOf) {
  const person = await fetchPerson(id)
  if (!person) return null
  const bio = personBio(person)
  const sportId = personSportId(person)
  const season = Number((asOf || isoToday()).slice(0, 4))
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  const cutoff = asOf || null
  const groups = bio.twoWay
    ? ['hitting', 'pitching']
    : [bio.isPitcher ? 'pitching' : 'hitting']
  const debutYear = bio.debut ? Number(bio.debut.slice(0, 4)) : null

  const [blocks, debutSplits, allStarIds] = await Promise.all([
    Promise.all(
      groups.map(async (group) => {
        const [seasonSplits, careerSplits, lrSplits, gameLogSplits, yearByYearSplits, arsenalSplits] =
          await Promise.all([
            fetchPersonStats(id, {
              type: 'byDateRange', group, season,
              startDate: `${season}-01-01`, endDate, sportId,
            }),
            fetchPersonStats(id, { type: 'career', group, sportId }),
            fetchPersonStats(id, { type: 'statSplits', group, sitCodes: 'vl,vr', season, sportId }),
            fetchPersonStats(id, { type: 'gameLog', group, season, sportId }),
            fetchPersonStats(id, { type: 'yearByYear', group, sportId }),
            group === 'pitching'
              ? fetchPersonStats(id, { type: 'pitchArsenal', group, season, sportId })
              : Promise.resolve([]),
          ])
        const seasonStat = aggregateSplits(seasonSplits, group)
        const role = group === 'pitching' ? pitcherRole(seasonStat) : null
        return buildBlock({
          group, role, seasonSplits, careerSplits, lrSplits,
          gameLogSplits, yearByYearSplits, arsenalSplits, cutoff, currentSeason: season,
        })
      }),
    ),
    // The MLB debut is always sportId 1; its box-score game is the first row of
    // that season's game log (the split whose date is the debut date).
    bio.debut && debutYear
      ? fetchPersonStats(id, {
          type: 'gameLog', group: bio.isPitcher ? 'pitching' : 'hitting',
          season: debutYear, sportId: 1,
        })
      : Promise.resolve([]),
    // All-Star membership (MLB only) — drives the banner. Spoiler-safe.
    sportId === 1 ? fetchAllStarRosterIds(season) : Promise.resolve(new Set()),
  ])

  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null

  // Point the debut fact and every game-log row at that game's (sealed) box
  // score, via the normal date/matchup/boxscore route (one batched schedule
  // lookup resolves all the abbreviations the slug needs).
  const pks = new Set()
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) if (r.gamePk) pks.add(r.gamePk)
  if (debutGamePk) pks.add(debutGamePk)
  const byPk = await fetchGamesByPk([...pks])
  const boxPath = (pk) => {
    const g = byPk[pk]
    return g ? gamePath(g.apiDate, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber) : null
  }
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) r.boxscorePath = boxPath(r.gamePk)

  return {
    bio, blocks, season, asOf, sportId,
    isAllStar: allStarIds.has(bio.id),
    debutBoxscorePath: debutGamePk ? boxPath(debutGamePk) : null,
  }
}

export function PlayerPage({ id, asOf, sportId }) {
  const { loading, error, data } = useAsync(() => loadPlayer(id, asOf), [id, asOf])

  const back = () => window.history.back()

  if (loading && !data) {
    return (
      <div className="screen player">
        <BackBtn onClick={back} />
        <p className="hint">Loading player…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="screen player">
        <BackBtn onClick={back} />
        <p className="hint hint--error">
          {error ? 'Couldn’t load this player. Try again.' : 'Player not found.'}
        </p>
      </div>
    )
  }

  const { bio, blocks } = data
  const pitchBlock = blocks.find((b) => b.group === 'pitching')
  const heroPos = (bio.isPitcher && pitchBlock?.role) || bio.posAbbr || ''
  const hand = bio.isPitcher && !bio.twoWay
    ? bio.throws ? `Throws ${bio.throws}` : ''
    : [bio.bats && `Bats ${bio.bats}`, bio.throws && `Throws ${bio.throws}`].filter(Boolean).join(' / ')
  const enteringLabel = asOf ? `entering ${monthDay(asOf)}` : 'season to date'

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen player">
        {data.isAllStar && (
          <div className="allstar-banner" role="note">
            <span className="allstar-banner__star" aria-hidden="true">★</span>
            <span className="allstar-banner__text">{data.season} All-Star</span>
            <span className="allstar-banner__star" aria-hidden="true">★</span>
          </div>
        )}
        <BackBtn onClick={back} />

        <header className="player__hero">
          <Headshot personId={bio.id} name={bio.fullName} />
          <div className="player__ident">
            <h1 className="player__name">
              {bio.fullName}
              {bio.number && <span className="player__num">#{bio.number}</span>}
            </h1>
            <p className="player__meta">
              {heroPos && <span className="player__pos">{heroPos}</span>}
              {hand && <> <span className="sep">·</span> {hand}</>}
              {bio.team && (
                <> <span className="sep">·</span>{' '}
                  <TeamLink id={bio.team.id} className="player__team">{bio.team.name}</TeamLink>
                </>
              )}
            </p>
          </div>
        </header>

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

        {blocks.map((block) => (
          <section key={block.group}>
            {blocks.length > 1 && <h2 className="player__blocktitle">{block.title}</h2>}

            <SectionTitle title="Current season" note={
              block.group === 'pitching' && block.role ? `${roleWord(block.role)} · ${enteringLabel}` : enteringLabel
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
                <SectionTitle title="Pitches" note="avg velo" />
                <div className="arsenal">
                  {block.arsenal.map((p) => (
                    <div key={p.code} className="pitch">
                      <div className="pitch__name">{p.name}</div>
                      <div className="pitch__velo">
                        {p.velo != null
                          ? <>{p.velo.toFixed(1)}<span className="pitch__unit">mph</span></>
                          : DASH}
                      </div>
                      {p.usage != null && (
                        <div className="pitch__usage">{Math.round(p.usage * 100)}%</div>
                      )}
                    </div>
                  ))}
                </div>
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

            {block.yearByYear && (
              <>
                <SectionTitle title="Year by year" />
                <Ledger
                  leftCols={1}
                  head={['Year', ...block.yearByYear.columns]}
                  rows={block.yearByYear.rows.map((r) => ({
                    key: r.year,
                    current: r.isCurrent,
                    cells: [`${r.year}${r.isCurrent ? '*' : ''}`, ...r.cells],
                  }))}
                  total={block.yearByYear.total}
                  totalLabel="Career"
                />
              </>
            )}

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

        <p className="hint player__caveat">
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

function BackBtn({ onClick }) {
  return (
    <button type="button" className="backbtn" onClick={onClick}>
      ‹ back
    </button>
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

function Ledger({ head, rows, leftCols = 2, total = null, totalLabel = '' }) {
  const cellClass = (i) => (i === 0 ? 'lft yr' : i < leftCols ? 'lft opp' : '')
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i < leftCols ? 'lft' : ''}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.current ? 'is-current' : ''}>
              {r.cells.map((c, i) => (
                <td key={i} className={cellClass(i)}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="is-total">
              {[totalLabel, ...total].map((c, i) => (
                <td key={i} className={cellClass(i)}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
