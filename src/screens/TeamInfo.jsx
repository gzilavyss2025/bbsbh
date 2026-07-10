import { useEffect, useMemo, useState } from 'react'
import {
  selectLineup,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
  selectOpposingPitcher,
  selectOpposingDefense,
  selectBirthdayIds,
  lastFirst,
} from '../api/select.js'
import { fetchTeamRoster } from '../api/team.js'
import { resolveGameNotes } from '../api/gameNotes.js'
import { BREWERS_ID } from '../api/whatsBrewing.js'
import { WhatsBrewingModal } from '../components/WhatsBrewingModal.jsx'
import { POS_ORDER, rosterPitcherRole } from '../api/person.js'
import { prospectBadge } from '../api/prospects.js'
import { formerTeammatePairs, groupTeammateCards, orgTiesFor } from '../api/formerTeammates.js'
import { splitDisplayName } from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { scorebookDate } from '../lib/dates.js'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { UmpireLink } from '../components/UmpireLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
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
  broadcast,
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
          <GameNotesButton feed={feed} side={side} />
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
        {/* Broadcast rides on the away page only, filling the cell that
            otherwise sits empty next to Uniform (an odd fact count leaves it
            alone at the end of the grid — see the ESPN-sourced fetch in
            GameView). The home page's grid is already even without it. */}
        {side === 'away' && <Fact label="Broadcast" value={broadcast} />}
      </dl>

      <Umpires officials={officials} />

      <TeamSections
        feed={feed}
        side={side}
        oppPitcherLine={oppPitcherLine}
        prospectsData={prospectsData}
        formerTeammatesData={formerTeammatesData}
      />

      {/* Refresh rides the floating bar (stacked above the advance button), the
          same place the innings page keeps it — freed up by Game Notes taking
          its old spot in the team head. */}
      <div className="pagenav pagenav--innings">
        <RefreshButton onReload={onReload} loading={loading} className="refreshbtn--float" />
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
  broadcast,
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
  const awayMeta = useMemo(() => selectTeamMeta(feed, 'away'), [feed])
  const homeMeta = useMemo(() => selectTeamMeta(feed, 'home'), [feed])
  // One shared, order-independent list for the whole matchup — each side's
  // column would otherwise show the same ties twice, once from each club's
  // point of view (see formerTeammatePairs).
  const teammatePairs = useMemo(
    () => formerTeammatePairs(formerTeammatesData, awayMeta.id, homeMeta.id),
    [formerTeammatesData, awayMeta.id, homeMeta.id],
  )
  // The ORG TIES fallback — only ever populated when teammatePairs above came
  // up empty for this matchup (see orgTiesFor / scripts/gen-former-teammates.mjs).
  const orgTies = useMemo(
    () => orgTiesFor(formerTeammatesData, awayMeta.id, homeMeta.id),
    [formerTeammatesData, awayMeta.id, homeMeta.id],
  )
  const startingIds = useMemo(() => startingIdsFor(feed), [feed])

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
          broadcast={broadcast}
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
          />
        ))}
      </div>

      <FormerTeammates
        pairs={teammatePairs}
        startingIds={startingIds}
        dayNight={info.dayNight}
        awayTeamId={awayMeta.id}
        homeTeamId={homeMeta.id}
      />
      <OrgTies ties={orgTies} />

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
// Former teammates is deliberately NOT part of this column — see LineupSpread,
// which renders one shared, full-width card grid below both columns instead.
function TeamPanel({ feed, side, manager, uniform, oppPitcherLine, prospectsData }) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  return (
    <section className="teampanel">
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">
          <TeamLink id={meta.id} className="teaminfo__namelink">
            {(meta.name || 'Team').toUpperCase()}
          </TeamLink>
        </h2>
        <div className="teaminfo__headright">
          <GameNotesButton feed={feed} side={side} />
          <span className="teaminfo__side">{side === 'away' ? 'Away' : 'Home'}</span>
        </div>
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
        showTeammates={false}
      />
    </section>
  )
}

