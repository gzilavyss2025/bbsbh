import { memo, useMemo, useRef, useState } from 'react'
import { resolveCardPlayer } from '../api/boxscore.js'
import { highlightPoster } from '../api/highlights.js'
import { revealBoxScore } from './boxscore/revealBoxScore.js'
import { InningTally } from './boxscore/InningTally.jsx'
import { managerLabel } from '../api/game.js'
import { defenseEntering } from '../api/defense.js'
import { selectOfficials, selectIsFinal } from '../api/select.js'
import { stepToSection } from '../lib/route.js'
import { umpireAccuracySummary } from '../api/umpires.js'
import { selectChallengeState, gameHasAbs } from '../api/challenges.js'
import { useAsync } from '../hooks/useAsync.js'
import { SealBox } from '../components/SealBox.jsx'
import { WinProbChart } from '../components/charts/WinProbChart.jsx'
import { AbsRow } from '../components/gamehud/StatBox.jsx'
import { PerformerCard } from '../components/player/PerformerCard.jsx'
import { CalloutNote } from '../components/playbyplay/CalloutNote.jsx'
import { HighlightSheet } from '../components/playbyplay/HighlightSheet.jsx'
import { GameStoryCard } from '../components/game/GameStoryCard.jsx'
import { StampGameButton } from '../components/logbook/StampGameButton.jsx'
import { GamePhotosStrip } from '../components/game/GamePhotosStrip.jsx'
import { GameVideoRow } from '../components/highlights/GameVideoRow.jsx'
import { Headshot } from '../components/player/Headshot.jsx'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { TeamTreatmentMark } from '../components/logo/TeamTreatmentMark.jsx'
import { DefenseDiamond } from '../components/scoring/DefenseDiamond.jsx'
import { UmpireAccuracyModal } from '../components/umpire/UmpireAccuracyModal.jsx'
import { UmpireTierPill } from '../components/badges/UmpireTierPill.jsx'
import { UmpireLink } from '../components/umpire/UmpireLink.jsx'
import { ManagerLink } from '../components/team/ManagerLink.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { RefreshButton, InfoIcon } from './TeamInfo.jsx'
import { ballparkFor } from '../lib/ballpark/ballparkData.js'
import { headerThemeFor, headerThemeStyle, headerThemeClass, themeKeyFor } from '../lib/headerTheme.js'
import { useStampUnseal } from '../hooks/useStamps.js'
import { useBoxScoreReveal } from '../hooks/useRevealProgress.js'
import { BoxRevealSyncMount } from '../components/sync/BoxRevealSyncMount.jsx'

// Manager fill-in value, surname-first with the uniform number riding along —
// "MURPHY, PAT · 21" — matching how every staged name is penciled in. The
// number is inked red like every uniform number on the box score. Wrapped in
// ManagerLink (degrades to plain text when the coaches endpoint had no
// personId — see that component) so the whole fill-in value is tappable,
// same as the lineup page's own Manager fact.
function managerValue(mgr) {
  const label = managerLabel(mgr)
  if (!label) return ''
  const body = !mgr.jersey ? (
    label
  ) : (
    <>
      {label} · <span className="bs__unum">{mgr.jersey}</span>
    </>
  )
  return <ManagerLink id={mgr.personId}>{body}</ManagerLink>
}

// A player's uniform number and position after his name — "21 | SS" — the
// number inked red like every uniform number on the sheet, a pipe between it and
// the position, both at the position's size. Falls back to just the position
// when the feed didn't post a number.
function NumPos({ num, pos }) {
  return (
    <span className="bs__pos">
      {num !== '' && num != null && (
        <>
          <span className="bs__unum">{num}</span>
          {' | '}
        </>
      )}
      {pos}
    </span>
  )
}

