import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { filmCanExist } from '../api/expresslane/eligibility.js'
import { revealBoxScore } from './boxscore/revealBoxScore.js'
import { InningTally } from './boxscore/InningTally.jsx'
import { ScoringSummary } from './boxscore/ScoringSummary.jsx'
import { managerLabel } from '../api/game.js'
import { defenseEntering } from '../api/defense.js'
import { selectGameSeason, selectOfficials, selectIsFinal, selectVenueRef } from '../api/select.js'
import { stepToSection } from '../lib/route.js'
import { boxScoreOpensByDate } from '../lib/dates.js'
import { ordinal } from '../lib/format.js'
import { umpireAccuracySummary } from '../api/umpires.js'
import { selectChallengeState, gameHasAbs } from '../api/challenges.js'
import { useAsync } from '../hooks/useAsync.js'
import { useEventHistory } from '../hooks/postseason/useWsEvents.js'
import { SealBox } from '../components/SealBox.jsx'
import { Table } from '../components/ui/table/Table.jsx'
import { GuideLink } from '../components/chrome/GuideLink.jsx'
import { WinProbChart } from '../components/charts/WinProbChart.jsx'
import { HitChartCard } from './boxscore/HitChartCard.jsx'
import { FeatLabel } from './boxscore/FeatLabel.jsx'
import { AbsRow } from '../components/gamehud/StatBox.jsx'
import { GameStoryCard } from '../components/game/GameStoryCard.jsx'
import { StampGameButton } from '../components/logbook/StampGameButton.jsx'
import { HeritagePass } from '../components/heritage/HeritagePass.jsx'
import { heritageArt } from '../lib/heritage/art.js'
import { GamePhotosStrip } from '../components/game/GamePhotosStrip.jsx'
import { GameVideoRow } from '../components/highlights/GameVideoRow.jsx'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamTreatmentMark } from '../components/logo/TeamTreatmentMark.jsx'
import { resolveBallparkLayout } from '../lib/ballpark/layout/resolveLayout.js'
import { DefenseDiamond } from '../components/scoring/DefenseDiamond.jsx'
import { UmpireAccuracyModal } from '../components/umpire/UmpireAccuracyModal.jsx'
import { TierPill } from '../components/badges/TierPill.jsx'
import { UmpireLink } from '../components/umpire/UmpireLink.jsx'
import { ManagerLink } from '../components/team/ManagerLink.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { Card } from '../components/ui/frame/Card.jsx'
import { RefreshButton } from '../components/ui/control/RefreshButton.jsx'
import { CrowdIcon } from './lineup/parts.jsx'
import { ballparkFor } from '../lib/ballpark/ballparkData.js'
import { headerThemeFor, headerThemeStyle, headerThemeClass, themeKeyFor } from '../lib/headerTheme.js'
import { seasonTheme } from '../lib/identity/seasonMarks.js'
import { useStampUnseal } from '../hooks/useStamps.js'
import { useBoxScoreReveal } from '../hooks/useRevealProgress.js'
import { BoxRevealSyncMount } from '../components/sync/BoxRevealSyncMount.jsx'
import { StatcastLeadersCard, InsightsCard } from './boxscore/InsightCards.jsx'
import { Decisions, PlayOfTheGame, ThreeStars, GameInfo } from './boxscore/GameNotes.jsx'

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
    <span className="t-label t-label--nocaps bs__pos">
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
// Mounted only inside the reveal render: it fires once the box score is shown, never before, and hands
// up the final's winner (a club id, or null for a tie or a game not final), read here inside the seal.
function Opened({ onOpened, winnerId }) {
  useEffect(() => { onOpened(winnerId) }, [onOpened, winnerId])
  return null
}
const finalWinnerId = (feed) => {
  if (feed?.gameData?.status?.codedGameState !== 'F') return null
  const ls = feed.liveData?.linescore?.teams
  if (!ls || ls.home?.runs === ls.away?.runs) return null
  return feed.gameData.teams?.[ls.home.runs > ls.away.runs ? 'home' : 'away']?.id ?? null
}

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
  onOpened = null,
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
  const eventHistory = useEventHistory(feed)
  const stamped = useStampUnseal(feed?.gamePk)
  // THIS BOX SCORE'S OWN MARK (ADR-0049): the reader already lifted this seal,
  // here or on another of their devices. Alone of the two openers below, it
  // persists — one bit per gamePk, written only on a real tap.
  const { boxOpened, markBoxOpened } = useBoxScoreReveal(feed?.gamePk)
  // A THIRD OPENER (ADR-0117): the game's schedule date is before the slate's today. A date,
  // not a score, so it is read outside the seal. It persists nothing. Memoised on the date, so
  // the clock passing midnight does not open a seal under a reader who is looking at it.
  const officialDate = feed?.gameData?.datetime?.officialDate
  const openByDate = useMemo(() => boxScoreOpensByDate(officialDate), [officialDate])

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

      {/* THREE OPENERS, ONE INPUT. The reader's own stamp on this game (ADR-0048), their
          own record of having already lifted THIS seal (ADR-0049), and the game's date
          being before the slate's today (ADR-0117). All ride SealBox's existing
          `forceRevealed`, so the render-function gate is untouched: children are invoked
          only in the revealed branch (ADR-0001/0002); the flags choose WHICH branch
          renders, never what it computes.
          ONLY THE SECOND WRITES ANYTHING, and the `onReveal` gate is the load-bearing
          line: SealBox fires it whenever the box becomes shown, by tap OR by flag
          (SealBox.jsx). Handing it over unconditionally would let the stamp or the date
          record a permanent mark for a seal nobody touched. Under either flag there is no
          seal on screen, so there is no tap to record. (The Scores Unlocked day pass was
          another opener until ADR-0116.) */}
      <SealBox
        label="Tap to reveal the box score"
        forceRevealed={stamped || boxOpened || openByDate}
        onReveal={stamped || openByDate ? undefined : markBoxOpened}
        gamePk={feed?.gamePk}
      >
        {() => {
          const r = revealBoxScore(revealCacheRef, feed, winProbability, highlights, callouts, vsTeam, eventHistory)
          return (
            <>
            {/* Tells GameView the box score is open, so its series line may count this game. */}
            {onOpened && <Opened onOpened={onOpened} winnerId={finalWinnerId(feed)} />}
            <BoxScoreBody
              stampFacts={r.stampFacts}
              feed={feed}
              box={r.box}
              battedBalls={r.battedBalls}
              stars={r.stars}
              potg={r.potg}
              potgHighlight={r.potgHighlight}
              scoringSummary={r.scoringSummary}
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
            </>
          )
        }}
      </SealBox>

      <GuideLink path="/learn/read-a-box-score" />

      {/* Mobile-only: Refresh moves down here as a floating pill, same
          placement as the Innings page's own mobile Refresh (see
          .innings__refresh--float), instead of sitting in the header — the wide
          layout keeps it inline up top (see the boxscore__headright rule in
          index.css). Never shown once the game is Final. */}
      {!isFinal && (
        <div className="pagenav pagenav--boxscore">
          <RefreshButton
            onReload={onReload}
            loading={loading}
            lastUpdated={lastUpdated}
            className="innings__refresh--float"
          />
        </div>
      )}
    </div>
  )
}

