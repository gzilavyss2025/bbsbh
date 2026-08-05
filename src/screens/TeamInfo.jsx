import { useEffect, useMemo, useState } from 'react'
import {
  selectLineup,
  selectBullpen,
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
import { hasWhatsBrewing, whatsBrewingTitle } from '../api/whatsBrewingClubs.js'
import { WhatsBrewingModal } from '../components/WhatsBrewingModal.jsx'
import { BallparkModal } from '../components/BallparkModal.jsx'
import { ballparkFor } from '../lib/ballparkData.js'
import { POS_ORDER, rosterPitcherRole, isTwoWay } from '../api/person.js'
import { prospectBadge } from '../api/prospects.js'
import { showRookiePill, hasDebuted } from '../api/rookies.js'
import { formerTeammatePairs, groupTeammateCards, orgTiesFor } from '../api/formerTeammates.js'
import {
  careerMatchupsFor,
  sortByPitcher,
  groupByPitcher,
  matchupLine,
} from '../api/careerMatchups.js'
import { splitDisplayName } from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { scorebookDate, monthDay, timeOfDay } from '../lib/dates.js'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { UmpireLink } from '../components/UmpireLink.jsx'
import { ManagerLink } from '../components/ManagerLink.jsx'
import { UmpireAccuracyModal } from '../components/UmpireAccuracyModal.jsx'
import { UmpireTierGlyph } from '../components/badges/UmpireTierGlyph.jsx'
import { umpireAccuracySummary } from '../api/umpires.js'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { ProspectPill } from '../components/badges/ProspectPill.jsx'
import { MilestonePill } from '../components/badges/MilestonePill.jsx'
import { RookiePill } from '../components/badges/RookiePill.jsx'
import { DebutPill } from '../components/badges/DebutPill.jsx'
import { RadarPill } from '../components/badges/RadarPill.jsx'
import { milestoneTextFor } from '../api/callouts.js'
import { radarEntryFor } from '../api/feverRadar.js'
import { savantPercentilesFor, qualifiedCount } from '../api/savantPercentiles.js'
import { pitchArsenalFor } from '../api/pitchArsenal.js'
import { PitchArsenalMix } from '../components/charts/PitchArsenalMix.jsx'
import { LineupStrengthCard } from '../components/LineupStrengthCard.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { BullpenBoard } from '../components/BullpenBoard.jsx'
import { SeasonSeriesStrip } from '../components/SeasonSeriesStrip.jsx'
import { SPORT_LABEL } from '../lib/teams.js'
import { headerThemeFor, headerThemeStyle, headerThemeClass, themeKeyFor } from '../lib/headerTheme.js'

// Away/home info + lineup page — the staging page you copy the scorebook
// header from, so facts run in the sheet's order (date, park, first pitch,
// weather, attendance, manager, umpires) and every person outside the
// opposing-defense diamond is penciled surname-first with a uniform number.
// Nothing here is score-revealing, so it renders openly. The game masthead
// (see GameView) carries the main away@home logo pairing; the batting-order /
// opposing-starter / opposing-defense section headers below also carry a
// small club mark of their own, forced to solid white for the navy bar (see
// index.css's .metricbar__logo).
//
// THEMING (ADR-0030). This page dresses its club-name bar and its section
// mastheads in the header colors of the jersey that club is actually wearing
// tonight, so paging away -> home reads as two different clubs' sheets rather
// than the same navy twice. The whole mechanism is three CSS custom properties
// scoped to whichever subtree carries `.is-themed` — here that's `.teaminfo`;
// the box score's team cards (BoxScore.jsx) scope the same mechanism to each
// card instead. The innings viewer, where navy-and-kraft IS the seal
// metaphor, stays untouched because nothing there ever adds the class.
//
// The theme's only inputs are (teamId, treatment): identity, never state. See
// lib/headerTheme.js for the full invariant and why "tint the page by whoever's
// leading" is the version of this that would break the spoiler rule.

export function TeamInfo({
  feed,
  side,
  manager,
  uniform,
  treatment,
  oppTreatment,
  broadcast,
  scorebookWeather,
  scorebookWeatherLoading,
  oppPitcherLine,
  prospectsData,
  rookiesData,
  feverRadarData,
  savantPercentilesData,
  pitchArsenalData,
  formerTeammatesData,
  careerMatchupsData,
  workloadData,
  lineupValuesData,
  callouts,
  onNext,
  nextLabel,
  onReload,
  loading,
  lastUpdated,
}) {
  const oppSide = side === 'away' ? 'home' : 'away'
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const oppMeta = useMemo(() => selectTeamMeta(feed, oppSide), [feed, oppSide])
  const officials = useMemo(() => selectOfficials(feed), [feed])
  const info = useMemo(() => selectGameInfo(feed), [feed])
  // Null for a club with no curated triad, which leaves every bar below on the
  // app's default navy chrome — coverage is partial by design (ADR-0030).
  const theme = useMemo(
    () => headerThemeFor(meta.id, themeKeyFor(meta.id, side, treatment)),
    [meta.id, side, treatment],
  )
  // The Starting pitcher card shows the OTHER club's starter, so its own
  // masthead wears THAT club's jersey colors rather than this page's — see
  // OpposingStarterCard.
  const oppTheme = useMemo(
    () => headerThemeFor(oppMeta.id, themeKeyFor(oppMeta.id, oppSide, oppTreatment)),
    [oppMeta.id, oppSide, oppTreatment],
  )

  return (
    <div className={`teaminfo ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <div className="teaminfo__head">
        <h2 className="teaminfo__name">
          <TeamLink id={meta.id} className="teaminfo__namelink">
            {meta.name || 'Team'}
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

      <SeasonSeriesStrip
        viewingTeamId={meta.id}
        opponentId={oppMeta.id}
        officialDate={info.officialDate}
        sportId={meta.sportId}
        currentGamePk={feed?.gamePk}
      />

      <TeamSections
        feed={feed}
        side={side}
        oppTheme={oppTheme}
        oppPitcherLine={oppPitcherLine}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        feverRadarData={feverRadarData}
        savantPercentilesData={savantPercentilesData}
        pitchArsenalData={pitchArsenalData}
        formerTeammatesData={formerTeammatesData}
        careerMatchupsData={careerMatchupsData}
        workloadData={workloadData}
        lineupValuesData={lineupValuesData}
        callouts={callouts}
      />

      {/* Refresh rides the floating bar (stacked above the advance button), the
          same place the innings page keeps it — freed up by Game Notes taking
          its old spot in the team head. */}
      <div className="pagenav pagenav--innings">
        <RefreshButton
          onReload={onReload}
          loading={loading}
          lastUpdated={lastUpdated}
          className="refreshbtn--float"
        />
        <button className="btn btn--next" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

// The game-level fill-ins shared by both clubs, in the sheet's order.
// Broadcast rides in its own spot next to Uniform on this page (see TeamInfo)
// rather than in this shared list.
function GameFacts({ info, scorebookWeather, scorebookWeatherLoading }) {
  return (
    <>
      <Fact label="Date" value={scorebookDate(info.officialDate)} />
      <BallparkFact venue={info.venue} />
      {/* Scheduled start (posted the moment the game exists) until the box
          score's own "First pitch" info line posts once the game's under
          way — the actual time then overwrites the estimate in place, same
          cell, rather than adding a second fact. */}
      <Fact label="First pitch" value={info.firstPitch || info.scheduledTime} />
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
      <AttendanceFact venue={info.venue} attendance={info.attendance} />
    </>
  )
}

function Umpires({ officials }) {
  // Under tonight's plate ump: his season accuracy TIER (Elite/Good/Average/
  // Below Average — see api/umpires.js's tierForZ), as a tap glyph next to
  // his name (UmpireTierGlyph) that unfolds the tier tag + rank in place
  // before the full accuracy modal (zone map, accuracy %, tendency, last
  // five plate games) one tap further. Rides its own async load (keyed to
  // his id). It's a season aggregate of Final games only, so it can't leak
  // tonight's (unplayed) result; hidden for MiLB / umps with no data.
  const hpId = useMemo(() => officials.find((o) => o.role === 'HP')?.id ?? null, [officials])
  const { data: hpAccuracy } = useAsync(() => umpireAccuracySummary(hpId), [hpId])
  const [modalId, setModalId] = useState(null)

  if (officials.length === 0) return null
  // A six-man crew (All-Star Game / postseason, LF + RF added — see
  // selectOfficials) needs its own desktop/ipad layout: two rows of three
  // rather than the auto-fit grid's crowded row of four plus a stray row of
  // two (see .umps__list--six in index.css). Four-and-under crews keep the
  // existing auto-fit flow untouched.
  const sixMan = officials.length === 6
  return (
    <section className="umps">
      <h3 className="section__title">Umpires</h3>
      <ul className={`umps__list${sixMan ? ' umps__list--six' : ''}`}>
        {officials.map((o) => (
          <li key={o.role}>
            <span className="umps__role">{o.role}</span>
            <span className="umps__namerow">
              <UmpireLink id={o.id} className="umps__name">
                {o.name}
              </UmpireLink>
              {o.role === 'HP' && hpAccuracy?.tier && (
                <UmpireTierGlyph
                  tier={hpAccuracy.tier}
                  rank={hpAccuracy.rank}
                  total={hpAccuracy.total}
                  onFullBreakdown={() => setModalId(o.id)}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
      {modalId != null && <UmpireAccuracyModal id={modalId} onClose={() => setModalId(null)} />}
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
  const rows = (roster ?? []).map((r) => {
    // A two-way player (Ohtani-type) carries a single roster spot typed
    // 'Two-Way Player', not 'Pitcher' — treat him as a pitcher for the
    // starters/bullpen split (isTwoWay) without pulling him out of the
    // batters list below, so he lists in both, same as the team page.
    const twoWay = isTwoWay(r.person)
    return {
      id: r.person?.id,
      name: lastFirst(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
      isPitcher: r.position?.type === 'Pitcher',
      twoWay,
      role: r.position?.type === 'Pitcher' || twoWay ? rosterPitcherRole(r) : null,
    }
  })
  const batters = rows
    .filter((r) => !r.isPitcher)
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))
  const starters = rows
    .filter((r) => r.role === 'SP')
    .sort((a, b) => a.name.localeCompare(b.name))
  const bullpen = rows
    .filter((r) => (r.isPitcher || r.twoWay) && r.role !== 'SP')
    .sort((a, b) => a.name.localeCompare(b.name))
  return { batters, starters, bullpen }
}

// The ids of every player in TONIGHT's starting lineups, both clubs, plus both
// probable starting pitchers — used to pin/badge a former-teammate pair who are
// about to face each other for real, pitch by pitch, on the user's own
// scoresheet (see FormerTeammates). Under the universal DH a starting pitcher
// never has a battingOrder slot, so selectLineup alone would never catch him.
// Lineups + probable pitchers are both spoiler-free pregame, so this is safe
// outside any seal.
function startingIdsFor(feed) {
  const ids = new Set()
  for (const side of ['away', 'home']) {
    for (const p of selectLineup(feed, side)) ids.add(p.id)
    const pitcher = selectTeamMeta(feed, side).probablePitcher
    if (pitcher?.id) ids.add(pitcher.id)
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
  oppTheme,
  oppPitcherLine,
  prospectsData,
  rookiesData,
  feverRadarData,
  savantPercentilesData,
  pitchArsenalData,
  formerTeammatesData,
  careerMatchupsData,
  workloadData,
  lineupValuesData,
  callouts,
}) {
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const birthdayIds = useMemo(() => selectBirthdayIds(feed), [feed])
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  // Debut pills are only informative on a MiLB roster, where most players
  // HAVEN'T debuted — on an MLB roster it's true of nearly every name and
  // adds nothing.
  const isMlb = (meta.sportId ?? 1) === 1
  const oppMeta = useMemo(
    () => selectTeamMeta(feed, side === 'away' ? 'home' : 'away'),
    [feed, side],
  )
  const season = feed?.gameData?.game?.season
  const oppPitcher = useMemo(() => selectOpposingPitcher(feed, side), [feed, side])
  // The opposing starter's season pitch-type mix (see api/pitchArsenal.js) —
  // MLB + AAA only; a lower-level starter's lookup just resolves to null,
  // same graceful degradation as everywhere else.
  const oppArsenal = useMemo(
    () => pitchArsenalFor(pitchArsenalData, oppPitcher?.id, isMlb),
    [pitchArsenalData, oppPitcher?.id, isMlb],
  )
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])
  const bullpenArms = useMemo(() => selectBullpen(feed, side), [feed, side])
  // The availability board describes "now" (the nightly workload file's
  // asOf); on an archival game its rested/tired flags would be about the
  // wrong day entirely, so it only renders when this game sits within a few
  // days of the file's own cutoff.
  const boardGameDate = useMemo(() => {
    const d = feed?.gameData?.datetime?.officialDate ?? null
    const asOf = workloadData?.asOf ?? null
    if (!d || !asOf) return null
    const diff = Math.abs(new Date(`${d}T00:00:00Z`) - new Date(`${asOf}T00:00:00Z`))
    return diff <= 3 * 86400000 ? d : null
  }, [feed, workloadData])
  // Same freshness rule for the lineup grade: the nightly values file
  // describes the CURRENT roster, so grading an archival game's posted nine
  // against today's values would be stale nonsense — hide it there.
  const freshLineupValues = useMemo(() => {
    const d = feed?.gameData?.datetime?.officialDate ?? null
    const asOf = (lineupValuesData?.asOf ?? '').slice(0, 10) || null
    if (!d || !asOf) return null
    const diff = Math.abs(new Date(`${d}T00:00:00Z`) - new Date(`${asOf}T00:00:00Z`))
    return diff <= 3 * 86400000 ? lineupValuesData : null
  }, [feed, lineupValuesData])

  // Ties between this matchup's two clubs — see formerTeammatePairs. Empty
  // for MiLB games / matchups outside the nightly build, which hides the card.
  const teammatePairs = useMemo(
    () => formerTeammatePairs(formerTeammatesData, meta.id, oppMeta.id),
    [formerTeammatesData, meta.id, oppMeta.id],
  )
  // orgTies — same fallback, only populated when teammatePairs comes up empty
  // for this matchup.
  const orgTies = useMemo(
    () => orgTiesFor(formerTeammatesData, meta.id, oppMeta.id),
    [formerTeammatesData, meta.id, oppMeta.id],
  )
  const startingIds = useMemo(() => startingIdsFor(feed), [feed])
  // Same once-per-matchup skip as teammatePairs above — see careerMatchupsFor.
  const matchupPairs = useMemo(
    () => careerMatchupsFor(careerMatchupsData, meta.id, oppMeta.id),
    [careerMatchupsData, meta.id, oppMeta.id],
  )
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const dayNight = info.dayNight

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
      <OpposingStarterCard
        pitcher={oppPitcher}
        pitcherLine={oppPitcherLine}
        teamId={oppMeta.id}
        teamName={oppMeta.teamName}
        theme={oppTheme}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        callouts={callouts}
        isMlb={isMlb}
        arsenal={oppArsenal}
      />

      {/* Wide screens run the batting order and defense diamond side by side
          rather than 50/50 — the order's the meat of the page, the diamond is
          a small square (see .teaminfo__lineupdefense's 3fr/2fr split). */}
      <div className="teaminfo__lineupdefense">
        <section className="lineup">
          <SectionMasthead
            as="h3"
            title="Batting order"
            logo={
              <TeamLogo
                teamId={meta.id}
                name={meta.teamName}
                size={22}
                variant="mono"
                className="metricbar__logo"
              />
            }
          />
          {lineup.length > 0 ? (
            <ol className="lineup__list">
              {lineup.map((p) => (
                <li key={p.id} className="lineup__row">
                  <span className="lineup__order">{p.order}</span>
                  <span className="lineup__namewrap">
                    <PlayerLink id={p.id} className="lineup__name">
                      {p.nameLastFirst}
                    </PlayerLink>
                    <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                    <MilestonePill text={milestoneTextFor(callouts, p.id)} />
                    <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                    <DebutPill debuted={!isMlb && hasDebuted(rookiesData, p.id)} />
                    <RadarPill
                      entry={radarEntryFor(feverRadarData, p.id)}
                      teamId={meta.id}
                      evPercentile={savantPercentilesFor(savantPercentilesData, p.id, 'batting')?.ev ?? null}
                      evLeagueSize={qualifiedCount(savantPercentilesData, 'batting')}
                    />
                    <BirthdayCake show={birthdayIds.has(p.id)} />
                  </span>
                  <span className="lineup__jersey">{p.jersey || ''}</span>
                  <span className="lineup__pos">{p.position}</span>
                </li>
              ))}
            </ol>
          ) : roster.batters.length > 0 || roster.starters.length > 0 || roster.bullpen.length > 0 ? (
            <>
              <p className="roster__notice">
                Not final{info.scheduledTime ? ` — posts close to first pitch (${info.scheduledTime})` : ' yet'}
              </p>
              <div className="roster">
                {roster.batters.length > 0 && (
                  <>
                    <h4 className="roster__group">Batters</h4>
                    <ul className="roster__list">
                      {roster.batters.map((p) => (
                        <li key={p.id} className="roster__row">
                          <span className="roster__namewrap">
                            <PlayerLink id={p.id} className="roster__name">
                              {p.name}
                            </PlayerLink>
                            <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                            <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                            <DebutPill debuted={!isMlb && hasDebuted(rookiesData, p.id)} />
                            <RadarPill
                              entry={radarEntryFor(feverRadarData, p.id)}
                              teamId={meta.id}
                              evPercentile={savantPercentilesFor(savantPercentilesData, p.id, 'batting')?.ev ?? null}
                              evLeagueSize={qualifiedCount(savantPercentilesData, 'batting')}
                            />
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
                              {p.name}
                            </PlayerLink>
                            <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                            <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                            <DebutPill debuted={!isMlb && hasDebuted(rookiesData, p.id)} />
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
                              {p.name}
                            </PlayerLink>
                            <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                            <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                            <DebutPill debuted={!isMlb && hasDebuted(rookiesData, p.id)} />
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
            <p className="roster__notice">
              Not final{info.scheduledTime ? ` — posts close to first pitch (${info.scheduledTime})` : ' yet'}
            </p>
          )}
        </section>

        {oppDefense.length > 0 && (
          <section
            className={`opp ${headerThemeClass(oppTheme)}`.trim()}
            style={headerThemeStyle(oppTheme)}
          >
            <SectionMasthead
              as="h3"
              title="Defense"
              logo={
                <TeamLogo
                  teamId={oppMeta.id}
                  name={oppMeta.teamName}
                  size={22}
                  variant="mono"
                  className="metricbar__logo"
                />
              }
            />
            {/* Drawn like the sheet's bottom-left diamond: surnames on writing
                lines at their positions. The defense belongs to the OTHER side,
                so — same as the Starting pitcher card above — its masthead
                wears THAT club's jersey colors (oppTheme) rather than this
                page's own. */}
            <DefenseDiamond defense={oppDefense} />
          </section>
        )}
      </div>

      <LineupStrengthCard data={freshLineupValues} teamId={meta.id} lineup={lineup} />

      <BullpenBoard
        workload={workloadData}
        bullpen={bullpenArms}
        gameDate={boardGameDate}
      />

      <FormerTeammates
        pairs={teammatePairs}
        startingIds={startingIds}
        dayNight={dayNight}
        awayTeamId={side === 'away' ? meta.id : oppMeta.id}
        homeTeamId={side === 'away' ? oppMeta.id : meta.id}
      />
      <OrgTies ties={orgTies} />
      <CareerMatchups
        pairs={matchupPairs}
        startingIds={startingIds}
        teamA={{ id: meta.id, name: meta.teamName }}
        teamB={{ id: oppMeta.id, name: oppMeta.teamName }}
        levelLabel={SPORT_LABEL[meta.sportId] ?? 'MLB'}
      />
    </>
  )
}

// The starter this club's lineup is about to face, staged as its own
// headshot card ahead of the batting order — the single most useful thing on
// the page before the lineup posts, so it leads rather than waiting behind
// the roster fallback. Same underlying data the old plain-text "Opposing
// pitcher" row used (selectOpposingPitcher + the season line fetched
// alongside it); this replaces that row rather than duplicating it.
function OpposingStarterCard({
  pitcher,
  pitcherLine,
  teamId,
  teamName,
  theme,
  prospectsData,
  rookiesData,
  callouts,
  isMlb,
  arsenal,
}) {
  return (
    <section
      className={`startercard ${headerThemeClass(theme)}`.trim()}
      style={headerThemeStyle(theme)}
    >
      <SectionMasthead
        as="h3"
        title="Starting pitcher"
        logo={
          <TeamLogo
            teamId={teamId}
            name={teamName}
            size={22}
            variant="mono"
            className="metricbar__logo"
          />
        }
      />
      {pitcher ? (
        <div className="startercard__body">
          <Headshot
            personId={pitcher.id}
            name={pitcher.name}
            teamId={teamId}
            className="startercard__shot"
          />
          <div className="startercard__info">
            <span className="startercard__namewrap">
              <PlayerLink id={pitcher.id} className="startercard__name">
                {pitcher.nameLastFirst}
              </PlayerLink>
              <ProspectPill {...prospectBadge(prospectsData, pitcher.id)} />
              <MilestonePill text={milestoneTextFor(callouts, pitcher.id)} />
              <RookiePill active={showRookiePill(rookiesData, pitcher.id, isMlb)} />
              <DebutPill debuted={!isMlb && hasDebuted(rookiesData, pitcher.id)} />
            </span>
            <span className="startercard__badges">
              {pitcher.jersey && <span className="startercard__jersey">{pitcher.jersey}</span>}
              {pitcher.hand && <span className="startercard__hand">{pitcher.hand}HP</span>}
            </span>
            {/* Season line (aggregates only, never this game's) — the numbers
                you pencil next to the starter while staging. */}
            {pitcherLine && (
              <span className="startercard__stats">
                {[
                  pitcherLine.era && `${pitcherLine.era} ERA`,
                  pitcherLine.wins != null && `${pitcherLine.wins}-${pitcherLine.losses}`,
                  pitcherLine.strikeOuts != null && `${pitcherLine.strikeOuts} K`,
                  pitcherLine.inningsPitched && `${pitcherLine.inningsPitched} IP`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            {/* His most recent appearance, whatever level it came at (see
                fetchPitcherLastGame) — an already-final box line from a past
                game, so it's staging-safe the same way the season line above
                is; never this game's. */}
            {pitcherLine?.lastGame && (
              <span className="startercard__last">{lastGameLine(pitcherLine.lastGame)}</span>
            )}
          </div>
          {/* Fills the wide layout's open right half (see .startercard__arsenal
              in index.css) — hidden below the wide breakpoint, where there's
              no room for it next to the headshot + info column. */}
          {arsenal && <PitchArsenalMix arsenal={arsenal} className="startercard__arsenal" />}
        </div>
      ) : (
        <p className="hint">Not posted yet.</p>
      )}
    </section>
  )
}

// "LAST: 7/12 AT BOS (AAA) — 6.0 IP · 5 H · 2 ER · 6 K" — the compact line
// under .startercard__last's dotted divider (see fetchPitcherLastGame).
function lastGameLine(g) {
  const md = monthDay(g.date)
  const where = g.opponent ? `${g.home ? 'vs' : '@'} ${g.opponent}${g.level ? ` (${g.level})` : ''}` : ''
  const stat = [
    g.inningsPitched && `${g.inningsPitched} IP`,
    `${g.hits} H`,
    `${g.earnedRuns} ER`,
    `${g.strikeOuts} K`,
    `${g.baseOnBalls} BB`,
  ]
    .filter(Boolean)
    .join(', ')
  return `${[md, where].filter(Boolean).join(' ')}: ${stat}`
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
    <section className="metriccard teammates">
      <SectionMasthead as="h3" title="Former teammates" />
      <div className="metriccard__body">
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
      </div>
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

const MATCHUPS_SHOWN = 6

// Every batter/pitcher pair on the two clubs with real career plate-
// appearance history against each other, at ANY level either has played (see
// careerMatchupsFor) — the "Contreras is 0-for-3 vs. tonight's starter"
// scorebook fact, but not limited to just the probable starter, and not
// limited to history made at tonight's own level: a AA lineup card still
// shows a pair who last faced off in A+. A plain stat table rather than
// FormerTeammates' headshot cards — this is a line off the stat sheet, not a
// story about two people's careers crossing. Hidden when there's no history.
//
// `pairs` mixes both directions (teamA batting vs teamB pitching, and vice
// versa — see careerMatchupsFor's header); this splits it into the two real
// baseball facts a reader actually wants ("how has THIS lineup done against
// THAT pitching staff") rather than one interleaved list. `startingIds` (see
// startingIdsFor) is the same set FormerTeammates uses for its "starting
// tonight" badge — here it drives a soft row highlight for a pair that's
// tonight's actual batter vs. the opposing actual starter, the highest-value
// row on the table.
function CareerMatchups({ pairs, startingIds, teamA, teamB, levelLabel }) {
  const tableA = useMemo(
    () => sortByPitcher((pairs ?? []).filter((r) => r.batter.teamId === teamA?.id)),
    [pairs, teamA?.id],
  )
  const tableB = useMemo(
    () => sortByPitcher((pairs ?? []).filter((r) => r.batter.teamId === teamB?.id)),
    [pairs, teamB?.id],
  )
  if (tableA.length === 0 && tableB.length === 0) return null
  return (
    <section className="metriccard matchups">
      <SectionMasthead as="h3" title="Career matchups" />
      <div className="metriccard__body">
        <MatchupTable
          title={`${teamA?.name || 'Team'} batters vs ${teamB?.name || 'team'} pitchers`}
          rows={tableA}
          startingIds={startingIds}
          levelLabel={levelLabel}
        />
        <MatchupTable
          title={`${teamB?.name || 'Team'} batters vs ${teamA?.name || 'team'} pitchers`}
          rows={tableB}
          startingIds={startingIds}
          levelLabel={levelLabel}
        />
      </div>
    </section>
  )
}

// One direction's list (e.g. "Braves batters vs Padres pitchers") — rows
// already grouped by pitcher (sortByPitcher), then collapsed one heading per
// pitcher (groupByPitcher) so his name isn't repeated down every row. That
// repetition is what forced a three-column "batter / pitcher / line" table
// too wide for a phone (the reported horizontal-swipe bug); a pitcher heading
// over two-part batter→line rows fits any width with no scroll, and reads
// cleaner on desktop too. Each list shows/hides independently since one
// direction commonly has far more real history than the other (a club's
// long-tenured regulars vs. a just-called-up opener). Slice by MATCHUP (row)
// count first so "Show N more" still counts matchups, then group the slice.
function MatchupTable({ title, rows, startingIds, levelLabel }) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) return null
  const shown = showAll ? rows : rows.slice(0, MATCHUPS_SHOWN)
  const hidden = rows.length - shown.length
  const groups = groupByPitcher(shown)
  return (
    <div className="matchuptable">
      <h4 className="matchuptable__title">{title}</h4>
      <div className="matchuplist">
        {groups.map((g) => {
          const pitcherStarting = startingIds?.has(g.pitcher.id)
          return (
            <div className="matchupgroup" key={g.pitcher.id}>
              <p className="matchupgroup__pitcher">
                <span className="matchupgroup__vs">vs</span>{' '}
                <PlayerLink id={g.pitcher.id}>{g.pitcher.name}</PlayerLink>
              </p>
              <ul className="matchupgroup__rows">
                {g.rows.map((r) => {
                  const tonight = pitcherStarting && startingIds?.has(r.batter.id)
                  return (
                    <li
                      key={r.batter.id}
                      className={
                        tonight
                          ? 'matchupgroup__row matchupgroup__row--tonight'
                          : 'matchupgroup__row'
                      }
                    >
                      <PlayerLink id={r.batter.id} className="matchupgroup__batter">
                        {r.batter.name}
                      </PlayerLink>
                      <span className="matchupgroup__line">{matchupLine(r, levelLabel)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      {hidden > 0 && (
        <button type="button" className="teammates__more" onClick={() => setShowAll(true)}>
          Show {hidden} more matchup{hidden === 1 ? '' : 's'}
        </button>
      )}
    </div>
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
        {first && <span className="teammatecard__name-first">{first}</span>}
        <span className="teammatecard__name-last">{last}</span>
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

  // Calibrated clubs (see whatsBrewing.js's CONFIG): tap opens the What's Brewing
  // modal (the parsed narrative blurbs) with the full PDF linked inside it. Every
  // other club: the plain link-out to the PDF in a new tab. Both read "Game
  // Notes"; the arrow distinguishes the in-app modal (›) from the external-PDF
  // jump (↗).
  if (hasWhatsBrewing(meta.id)) {
    return (
      <>
        <button
          className="notesbtn"
          onClick={() => setShowBrewing(true)}
          title={`${notes.title} — the club's game notes`}
        >
          Game Notes
          <span className="notesbtn__ext" aria-hidden="true">›</span>
        </button>
        {showBrewing && (
          <WhatsBrewingModal
            notes={notes}
            teamId={meta.id}
            title={whatsBrewingTitle(meta.id)}
            onClose={() => setShowBrewing(false)}
          />
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
// Linked to his manager page once fetchManager resolves a personId (older
// cached data / a fetch that raced ahead of that field lands here without
// one — ManagerLink degrades to plain text rather than a dead link).
function managerFact(manager) {
  if (!manager) return null
  return (
    <ManagerLink id={manager.personId} className="fact__person">
      {manager.lastFirst}
      {manager.jersey ? (
        <span className="fact__jersey">{manager.jersey}</span>
      ) : null}
      {manager.interim ? <span className="fact__note">interim</span> : null}
    </ManagerLink>
  )
}

// Same pill button/markup as the innings viewer's Refresh — reused here and
// in the box score so every game page has one, not just the live innings.
// `onReload` is undefined only for the (unused) case a caller skips it, so
// this degrades to nothing rather than a dead button. `lastUpdated`
// (useAsync's epoch-ms field, threaded down from GameView's feedState) shows
// a small "as of 7:42 PM" caption so a congested-wifi refresh failure or the
// new auto-refresh poll (useGameData's FEED_POLL_MS) both stay legible —
// you can tell how fresh what's on screen actually is without guessing.
export function RefreshButton({ onReload, loading, lastUpdated, className = '' }) {
  if (!onReload) return null
  return (
    <>
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
      {lastUpdated && !loading && (
        <span className="refreshstamp">as of {timeOfDay(lastUpdated)}</span>
      )}
    </>
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

// The kraft "i" info glyph itself, drawn as an SVG dot-over-bar rather than a
// literal "i" character — the global ALL-CAPS invariant forces all rendered
// text uppercase (see index.css / check-caps.mjs), which would flatten a
// literal letter into a capital I, so a vector shape is the same move
// UmpireTierGlyph's home-plate icon already makes. Exported so the box
// score's own Attendance field (BoxScore.jsx) can reuse the same glyph.
export function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" width="10" height="10" aria-hidden="true">
      <circle cx="10" cy="5.5" r="1.8" fill="currentColor" />
      <rect x="8.2" y="9" width="3.6" height="8" rx="1.2" fill="currentColor" />
    </svg>
  )
}

// The Attendance fact. When the park's capacity is on file (the 30 MLB
// parks — see ballparkData.js) and tonight's attendance parses to a number, a
// kraft "i" glyph sits next to the figure and unfolds a small note with the
// percent full + the park's capacity — same tap-glyph-unfolds-in-place idiom
// as the Umpires card's tier glyph (UmpireTierGlyph), just without a further
// "full breakdown" modal since there's nothing more to show. MiLB parks and
// any venue not on file, or an attendance value that won't parse, degrade to
// the plain read-only Fact, per the app's graceful-degradation rule.
function AttendanceFact({ venue, attendance }) {
  const [open, setOpen] = useState(false)
  const park = ballparkFor(venue)
  const count = attendance ? Number(attendance.replace(/,/g, '')) : null
  const pctFull = park?.capacity && count ? Math.round((count / park.capacity) * 100) : null

  if (!pctFull) return <Fact label="Attendance" value={attendance} />

  return (
    <div className="fact">
      <dt className="fact__label">Attendance</dt>
      <dd className="fact__value attendance__value">
        {attendance}
        <button
          type="button"
          className={`attendance__glyph${open ? ' attendance__glyph--open' : ''}`}
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          aria-label="How full is the stadium"
        >
          <InfoIcon />
        </button>
      </dd>
      {open && (
        <p className="attendance__note">
          <span className="attendance__note-pct">{pctFull}% full</span>
          <span className="attendance__note-cap">{park.capacity.toLocaleString()} capacity</span>
        </p>
      )}
    </div>
  )
}

// The Ballpark fact. When we have the park on file (the 30 MLB parks — see
// ballparkData.js), the venue name becomes a button that opens the to-scale
// field diagram + league-ranked dimensions. MiLB parks and any venue not on file
// degrade to the plain read-only Fact, per the app's graceful-degradation rule.
function BallparkFact({ venue }) {
  const [open, setOpen] = useState(false)
  if (!ballparkFor(venue)) return <Fact label="Ballpark" value={venue} />
  return (
    <div className="fact">
      <dt className="fact__label">Ballpark</dt>
      <dd className="fact__value">
        <button className="fact__link" onClick={() => setOpen(true)}>
          {venue}
        </button>
      </dd>
      {open && <BallparkModal venue={venue} onClose={() => setOpen(false)} />}
    </div>
  )
}
