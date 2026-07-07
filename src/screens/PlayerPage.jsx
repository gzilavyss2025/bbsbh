import {
  fetchPerson,
  fetchPersonStats,
  fetchMilbYearByYear,
  fetchMilbByDateRange,
  fetchGamesByPk,
  fetchAllStarRosterIds,
  fetchTeamAbbrevs,
  findFirstStart,
  findFirstStrikeoutBatter,
} from '../api/mlb.js'
import {
  personBio,
  personSportId,
  aggregateSplits,
  pitcherRole,
  buildBlock,
  levelProgressionView,
  firstsFromGameLog,
  PITCHER_FIRSTS_DEFS,
  splitDisplayName,
} from '../api/person.js'
import { fetchTopProspects, prospectRankById, orgProspectRankById } from '../api/prospects.js'
import { leagueLogoUrl } from '../lib/teams.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { LinkScope } from '../lib/nav.jsx'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { LevelProgressionCard } from '../components/LevelProgressionCard.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Ledger } from '../components/Ledger.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'

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

// The "Current season" tiles' stat line. `levelStat` (already fetched at the
// player's current team's level) covers the common cases as-is: an active MLB
// player, or a MiLB player who's spent the whole year at one level. Two cases
// need extra fetches: a player who has debuted before but shows no MLB games
// this season (a rehab assignment or a full-season option down, `sportId` !=
// 1) should still prefer his MLB line if he's actually appeared there this
// year; and a player with no MLB action at all this season should get his
// stints at every MiLB level combined, not just the level he's at right now
// (e.g. a mid-season AA -> AAA promotion).
async function resolveCurrentSeasonStat({ id, group, season, startDate, endDate, sportId, hasDebuted, levelStat }) {
  if (sportId === 1) return levelStat
  if (hasDebuted) {
    const mlbSplits = await fetchPersonStats(id, {
      type: 'byDateRange', group, season, startDate, endDate, sportId: 1,
    })
    const mlbStat = aggregateSplits(mlbSplits, group)
    if (mlbStat && Number(mlbStat.gamesPlayed) > 0) return mlbStat
  }
  const milbSplits = await fetchMilbByDateRange(id, group, season, startDate, endDate)
  return aggregateSplits(milbSplits, group)
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
  const currentYear = Number(isoToday().slice(0, 4))
  const startDate = `${season}-01-01`
  // "Path to the Majors" always tells the minor-league story in the page's
  // primary stat group (hitting for a two-way player: the more common
  // progression story, and the one whose gamesPlayed reads naturally as
  // "games at that level").
  const primaryGroup = bio.isPitcher ? 'pitching' : 'hitting'

  const [results, debutSplits, prospects, milbProgressionSplits] = await Promise.all([
    Promise.all(
      groups.map(async (group) => {
        const [seasonSplits, careerSplits, lrSplits, gameLogSplits, yearByYearSplits, arsenalSplits] =
          await Promise.all([
            fetchPersonStats(id, { type: 'byDateRange', group, season, startDate, endDate, sportId }),
            fetchPersonStats(id, { type: 'career', group, sportId }),
            fetchPersonStats(id, { type: 'statSplits', group, sitCodes: 'vl,vr', season, sportId }),
            fetchPersonStats(id, { type: 'gameLog', group, season, sportId }),
            // A pre-debut MiLB player's year-by-year table nests every level
            // he's played (see yearByYearView / levelProgressionView below);
            // a debuted player keeps today's single-sportId fetch, untouched.
            bio.debut
              ? fetchPersonStats(id, { type: 'yearByYear', group, sportId })
              : fetchMilbYearByYear(id, group),
            group === 'pitching'
              ? fetchPersonStats(id, { type: 'pitchArsenal', group, season, sportId })
              : Promise.resolve([]),
          ])
        const seasonStat = aggregateSplits(seasonSplits, group)
        const tileStat = await resolveCurrentSeasonStat({
          id, group, season, startDate, endDate, sportId,
          hasDebuted: Boolean(bio.debut), levelStat: seasonStat,
        })
        const role = group === 'pitching' ? pitcherRole(tileStat) : null
        const block = buildBlock({
          group, role, seasonSplits, careerSplits, lrSplits,
          gameLogSplits, yearByYearSplits, arsenalSplits, cutoff, currentSeason: season, sportId, tileStat,
        })
        return { group, yearByYearSplits, block }
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
    // Session-memoized after the first call anywhere in the app — cheap even
    // though every player page asks for it.
    fetchTopProspects(),
    // A debuted player's own yearByYearSplits fetch above is single-sportId
    // (see the comment on that fetch) so it can't feed the progression card —
    // fetch the multi-level MiLB history separately, just for the primary
    // group, so the card can still show his climb through the minors.
    bio.debut ? fetchMilbYearByYear(id, primaryGroup) : Promise.resolve(null),
  ])
  const blocks = results.map((r) => r.block)
  const prospectRank = prospectRankById(prospects.players, bio.id)
  // The player's rank on his own org's farm-system list — shown as a second
  // pill for anyone who's on their org's list but not the overall Top 100.
  const orgProspectRank = orgProspectRankById(prospects.orgProspects, bio.id)

  // "Path to the Majors" card. Pre-debut, the multi-level yearByYear splits
  // already fetched above cover it (no extra request); debuted, it's built
  // from the milbProgressionSplits fetched separately above, since that
  // player's own yearByYearSplits is single-sportId. Either way
  // levelProgressionView degrades to null if no MiLB level was ever reached.
  const primaryResult = results.find((r) => r.group === primaryGroup) ?? results[0]
  const progression = primaryResult
    ? levelProgressionView(
        bio.debut ? milbProgressionSplits : primaryResult.yearByYearSplits,
        primaryResult.group,
        sportId,
      )
    : null

  // All-Star roster membership (MLB only), one roster lookup per distinct year
  // that appears in the year-by-year table plus the real current year. The
  // banner is a "how's he doing right now" badge, so it always checks the real
  // current year — never the (possibly past) season a game link is scoped to,
  // so viewing an old game never shows a stale "20XX All-Star" banner. The
  // year-by-year table instead marks every season the player actually made an
  // All-Star team, however many that is. Spoiler-safe.
  const yearByYearYears = new Set()
  for (const b of blocks) for (const r of b.yearByYear?.rows ?? []) yearByYearYears.add(Number(r.year))
  const allStarYears = sportId === 1 ? new Set([currentYear, ...yearByYearYears]) : new Set()
  const allStarByYear = new Map(
    await Promise.all([...allStarYears].map(async (yr) => [yr, await fetchAllStarRosterIds(yr)])),
  )
  for (const b of blocks) {
    for (const r of b.yearByYear?.rows ?? []) {
      r.allStar = allStarByYear.get(Number(r.year))?.has(bio.id) ?? false
    }
  }
  const isAllStar = allStarByYear.get(currentYear)?.has(bio.id) ?? false

  // Team(s) played for each year-by-year row — a trade mid-season means more
  // than one. One batched lookup for every team id across every row (those
  // stat splits carry only a team id/name, never an abbreviation).
  const yearByYearTeamIds = new Set()
  for (const b of blocks) {
    for (const r of b.yearByYear?.rows ?? []) {
      for (const id of r.teamIds) yearByYearTeamIds.add(id)
      for (const lvl of r.levels ?? []) for (const tid of lvl.teamIds) yearByYearTeamIds.add(tid)
    }
  }
  const teamAbbrevs = await fetchTeamAbbrevs([...yearByYearTeamIds])
  for (const b of blocks) {
    for (const r of b.yearByYear?.rows ?? []) {
      r.team = r.teamIds.map((tid) => teamAbbrevs[tid]).filter(Boolean).join('/')
      for (const lvl of r.levels ?? []) {
        lvl.team = lvl.teamIds.map((tid) => teamAbbrevs[tid]).filter(Boolean).join('/')
      }
    }
  }

  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null

  // Firsts — milestones read off the debut year's game log (already fetched
  // above for the debut deep-link). Hitters get five plate milestones plus the
  // first game STARTED, which needs each candidate game's own boxscore (see
  // findFirstStart) since no gameLog field distinguishes a start from a sub
  // appearance. Pitchers get the pitching counterpart (PITCHER_FIRSTS_DEFS) —
  // every field but the strikeout victim is a direct gameLog stat, so only
  // that one needs an extra per-game feed lookup (findFirstStrikeoutBatter).
  // `debutSplits` above is fetched in whichever group matches `bio.isPitcher`.
  let firsts = null
  if (bio.isPitcher && bio.debut) {
    const { events } = firstsFromGameLog(debutSplits, cutoff, PITCHER_FIRSTS_DEFS)
    if (events.so) {
      events.so.batter = await findFirstStrikeoutBatter(bio.id, events.so.gamePk)
    }
    firsts = events
  } else if (!bio.isPitcher && bio.debut) {
    const { events, rowsAscending } = firstsFromGameLog(debutSplits, cutoff)
    const startSplit = await findFirstStart(bio.id, rowsAscending)
    events.start = startSplit
      ? {
          label: 'First Start',
          date: startSplit.date,
          gamePk: startSplit.game.gamePk,
          isHome: startSplit.isHome,
        }
      : null
    firsts = events
  }

  // Point the debut fact and every game-log row at that game's (sealed) box
  // score, via the normal date/matchup/boxscore route (one batched schedule
  // lookup resolves all the abbreviations the slug needs).
  const pks = new Set()
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) if (r.gamePk) pks.add(r.gamePk)
  if (debutGamePk) pks.add(debutGamePk)
  if (firsts) for (const f of Object.values(firsts)) if (f?.gamePk) pks.add(f.gamePk)
  const byPk = await fetchGamesByPk([...pks])
  const boxPath = (pk) => {
    const g = byPk[pk]
    return g ? gamePath(g.apiDate, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber) : null
  }
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) r.boxscorePath = boxPath(r.gamePk)
  if (firsts) {
    for (const key of Object.keys(firsts)) {
      const f = firsts[key]
      if (!f) continue
      const g = byPk[f.gamePk]
      firsts[key] = {
        ...f,
        path: boxPath(f.gamePk),
        oppAbbr: g ? (f.isHome ? g.awayAbbr : g.homeAbbr) : '',
      }
    }
  }

  return {
    bio, blocks, season, asOf, sportId,
    isAllStar, currentYear, firsts, progression, prospectRank, orgProspectRank,
    debutBoxscorePath: debutGamePk ? boxPath(debutGamePk) : null,
  }
}

export function PlayerPage({ id, asOf, sportId }) {
  const { loading, error, data } = useAsync(() => loadPlayer(id, asOf), [id, asOf])
  useDocumentTitle(data?.bio?.fullName || null)

  const back = () => window.history.back()

  if (loading && !data) {
    return (
      <div className="screen player">
        <SiteHeader />
        <BackBtn onClick={back} />
        <p className="hint">Loading player…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="screen player">
        <SiteHeader />
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

            {block.yearByYear && (
              <>
                <SectionTitle title="Year by year" />
                <Ledger
                  leftCols={2}
                  head={['Year', 'Team', ...block.yearByYear.columns]}
                  rows={block.yearByYear.rows.map((r) => ({
                    key: r.year,
                    allStar: r.allStar,
                    cells: [
                      <>
                        {r.year}
                        {r.allStar && (
                          <span className="ledger__allstar" title="All Star">★</span>
                        )}
                      </>,
                      r.team || DASH,
                      ...r.cells,
                    ],
                    subRows: r.levels?.map((l) => ({
                      key: `${r.year}-${l.sportId}`,
                      label: `${l.label}${l.team ? ' · ' + l.team : ''}`,
                      cells: l.cells,
                    })) ?? null,
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
                          <PlayerLink id={f.batter.id}>{f.batter.fullName}</PlayerLink>
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
