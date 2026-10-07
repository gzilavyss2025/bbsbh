import { useEffect, useMemo, useState } from 'react'
import {
  selectLineup,
  selectBullpen,
  selectTeamMeta,
  selectOfficials,
  selectGameInfo,
  selectGameSeason,
  selectOpposingPitcher,
  selectOpposingDefense,
  selectHasStarted,
  selectBirthdayIds,
  lastFirst,
} from '../api/select.js'
import { selectRecordIsClosed } from '../api/gamerecord/played.js'
import { fetchTeam, fetchTeamRoster } from '../api/team.js'
import { resolveGameNotes } from '../api/gameNotes.js'
import { BallparkModal } from '../components/ballpark/BallparkModal.jsx'
import { BoxLinesDoor } from '../components/boxlines/BoxLinesDoor.jsx'
import { ExpressLaneDoor } from '../components/game/ExpressLaneDoor.jsx'
import { ballparkFor } from '../lib/ballpark/ballparkData.js'
import { POS_ORDER } from '../api/person.js'
import { prospectBadge } from '../api/prospects.js'
import { showRookiePill, hasDebuted } from '../api/rookies.js'
import { formerTeammatePairs, orgTiesFor } from '../api/formerTeammates.js'
import { FormerTeammates, OrgTies } from '../components/team/FormerTeammates.jsx'
import { vsTeamDoorLabel } from '../api/vsTeamSplits.js'
import { starterMatchupsFor, splitMatchupRows } from '../api/careerMatchups.js'
import {
  useMatchupNotes,
  MatchupNotesToggle,
  MatchupNote,
  BenchMatchups,
} from '../components/teamstats/StarterMatchups.jsx'
import { splitDisplayName } from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { teamTabPath } from '../lib/route.js'
import { Door } from '../components/ui/control/Door.jsx'
import { Button } from '../components/ui/control/Button.jsx'
import { scorebookDate, monthDay, timeOfDay } from '../lib/dates.js'
import { DefenseDiamond } from '../components/scoring/DefenseDiamond.jsx'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { ManagerLink } from '../components/team/ManagerLink.jsx'
import { UmpiresCard } from '../components/umpire/UmpiresCard.jsx'
import { UmpireTendencies } from '../components/umpire/UmpireTendencies.jsx'
import { loadUmpire } from '../api/umpires.js'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { Headshot } from '../components/player/Headshot.jsx'
import { ProspectPill } from '../components/badges/ProspectPill.jsx'
import { MilestonePill } from '../components/badges/MilestonePill.jsx'
import { RookiePill } from '../components/badges/RookiePill.jsx'
import { DebutPill } from '../components/badges/DebutPill.jsx'
import { milestoneTextFor } from '../api/callouts.js'
import { arsenalSidesView, arsenalTtoView, fetchPitchArsenalFor, pitchArsenalFor } from '../api/pitchArsenal.js'
import { StarterMix } from '../components/playbyplay/pitcherCard/StarterMix.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { BullpenBoard, useBullpenReveal, BullpenToggle } from '../components/teamstats/BullpenBoard.jsx'
import { ProjectedStarters } from '../components/workload/ProjectedStarters.jsx'
import { projectFromLiveLogs } from '../api/rotation/liveStarters.js'
import { SeasonSeriesStrip } from '../components/teamstats/SeasonSeriesStrip.jsx'
import { SPORT_LABEL, teamAbbr } from '../lib/teams.js'
import { headerThemeFor, headerThemeStyle, headerThemeClass, themeKeyFor, mastheadMarkFor } from '../lib/headerTheme.js'
import { seasonTheme, seasonMasthead } from '../lib/identity/seasonMarks.js'
import { FactGrid } from '../components/ui/frame/FactGrid.jsx'
import { Card } from '../components/ui/frame/Card.jsx'
import { EmptyState } from '../components/ui/state/EmptyState.jsx'