// The full, MLB.com-style final box score for a game — batting orders (with
// substitutes indented), pitching lines, the BATTING/BASERUNNING/FIELDING notes,
// per-team footnotes, and the game-info foot (WP, umpires, weather, T, Att…).
//
// SPOILER RULE: the whole thing is score-revealing, so it lives behind a single
// SealBox. `selectBoxscore` is only called inside the reveal render function —
// nothing score-revealing is in the DOM until the user taps to reveal, exactly
// like every half-inning seal. This holds even for a deep link straight to the
// box score, so the card's "Box score" shortcut can't spoil either.
export function BoxScore({
  feed,
  managers,
  uniforms,
  scorebookWeather,
  winProbability,
  winProbTreatment,
  callouts,
  vsTeam,
  highlights,
  onReload,
  loading,
  lastUpdated,
  onSection,
  spoilersOff = false,
}) {
  // The masthead above every section (GameView.jsx) already carries this
  // game's date, so the title itself just says "Box score" — no second date
  // a few pixels below the first.
  //
  // Structural status, not a score — spoiler-free, read outside the seal
  // (same footing as the date). A final game has nothing left to refresh, so
  // Refresh drops entirely rather than sitting there disabled-looking or,
  // worse, inviting a pointless re-fetch. The Innings nav button is gone too
  // — MIL/STL/INNINGS/BOX in the section tabs right above this header
  // already goes there, live or final.
  const isFinal = selectIsFinal(feed)

  // The reveal render's own cache (see `revealBoxScore` at the foot of this
  // file). Declared here because a ref has to be, but it holds NOTHING until
  // the reveal function runs — the seal is still what decides whether any of
  // this is ever computed (ADR-0001/0002). ADR-0007's rule is why the key is
  // the input objects THEMSELVES rather than a gamePk or a timestamp: a poll
  // mints a fresh feed, a fresh feed is a cache miss, and the sheet recomputes.
  const revealCacheRef = useRef({ key: null, value: null })
  const stamped = useStampUnseal(feed?.gamePk)
  // THIS BOX SCORE'S OWN MARK (ADR-0049): the reader already lifted this seal,
  // here or on another of their devices. Alone among the three openers below, it
  // persists — one bit per gamePk, written only on a real tap.
  const { boxOpened, markBoxOpened } = useBoxScoreReveal(feed?.gamePk)

  return (
    <div className="boxscore">
      {/* That mark's cross-device wire: signed-in only, inert with no Clerk, and
          able only to OPEN a box score its owner opened elsewhere. */}
      <BoxRevealSyncMount gamePk={feed?.gamePk} opened={boxOpened} mergeOpened={markBoxOpened} />
      <div className="boxscore__head">
        <h2 className="boxscore__title" id="bs__title">Box score</h2>
        {!isFinal && (
          <div className="boxscore__headright">
            <RefreshButton onReload={onReload} loading={loading} lastUpdated={lastUpdated} />
          </div>
        )}
      </div>

      {/* THREE OPENERS, ONE INPUT. The day pass for a day the reader agreed to
          spoil (`spoilersOff`, ADR-0026, resolved from the date by GameView);
          their own stamp on this game (ADR-0048); and their own record of having
          already lifted THIS seal (ADR-0049). All three ride SealBox's existing
          `forceRevealed`, so the render-function gate is untouched: children are
          invoked only in the revealed branch (ADR-0001/0002); the flags choose
          WHICH branch renders, never what it computes.
          ONLY THE THIRD WRITES ANYTHING, and the `onReveal` gate is the
          load-bearing line: SealBox fires it whenever the box becomes shown, by
          tap OR by flag (SealBox.jsx). Handing it over unconditionally would let
          the pass and the stamp record a permanent mark for a seal nobody
          touched — what ADR-0026 promises the pass can never do, and what keeps
          ADR-0048's override as reversible as the stamp behind it. Under either
          flag there is no seal, so there is no tap to record. */}
      <SealBox
        label="Tap to reveal the box score"
        forceRevealed={spoilersOff || stamped || boxOpened}
        onReveal={spoilersOff || stamped ? undefined : markBoxOpened}
        gamePk={feed?.gamePk}
      >
        {() => {
          const r = revealBoxScore(revealCacheRef, feed, winProbability, highlights, callouts, vsTeam)
          return (
            <BoxScoreBody
              stampFacts={r.stampFacts}
              feed={feed}
              box={r.box}
              stars={r.stars}
              potg={r.potg}
              potgHighlight={r.potgHighlight}
              highlights={highlights}
              winProbPoints={r.winProbPoints}
              winProbBigPlays={r.winProbBigPlays}
              winProbTreatment={winProbTreatment}
              insights={r.insights}
              inningDigest={r.inningDigest}
              calloutNotes={r.calloutNotes}
              managers={managers}
              uniforms={uniforms}
              scorebookWeather={scorebookWeather}
              onSection={onSection}
            />
          )
        }}
      </SealBox>

      {/* Mobile-only: Refresh moves down here as a floating pill, same
          placement as the Innings page's own mobile Refresh (see
          .refreshbtn--float), instead of sitting in the header — the wide
          layout keeps it inline up top (see the boxscore__headright rule in
          index.css). Never shown once the game is Final. */}
      {!isFinal && (
        <div className="pagenav pagenav--boxscore">
          <RefreshButton
            onReload={onReload}
            loading={loading}
            lastUpdated={lastUpdated}
            className="refreshbtn--float"
          />
        </div>
      )}
    </div>
  )
}