// The game-level fill-ins shared by both clubs, in the sheet's order.
// `broadcast` is only passed by the wide spread layout (see LineupSpread) —
// on the phone page it rides in its own spot next to Uniform instead (see
// TeamInfo), so it's left out of this shared list there.
function GameFacts({ info, scorebookWeather, scorebookWeatherLoading, broadcast }) {
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
      {/* TV/streaming network (see api/broadcast.js, ESPN-sourced). Its
          presence right after Attendance also keeps the fact count a multiple
          of three in the common case, so Attendance no longer stretches
          across two grid cells the way it did as the list's odd one out. */}
      {broadcast !== undefined && <Fact label="Broadcast" value={broadcast} />}
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
            <UmpireLink id={o.id} className="umps__name">
              {o.name}
            </UmpireLink>
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

// The ids of every player in TONIGHT's starting lineups, both clubs — used to
// pin/badge a former-teammate pair who are about to face each other for real,
// pitch by pitch, on the user's own scoresheet (see FormerTeammates). Lineups
// are spoiler-free pregame, so this is safe outside any seal.
function startingIdsFor(feed) {
  const ids = new Set()
  for (const side of ['away', 'home']) {
    for (const p of selectLineup(feed, side)) ids.add(p.id)
  }
  return ids
}

// A birthday cake next to a player's name on the staging sheet when today's
// game falls on his birthday (see selectBirthdayIds) — sits in the same spot an
// all-star star would, a small non-score flourish. `show` is his membership in
// the game's birthday set; renders nothing otherwise.
function BirthdayCake({ show }) {
  if (!show) return null
  return (
    <span className="name-cake" role="img" aria-label="Birthday today" title="Birthday today">
      🎂
    </span>
  )
}

// The team-specific body shared by the phone page and the spread's panels:
// batting order, the opposing starter, and the opposing defense diamond.
function TeamSections({
  feed,
  side,
  oppPitcherLine,
  prospectsData,
  formerTeammatesData,
  showTeammates = true,
}) {
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const birthdayIds = useMemo(() => selectBirthdayIds(feed), [feed])
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const oppMeta = useMemo(
    () => selectTeamMeta(feed, side === 'away' ? 'home' : 'away'),
    [feed, side],
  )
  const season = feed?.gameData?.game?.season
  const oppPitcher = useMemo(() => selectOpposingPitcher(feed, side), [feed, side])
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])

  // Ties between this matchup's two clubs — see formerTeammatePairs. Skipped
  // entirely on the spread layout, which renders one shared copy itself
  // (`showTeammates={false}`); order-independent, so this and that shared copy
  // always agree. Empty for MiLB games / matchups outside the nightly build,
  // which hides the card.
  const teammatePairs = useMemo(
    () => (showTeammates ? formerTeammatePairs(formerTeammatesData, meta.id, oppMeta.id) : []),
    [showTeammates, formerTeammatesData, meta.id, oppMeta.id],
  )
  // See LineupSpread's orgTies — same fallback, only populated when
  // teammatePairs comes up empty for this matchup.
  const orgTies = useMemo(
    () => (showTeammates ? orgTiesFor(formerTeammatesData, meta.id, oppMeta.id) : []),
    [showTeammates, formerTeammatesData, meta.id, oppMeta.id],
  )
  const startingIds = useMemo(() => (showTeammates ? startingIdsFor(feed) : null), [
    showTeammates,
    feed,
  ])
  const dayNight = feed?.gameData?.datetime?.dayNight ?? ''

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
                  <BirthdayCake show={birthdayIds.has(p.id)} />
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
                          <BirthdayCake show={birthdayIds.has(p.id)} />
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
                          <BirthdayCake show={birthdayIds.has(p.id)} />
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
                          <BirthdayCake show={birthdayIds.has(p.id)} />
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

      {showTeammates && (
        <FormerTeammates
          pairs={teammatePairs}
          startingIds={startingIds}
          dayNight={dayNight}
          awayTeamId={side === 'away' ? meta.id : oppMeta.id}
          homeTeamId={side === 'away' ? oppMeta.id : meta.id}
        />
      )}
      {showTeammates && <OrgTies ties={orgTies} />}
    </>
  )
}

// Show only the first handful up front — a heavy shared history (two rosters
// that have swapped a lot of players) can run to dozens of cards — and let a
// button reveal the rest rather than dumping them all in the page's height.
const TEAMMATES_SHOWN = 5
// Cap the headshots inside one GROUP card (a big reunion can run to a dozen+
// spokes) so the tile stays a glance, not a scroll of its own.
const GROUP_MATES_SHOWN = 6

// Pins a pair/group whose players are BOTH in tonight's starting lineups above
// everything else, ranked score included — the connection is about to play
// out for real, pitch by pitch, on the user's own scoresheet, which is a
// better fact than anything the static score can express.
const TONIGHT_BOOST = 1000

function isCardTonight(card, startingIds) {
  if (!startingIds) return false
  if (card.kind === 'group') {
    return startingIds.has(card.anchor.id) && card.mates.some((m) => startingIds.has(m.id))
  }
  return startingIds.has(card.a.id) && startingIds.has(card.b.id)
}

