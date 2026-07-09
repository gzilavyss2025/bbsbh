import { useMemo } from 'react'
import {
  selectLineup,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
  selectOpposingPitcher,
  selectOpposingDefense,
  lastFirst,
} from '../api/select.js'
import { fetchTeamRoster } from '../api/team.js'
import { POS_ORDER, rosterPitcherRole } from '../api/person.js'
import { prospectBadge } from '../api/prospects.js'
import { formerTeammateGroups } from '../api/formerTeammates.js'
import { useAsync } from '../hooks/useAsync.js'
import { scorebookDate } from '../lib/dates.js'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { ProspectPill } from '../components/ProspectPill.jsx'

// Away/home info + lineup page — the staging page you copy the scorebook
// header from, so facts run in the sheet's order (date, park, first pitch,
// weather, attendance, manager, umpires) and every person outside the
// opposing-defense diamond is penciled surname-first with a uniform number.
// Nothing here is score-revealing, so it renders openly. The team's logo
// lives in the game masthead (see GameView), not here.
export function TeamInfo({
  feed,
  side,
  manager,
  uniform,
  scorebookWeather,
  scorebookWeatherLoading,
  oppPitcherLine,
  prospectsData,
  formerTeammatesData,
  onNext,
  nextLabel,
  onReload,
  loading,
}) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])

  return (
    <div className="teaminfo">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">
          <TeamLink id={meta.id} className="teaminfo__namelink">
            {(meta.name || 'Team').toUpperCase()}
          </TeamLink>
        </h2>
        <div className="teaminfo__headright">
          <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
          <RefreshButton onReload={onReload} loading={loading} />
        </div>
      </div>

      <dl className="factgrid">
        <GameFacts
          info={info}
          scorebookWeather={scorebookWeather}
          scorebookWeatherLoading={scorebookWeatherLoading}
        />
        <Fact label="Manager" value={managerFact(manager)} />
        {/* Tonight's uniform, synthesized to a tight summary ("Away Alternate
            Navy Blue") — spoiler-free, but the assignment isn't posted until
            around first pitch, so pregame this reads "—" until a Refresh picks
            it up. Never posted for MiLB. */}
        <Fact label="Uniform" value={uniform} />
      </dl>

      <Umpires officials={officials} />

      <TeamSections
        feed={feed}
        side={side}
        oppPitcherLine={oppPitcherLine}
        prospectsData={prospectsData}
        formerTeammatesData={formerTeammatesData}
      />

      <div className="pagenav">
        <button className="btn btn--next" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

// Both lineup pages condensed onto one sheet — the wide-screen (tablet /
// desktop) replacement for the two TeamInfo pages, swapped in by GameView at
// the WIDE_QUERY breakpoint. The game-level facts and umpires render once up
// top; each club then gets its own column of the team-specific sections
// (manager/uniform, batting order, opposing pitcher, opposing defense).
export function LineupSpread({
  feed,
  managers,
  uniforms,
  scorebookWeather,
  scorebookWeatherLoading,
  starterLines,
  prospectsData,
  formerTeammatesData,
  onNext,
  onReload,
  loading,
}) {
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])

  return (
    <div className="teaminfo teaminfo--spread">
      <div className="teaminfo__toolbar">
        <RefreshButton onReload={onReload} loading={loading} />
      </div>

      <dl className="factgrid factgrid--game">
        <GameFacts
          info={info}
          scorebookWeather={scorebookWeather}
          scorebookWeatherLoading={scorebookWeatherLoading}
        />
      </dl>

      <Umpires officials={officials} />

      <div className="teaminfo__duo">
        {['away', 'home'].map((side) => (
          <TeamPanel
            key={side}
            feed={feed}
            side={side}
            manager={managers?.[side]}
            uniform={uniforms?.[side]}
            // Each side FACES the other side's starter.
            oppPitcherLine={starterLines?.[side === 'away' ? 'home' : 'away']}
            prospectsData={prospectsData}
            formerTeammatesData={formerTeammatesData}
          />
        ))}
      </div>

      <div className="pagenav">
        <button className="btn btn--next" onClick={onNext}>
          Innings ›
        </button>
      </div>
    </div>
  )
}