// One section, ordered for a wide screen; a phone re-ranks the same blocks with
// CSS (styles/48-stamp-strip.css). Top to bottom on desktop: the Game Log stamp,
// the HIGHLIGHTS rule, totals + Three Stars beside decisions + the win-prob arc,
// the line score, the per-inning pitching tally, the game-story write-up, each
// club's info / batting + pitching / ABS / defense cards (away beside home),
// then Photos, Play of the Game, Statcast Leaders, Insights, the video row, the
// hit chart, and the game-info text at the very bottom so nothing is lost.
// Memoized: with the reveal cache above returning the same objects for the same
// inputs, every prop crossing this boundary keeps its identity across a
// re-render the feed didn't cause, so the whole sheet — hundreds of rows — sits
// that render out. It cannot render anything the un-memoized version would not
// have: memo only skips a render whose props are identical, and it is still
// mounted only from inside the SealBox reveal function (ADR-0002).
const BoxScoreBody = memo(function BoxScoreBody({ feed, box, battedBalls, stars, potg, potgHighlight, scoringSummary, highlights, winProbPoints, winProbBigPlays, winProbTreatment, insights, inningDigest, calloutNotes, managers, uniforms, scorebookWeather, onSection, stampFacts }) {
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
  // mechanism the lineup page's club-name bar uses, scoped per card here instead of to
  // one page-wide scope. `winProbTreatment` is the same jersey-treatment pair
  // already threaded to WinProbChart, so this is no new fetch. Null for a club with
  // no curated triad, which leaves that card on the app's default navy chrome.
  // Resolved on every render rather than memoized. It is a table lookup and two
  // string compares, and the overlay behind those tables refills them IN PLACE
  // (ADR-0050) — so a memo here would keep serving the pre-override triad until one
  // of its other deps happened to move. Same class of trap as ADR-0007.
  // The game's season (#1201), so an old box score reads its own year. A club
  // in a season-covered era wears the default chrome, not today's (#1626).
  const seasonYear = selectGameSeason(feed)
  const awayTheme = seasonTheme(box.away.id, seasonYear, headerThemeFor(box.away.id, themeKeyFor(box.away.id, 'away', winProbTreatment?.away)))
  const homeTheme = seasonTheme(box.home.id, seasonYear, headerThemeFor(box.home.id, themeKeyFor(box.home.id, 'home', winProbTreatment?.home)))
  const hpId = officialIdByRole.HP ?? null
  const { data: hpAccuracy } = useAsync(() => umpireAccuracySummary(hpId, { seasonYear }), [hpId, seasonYear])
  const [modalId, setModalId] = useState(null)
  // An umpire fill-in field's value, linked to their page when the crew list
  // resolved an id for that role (degrades to plain text otherwise — see
  // UmpireLink). '' passes through so InfoCard's '—' fallback still shows for
  // a role the feed didn't post.
  const umpValue = (role, name) => (name ? <UmpireLink id={officialIdByRole[role]} seasonYear={seasonYear}>{name}</UmpireLink> : '')
  const hpUmpireValue = u.hp ? (
    <>
      <UmpireLink id={hpId} seasonYear={seasonYear}>{u.hp}</UmpireLink>
      {hpAccuracy?.tier && (
        <button type="button" className="umps__tierbtn bs__tierbtn" onClick={() => setModalId(hpId)}>
          <TierPill tier={hpAccuracy.tier} />
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
      <section className="bs__section" aria-labelledby="bs__title">
        {/* ONE section, in the DESKTOP reading order. A phone reads a different
            order (Gary's, 2026-09-29) and gets it from the flex `order` rules
            in styles/48-stamp-strip.css, not from a second render: below the
            wide breakpoint the duo/col wrappers are `display: contents`, so
            every block here is a flex item of this one section and can be
            ranked freely — which is also why this is a single section rather
            than the old Highlights / Box score pair, whose boundary a phone
            order has to cross. The masthead's own "Box score" h2
            (id="bs__title") titles it. */}
        {/* The Logbook stamp, first thing on the sheet: a thin strip across the
            head of the page. Everything about why it is safe here — and only
            here — is in StampGameButton.jsx's header: it renders inside this
            page's SealBox reveal render, which is the whole client-side
            guarantee, and that is a render-function boundary, not a position
            on the page. */}
        <StampGameButton game={stampFacts} />
        <FeatLabel gamePk={feed?.gamePk} />
        <h2 className="bs__sectionTitle">Highlights</h2>
        {/* Wide: totals over the scoring summary beside decisions over the
            win-prob arc. The wrappers are transparent on a phone. */}
        <div className="bs__duo">
          <div className="bs__col">
            <LineTotals away={box.away} home={box.home} />
            <ScoringSummary groups={scoringSummary} box={box} filmEligible={filmCanExist(feed)} />
          </div>
          <div className="bs__col">
            <Decisions decisions={box.decisions} />
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
              highlights={highlights}
              filmEligible={filmCanExist(feed)}
              final={selectIsFinal(feed)}
            />
          </div>
        </div>
        {/* The line score spans the full section width (not squeezed into a
            duo column) on every breakpoint — the one row every scorebook page
            reads across in one line. */}
        <Scoreboard
          away={box.away}
          home={box.home}
          innings={box.innings}
          onSection={onSection}
          treatments={winProbTreatment}
          officialDate={feed?.gameData?.datetime?.officialDate}
        />
        <InningTally rows={inningDigest} away={box.away} home={box.home} treatments={winProbTreatment} />
        <GameStoryCard feed={feed} />
        {/* Away beside home. `--away`/`--home` name the columns for the phone
            order, which interleaves nothing between them but has to rank all
            four of one club's cards ahead of the other's. */}
        <div className="bs__duo">
          <div className="bs__col bs__col--away">
            <InfoCard fields={awayFields} />
            <TeamBlock side={box.away} theme={awayTheme} />
            {/* Each own independent card, outside the batting/pitching card
                above — not nested tail sections of it (see BoxAbs/BoxDefense). */}
            <BoxAbs feed={feed} sideKey="away" abbr={box.away.abbreviation} theme={awayTheme} />
            <BoxDefense feed={feed} sideKey="away" theme={awayTheme} />
          </div>
          <div className="bs__col bs__col--home">
            <InfoCard fields={homeFields} />
            <TeamBlock side={box.home} theme={homeTheme} />
            <BoxAbs feed={feed} sideKey="home" abbr={box.home.abbreviation} theme={homeTheme} />
            <BoxDefense feed={feed} sideKey="home" theme={homeTheme} />
          </div>
        </div>
        {/* Safe here (inside the seal) but not above it — see
            GamePhotosStrip.jsx. */}
        <GamePhotosStrip gamePk={feed?.gamePk} />
        <PlayOfTheGame
          play={potg}
          highlight={potgHighlight}
          awayAbbr={box.away.abbreviation}
          homeAbbr={box.home.abbreviation}
        />
        {/* Its own full-width row — three tiles across on desktop/ipad,
            stacked on phone (see .bs__statcastRow's wide-breakpoint
            override). */}
        <StatcastLeadersCard feed={feed} insights={insights} />
        {/* The catch-all for whatever the game turned up as notable. */}
        <InsightsCard calloutNotes={calloutNotes} feed={feed} />
        {/* Headingless on purpose — the kraft tab and the posters say what it
            is. Rendered here, inside the seal, is what makes it safe: see
            GameVideoRow.jsx. */}
        <GameVideoRow items={highlights} />
        <HitChartCard battedBalls={battedBalls} box={box} {...selectVenueRef(feed)} />
        <GameInfo rows={box.footNotes} />
        <ThreeStars stars={stars} />
      </section>

      {stampFacts?.status === 'Final' && (
        <section className="heritagepass-box" aria-label="Game souvenir">
          <h2>Heritage Pass</h2>
          <HeritagePass game={stampFacts} artwork={heritageArt(stampFacts.venue)} />
        </section>
      )}
      {modalId != null && <UmpireAccuracyModal id={modalId} seasonYear={seasonYear} onClose={() => setModalId(null)} />}
    </div>
  )
})

// The Attendance fill-in's crowd glyph + % full note — the same tap-glyph-
// unfolds-in-place idiom as the lineup page's own AttendanceFact
// (TeamInfo.jsx), reusing its .attendance__* styling and CrowdIcon glyph.
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
          <CrowdIcon />
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
    <Card as="div" body="flush" className="bs__fill">
      {fields.map((f) => (
        <div
          className={`bs__field${f.wide ? ' bs__field--wide' : ''}`}
          key={f.label}
        >
          <span className="bs__fieldLabel">{f.label}</span>
          <span className="bs__fieldValue">{f.value || '—'}</span>
        </div>
      ))}
    </Card>
  )
}