// "MLB teammates, Marlins ’19–’21" — the one-line story under a card. The
// global ALL-CAPS rule (see index.css) renders it uppercase; write it in
// natural case here.
function connectionCaption(level, teamName, seasons) {
  const label = level === 'MLB' ? 'MLB teammates' : `${level} teammates`
  return `${label}, ${teamName} ${seasonRange(seasons)}`
}

// One card per pair of players — one from each club — who were once
// teammates, tiling 2–3 to a row depending on width, ranked by how
// interesting the connection is (see formerTeammatePairs' `score`). A real
// hub-and-spokes reunion (several of tonight's players who all crossed paths
// on one notable club) collapses into a single GROUP card instead of one
// repetitive pair card per opponent (see groupTeammateCards). Spoiler-free
// (rosters + team-season history carry no score), rendered openly like the
// opposing-pitcher line. Hidden when there are no ties. `pairs` is already
// order-independent and deduped (see formerTeammatePairs), so this same
// component reads correctly whether it's one club's page or the shared,
// full-width copy on the spread layout.
function FormerTeammates({ pairs, startingIds, dayNight, awayTeamId, homeTeamId }) {
  const [showAll, setShowAll] = useState(false)
  const cards = useMemo(() => {
    const grouped = groupTeammateCards(pairs).map((c) => ({
      ...c,
      tonight: isCardTonight(c, startingIds),
    }))
    return grouped.sort(
      (x, y) =>
        y.score + (y.tonight ? TONIGHT_BOOST : 0) - (x.score + (x.tonight ? TONIGHT_BOOST : 0)),
    )
  }, [pairs, startingIds])
  // `pairs` always runs (away player, home player) — see formerTeammatePairs'
  // header — so any id that ever shows up as an `a` belongs to the away club
  // and any `b` to the home club, regardless of which side's page is asking.
  // Feeds each headshot's solid team-color background (see TeammateHalf) so a
  // headshot always reads as "this is a Team A face" at a glance, not just on
  // a big reunion's wall of them.
  const sideTeamId = useMemo(() => {
    const awayIds = new Set(pairs.map((p) => p.a.id))
    return (id) => (awayIds.has(id) ? awayTeamId : homeTeamId)
  }, [pairs, awayTeamId, homeTeamId])
  if (cards.length === 0) return null
  const shown = showAll ? cards : cards.slice(0, TEAMMATES_SHOWN)
  const hidden = cards.length - shown.length
  const startingLabel = dayNight === 'day' ? 'Starting today' : 'Starting tonight'
  return (
    <section className="teammates">
      <h3 className="section__title">Former teammates</h3>
      {/* A CSS multi-column "waterfall" rather than a grid: a big reunion card
          can run much taller than a plain pair card, and a grid stretches
          every OTHER card in that row to match — the exact mess this avoids.
          Each card just flows into whichever column has room next, like a
          Pinterest/Twitter card wall, so one tall card never drags its
          row-mates' height with it. */}
      <ul className="teammates__grid">
        {shown.map((c) =>
          c.kind === 'group' ? (
            <GroupCard
              key={`g-${c.anchor.id}-${c.club.teamId}`}
              card={c}
              startingLabel={startingLabel}
              sideTeamId={sideTeamId}
            />
          ) : (
            <PairCard
              key={`${c.a.id}-${c.b.id}`}
              card={c}
              startingLabel={startingLabel}
              sideTeamId={sideTeamId}
            />
          ),
        )}
      </ul>
      {hidden > 0 && (
        <button type="button" className="teammates__more" onClick={() => setShowAll(true)}>
          Show {hidden} more former {hidden === 1 ? 'teammate' : 'teammates'}
        </button>
      )}
    </section>
  )
}

// A plain 1-vs-1 former-teammate card.
function PairCard({ card: c, startingLabel, sideTeamId }) {
  return (
    <li className="teammatecard">
      {c.tonight && <span className="teammatecard__badge">{startingLabel}</span>}
      <TeammateHalf id={c.a.id} name={c.a.name} pos={c.a.pos} teamId={sideTeamId(c.a.id)} />
      <div className="teammatecard__mid">
        <div className="teammatecard__logos">
          {c.clubs.slice(0, 2).map((club) => (
            <TeamLogo key={club.teamId} teamId={club.teamId} name={club.teamName} size={28} />
          ))}
        </div>
        <span className="teammatecard__years">{clubsYears(c.clubs)}</span>
      </div>
      <TeammateHalf id={c.b.id} name={c.b.name} pos={c.b.pos} teamId={sideTeamId(c.b.id)} />
      <span className="teammatecard__caption">
        {connectionCaption(c.clubs[0]?.level, c.clubs[0]?.teamName, c.clubs[0]?.seasons)}
      </span>
    </li>
  )
}