// Away/home info + lineup page — the staging page you copy the scorebook
// header from, so facts run in the sheet's order (date, park, first pitch,
// weather, attendance, manager, umpires) and every person outside the
// opposing-defense diamond is penciled surname-first with a uniform number.
// Nothing here is score-revealing, so it renders openly. The game masthead
// (see GameView) carries the main away@home logo pairing; the batting-order /
// opposing-starter / opposing-defense section headers below also carry a
// small club mark of their own, forced to solid white for the navy bar (see
// index.css's .sectionhead__mark).
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
  vsTeam,
  prospectsData,
  rookiesData,
  formerTeammatesData,
  careerMatchupsData,
  workloadData,
  callouts,
  onNext,
  nextLabel,
  onCatchUp = null,
  onPrintSheet,
  onPreview,
  onReload,
  loading,
  lastUpdated,
}) {
  const oppSide = side === 'away' ? 'home' : 'away'
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const oppMeta = useMemo(() => selectTeamMeta(feed, oppSide), [feed, oppSide])
  const officials = useMemo(() => selectOfficials(feed), [feed])
  // Tonight's plate umpire's full record, for the Tendencies card in the
  // page-top zone below. Static nightly files, memoized in api/umpires.js —
  // the accuracy modal and the EXTRAS-tab drawer read the same load.
  const hpId = useMemo(() => officials.find((o) => o.role === 'HP')?.id ?? null, [officials])
  // The GAME's season, not the store's current one (#1201): an old 2026 game
  // still shows 2026 after 2027 starts.
  const gameSeason = selectGameSeason(feed)
  const { data: hpUmpire } = useAsync(
    () => (hpId != null ? loadUmpire(hpId, { seasonYear: gameSeason }) : Promise.resolve(null)),
    [hpId, gameSeason],
  )
  const info = useMemo(() => selectGameInfo(feed), [feed])
  // Null for a club with no curated triad, which leaves every bar below on the
  // app's default navy chrome — coverage is partial by design (ADR-0030).
  // Resolved on every render rather than memoized. It is a table lookup and two
  // string compares, and the overlay behind those tables refills them IN PLACE
  // (ADR-0050) — so a memo here would keep serving the pre-override triad until one
  // of its other deps happened to move. Same class of trap as ADR-0007.
  // An old game in a season-covered era wears the default chrome, not today's
  // colours (#1626, lib/identity/seasonMarks.js).
  const theme = seasonTheme(meta.id, gameSeason, headerThemeFor(meta.id, themeKeyFor(meta.id, side, treatment)))
  // The Starting pitcher card shows the OTHER club's starter, so its own
  // masthead wears THAT club's jersey colors rather than this page's — see
  // OpposingStarterCard.
  const oppTheme = seasonTheme(oppMeta.id, gameSeason, headerThemeFor(oppMeta.id, themeKeyFor(oppMeta.id, oppSide, oppTreatment)))
  // A club's own override for the mark ITS mastheads draw on the BAR it wears
  // tonight (teams.js's mastheadMarkUrl) — null for a bar nobody has dressed,
  // the overwhelming default, so TeamLogo's club-wide mono mark still draws.
  // Keyed by BAR, not by jersey, exactly as the theme above it is:
  // `mastheadBarFor` collapses Main and every alternate onto one answer, City
  // Connect onto its own, MiLB onto a third — the grouping headerThemeFor's own
  // override tables use. Identity-only inputs, same invariant; MiLB needs no
  // special case here any more, it is simply the third bar.
  // `{ url, scale }` — the override art, and how big this bar draws its mark.
  const ownMasthead = seasonMasthead(meta.id, gameSeason, mastheadMarkFor(meta.id, treatment))
  const oppMasthead = seasonMasthead(oppMeta.id, gameSeason, mastheadMarkFor(oppMeta.id, oppTreatment))

  return (
    <div className={`teaminfo ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme, ownMasthead.scale)}>
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

      {/* The page-top zone: the fill-in facts, the crew, the preview door,
          the print-sheet link, and the season series carousel all stack in
          the left column; the plate ump's full Tendencies card is the WHOLE
          right side from the wide breakpoint (see .teaminfo__topzone). A
          phone keeps this same order as a single column. The card fetch
          reads the same memoized static nightly files the accuracy modal
          does, and the card renders nothing (single-column zone) for MiLB or
          an unswept umpire. */}
      <div className="teaminfo__topzone">
        <div className="teaminfo__topmain">
          {/* The crew rides in this same grid as more cells (HP UMP, 1B UMP, …),
              so the page's two top tables are one table. */}
          <FactGrid className="teaminfo__facts">
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
            <UmpiresCard officials={officials} seasonYear={gameSeason} closed={selectRecordIsClosed(feed)} />
          </FactGrid>

          {/* The preview card and the blank sheet: two plain doors on one line
              (ADR-0047's second amendment moved the preview here from its old
              "Card" tab-bar stop). Quiet links, not bars — the page opens as a
              scorebook header and a departure must not shout over the sheet. */}
          {(onPreview || onPrintSheet) && (
            <div className="thub__door">
              {onPreview && <Door onClick={onPreview}>View preview card</Door>}
              {onPrintSheet && <Door onClick={onPrintSheet}>Print blank scorecard</Door>}
            </div>
          )}

          {/* The third thing you can do with a game that is not "walk the
              innings": score it from the pitch clips. It joins the two doors
              above rather than the foot of the page, and it draws itself or
              nothing at all — a game with no film has no door. Its own header
              carries the placement argument and the suppression rules. */}
          <ExpressLaneDoor feed={feed} />

          <SeasonSeriesStrip
            viewingTeamId={meta.id}
            opponentId={oppMeta.id}
            officialDate={info.officialDate}
            sportId={meta.sportId}
            currentGamePk={feed?.gamePk}
          />
        </div>
        {hpUmpire && <UmpireTendencies umpire={hpUmpire} />}
      </div>

      <TeamSections
        feed={feed}
        side={side}
        oppTheme={oppTheme}
        ownMasthead={ownMasthead}
        oppMasthead={oppMasthead}
        oppPitcherLine={oppPitcherLine}
        vsTeam={vsTeam}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        formerTeammatesData={formerTeammatesData}
        careerMatchupsData={careerMatchupsData}
        workloadData={workloadData}
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
          className="innings__refresh--float"
        />
        {onCatchUp ? (
          /* CATCH UP TO LIVE (ADR-0055), on a game already in progress. The
             pair borrows `.revealsplit` from the innings bar — the same layout,
             and the same reading of which of two side-by-side buttons is the
             quiet one — but NOT its emphasis, and the difference is worth
             saying out loud so the two are not made to match later. There the
             quiet half is the skip, demoted because revealing is
             one-directional. Here the quiet half is the ordinary advance, and
             it is the SAFE one: "Innings ›" from a live game's lineup page
             means "start at the top of the 1st and walk", which reveals
             nothing at all. What earns the kraft seal on the left is that it
             is the reveal — same texture, and so the same warning, that every
             other reveal in this app wears. The two skins are enough on their
             own; `--quiet` is a focus-mode rule and does not reach this bar. */
          <div className="revealsplit">
            <button className="btn btn--reveal revealsplit__btn" onClick={onCatchUp}>
              Catch up to live ›
            </button>
            <button className="btn btn--ink btn--next revealsplit__btn" onClick={onNext}>
              {nextLabel}
            </button>
          </div>
        ) : (
          <button className="btn btn--ink btn--next" onClick={onNext}>
            {nextLabel}
          </button>
        )}
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

// The team's full active roster (from fetchTeamRoster), pared to batters, for
// the pregame fallback when the starting lineup isn't posted yet. Roster
// entries come from the plain /roster endpoint, not the live feed, so names
// degrade to fullName (no lastFirstName on that thinner person object).
//
// Pitchers are left out rather than grouped into their own Starters/Bullpen
// lists (a prior version of this card did that): once a real lineup posts,
// nothing on this page shows this side's own pitching staff either — under
// the universal DH a starter never carries a battingOrder slot, so
// selectLineup's nine are batters only — and staging a roster of arms here
// that then vanishes the moment lineups post was a card that got LESS useful
// as the page went live. `FullRosterLink` below is the door to that full
// staff for whoever wants it. A two-way player (Ohtani-type) carries a
// single roster spot typed 'Two-Way Player', not 'Pitcher', so he lists here
// same as any other batter.
function rosterFallbackGroups(roster) {
  return (roster ?? [])
    .filter((r) => r.position?.type !== 'Pitcher')
    .map((r) => ({
      id: r.person?.id,
      name: lastFirst(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
    }))
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))
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
    const pitcher = selectTeamMeta(feed, side, { includeDerivedStarter: true }).probablePitcher
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

// The door out of the pregame roster fallback to the team hub's Roster tab —
// the pitching staff (and everyone else) rosterFallbackGroups no longer lists
// here now that it's batters-only. Same .thub__door/.door--inline shell
// TeamPage's own previews end in (PreviewDoor), reused rather than doubled
// up. No `?d=` cutoff: a lineup-page link stays live per ADR-0034, same as
// every other link off this page.
function FullRosterLink({ teamId, sportId }) {
  const navigate = useNav()
  return (
    <div className="thub__door">
      <Door onClick={() => navigate(teamTabPath(teamId, 'roster', { s: sportId }))}>
        Full roster
      </Door>
    </div>
  )
}

// The team-specific body shared by the phone page and the spread's panels:
// batting order, the opposing starter, and the opposing defense diamond.
function TeamSections({
  feed,
  side,
  oppTheme,
  ownMasthead,
  oppMasthead,
  oppPitcherLine,
  vsTeam,
  prospectsData,
  rookiesData,
  formerTeammatesData,
  careerMatchupsData,
  workloadData,
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
  // This matchup's two clubs' CURRENT parent org — this side's own id when
  // it's already the MLB parent, else its live parentOrgId — so a prospect
  // badge can be checked against the roster the player is actually on today
  // rather than whatever org a week-old scrape baked in (prospectBadge,
  // api/prospects.js). Never the affiliate's own id: orgProspects rows are
  // always keyed by parent.
  const { data: teamIdentity } = useAsync(() => fetchTeam(meta.id), [meta.id])
  const { data: oppTeamIdentity } = useAsync(() => fetchTeam(oppMeta.id), [oppMeta.id])
  const orgTeamId = teamIdentity?.parentOrgId ?? meta.id
  const oppOrgTeamId = oppTeamIdentity?.parentOrgId ?? oppMeta.id
  const season = selectGameSeason(feed)
  // A played game or a forfeit: its lineup and starter will never post.
  const closed = selectRecordIsClosed(feed)
  const oppPitcher = useMemo(
    () => selectOpposingPitcher(feed, side, { includeDerivedStarter: true }),
    [feed, side],
  )
  // The opposing starter's whole career line against THIS side's club (see
  // api/vsTeamSplits.js) — MLB only, same as the file itself (the generator
  // sweeps only the 30 MLB active rosters). `vsTeam` already holds both this
  // matchup's clubs' shards (fetched once in useGameData), so no extra
  // request here — just a lookup, keyed by the pitcher's OWN club (oppMeta.id)
  // then by the club he's facing tonight (meta.id). Null on a first career
  // meeting, which is what hides the card's conditional row.
  const oppPitcherCareerVsOpp = useMemo(
    () => (isMlb ? vsTeam?.players?.[oppPitcher?.id]?.vs?.[String(meta.id)]?.car ?? null : null),
    [isMlb, vsTeam, oppPitcher?.id, meta.id],
  )
  const vsOpponentAbbr = teamAbbr({ id: meta.id, teamName: meta.teamName, name: meta.name })
  // The opposing starter's season pitch-type mix (see api/pitchArsenal.js) —
  // MLB + AAA only; a lower-level starter's lookup just resolves to null. Fetched
  // HERE by his id, not handed down from useGameData: this is the only card that
  // draws it, and it wants one man's bucket rather than the league's. The
  // GAME's season (#1201), or the latest on file in spring training, before the
  // new season has any (staticJson.js's seasonFolderOf).
  const { data: arsenalShard } = useAsync(
    () => fetchPitchArsenalFor(oppPitcher?.id, { seasonYear: season }),
    [oppPitcher?.id, season],
  )
  const oppArsenal = useMemo(
    () => pitchArsenalFor(arsenalShard, oppPitcher?.id, isMlb),
    [arsenalShard, oppPitcher?.id, isMlb],
  )
  // The same mix split by times through the order, off the same shard — the
  // card's filter. Null for an arm the file carries no split for, and the
  // card then renders the season with no filter at all.
  const oppArsenalTto = useMemo(
    () => arsenalTtoView(arsenalShard, oppPitcher?.id, isMlb),
    [arsenalShard, oppPitcher?.id, isMlb],
  )
  // And again by the side the BATTER stood on, off the same shard — the card's
  // other filter, which crosses with the one above. Null for an arm the file
  // carries no side split for, or with a side under the qualifier floor, and
  // the card then renders the look filter alone.
  const oppArsenalSides = useMemo(
    () => arsenalSidesView(arsenalShard, oppPitcher?.id, isMlb),
    [arsenalShard, oppPitcher?.id, isMlb],
  )
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])
  // The bullpen this side's lineup is about to face, not its own — it nests
  // under the opposing starter card (see BullpenBoard's own header), so it
  // reads the OTHER team's arms same as oppPitcher/oppDefense above.
  const oppBullpenArms = useMemo(
    () => selectBullpen(feed, side === 'away' ? 'home' : 'away'),
    [feed, side],
  )
  const { showBullpen, setShowBullpen } = useBullpenReveal()
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
  // No probable pitcher announced and the game not yet started: a short list of
  // likely starters from rest days (api/rotation/). The workload file only names
  // the candidates — it is regular-season only, so each one's appearances are
  // read live with every game type. Same freshness gate as the board above
  // (`boardGameDate`) and the same MLB-only file, so a MiLB or archival game
  // gets [] and keeps "Not posted yet." Until the live read lands, and if it
  // fails, the card says that too rather than guess from the stale file.
  const wantsProjection = !oppPitcher && !selectHasStarted(feed) && Boolean(workloadData && boardGameDate)
  const { data: projectedStarters } = useAsync(
    () =>
      wantsProjection
        ? projectFromLiveLogs(workloadData, oppMeta.id, boardGameDate)
        : Promise.resolve([]),
    [wantsProjection, workloadData, oppMeta.id, boardGameDate],
  )
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
  // This club's batters vs the arm they're about to face. Keyed by gamePk, so
  // a doubleheader's two games and a series' three nights each resolve to
  // their own starter rather than sharing one team-pair entry.
  const starterMatchups = useMemo(
    () => starterMatchupsFor(careerMatchupsData, feed?.gamePk, meta.id),
    [careerMatchupsData, feed?.gamePk, meta.id],
  )
  const { showNotes, setShowNotes } = useMatchupNotes()
  // Split once per render into "goes beside a name in the order" and "goes in
  // the bench row". Before the lineup posts the card lists the whole roster, so
  // the lineup set is empty and every batter's line lands inline instead.
  const matchupNotes = useMemo(
    () => splitMatchupRows(starterMatchups, new Set(lineup.map((p) => p.id))),
    [starterMatchups, lineup],
  )
  const starterLast = useMemo(
    () => (starterMatchups ? splitDisplayName(starterMatchups.pitcher.name).last : ''),
    [starterMatchups],
  )
  const matchupLevel = SPORT_LABEL[meta.sportId] ?? 'MLB'
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const dayNight = info.dayNight

  // Lineups don't post until close to first pitch. Until then, stage the
  // team's full active roster (batters + pitchers) in the same spot rather
  // than a dead-end "not posted" line — there's still something to copy onto
  // the sheet. Only fetched while actually needed (skipped once the real
  // lineup posts).
  const needsRoster = lineup.length === 0 && !closed
  const { data: rawRoster } = useAsync(
    () =>
      needsRoster && meta.id && season
        ? fetchTeamRoster(meta.id, season, { sportId: meta.sportId ?? 1 })
        : Promise.resolve([]),
    [needsRoster, meta.id, meta.sportId, season],
  )
  const roster = useMemo(() => rosterFallbackGroups(rawRoster), [rawRoster])

  const lineupHead = (
    <ClubHead title="Batting order" teamId={meta.id} teamName={meta.teamName} masthead={ownMasthead} season={season}>
      {/* Names the pitcher the notes below are measured against, and
          switches them off for a clean order to copy onto paper. */}
      <MatchupNotesToggle pitcherLast={starterLast} showNotes={showNotes} onToggle={setShowNotes} />
    </ClubHead>
  )
  const oppHead = (
    <ClubHead title="Defensive alignment" teamId={oppMeta.id} teamName={oppMeta.teamName} masthead={oppMasthead} season={season} />
  )

  return (
    <>
      <OpposingStarterCard
        pitcher={oppPitcher}
        closed={closed}
        projected={projectedStarters}
        pitcherLine={oppPitcherLine}
        careerVsOpp={oppPitcherCareerVsOpp}
        vsOpponentAbbr={vsOpponentAbbr}
        // The Box Lines sheet's query (ADR-0069): the club he faces, and the
        // scored game's own date as the cutoff — the whole spoiler defense.
        vsOpponent={{ id: meta.id, name: meta.teamName || meta.name }}
        cutoff={info.officialDate ?? null}
        teamId={oppMeta.id}
        teamName={oppMeta.teamName}
        season={season}
        orgTeamId={oppOrgTeamId}
        theme={oppTheme}
        masthead={oppMasthead}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        callouts={callouts}
        isMlb={isMlb}
        arsenal={oppArsenal}
        arsenalTto={oppArsenalTto}
        arsenalSides={oppArsenalSides}
        bullpenToggle={
          <BullpenToggle
            hasArms={oppBullpenArms.length > 0}
            showBullpen={showBullpen}
            onToggle={setShowBullpen}
          />
        }
      />
      {/* Nested under the starting pitcher card it belongs to (his team's
          pen), collapsible via the pill above — see useBullpenReveal. */}
      {showBullpen && (
        <BullpenBoard
          workload={workloadData}
          teamId={oppMeta.id}
          gameDate={boardGameDate}
          theme={oppTheme}
          masthead={oppMasthead}
        />
      )}

      {/* Wide screens run the batting order and defense diamond side by side
          rather than 50/50 — the order's the meat of the page, the diamond is
          a small square (see .teaminfo__lineupdefense's 3fr/2fr split). */}
      <div className="teaminfo__lineupdefense">
        {/* A Card with the club band as its head (#1113, slice C3). The list
            is its flush body; the Card clips the rows to its corners. */}
        <Card className="lineup" head={lineupHead} body="flush">
          {lineup.length > 0 ? (
            <ol className="lineup__list">
              {lineup.map((p, i) => (
                /* `--row-i` is the row's place in the posted order, and the
                   only thing the ink-in cascade needs from this file (see
                   styles/motion/lineup.css). Per row rather than one variable
                   on the <ol>: a parent variable recalculates styles for every
                   child, and per-child is what lets the Animation Lab pause the
                   strip additively. Same shape HalfTally uses for `--tally-i`. */
                <li key={p.id} className="lineup__row" style={{ '--row-i': i }}>
                  <span className="lineup__order">{p.order}</span>
                  <span className="lineup__namewrap">
                    <PlayerLink id={p.id} className="lineup__name">
                      {p.nameLastFirst}
                    </PlayerLink>
                    <ProspectPill {...prospectBadge(prospectsData, p.id, orgTeamId)} />
                    <MilestonePill text={milestoneTextFor(callouts, p.id)} />
                    <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                    <DebutPill debuted={!isMlb && hasDebuted(rookiesData, p.id)} />
                    <BirthdayCake show={birthdayIds.has(p.id)} />
                    {/* Inside the namewrap, not beside it: the note is a flex
                        child that takes a full-width basis, which is what puts
                        it on its own line under the name (see .lineup__vs). */}
                    {showNotes && (
                      <MatchupNote row={matchupNotes.byId.get(p.id)} levelLabel={matchupLevel} />
                    )}
                  </span>
                  <span className="lineup__jersey">{p.jersey || ''}</span>
                  <span className="lineup__pos">{p.position}</span>
                </li>
              ))}
              {showNotes && (
                <BenchMatchups
                  rows={matchupNotes.bench}
                  levelLabel={matchupLevel}
                  pitcherLast={starterLast}
                />
              )}
            </ol>
          ) : roster.length > 0 ? (
            <>
              <p className="roster__notice">
                Not final{info.scheduledTime ? ` — posts close to first pitch (${info.scheduledTime})` : ' yet'}
              </p>
              <div className="roster">
                <ul className="roster__list">
                  {roster.map((p) => (
                    <li key={p.id} className="roster__row">
                      <span className="roster__namewrap">
                        <PlayerLink id={p.id} className="roster__name">
                          {p.name}
                        </PlayerLink>
                        <ProspectPill {...prospectBadge(prospectsData, p.id, orgTeamId)} />
                        <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                        <DebutPill debuted={!isMlb && hasDebuted(rookiesData, p.id)} />
                        <BirthdayCake show={birthdayIds.has(p.id)} />
                        {/* Most visits to this page happen BEFORE the
                            lineup posts, when this roster list is the whole
                            card — so the notes attach here too and the data
                            is visible all day, not only once the nine drop.
                            No bench row is needed here: with no posted
                            order, nobody is left over. */}
                        {showNotes && (
                          <MatchupNote
                            row={matchupNotes.byId.get(p.id)}
                            levelLabel={matchupLevel}
                            className="roster__vs"
                          />
                        )}
                      </span>
                      <span className="roster__jersey">{p.jersey}</span>
                      <span className="roster__pos">{p.pos}</span>
                    </li>
                  ))}
                </ul>
                <FullRosterLink teamId={meta.id} sportId={meta.sportId} />
              </div>
            </>
          ) : (
            <p className="roster__notice">
              {closed
                ? 'The batting order is not in the record for this game.'
                : `Not final${info.scheduledTime ? ` — posts close to first pitch (${info.scheduledTime})` : ' yet'}`}
            </p>
          )}
        </Card>

        {oppDefense.length > 0 && (
          <Card
            className={`opp ${headerThemeClass(oppTheme)}`.trim()}
            style={headerThemeStyle(oppTheme, oppMasthead.scale)}
            head={oppHead}
            body="flush"
          >
            {/* Drawn like the sheet's bottom-left diamond: surnames on writing
                lines at their positions. The defense belongs to the OTHER side,
                so — same as the Starting pitcher card above — its masthead
                wears THAT club's jersey colors (oppTheme) rather than this
                page's own. */}
            <DefenseDiamond defense={oppDefense} />
          </Card>
        )}
      </div>

      <FormerTeammates
        pairs={teammatePairs}
        startingIds={startingIds}
        dayNight={dayNight}
        away={side === 'away' ? meta : oppMeta}
        home={side === 'away' ? oppMeta : meta}
      />
      <OrgTies ties={orgTies} />
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
  closed,
  projected,
  pitcherLine,
  careerVsOpp,
  vsOpponentAbbr,
  vsOpponent,
  cutoff,
  teamId,
  teamName,
  season,
  orgTeamId,
  theme,
  masthead,
  prospectsData,
  rookiesData,
  callouts,
  isMlb,
  arsenal,
  arsenalTto,
  arsenalSides,
  bullpenToggle,
}) {
  const head = (
    <ClubHead title="Starting pitcher" teamId={teamId} teamName={teamName} masthead={masthead} season={season}>
      {bullpenToggle}
    </ClubHead>
  )
  return (
    <Card
      className={`starter ${headerThemeClass(theme)}`.trim()}
      style={headerThemeStyle(theme, masthead.scale)}
      head={head}
      body="flush"
    >
      {pitcher ? (
        <div className="starter__body">
          <Headshot
            personId={pitcher.id}
            name={pitcher.name}
            teamId={teamId}
            className="starter__shot"
          />
          <div className="starter__info">
            <span className="starter__namewrap">
              <PlayerLink id={pitcher.id} className="starter__name">
                {pitcher.nameLastFirst}
              </PlayerLink>
              <ProspectPill {...prospectBadge(prospectsData, pitcher.id, orgTeamId)} />
              <MilestonePill text={milestoneTextFor(callouts, pitcher.id)} />
              <RookiePill active={showRookiePill(rookiesData, pitcher.id, isMlb)} />
              <DebutPill debuted={!isMlb && hasDebuted(rookiesData, pitcher.id)} />
            </span>
            <span className="starter__badges">
              {pitcher.jersey && <span className="starter__jersey">{pitcher.jersey}</span>}
              {pitcher.hand && <span className="starter__hand">{pitcher.hand}HP</span>}
            </span>
            {/* Season line (aggregates only, never this game's) — the numbers
                you pencil next to the starter while staging. */}
            {pitcherLine && (
              <span className="starter__stats">
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
              <span className="starter__last">{lastGameLine(pitcherLine.lastGame)}</span>
            )}
            {/* His summed line against TONIGHT'S opponent so far this season
                (see fetchPitcherSeasonVsOpponent) — every past start against
                this club folded into one line, staging-safe the same way. */}
            {pitcherLine?.vsOpponent && (
              <span className="starter__seasonvs">
                {seasonVsOpponentLine(pitcherLine.vsOpponent, vsOpponentAbbr)}
              </span>
            )}
            {/* His whole regular-season career against this club (see
                api/vsTeamSplits.js) — omitted entirely on a first career
                meeting, which is what the null careerVsOpp means. The line is
                worded by `vsTeamDoorLabel`, shared with the player page's
                Splits vs team card so the two doors into the same sheet
                cannot word the same career differently. */}
            {careerVsOpp && (
              <BoxLinesDoor
                className="starter__careervs"
                label={vsTeamDoorLabel(careerVsOpp, 'pitching', vsOpponentAbbr)}
                sheet={{
                  personId: pitcher.id,
                  playerSurname: splitDisplayName(pitcher.name).last,
                  group: 'pitching',
                  opponentId: vsOpponent.id,
                  opponentName: vsOpponent.name,
                  cutoff,
                }}
              />
            )}
          </div>
          {/* Wide: the list and the pitch scene as a band under this row.
              Phone: a "Watch his pitches" door that opens the scene in a sheet. */}
          {arsenal && (
            <StarterMix
              arsenal={arsenal}
              tto={arsenalTto}
              sides={arsenalSides}
              lefty={pitcher.hand === 'L'}
              name={pitcher.name}
            />
          )}
        </div>
      ) : closed ? (
        <p className="roster__notice starter__closed">The starting pitcher is not in the record for this game.</p>
      ) : projected?.length ? (
        <ProjectedStarters rows={projected} />
      ) : (
        <EmptyState size="compact" className="starter__empty">
          Not posted yet.
        </EmptyState>
      )}
    </Card>
  )
}

// The band head of a pre-game club card (the batting order, the defensive
// alignment, the starting pitcher): the title, the club's mono mark at the far
// right (ADR-0031), and one control in the aside slot. It is the Card's `head`
// (#1113, slice C3). The club colours come from the theme on the card root.
function ClubHead({ title, teamId, teamName, masthead, season, children }) {
  return (
    <SectionMasthead
      as="h3"
      title={title}
      logo={
        <TeamLogo
          teamId={teamId}
          name={teamName}
          size={22}
          variant="mono"
          crop="bar"
          overrideUrl={masthead.url}
          season={season}
          className={`sectionhead__mark${masthead.url ? ' sectionhead__mark--custom' : ''}`}
        />
      }
    >
      {children}
    </SectionMasthead>
  )
}

// "LAST: 7/12 AT BOS (AAA) — 6.0 IP · 5 H · 2 ER · 6 K" — the compact line
// under .starter__last's dotted divider (see fetchPitcherLastGame).
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

// "8/18 @ MIL: 6.0 IP, 3 H, 0 ER, 2 K, 1 BB" — his ONE start against tonight's
// opponent so far this season (see fetchPitcherSeasonVsOpponent), formatted
// exactly like lastGameLine since that's what it is: a single past outing.
// The common case there's more than one, "3 GS vs MIL this year: ..." — no
// single date to lead with, so it reads like the season-line row instead.
function seasonVsOpponentLine(v, oppAbbr) {
  const stat = [
    v.inningsPitched && `${v.inningsPitched} IP`,
    `${v.hits} H`,
    `${v.earnedRuns} ER`,
    `${v.strikeOuts} K`,
    `${v.baseOnBalls} BB`,
  ]
    .filter(Boolean)
    .join(', ')
  if (v.games.length === 1) {
    const g = v.games[0]
    return `${monthDay(g.date)} ${g.home ? 'vs' : '@'} ${oppAbbr}: ${stat}`
  }
  return `${v.games.length} GS vs ${oppAbbr} this year: ${stat}`
}

// A link out to this club's official pre-game press-notes PDF, sitting just
// under the team head on the lineup page (both the phone page and each spread
// panel). Resolves the freshest note for the game's date — live for the game
// being staged, from the committed archive for older, de-listed games (see
// api/gameNotes.js). MLB only, and hidden entirely when there's no note to link
// (every MiLB game, or a date the club never posted), so it degrades to nothing
// like the rest of the lineup surfaces. The PDF opens in a new tab: a deliberate
// jump to an external, spoiler-bearing press packet, not an in-app reveal.
//
// The button used to open the What's Brewing modal (the club's notes parsed into
// tap-to-read blurbs) instead of the PDF. The parse was too brittle across the
// clubs' shifting PDF templates to be worth the extra tap, so every club now gets
// the plain link-out. The parser and the modal still exist, reachable only from
// the unlisted /game-notes-debug QA page (src/screens/GameNotesDebugPage.jsx).

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

  // One behavior for every club: tap opens the club's own notes PDF in a new tab.
  // The ↗ says so.
  return (
    <a
      className="btn btn--control innings__notes"
      href={notes.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${notes.title} — the club's official press notes (PDF), opens in a new tab`}
    >
      Game Notes
      <span className="btn__icon" aria-hidden="true">↗</span>
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
    // The fact PRINTS surname-first; the address takes spoken order
    // (ADR-0057), which `name` on the same object already is.
    <ManagerLink id={manager.personId} name={manager.name} className="fact__person">
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
      <Button
        size="control"
        icon="↻"
        busy={loading}
        className={`innings__refresh ${className}`.trim()}
        onClick={onReload}
        aria-label="Refresh live game data"
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </Button>
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