// One club's column of the spread: name, its two team facts, then the same
// lineup / opposing-pitcher / opposing-defense sections as the phone page.
function TeamPanel({
  feed,
  side,
  manager,
  uniform,
  oppPitcherLine,
  prospectsData,
  formerTeammatesData,
}) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  return (
    <section className="teampanel">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">
          <TeamLink id={meta.id} className="teaminfo__namelink">
            {(meta.name || 'Team').toUpperCase()}
          </TeamLink>
        </h2>
        <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
      </div>
      <dl className="factgrid">
        <Fact label="Manager" value={managerFact(manager)} />
        <Fact label="Uniform" value={uniform} />
      </dl>
      <TeamSections
        feed={feed}
        side={side}
        oppPitcherLine={oppPitcherLine}
        prospectsData={prospectsData}
        formerTeammatesData={formerTeammatesData}
      />
    </section>
  )
}

// The game-level fill-ins shared by both clubs, in the sheet's order.
function GameFacts({ info, scorebookWeather, scorebookWeatherLoading }) {
  return (
    <>
      <Fact label="Date" value={scorebookDate(info.officialDate)} />
      <Fact label="Ballpark" value={info.venue} />
      <Fact label="First pitch" value={info.firstPitch} />
      <Fact
        label="Weather"
        value={scorebookWeatherLoading ? '…' : scorebookWeather?.text}
      />
      {/* Box weather is only the closed-roof interior reading — show it here
          just as a fallback when the outdoor scorebook weather resolved to
          nothing. When we have real weather, it's redundant (still in the box
          score at the bottom of the game). */}
      {!scorebookWeatherLoading && !scorebookWeather?.text && (
        <Fact label="Box weather" value={info.weather} />
      )}
      <Fact label="Attendance" value={info.attendance} />
    </>
  )
}