// Two sections, since this page has grown well past the literal box score:
// HIGHLIGHTS is the night's story — final totals, decisions, the win-prob
// arc, Play of the Game, Three Stars, Statcast Leaders, Insights,
// and now each team's own Game Story write-ups — everything you'd want above
// the fold before you get into the scorebook itself. BOX SCORE is the literal
// #22-page transcription: the line score (full-width, not squeezed into a
// column), then each team paired with its own header card — the visiting
// team's crew and first pitch above its batting/pitching, the home team's
// ballpark/weather/times above its own — with the complete MLB-style
// game-info text at the very bottom so nothing is lost.
// Memoized: with the reveal cache above returning the same objects for the same
// inputs, every prop crossing this boundary keeps its identity across a
// re-render the feed didn't cause, so the whole sheet — hundreds of rows — sits
// that render out. It cannot render anything the un-memoized version would not
// have: memo only skips a render whose props are identical, and it is still
// mounted only from inside the SealBox reveal function (ADR-0002).
const BoxScoreBody = memo(function BoxScoreBody({ feed, box, stars, potg, potgHighlight, highlights, winProbPoints, winProbBigPlays, winProbTreatment, insights, inningDigest, calloutNotes, managers, uniforms, scorebookWeather, onSection, stampFacts }) {
  const get = (label) =>
    box.gameInfo.find((r) => r.label === label)?.value ?? ''
  const u = box.umpires ?? {}

  // Each crew member's id, by role — `selectOfficials` (spoiler-free; umpire
  // assignments carry no score) is the one place with ids, since box.umpires
  // above is parsed from the feed's free-text "Umpires" info string, which
  // carries none. Same lookup TeamInfo.jsx's Umpires card uses, just keyed
  // here so every UmpireLink below (not only HP) can find its id.
  const officialIdByRole = useMemo(() => {
    const byRole = {}
    for (const o of selectOfficials(feed)) byRole[o.role] = o.id
    return byRole
  }, [feed])

  // Each club's batting/pitching card, ABS card, and Defense card wear the header
  // colors of the jersey it's actually wearing that game — the same ADR-0030
  // mechanism TeamInfo.jsx's club-name bar uses, scoped per card here instead of to
  // one page-wide `.teaminfo`. `winProbTreatment` is the same jersey-treatment pair
  // already threaded to WinProbChart, so this is no new fetch. Null for a club with
  // no curated triad, which leaves that card on the app's default navy chrome.
  // Resolved on every render rather than memoized. It is a table lookup and two
  // string compares, and the overlay behind those tables refills them IN PLACE
  // (ADR-0050) — so a memo here would keep serving the pre-override triad until one
  // of its other deps happened to move. Same class of trap as ADR-0007.
  const awayTheme = headerThemeFor(box.away.id, themeKeyFor(box.away.id, 'away', winProbTreatment?.away))
  const homeTheme = headerThemeFor(box.home.id, themeKeyFor(box.home.id, 'home', winProbTreatment?.home))
  const hpId = officialIdByRole.HP ?? null
  const { data: hpAccuracy } = useAsync(() => umpireAccuracySummary(hpId), [hpId])
  const [modalId, setModalId] = useState(null)
  // An umpire fill-in field's value, linked to their page when the crew list
  // resolved an id for that role (degrades to plain text otherwise — see
  // UmpireLink). '' passes through so InfoCard's '—' fallback still shows for
  // a role the feed didn't post.
  const umpValue = (role, name) => (name ? <UmpireLink id={officialIdByRole[role]}>{name}</UmpireLink> : '')
  const hpUmpireValue = u.hp ? (
    <>
      <UmpireLink id={hpId}>{u.hp}</UmpireLink>
      {hpAccuracy?.tier && (
        <button type="button" className="umps__tierbtn bs__tierbtn" onClick={() => setModalId(hpId)}>
          <UmpireTierPill tier={hpAccuracy.tier} />
        </button>
      )}
    </>
  ) : ''

  const awayFields = [
    { label: 'Visiting Team', value: box.away.teamName, wide: true },
    { label: 'Manager', value: managerValue(managers?.away), wide: true },
    // What they wore (jersey · pants · cap) — spoiler-free, posted ~game time.
    { label: 'Uniform', value: uniforms?.away, wide: true },
    { label: 'HP Umpire', value: hpUmpireValue },
    { label: '1B Umpire', value: umpValue('1B', u.first) },
    { label: '2B Umpire', value: umpValue('2B', u.second) },
    { label: '3B Umpire', value: umpValue('3B', u.third) },
    // Six-man crew only (All-Star Game / postseason) — hidden entirely for
    // the regular-season four-man crew, same as the lineup page's Umpires card.
    ...(u.left ? [{ label: 'LF Umpire', value: umpValue('LF', u.left) }] : []),
    ...(u.right ? [{ label: 'RF Umpire', value: umpValue('RF', u.right) }] : []),
    { label: 'First Pitch', value: box.times.firstPitch, wide: true },
  ]
  const homeFields = [
    { label: 'Home Team', value: box.home.teamName, wide: true },
    { label: 'Manager', value: managerValue(managers?.home), wide: true },
    { label: 'Uniform', value: uniforms?.home, wide: true },
    // The feed appends a period to the venue name ("Busch Stadium.") — drop it.
    // Ballpark + Attendance pair on one row; Time of Game + Game End on another.
    { label: 'Ballpark', value: get('Venue').replace(/\.\s*$/, '') },
    {
      label: 'Attendance',
      // AttendanceValue degrades to the plain figure (or '' when the feed
      // hasn't posted one, so InfoCard's own '—' fallback still shows).
      value: get('Att').replace(/\.\s*$/, '') && (
        <AttendanceValue
          venue={get('Venue').replace(/\.\s*$/, '')}
          attendance={get('Att').replace(/\.\s*$/, '')}
        />
      ),
    },
    // Outdoor scorebook weather from the park's lat/lon (see weather.js) — the
    // value to copy onto paper. Falls back to the box-score weather when the
    // generator has nothing (e.g. a MiLB park with no coordinates).
    {
      label: 'Weather',
      value: scorebookWeather?.text || get('Weather'),
      wide: true,
    },
    { label: 'Time of Game', value: box.times.duration },
    // Only shown when the game was actually delayed (rain, etc.) — it explains
    // why Game End is later than First Pitch + Time of Game would suggest.
    ...(box.times.delay ? [{ label: 'Delay', value: box.times.delay }] : []),
    { label: 'Game End', value: box.times.end },
  ]

  return (
    <div className="bs">
      <section className="bs__section">
        {/* The Logbook stamp, first thing on the sheet. It used to sit at the
            very bottom, on the reasoning that a keepsake is not a headline —
            which made the one thing here you can KEEP the one thing you had to
            scroll a whole box score to find. It is now a thin strip across the
            head of the page, and it is ONE element ordered two ways rather than
            two renders: on a wide screen it sits above this section's
            HIGHLIGHTS rule (its natural DOM position), and on a phone the flex
            `order` rules in styles/48-stamp-strip.css float that title and the
            R/H/E/LOB totals above it so it lands directly under the score.
            Everything about why it is safe here — and only here — is in
            StampGameButton.jsx's header: it renders inside this page's SealBox
            reveal render, which is the whole client-side guarantee, and that is
            a render-function boundary, not a position on the page. */}
        <StampGameButton game={stampFacts} />
        <h2 className="bs__sectionTitle">Highlights</h2>
        {/* The duo/col wrappers are transparent on a phone (display: contents
            — everything keeps stacking in this order on .bs__section's own
            gap) and become a two-up grid at the wide breakpoint: the left
            column runs totals above the win-prob arc, the right column runs
            the decisions above Play of the Game above Photos. */}
        <div className="bs__duo">
          <div className="bs__col">
            <LineTotals away={box.away} home={box.home} />
            {/* The game's win-probability arc — the retrospective companion
                to the three stars (both are the WPA story). Renders nothing
                at a park with no win-prob feed. */}
            <WinProbChart
              points={winProbPoints}
              bigPlays={winProbBigPlays}
              awayAbbr={box.away.abbreviation}
              homeAbbr={box.home.abbreviation}
              awayId={box.away.id}
              homeId={box.home.id}
              awayTreatment={winProbTreatment?.away}
              homeTreatment={winProbTreatment?.home}
            />
          </div>
          <div className="bs__col">
            <Decisions decisions={box.decisions} />
            <PlayOfTheGame
              play={potg}
              highlight={potgHighlight}
              awayAbbr={box.away.abbreviation}
              homeAbbr={box.home.abbreviation}
            />
            {/* Stacked in this right-hand column (rather than a full-width
                row of its own) so on desktop/ipad it fills the space the
                shorter right column leaves beside the left column's
                totals/win-prob arc — see GamePhotosStrip.jsx for why it's
                safe here (inside the seal) but not above it. */}
            <GamePhotosStrip gamePk={feed?.gamePk} />
          </div>
        </div>
        {/* Three Stars breaks out of the duo into its own full-width row —
            right beneath Photos, ahead of the day-level Statcast/Insights
            digests — so its three cards can lay out horizontally instead of
            being squeezed into the half-width right column. */}
        <ThreeStars stars={stars} />
        <GameStoryCard feed={feed} />
        {/* Its own full-width row — three tiles across on desktop/ipad,
            stacked on phone (see .bs__statcastRow's wide-breakpoint
            override). */}
        <StatcastLeadersCard feed={feed} insights={insights} />
        {/* The catch-all for whatever the game turned up as notable. */}
        <InsightsCard calloutNotes={calloutNotes} />
      </section>

      <section className="bs__section" aria-labelledby="bs__title">
        {/* No section heading here — the masthead's own "Box score" h2
            (id="bs__title" below) already titles this section; a second
            identical h2 would just duplicate it in the heading list. */}
        {/* The line score spans the full section width (not squeezed into a
            duo column) on every breakpoint — the one row every scorebook page
            reads across in one line. */}
        <Scoreboard
          away={box.away}
          home={box.home}
          innings={box.innings}
          onSection={onSection}
          treatments={winProbTreatment}
        />
        {/* Headingless on purpose — the kraft tab and the posters say what it
            is, and the page already spends "Highlights" on the section above.
            Rendered here, inside the seal, is what makes it safe: see
            GameVideoRow.jsx. */}
        <GameVideoRow items={highlights} />
        <InningTally rows={inningDigest} away={box.away} home={box.home} treatments={winProbTreatment} />
        <div className="bs__duo">
          <div className="bs__col">
            <InfoCard fields={awayFields} />
            <TeamBlock side={box.away} theme={awayTheme} />
            {/* Each own independent card, outside the batting/pitching card
                above — not nested tail sections of it (see BoxAbs/BoxDefense). */}
            <BoxAbs feed={feed} sideKey="away" abbr={box.away.abbreviation} theme={awayTheme} />
            <BoxDefense feed={feed} sideKey="away" theme={awayTheme} />
          </div>
          <div className="bs__col">
            <InfoCard fields={homeFields} />
            <TeamBlock side={box.home} theme={homeTheme} />
            <BoxAbs feed={feed} sideKey="home" abbr={box.home.abbreviation} theme={homeTheme} />
            <BoxDefense feed={feed} sideKey="home" theme={homeTheme} />
          </div>
        </div>
        <GameInfo rows={box.footNotes} />
      </section>

      {modalId != null && <UmpireAccuracyModal id={modalId} onClose={() => setModalId(null)} />}
    </div>
  )
})