function TeamBlock({ side, theme }) {
  return (
    <Card body="flush" className={`bs__team ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <SectionMasthead as="h3" title={<TeamLink id={side.id}>{side.teamName}</TeamLink>} />

      {/* Columns follow the #22 scorebook's batter-totals order (AB·R·H·RBI),
          matching MLB.com, so each row transcribes straight across. */}
      <Table frame="bare" density="tight" label={`Batting, ${side.teamName}`} className="bs__grid bs__grid--bat">
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
            <tr key={b.id} className={b.isSub ? 'bs__row--substitute' : ''}>
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
      </Table>

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

      {/* Columns match the #22 scorebook's pitcher table: throwing hand, IP,
          pitch count, batters faced, then H·R·ER·BB·K. (SO is the scorebook's
          K; HR/ERA/strike-split aren't on the sheet, so they're dropped.) */}
      <Table frame="bare" density="tight" label={`Pitching, ${side.teamName}`} className="bs__grid bs__grid--pit">
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
                    <span className="t-label t-label--nocaps bs__pos">
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
      </Table>

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
    </Card>
  )
}

// This club's whole-game ABS (Automated Ball-Strike) challenge tally — the
// same AbsRow StatBox shows one half at a time (src/api/challenges.js),
// walked through the whole game (Infinity — same "entering a half that never
// comes" sentinel BoxDefense uses below) since the box score is already
// behind its own seal. Previously this data only reached the page as raw
// feed text buried in the Pitching notes ("ABS Challenge: ATL 1-2…"); this is
// the same StatBox pip row instead of a second copy of it. Renders only where
// the feed says the game runs the challenge system (gameHasAbs) — every MLB
// and Triple-A game, the Florida State League parks that run it, nothing at
// the levels that run no challenges. Its own independent card below the
// team's batting/pitching card (BoxScoreBody), not a tail section of it —
// bs__abscard scopes the attached-header + card-frame treatment (see
// index.css) to just this copy of the shared .abs/.abs__title markup; the
// innings view's own AbsChallengesCard (StatBox.jsx) keeps its own look.
function BoxAbs({ feed, sideKey, abbr, theme }) {
  if (!gameHasAbs(feed)) return null
  const side = selectChallengeState(feed, Infinity, 'bottom')[sideKey]
  return (
    <div className={`abs bs__abscard ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <span className="abs__title sectionhead--band">ABS Challenges</span>
      <div className="abs__rows">
        <AbsRow teamId={side.teamId} abbr={abbr} outcomes={side.outcomes} remaining={side.remaining} showOpenPips={false} />
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
      <h4 className="halfdefense__title sectionhead--band">Defense</h4>
      {/* The lineup page's park outline, with the game's substitutions on it (Gary, 2026-10-28). */}
      <DefenseDiamond defense={defense} layout={resolveBallparkLayout({ venueId: feed?.gameData?.venue?.id, venueName: feed?.gameData?.venue?.name, gameDate: feed?.gameData?.datetime?.officialDate })} label={`${feed?.gameData?.venue?.name ?? 'The park'} with the defense`} />
    </section>
  )
}

// The final tally card — each club's R/H/E/LOB by abbreviation — lifted to the
// top of the page as the first thing you copy onto the #22 sheet. The line score
// below fills in the inning-by-inning story; this is the bottom-line summary.
function LineTotals({ away, home }) {
  return (
    <Card as="div" body="flush" className="bs__totalsCard">
      <Table frame="bare" density="tight" className="bs__grid bs__grid--totals">
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
      </Table>
    </Card>
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
// HUD (HeaderBug.jsx), the slate card, and the in-game masthead all wear,
// rather than a bare mark floating with no fill of its own.
function Scoreboard({ away, home, innings, onSection, treatments, officialDate }) {
  const rows = [
    { side: away, gameSide: 'away', cells: innings.map((i) => i.away), half: 'top' },
    { side: home, gameSide: 'home', cells: innings.map((i) => i.home), half: 'bottom' },
  ]
  return (
    <Card as="div" body="flush" className="bs__board">
      <Table frame="bare" density="tight" label="Line score" className="bs__grid bs__grid--board">
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
                    season={officialDate}
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
      </Table>
    </Card>
  )
}