// A hub-and-spokes reunion card. Starts capped to GROUP_MATES_SHOWN spokes
// with a "+N more teammates" button (a big reunion — see groupTeammateCards —
// can run well past a dozen) that reveals the rest of the headshots in place.
function GroupCard({ card: c, startingLabel, sideTeamId }) {
  const [expanded, setExpanded] = useState(false)
  const shownMates = expanded ? c.mates : c.mates.slice(0, GROUP_MATES_SHOWN)
  const moreCount = c.mates.length - shownMates.length
  return (
    <li className="teammatecard teammatecard--group">
      {c.tonight && <span className="teammatecard__badge">{startingLabel}</span>}
      {/* A reunion this size is exactly where a wall of headshots most needs
          the per-player club color (see TeammateHalf) — WHOSE roster each face
          is on tonight gets easy to lose track of past a couple of rows. */}
      <div className="teammatecard__group">
        <TeammateHalf
          id={c.anchor.id}
          name={c.anchor.name}
          pos={c.anchor.pos}
          teamId={sideTeamId(c.anchor.id)}
        />
        {shownMates.map((m) => (
          <TeammateHalf key={m.id} id={m.id} name={m.name} pos={m.pos} teamId={sideTeamId(m.id)} />
        ))}
      </div>
      <div className="teammatecard__mid">
        <TeamLogo teamId={c.club.teamId} name={c.club.teamName} size={32} />
        <span className="teammatecard__years">{seasonRange(c.seasons)}</span>
      </div>
      <span className="teammatecard__caption">
        {connectionCaption(c.club.level, c.club.teamName, c.seasons)}
      </span>
      {moreCount > 0 && (
        <button
          type="button"
          className="teammatecard__groupmore"
          onClick={() => setExpanded(true)}
        >
          +{moreCount} more {moreCount === 1 ? 'teammate' : 'teammates'}
        </button>
      )}
    </li>
  )
}

// "Milwaukee Brewers system — Biloxi Shuckers, AA ’19" — the one-line story
// under an org-tie card. Unlike connectionCaption (two players, one shared
// club) this is one player and the OPPONENT's org, so it leads with the org
// rather than a level label.
function orgTieCaption(t) {
  return `${t.orgName || 'Opponent'} system — ${t.teamName}, ${t.level} ${seasonRange(t.seasons)}`
}