// How many insight CARDS the Insights card shows before folding the rest
// behind a Show-more button (the former-teammates pattern). The notes arrive
// already ranked by worthiness (see computeGameCalloutNotes), so the cap
// keeps the most impactful ones on top without dropping anything.
const INSIGHTS_SHOWN = 6

// Every note about the same player (or, for a club-level note, the same
// team) folds into ONE card with a bullet per note, instead of one card per
// note — a hitter with a streak note AND a platoon split shouldn't get two
// cards competing for grid space. `calloutNotes` arrives globally sorted by
// worthiness (see computeGameCalloutNotes), so a group's position is set by
// its first (i.e. highest-scored) note and the resulting group order stays
// worthiness-ranked without a re-sort.
function groupCalloutNotes(notes) {
  const groups = []
  const byKey = new Map()
  for (const note of notes) {
    const key = note.personId != null ? `p:${note.personId}` : `t:${note.teamId}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        personId: note.personId,
        personName: note.personName,
        teamId: note.teamId,
        teamName: note.teamName,
        oppTeamId: note.oppTeamId,
        oppTeamName: note.oppTeamName,
        notes: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.notes.push(note)
  }
  return groups
}

// The three Statcast superlatives (see computeGameSuperlatives), each
// resolved to the "baseball card" shape PerformerCard renders via
// resolveCardPlayer (boxscore.js). Filters out any superlative whose value or
// player couldn't be resolved (most MiLB parks carry no tracking data at all).
function statcastCards(feed, insights) {
  const {
    maxVelo, maxVeloType, maxVeloPlayerId,
    hardestHit, hardestHitPlayerId,
    longestHit, longestHitPlayerId,
  } = insights ?? {}
  return [
    maxVelo != null && {
      label: 'Fastest pitch',
      player: resolveCardPlayer(feed, maxVeloPlayerId),
      stat: `${maxVelo.toFixed(1)} MPH${maxVeloType ? ` · ${maxVeloType}` : ''}`,
    },
    hardestHit != null && {
      label: 'Hardest hit',
      player: resolveCardPlayer(feed, hardestHitPlayerId),
      stat: `${hardestHit.toFixed(1)} MPH`,
    },
    longestHit != null && {
      label: 'Longest ball',
      player: resolveCardPlayer(feed, longestHitPlayerId),
      stat: `${Math.round(longestHit)} FT`,
    },
  ]
    .filter(Boolean)
    .filter((c) => c.player)
    .map((c) => ({ label: c.label, entry: { ...c.player, stat: c.stat } }))
}

// Whole-game Statcast superlatives — the fastest pitch, the hardest-hit
// ball, the longest ball, whoever owns each — rendered as the same
// PerformerCard "baseball card" tile the past-day recap's Top
// Performers/Statcast Leaders use (headshot, team, stat line). Its own
// full-width card between the linescore column and the two team cards (see
// BoxScoreBody) rather than folded into the Insights card below,
// so the three tiles can lay out as their own row instead of competing with
// the callout-notes waterfall for width. Hidden entirely when the feed
// carried no tracking data (most MiLB parks), same graceful-degrade as the
// per-half Statcast row in the innings view (which keeps its own plain-text
// StatcastCard — no boxscore to resolve a headshot against mid-game).
function StatcastLeadersCard({ feed, insights }) {
  const cards = statcastCards(feed, insights)
  if (cards.length === 0) return null
  return (
    <section className="bs__statcastCard">
      <SectionMasthead as="h3" title="Statcast Leaders" />
      <div className="bs__statcastRow">
        {cards.map(({ label, entry }) => (
          <div className="bs__statcastCol" key={label}>
            <h4 className="playercard__bucket">{label}</h4>
            <ul className="playercard__list">
              <PerformerCard entry={entry} />
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// Every leader/streak/situational-record note that fired somewhere in the
// game (see computeGameCalloutNotes). Hidden entirely when nothing fired.
function InsightsCard({ calloutNotes }) {
  const [showAll, setShowAll] = useState(false)
  const hasNotes = calloutNotes && calloutNotes.length > 0
  if (!hasNotes) return null
  const groups = groupCalloutNotes(calloutNotes)
  const shownGroups = showAll ? groups : groups.slice(0, INSIGHTS_SHOWN)
  const hiddenCount = groups.length - shownGroups.length
  return (
    <section className="bs__insights">
      <SectionMasthead as="h3" title="Insights" />
      {/* Every leader/streak/situational-record note that fired somewhere in
          the game (see computeGameCalloutNotes) — the same notes shown one at
          a time on the play they belong to in the innings view, rolled up
          here as tonight's full set with the game's outcome folded into the
          record-based ones ("moved to 18-2…"), grouped one card per player
          (or club) with a headshot/logo(s) so it's clear at a glance who it's
          about. A waterfall column layout (see .bs__noteGrid) packs the
          variable-height cards tightly instead of stretching every row to its
          tallest card. Ranked most-impactful-first by the shared worthiness
          score; the tail waits behind Show more. */}
      <div className="bs__noteGrid">
        {shownGroups.map((group, i) => (
          <InsightNoteCard key={i} group={group} />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="bs__noteMore" onClick={() => setShowAll(true)}>
          Show {hiddenCount} more {hiddenCount === 1 ? 'insight' : 'insights'}
        </button>
      )}
    </section>
  )
}

// One player's (or club's) insight card: the headshot (or, for a note about
// a club rather than a person — a situational team record — that club's
// logo, both logos when it pits two clubs against each other) beside his
// name and a bullet per note that fired for him tonight.
function InsightNoteCard({ group }) {
  return (
    <div className="bs__noteCard">
      <span className="bs__noteAvatar">
        {group.personId != null ? (
          <Headshot personId={group.personId} name={group.personName} teamId={group.teamId} className="bs__noteShot" />
        ) : (
          <span className="bs__noteLogos">
            <TeamLogo teamId={group.teamId} name={group.teamName} size={26} />
            {group.oppTeamId != null && (
              <TeamLogo teamId={group.oppTeamId} name={group.oppTeamName} size={26} />
            )}
          </span>
        )}
      </span>
      <span className="bs__noteBody">
        {group.personName && <span className="bs__noteWho">{group.personName}</span>}
        {group.notes.map((note, i) => (
          <CalloutNote key={i} text={note.text} />
        ))}
      </span>
    </div>
  )
}

// The Attendance fill-in's "i" glyph + % full note — the same tap-glyph-
// unfolds-in-place idiom as the lineup page's own AttendanceFact
// (TeamInfo.jsx), reusing its .attendance__* styling and InfoIcon glyph.
// Only reached (see homeFields above) when the feed posted a figure, so no
// separate "not posted yet" branch is needed here; degrades to the plain
// attendance figure when the park isn't one of the 30 MLB parks on file
// (see ballparkData.js) or its capacity can't be paired with tonight's count.
function AttendanceValue({ venue, attendance }) {
  const [open, setOpen] = useState(false)
  const park = ballparkFor(venue)
  const count = Number(attendance.replace(/,/g, ''))
  const pctFull = park?.capacity && count ? Math.round((count / park.capacity) * 100) : null

  if (!pctFull) return attendance

  return (
    <>
      <span className="attendance__value">
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
      </span>
      {open && (
        <p className="attendance__note">
          <span className="attendance__note-pct">{pctFull}% full</span>
          <span className="attendance__note-cap">{park.capacity.toLocaleString()} capacity</span>
        </p>
      )}
    </>
  )
}

// A card of the scorebook's labeled fill-in boxes — each a small caption over
// its value, so you read a box and copy it into the matching slot on the sheet.
// Anything the feed didn't post shows "—".
function InfoCard({ fields }) {
  return (
    <div className="bs__fill">
      {fields.map((f) => (
        <div
          className={`bs__field${f.wide ? ' bs__field--wide' : ''}`}
          key={f.label}
        >
          <span className="bs__fieldLabel">{f.label}</span>
          <span className="bs__fieldValue">{f.value || '—'}</span>
        </div>
      ))}
    </div>
  )
}

function TeamBlock({ side, theme }) {
  return (
    <section className={`bs__team ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <SectionMasthead as="h3" title={<TeamLink id={side.id}>{side.teamName}</TeamLink>} />

      <div className="bs__scroll">
        {/* Columns follow the #22 scorebook's batter-totals order (AB·R·H·RBI),
            matching MLB.com, so each row transcribes straight across. */}
        <table className="bs__grid bs__grid--bat">
          <thead>
            <tr>
              <th className="bs__nameCol">Batting</th>
              <th>AB</th>
              <th>R</th>
              <th>H</th>
              <th>RBI</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map((b) => (
              <tr key={b.id} className={b.isSub ? 'bs__sub' : ''}>
                <td className="bs__nameCol">
                  <span className="bs__player">
                    {b.mark && <span className="bs__mark">{b.mark}</span>}
                    <PlayerLink id={b.id} className="bs__pname">{b.name}</PlayerLink>
                    {b.position && <NumPos num={b.num} pos={b.position} />}
                  </span>
                </td>
                <td>{b.ab}</td>
                <td>{b.r}</td>
                <td>{b.h}</td>
                <td>{b.rbi}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bs__totals">
              <td className="bs__nameCol">Totals</td>
              <td>{side.batTotals.ab}</td>
              <td>{side.batTotals.r}</td>
              <td>{side.batTotals.h}</td>
              <td>{side.batTotals.rbi}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {side.footnotes.length > 0 && (
        <ul className="bs__footnotes">
          {side.footnotes.map((n) => (
            <li key={n.label}>
              <span className="bs__mark">{n.label}</span>
              {n.value}
            </li>
          ))}
        </ul>
      )}

      {side.notes.map((g) => (
        <div className="bs__notes" key={g.title}>
          <h4 className="bs__notesTitle">{g.title}</h4>
          {g.rows.map((r, i) => (
            <p className="bs__note" key={i}>
              <span className="bs__noteLabel">{r.label}:</span> {r.value}
            </p>
          ))}
        </div>
      ))}

      <div className="bs__scroll">
        {/* Columns match the #22 scorebook's pitcher table: throwing hand, IP,
            pitch count, batters faced, then H·R·ER·BB·K. (SO is the scorebook's
            K; HR/ERA/strike-split aren't on the sheet, so they're dropped.) */}
        <table className="bs__grid bs__grid--pit">
          <thead>
            <tr>
              <th className="bs__nameCol">Pitching</th>
              <th>R/L</th>
              <th>IP</th>
              <th>P</th>
              <th>BF</th>
              <th>H</th>
              <th>R</th>
              <th>ER</th>
              <th>BB</th>
              <th>K</th>
            </tr>
          </thead>
          <tbody>
            {side.pitchers.map((p) => (
              <tr key={p.id}>
                <td className="bs__nameCol">
                  <span className="bs__player">
                    <PlayerLink id={p.id} className="bs__pname">{p.name}</PlayerLink>
                    {p.num !== '' && p.num != null && (
                      <span className="bs__pos">
                        <span className="bs__unum">{p.num}</span>
                      </span>
                    )}
                    {p.dec && (
                      <span
                        className={`bs__dec bs__dec--${
                          p.dec === 'L' ? 'loss' : 'win'
                        }`}
                      >
                        {p.dec}
                      </span>
                    )}
                  </span>
                </td>
                <td className="bs__hand">{p.hand || '—'}</td>
                <td>{p.ip}</td>
                <td>{p.pitches}</td>
                <td>{p.bf}</td>
                <td>{p.h}</td>
                <td>{p.r}</td>
                <td>{p.er}</td>
                <td>{p.bb}</td>
                <td>{p.so}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bs__totals">
              <td className="bs__nameCol">Totals</td>
              <td />
              <td>{side.pitchTotals.ip}</td>
              <td />
              <td>{side.pitchTotals.bf}</td>
              <td>{side.pitchTotals.h}</td>
              <td>{side.pitchTotals.r}</td>
              <td>{side.pitchTotals.er}</td>
              <td>{side.pitchTotals.bb}</td>
              <td>{side.pitchTotals.so}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {side.pitchNotes.length > 0 && (
        <div className="bs__notes">
          <h4 className="bs__notesTitle">Pitching</h4>
          {side.pitchNotes.map((r, i) => (
            <p className="bs__note" key={i}>
              <span className="bs__noteLabel">{r.label}:</span> {r.value}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

// This club's whole-game ABS (Automated Ball-Strike) challenge tally — the
// same AbsRow StatBox shows one half at a time (src/api/challenges.js),
// walked through the whole game (Infinity — same "entering a half that never
// comes" sentinel BoxDefense uses below) since the box score is already
// behind its own seal. Previously this data only reached the page as raw
// feed text buried in the Pitching notes ("ABS Challenge: ATL 1-2…"); this is
// the same StatBox pip row instead of a second copy of it. MLB only —
// gameHasAbs is false at every MiLB park. Its own independent card below the
// team's batting/pitching card (BoxScoreBody), not a tail section of it —
// bs__abscard scopes the attached-header + card-frame treatment (see
// index.css) to just this copy of the shared .abs/.abs__title markup; the
// innings view's own AbsChallengesCard (StatBox.jsx) keeps its own look.
function BoxAbs({ feed, sideKey, abbr, theme }) {
  if (!gameHasAbs(feed)) return null
  const side = selectChallengeState(feed, Infinity, 'bottom')[sideKey]
  return (
    <div className={`abs bs__abscard ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <span className="abs__title">ABS Challenges</span>
      <div className="abs__rows">
        <AbsRow teamId={side.teamId} abbr={abbr} outcomes={side.outcomes} />
      </div>
    </div>
  )
}

// The team's complete defensive alignment for the game — the same scorebook
// diamond as the innings view (api/defense.js), but with every substitution
// through the game's final play folded in (or, for a game still in progress
// when this box score is viewed, every substitution made so far). The Infinity
// "through" cutoff means "entering a half that never comes" — i.e. the whole
// game. Safe to compute here: the whole box score is already behind its own
// SealBox, so there's nothing left to spoil by walking the full play-by-play.
// Its own independent card below BoxAbs, not a tail section of the team's
// batting/pitching card — bs__defensecard scopes the attached-header +
// standalone-card treatment (see index.css) to just this copy of the shared
// .halfdefense/.defdiamond markup; the innings view's own DefenseSection
// (EnteringReference.jsx) keeps its own floating header + bordered diamond.
function BoxDefense({ feed, sideKey, theme }) {
  const defense = defenseEntering(feed, sideKey, Infinity, 'bottom')
  if (defense.length === 0) return null
  return (
    <section
      className={`halfdefense bs__defensecard ${headerThemeClass(theme)}`.trim()}
      style={headerThemeStyle(theme)}
    >
      <h4 className="halfdefense__title">Defense</h4>
      <DefenseDiamond defense={defense} />
    </section>
  )
}

// The final tally card — each club's R/H/E/LOB by abbreviation — lifted to the
// top of the page as the first thing you copy onto the #22 sheet. The line score
// below fills in the inning-by-inning story; this is the bottom-line summary.
function LineTotals({ away, home }) {
  return (
    <div className="bs__totalsCard">
      <table className="bs__grid bs__grid--totals">
        <thead>
          <tr>
            <th className="bs__nameCol">Team</th>
            <th>R</th>
            <th>H</th>
            <th>E</th>
            <th>LOB</th>
          </tr>
        </thead>
        <tbody>
          {[away, home].map((side) => (
            <tr key={side.teamName}>
              <td className="bs__nameCol">
                <span className="bs__pname">
                  {side.abbreviation || side.teamName}
                </span>
              </td>
              <td className="bs__totCell">{side.line.r}</td>
              <td>{side.line.h}</td>
              <td>{side.line.e}</td>
              <td>{side.line.lob}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The scorebook's line score: runs by inning (1…N, extras included) then each
// club's R/H/E, one row per team the way it reads across the bottom of the #22
// sheet. The name column carries each club's logo (linked to its team page)
// rather than a text nickname; each half-inning a fixed, equal-width bordered
// box, and any half that scored inked bold red. A played half (a real number,
// 0 included) is itself a button to that half-inning in the Innings view;
// 'X' (the team never batted that half) isn't. (LOB and the winning pitcher
// live elsewhere: the totals card up top and the decisions block above.)
//
// The logo sits on its jersey-tinted tile (TeamTreatmentMark, `treatments` ==
// `winProbTreatment` from BoxScoreBody) — the same shared tile the scorebug
// HUD (Scorebug.jsx), the slate card, and the in-game masthead all wear,
// rather than a bare mark floating with no fill of its own.
function Scoreboard({ away, home, innings, onSection, treatments }) {
  const rows = [
    { side: away, gameSide: 'away', cells: innings.map((i) => i.away), half: 'top' },
    { side: home, gameSide: 'home', cells: innings.map((i) => i.home), half: 'bottom' },
  ]
  return (
    <div className="bs__board">
      <div className="bs__scroll">
        <table className="bs__grid bs__grid--board">
          <thead>
            <tr>
              <th className="bs__boardName" />
              {innings.map((i) => (
                <th key={i.num} className="bs__boardInn">
                  {i.num}
                </th>
              ))}
              <th className="bs__boardFinal">R</th>
              <th className="bs__boardFinal">H</th>
              <th className="bs__boardFinal">E</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ side, gameSide, cells, half }) => (
              <tr key={side.teamName}>
                <td className="bs__boardName">
                  <TeamLink id={side.id} className="bs__boardLogo" ariaLabel={side.teamName}>
                    <TeamTreatmentMark
                      teamId={side.id}
                      name={side.teamName}
                      treatment={treatments?.[gameSide]}
                      side={gameSide}
                      size={24}
                      block="bs__boardLogobox"
                    />
                  </TeamLink>
                </td>
                {cells.map((v, i) => {
                  const played = typeof v === 'number'
                  const scored = played && v > 0
                  const label = `${half === 'bottom' ? 'Bottom' : 'Top'} ${ordinal(innings[i].num)}`
                  return (
                    <td
                      key={innings[i].num}
                      className={`bs__boardInn${
                        scored ? ' bs__boardInn--scored' : ''
                      }`}
                    >
                      {played && onSection ? (
                        <button
                          type="button"
                          className="bs__boardCellBtn"
                          onClick={() => onSection(stepToSection(2, innings[i].num, half))}
                          aria-label={label}
                        >
                          {v}
                        </button>
                      ) : (
                        v
                      )}
                    </td>
                  )
                })}
                <td className="bs__boardFinal">{side.line.r}</td>
                <td className="bs__boardFinal">{side.line.h}</td>
                <td className="bs__boardFinal">{side.line.e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Pitchers of record, stacked one per line. Each name carries its season line in
// parens — (W-L) for the win and loss, (saves) for the save — the way a printed
// box score writes the decisions.
function Decisions({ decisions }) {
  // The name links to his player page (PlayerLink degrades to plain text if
  // the feed carried no id — never a dead link); the season record stays
  // plain text outside the link, same split as every batting/pitching row.
  const withRec = (id, name, rec) => (
    <>
      <PlayerLink id={id}>{name}</PlayerLink>
      {rec ? ` (${rec})` : ''}
    </>
  )
  const parts = [
    decisions.win && {
      k: 'Win',
      v: withRec(decisions.winId, decisions.win, decisions.winRecord),
    },
    decisions.loss && {
      k: 'Loss',
      v: withRec(decisions.lossId, decisions.loss, decisions.lossRecord),
    },
    decisions.save && {
      k: 'Save',
      v: withRec(decisions.saveId, decisions.save, decisions.saveRecord),
    },
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div className="bs__decisions">
      {parts.map((p) => (
        <span className="bs__decision" key={p.k}>
          <span className="bs__decisionK">{p.k}</span>
          <span className="bs__decisionV">{p.v}</span>
        </span>
      ))}
    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// The night's single most memorable moment (see computePlayOfTheGame) — the
// play itself, not a player, so it sits above the three stars. Hidden entirely
// when WPA isn't available (most MiLB parks).
//
// `highlight` is the eligible video clip for this exact play, or null — which
// is the majority case (a clip was matched on 32-41 of 44 sampled games, but
// coverage is genuinely uneven). When it's null the card renders exactly as it
// did before the affordance existed: no empty state, nothing additive is
// missing, this is purely a bonus when MLB happens to have cut the play.
//
// Everything here is already inside the box score's single top-level SealBox
// (see BoxScore above), which is what makes the poster safe: it's an image of
// a play whose description, score and players this same card is printing in
// text two lines up, so it adds no information the reader doesn't already
// have. That is the whole argument — it does NOT generalize to a surface
// where the play isn't already spelled out.
function PlayOfTheGame({ play, highlight, awayAbbr, homeAbbr }) {
  const [watchOpen, setWatchOpen] = useState(false)
  // A poster URL that 404s would leave a broken frame on the card, so a failed
  // load falls back to the plain text button rather than an empty box.
  const [posterFailed, setPosterFailed] = useState(false)
  if (!play || !play.desc) return null
  const halfLabel = play.half === 'top' ? 'Top' : 'Bottom'
  const hasScore = play.awayScore != null && play.homeScore != null
  const poster = highlight && !posterFailed ? highlightPoster(highlight) : null
  // Generic label only — never the clip's own title, same discipline as
  // PlayByPlay's per-play button: the title narrates the play in words the
  // card's own prose hasn't necessarily been read yet. The batter's name is
  // enough to say what you're about to watch, and the full context still
  // reaches screen readers through aria-label.
  const watchLabel = play.batterName
    ? `Watch highlight for ${play.batterName}`
    : 'Watch highlight for the play of the game'
  return (
    <div className="bs__potg">
      <SectionMasthead as="h3" title="Play of the game" />
      <div className="bs__potgBody">
        <Headshot
          personId={play.batterId}
          name={play.batterName}
          teamId={play.batterTeamId}
          className="bs__potgShot"
        />
        <div className="bs__potgMain">
          {play.batterName && (
            <div className="bs__potgWho">
              <PlayerLink id={play.batterId} className="bs__potgName">
                {play.batterName}
              </PlayerLink>
              {(play.batterTeamAbbr || play.batterPos) && (
                <span className="bs__potgMeta">
                  {[play.batterTeamAbbr, play.batterPos].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )}
          <p className="bs__potgDesc">
            {play.inning != null && (
              <span className="bs__potgWhen">
                {halfLabel} {ordinal(play.inning)}{' '}
              </span>
            )}
            {play.desc}
            {/* The score right after this play, so the moment reads with its
                consequence attached — bold, and (unlike the narrative above it)
                not run through title case: team abbreviations stay shouting
                like the rest of the sheet. */}
            {hasScore && (
              <span className="bs__potgScore">
                {' '}
                {awayAbbr} {play.awayScore}, {homeAbbr} {play.homeScore}
              </span>
            )}
          </p>
        </div>
      </div>
      {/* The poster IS the button when there's a frame to show — a 16:9 still
          with a play badge over it, which is the affordance the team/player
          rails will read as too. With no usable poster it degrades to the same
          plain kraft pill the innings view's per-play button uses, so the
          feature never depends on the image resolving. */}
      {highlight && (
        <button
          type="button"
          className={`bs__potgWatch${poster ? ' bs__potgWatch--poster' : ''}`}
          onClick={() => setWatchOpen(true)}
          aria-label={watchLabel}
        >
          {poster && (
            <img
              className="bs__potgPoster"
              src={poster}
              alt=""
              loading="lazy"
              onError={() => setPosterFailed(true)}
            />
          )}
          <span className="bs__potgPlay">
            <span className="bs__potgPlayIcon" aria-hidden="true">▶</span> Watch
          </span>
        </button>
      )}
      {watchOpen && highlight && (
        <HighlightSheet item={highlight} onClose={() => setWatchOpen(false)} />
      )}
    </div>
  )
}

// The three stars of the game — the hockey-tradition nod, ranked by
// win-probability added (see computeThreeStars). Hidden entirely when WPA
// isn't available (most MiLB parks). One card markup for all entries (0-3
// of them — a candidate can be missing, not just WPA-unavailable) so the
// row reads as one family of cards at any width; the top mover gets a
// `--hero` modifier for extra weight (the inset gradient panel, borrowed
// from .team-score__grade) since it's still the single most important line
// on the card. On phone that pairs with a bigger typeface; from the
// horizontal-row breakpoint up, every card shares one photo size and one
// type scale (see 21a-box-score-stars.css) so the panel alone carries the
// emphasis in a row that otherwise reads as one uniform family.
function ThreeStars({ stars }) {
  if (!stars || stars.length === 0) return null
  return (
    <div className="bs__stars">
      <SectionMasthead as="h3" title="Three stars" />
      <ol className="stars3__row">
        {stars.map((s, i) => (
          <li className={`stars3__card${i === 0 ? ' stars3__card--hero' : ''}`} key={s.id}>
            <Headshot personId={s.id} name={s.name} teamId={s.teamId} className="stars3__shot" />
            <span className="stars3__copy">
              <span className="stars3__marks" aria-label={`${s.stars} star`}>
                {'★'.repeat(s.stars)}
              </span>
              <PlayerLink id={s.id} className="stars3__name">{s.name}</PlayerLink>
              {(s.teamName || s.pos) && (
                <span className="stars3__meta">{[s.teamName, s.pos].filter(Boolean).join(' · ')}</span>
              )}
            </span>
            <span className="stars3__stat">{s.stat}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// What's left of the info block after selectBoxscore peels off the
// structured fill-in-box fields (umpires, weather+wind, venue, attendance,
// first pitch, duration) and splits every per-player row onto its own team's
// TeamBlock — pitcher rows into `pitchNotes` there, HBP/IBB into that club's
// BATTING group: whole-game fields with no team owner (an ejection names its
// club in prose and has no roster name to key on), plus any entry that
// couldn't be matched to a roster name.
//
// An entry landing HERE that names a player is a parse bug, not a category —
// that is exactly how a double plunk ("Culpepper, K 2 (by Gasser, by
// Patrick)") ended up at the foot of the sheet. See splitGameNotes.
function GameInfo({ rows }) {
  if (rows.length === 0) return null
  return (
    <div className="bs__info">
      {rows.map((r, i) => (
        <p className="bs__infoRow" key={i}>
          <span className="bs__infoLabel">{r.label}:</span> {r.value}
        </p>
      ))}
    </div>
  )
}