function Umpires({ officials }) {
  if (officials.length === 0) return null
  return (
    <section className="umps">
      <h3 className="section__title">Umpires</h3>
      <ul className="umps__list">
        {officials.map((o) => (
          <li key={o.role}>
            <span className="umps__role">{o.role}</span>
            <span className="umps__name">{o.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Groups a full active roster (from fetchTeamRoster) into the same
// batters/starters/bullpen split the team page uses, for the pregame
// fallback when the starting lineup isn't posted yet. Roster entries come
// from the plain /roster endpoint, not the live feed, so names degrade to
// fullName (no lastFirstName on that thinner person object). Starters won't
// enter once the game's underway, so they're split from the bullpen using
// the same season-stats role inference the team page badges pitchers with
// (rosterPitcherRole — gamesStarted ratio / saves); a pitcher with no
// resolved role (no starts on record yet) defaults into the bullpen list.
function rosterFallbackGroups(roster) {
  const rows = (roster ?? []).map((r) => ({
    id: r.person?.id,
    name: lastFirst(r.person),
    jersey: r.jerseyNumber ?? '',
    pos: r.position?.abbreviation ?? '',
    isPitcher: r.position?.type === 'Pitcher',
    role: r.position?.type === 'Pitcher' ? rosterPitcherRole(r) : null,
  }))
  const batters = rows
    .filter((r) => !r.isPitcher)
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))
  const starters = rows
    .filter((r) => r.role === 'SP')
    .sort((a, b) => a.name.localeCompare(b.name))
  const bullpen = rows
    .filter((r) => r.isPitcher && r.role !== 'SP')
    .sort((a, b) => a.name.localeCompare(b.name))
  return { batters, starters, bullpen }
}

// The team-specific body shared by the phone page and the spread's panels:
// batting order, the opposing starter, and the opposing defense diamond.
function TeamSections({ feed, side, oppPitcherLine, prospectsData, formerTeammatesData }) {
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const oppMeta = useMemo(
    () => selectTeamMeta(feed, side === 'away' ? 'home' : 'away'),
    [feed, side],
  )
  const season = feed?.gameData?.game?.season
  const oppPitcher = useMemo(() => selectOpposingPitcher(feed, side), [feed, side])
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])

  // Opposing players who were once teammates of someone on THIS club — grouped
  // by the opposing player (a recently-traded man ties to many of his old
  // mates), oriented so each row reads from our side. Empty for MiLB games /
  // matchups outside the nightly build, which hides the card.
  const teammateGroups = useMemo(
    () => formerTeammateGroups(formerTeammatesData, meta.id, oppMeta.id),
    [formerTeammatesData, meta.id, oppMeta.id],
  )

  // Lineups don't post until close to first pitch. Until then, stage the
  // team's full active roster (batters + pitchers) in the same spot rather
  // than a dead-end "not posted" line — there's still something to copy onto
  // the sheet. Only fetched while actually needed (skipped once the real
  // lineup posts).
  const needsRoster = lineup.length === 0
  const { data: rawRoster } = useAsync(
    () =>
      needsRoster && meta.id && season
        ? fetchTeamRoster(meta.id, season, { sportId: meta.sportId ?? 1 })
        : Promise.resolve([]),
    [needsRoster, meta.id, meta.sportId, season],
  )
  const roster = useMemo(() => rosterFallbackGroups(rawRoster), [rawRoster])

  return (
    <>
      <section className="lineup">
        <h3 className="section__title">Batting order</h3>
        {lineup.length > 0 ? (
          <ol className="lineup__list">
            {lineup.map((p) => (
              <li key={p.id} className="lineup__row">
                <span className="lineup__order">{p.order}</span>
                <span className="lineup__namewrap">
                  <PlayerLink id={p.id} className="lineup__name">
                    {p.nameLastFirst.toUpperCase()}
                  </PlayerLink>
                  <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                </span>
                <span className="lineup__jersey">{p.jersey || ''}</span>
                <span className="lineup__pos">{p.position}</span>
              </li>
            ))}
          </ol>
        ) : roster.batters.length > 0 || roster.starters.length > 0 || roster.bullpen.length > 0 ? (
          <>
            <p className="hint">Lineup not posted yet — full roster:</p>
            <div className="roster">
              {roster.batters.length > 0 && (
                <>
                  <h4 className="roster__group">Batters</h4>
                  <ul className="roster__list">
                    {roster.batters.map((p) => (
                      <li key={p.id} className="roster__row">
                        <span className="roster__namewrap">
                          <PlayerLink id={p.id} className="roster__name">
                            {p.name.toUpperCase()}
                          </PlayerLink>
                          <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                        </span>
                        <span className="roster__jersey">{p.jersey}</span>
                        <span className="roster__pos">{p.pos}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {roster.bullpen.length > 0 && (
                <>
                  <h4 className="roster__group">Bullpen</h4>
                  <ul className="roster__list">
                    {roster.bullpen.map((p) => (
                      <li key={p.id} className="roster__row">
                        <span className="roster__namewrap">
                          <PlayerLink id={p.id} className="roster__name">
                            {p.name.toUpperCase()}
                          </PlayerLink>
                          <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                        </span>
                        <span className="roster__jersey">{p.jersey}</span>
                        <span className="roster__pos">{p.pos}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {roster.starters.length > 0 && (
                <>
                  <h4 className="roster__group">Starters</h4>
                  <ul className="roster__list">
                    {roster.starters.map((p) => (
                      <li key={p.id} className="roster__row">
                        <span className="roster__namewrap">
                          <PlayerLink id={p.id} className="roster__name">
                            {p.name.toUpperCase()}
                          </PlayerLink>
                          <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                        </span>
                        <span className="roster__jersey">{p.jersey}</span>
                        <span className="roster__pos">{p.pos}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="hint">Lineup not posted yet.</p>
        )}
      </section>

      <section className="opp">
        <h3 className="section__title">Opposing pitcher</h3>
        {oppPitcher ? (
          <div className="opp__pitcher">
            <span className="opp__namewrap">
              <PlayerLink id={oppPitcher.id} className="opp__name">
                {oppPitcher.nameLastFirst.toUpperCase()}
              </PlayerLink>
              <ProspectPill {...prospectBadge(prospectsData, oppPitcher.id)} />
            </span>
            <span className="opp__jersey">{oppPitcher.jersey || ''}</span>
            <span className="opp__hand">{oppPitcher.hand}</span>
            {/* Season line (aggregates only, never this game's) — the numbers
                you pencil next to the starter while staging. */}
            {oppPitcherLine && (
              <span className="opp__season">
                {[
                  oppPitcherLine.era && `${oppPitcherLine.era} ERA`,
                  `${oppPitcherLine.wins}-${oppPitcherLine.losses}`,
                  `${oppPitcherLine.strikeOuts} K`,
                  oppPitcherLine.inningsPitched &&
                    `${oppPitcherLine.inningsPitched} IP`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
        ) : (
          <p className="hint">Not posted yet.</p>
        )}
      </section>

      {oppDefense.length > 0 && (
        <section className="opp">
          <h3 className="section__title">Opposing defense</h3>
          {/* Drawn like the sheet's bottom-left diamond: surnames on writing
              lines at their positions. The defense belongs to the OTHER side. */}
          <DefenseDiamond defense={oppDefense} />
        </section>
      )}

      <FormerTeammates groups={teammateGroups} />
    </>
  )
}

// Cap the card so a heavy trade history (a whole traded-away roster) doesn't run
// off the page; the rest collapse into a "+N more" footer.
const TEAMMATES_SHOWN = 8
// How many of MY players to name inline before summarizing as a count — keeps a
// recently-traded opponent (teammate of half our club) to one readable line.
const MATES_INLINE = 4

// Opposing players who used to be teammates of someone on this club, with the
// shared club(s) softly labeled ("both played for the 2021 Biloxi Shuckers") —
// the point being CROSS-team history, so only opponents appear. Spoiler-free
// (rosters + team-season history carry no score), rendered openly like the
// opposing-pitcher line. Hidden when there are no ties.
function FormerTeammates({ groups }) {
  if (!groups || groups.length === 0) return null
  const shown = groups.slice(0, TEAMMATES_SHOWN)
  const hidden = groups.length - shown.length
  return (
    <section className="teammates">
      <h3 className="section__title">Former teammates</h3>
      <ul className="teammates__list">
        {shown.map((g) => (
          <li key={g.opp.id} className="teammates__row">
            <span className="teammates__namewrap">
              <PlayerLink id={g.opp.id} className="teammates__name">
                {g.opp.name.toUpperCase()}
              </PlayerLink>
            </span>
            <span className="teammates__detail">
              {matesLabel(g.mates)}
              <span className="teammates__clubs">{clubsLabel(g.clubs)}</span>
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="teammates__more">
          +{hidden} more former {hidden === 1 ? 'teammate' : 'teammates'}
        </p>
      )}
    </section>
  )
}

// "with SURNAME, SURNAME" — or "with N teammates" once the list would run long
// (the recently-traded case). Surnames only, so the row stays scannable.
function matesLabel(mates) {
  const surnames = mates.map((m) => surnameOf(m.name))
  if (surnames.length <= MATES_INLINE) {
    return `with ${surnames.join(', ')}`
  }
  return `with ${surnames.length} teammates`
}

// "Nashville Sounds (AAA) ’22–’23 · Biloxi Shuckers (AA) ’21" — the soft label,
// deliberately vague on simultaneity (a shared roster-year, not proof both were
// there the same day). Only the top two clubs, to keep the caption to a line.
function clubsLabel(clubs) {
  return clubs
    .slice(0, 2)
    .map((c) => {
      const yrs = seasonRange(c.seasons)
      const lvl = c.level ? ` (${c.level})` : ''
      return `${c.teamName}${lvl} ${yrs}`
    })
    .join(' · ')
}

function surnameOf(name) {
  const parts = String(name || '').trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : name || ''
}

// [2022, 2023] -> "’22–’23"; [2021] -> "’21". Non-contiguous years still read as
// a min–max span (good enough for a caption).
function seasonRange(seasons) {
  const ys = [...(seasons ?? [])].sort((a, b) => a - b)
  if (ys.length === 0) return ''
  const yy = (y) => `’${String(y).slice(-2)}`
  return ys.length === 1 ? yy(ys[0]) : `${yy(ys[0])}–${yy(ys[ys.length - 1])}`
}

// The manager fill-in: surname-first name with the uniform number inked in
// seam red, like every lineup row. Null (→ the Fact's "—") until resolved.
function managerFact(manager) {
  if (!manager) return null
  return (
    <span className="fact__person">
      {manager.lastFirst.toUpperCase()}
      {manager.jersey ? (
        <span className="fact__jersey">{manager.jersey}</span>
      ) : null}
      {manager.interim ? <span className="fact__note">interim</span> : null}
    </span>
  )
}

// Same pill button/markup as the innings viewer's Refresh — reused here and
// in the box score so every game page has one, not just the live innings.
// `onReload` is undefined only for the (unused) case a caller skips it, so
// this degrades to nothing rather than a dead button.
export function RefreshButton({ onReload, loading }) {
  if (!onReload) return null
  return (
    <button
      type="button"
      className="refreshbtn"
      onClick={onReload}
      disabled={loading}
      aria-label="Refresh live game data"
    >
      <span className="refreshbtn__icon" aria-hidden="true">
        ↻
      </span>
      {loading ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value || <span className="fact__na">—</span>}</dd>
    </div>
  )
}