// The ORG TIES fallback for a matchup with no literal former-teammate pairs
// (see orgTiesFor) — "this player has a history in the org tonight's opponent
// belongs to," even without ever sharing a roster with anyone playing
// tonight. Reuses the group card's single-column-of-headshots + shared-club
// layout (teammatecard--group) since it's the same shape (N headshots, one
// club to point at) with N pinned at 1. Hidden when there are no ties — which
// is the common case, since the generator only falls back to this when the
// real Former Teammates card came up empty.
function OrgTies({ ties }) {
  if (!ties || ties.length === 0) return null
  return (
    <section className="teammates">
      <h3 className="section__title">Org ties</h3>
      <p className="hint">No shared roster tonight — but these players have history in the other side&rsquo;s organization.</p>
      <ul className="teammates__grid">
        {ties.map((t) => (
          <li key={`${t.player.id}-${t.orgId}`} className="teammatecard teammatecard--group">
            <div className="teammatecard__group">
              <TeammateHalf
                id={t.player.id}
                name={t.player.name}
                pos={t.player.pos}
                teamId={t.rosterTeamId}
              />
            </div>
            <div className="teammatecard__mid">
              <TeamLogo teamId={t.orgId} name={t.orgName} size={32} />
              <span className="teammatecard__years">{seasonRange(t.seasons)}</span>
            </div>
            <span className="teammatecard__caption">{orgTieCaption(t)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// A pitcher's roster position is already the plain "P" abbreviation (no
// SP/RP split) at the source, but normalize defensively anyway — the badge
// should never show anything longer than that for a pitcher.
const posLabel = (pos) => (pos === 'SP' || pos === 'RP' ? 'P' : pos)

// One player's headshot over his two-line name (first name small, surname
// big) — the same treatment as the player page's hero, shrunk to fit a card —
// with his roster position as a small badge floating on the headshot's
// bottom-left corner.
function TeammateHalf({ id, name, pos, teamId }) {
  const { first, last } = splitDisplayName(name)
  return (
    <PlayerLink id={id} className="teammatecard__half">
      <span className="teammatecard__shotwrap">
        <Headshot personId={id} name={name} teamId={teamId} className="teammatecard__shot" />
        {pos && <span className="teammatecard__posbadge">{posLabel(pos)}</span>}
      </span>
      <span className="teammatecard__name">
        {first && <span className="teammatecard__name-first">{first.toUpperCase()}</span>}
        <span className="teammatecard__name-last">{last.toUpperCase()}</span>
      </span>
    </PlayerLink>
  )
}

// "’20–’25 · ’19" — one span per shown club, deliberately vague on
// simultaneity (a shared roster-year, not proof both were there the same day).
function clubsYears(clubs) {
  return clubs.slice(0, 2).map((c) => seasonRange(c.seasons)).join(' · ')
}

// [2022, 2023] -> "’22–’23"; [2021] -> "’21". Non-contiguous years still read as
// a min–max span (good enough for a caption).
function seasonRange(seasons) {
  const ys = [...(seasons ?? [])].sort((a, b) => a - b)
  if (ys.length === 0) return ''
  const yy = (y) => `’${String(y).slice(-2)}`
  return ys.length === 1 ? yy(ys[0]) : `${yy(ys[0])}–${yy(ys[ys.length - 1])}`
}

// A link out to this club's official pre-game press-notes PDF, sitting just
// under the team head on the lineup page (both the phone page and each spread
// panel). Resolves the freshest note for the game's date — live for the game
// being staged, from the committed archive for older, de-listed games (see
// api/gameNotes.js). MLB only, and hidden entirely when there's no note to link
// (every MiLB game, or a date the club never posted), so it degrades to nothing
// like the rest of the lineup surfaces. The PDF opens in a new tab: a deliberate
// jump to an external, spoiler-bearing press packet, not an in-app reveal.
// How often to re-check the live feed for a not-yet-posted note (see below).
const NOTES_POLL_MS = 5 * 60 * 1000
// Today's calendar date in America/New_York — the tz the game's officialDate and
// the notes' publish dates are both keyed to (see gameNotes.js).
const ET_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const etToday = () => ET_TODAY.format(new Date())

function GameNotesButton({ feed, side }) {
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const isMlb = (meta.sportId ?? 1) === 1
  const [showBrewing, setShowBrewing] = useState(false)
  const { data: notes, reload } = useAsync(
    () =>
      isMlb && meta.id ? resolveGameNotes(meta.id, info.officialDate) : Promise.resolve(null),
    [isMlb, meta.id, info.officialDate],
  )

  // Tonight's note doesn't post until the afternoon/evening ET — after the page
  // first loads — and the button stays hidden until it does (the gate only shows
  // a note actually written for THIS game; see gameNotes.js). So while we're on
  // the game's own day with no note yet, quietly re-poll the live feed every few
  // minutes: the button then appears on its own the moment the note drops,
  // without the user hunting for Refresh. Past games never gain a note, so they
  // don't poll; once a note is in hand the interval clears.
  const isGameDay = isMlb && !!info.officialDate && info.officialDate === etToday()
  useEffect(() => {
    if (!isGameDay || notes?.url) return
    const id = setInterval(reload, NOTES_POLL_MS)
    return () => clearInterval(id)
  }, [isGameDay, notes?.url, reload])

  if (!notes?.url) return null

  // Brewers: tap opens the What's Brewing modal (the parsed narrative blurbs)
  // with the full PDF linked inside it. Every other club: the plain link-out to
  // the PDF in a new tab — parsing is calibrated to the Brewers' template only
  // (see whatsBrewing.js). Both read "Game Notes"; the arrow distinguishes the
  // in-app modal (›) from the external-PDF jump (↗).
  if (meta.id === BREWERS_ID) {
    return (
      <>
        <button
          className="notesbtn"
          onClick={() => setShowBrewing(true)}
          title={`${notes.title} — the club's What's Brewing notes`}
        >
          Game Notes
          <span className="notesbtn__ext" aria-hidden="true">›</span>
        </button>
        {showBrewing && (
          <WhatsBrewingModal notes={notes} onClose={() => setShowBrewing(false)} />
        )}
      </>
    )
  }

  return (
    <a
      className="notesbtn"
      href={notes.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${notes.title} — the club's official press notes (PDF), opens in a new tab`}
    >
      Game Notes
      <span className="notesbtn__ext" aria-hidden="true">↗</span>
    </a>
  )
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
export function RefreshButton({ onReload, loading, className = '' }) {
  if (!onReload) return null
  return (
    <button
      type="button"
      className={`refreshbtn ${className}`.trim()}
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
