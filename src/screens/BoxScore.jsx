import { useMemo, useState } from 'react'
import { selectBoxscore, computeThreeStars, computePlayOfTheGame, resolveCardPlayer } from '../api/boxscore.js'
import { selectWinProbPath } from '../api/winprob.js'
import { computeGameSuperlatives } from '../api/derive.js'
import { computeGameCalloutNotes } from '../api/callout-notes.js'
import { managerLabel } from '../api/game.js'
import { defenseEntering } from '../api/defense.js'
import { selectOfficials, selectIsFinal } from '../api/select.js'
import { stepToSection } from '../lib/route.js'
import { umpireAccuracySummary } from '../api/umpires.js'
import { selectChallengeState, gameHasAbs } from '../api/challenges.js'
import { useAsync } from '../hooks/useAsync.js'
import { SealBox } from '../components/SealBox.jsx'
import { WinProbChart } from '../components/WinProbChart.jsx'
import { AbsRow } from '../components/StatBox.jsx'
import { PerformerCard } from '../components/PastDayRecapBox.jsx'
import { CalloutNote } from '../components/CalloutNote.jsx'
import { GameStoryCard } from '../components/GameStoryCard.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'
import { UmpireAccuracyModal } from '../components/UmpireAccuracyModal.jsx'
import { UmpireTierPill } from '../components/UmpireTierPill.jsx'
import { UmpireLink } from '../components/UmpireLink.jsx'
import { ManagerLink } from '../components/ManagerLink.jsx'
import { GameScoreCard } from '../components/GameScoreCard.jsx'
import { RefreshButton } from './TeamInfo.jsx'

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
  callouts,
  vsTeam,
  onReload,
  loading,
  onSection,
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

  return (
    <div className="boxscore">
      <div className="boxscore__head">
        <h2 className="boxscore__title">Box score</h2>
        {!isFinal && (
          <div className="boxscore__headright">
            <RefreshButton onReload={onReload} loading={loading} />
          </div>
        )}
      </div>

      <SealBox label="Tap to reveal the box score">
        {() => {
          const box = selectBoxscore(feed)
          // Computed here, inside the reveal render, so WPA and the win-prob
          // path never reach the DOM before the tap — same gate as the box
          // score itself.
          const stars = computeThreeStars(winProbability, feed)
          const potg = computePlayOfTheGame(winProbability, feed)
          const winProbPoints = selectWinProbPath(winProbability)
          const insights = computeGameSuperlatives(feed)
          // Every leader/streak/situational-record note that fired somewhere
          // in the game (see api/callout-notes.js) — the same notes the
          // innings view shows one at a time on the play they belong to,
          // rolled up here into the Insights card.
          const calloutNotes = computeGameCalloutNotes(feed, callouts, vsTeam)
          return (
            <BoxScoreBody
              feed={feed}
              box={box}
              stars={stars}
              potg={potg}
              winProbPoints={winProbPoints}
              insights={insights}
              calloutNotes={calloutNotes}
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
          <RefreshButton onReload={onReload} loading={loading} className="refreshbtn--float" />
        </div>
      )}
    </div>
  )
}

// Two sections, since this page has grown well past the literal box score:
// HIGHLIGHTS is the night's story — final totals, decisions, Game Score, the
// win-prob arc, Play of the Game, Three Stars, Statcast Leaders, Insights,
// and now each team's own Game Story write-ups — everything you'd want above
// the fold before you get into the scorebook itself. BOX SCORE is the literal
// #22-page transcription: the line score (full-width, not squeezed into a
// column), then each team paired with its own header card — the visiting
// team's crew and first pitch above its batting/pitching, the home team's
// ballpark/weather/times above its own — with the complete MLB-style
// game-info text at the very bottom so nothing is lost.
function BoxScoreBody({ feed, box, stars, potg, winProbPoints, insights, calloutNotes, managers, uniforms, scorebookWeather, onSection }) {
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
    { label: 'Attendance', value: get('Att').replace(/\.\s*$/, '') },
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
        <h2 className="bs__sectionTitle">Highlights</h2>
        {/* The duo/col wrappers are transparent on a phone (display: contents
            — everything keeps stacking in this order on .bs__section's own
            gap) and become a two-up grid at the wide breakpoint: the left
            column runs totals above the decisions, the right column runs
            Play of the Game above Three Stars. */}
        <div className="bs__duo">
          <div className="bs__col">
            <LineTotals away={box.away} home={box.home} />
            {/* The game's win-probability arc, directly under the R/H/E/LOB
                totals — the retrospective companion to the three stars (both
                are the WPA story). Renders nothing at a park with no win-prob
                feed. */}
            <WinProbChart
              points={winProbPoints}
              awayAbbr={box.away.abbreviation}
              homeAbbr={box.home.abbreviation}
            />
            <Decisions decisions={box.decisions} />
            {/* Nested under the decisions rather than full-width up top — how
                tonight's game rated for excitement against the rest of the
                day's slate at this level, in the same visual family as the
                Team Page's Season Grade card. Renders nothing until the
                10-minute Game Score cron has scored this game. */}
            <GameScoreCard feed={feed} />
          </div>
          <div className="bs__col">
            <PlayOfTheGame play={potg} awayAbbr={box.away.abbreviation} homeAbbr={box.home.abbreviation} />
            <ThreeStars stars={stars} />
          </div>
        </div>
        {/* Full-width, directly under the totals/stars duo — right beneath
            Three Stars, ahead of the day-level Statcast/Insights digests. */}
        <GameStoryCard feed={feed} />
        {/* Its own full-width row — three tiles across on desktop/ipad,
            stacked on phone (see .bs__statcastRow's wide-breakpoint
            override). */}
        <StatcastLeadersCard feed={feed} insights={insights} />
        {/* The catch-all for whatever the game turned up as notable. */}
        <InsightsCard calloutNotes={calloutNotes} />
      </section>

      <section className="bs__section">
        <h2 className="bs__sectionTitle">Box score</h2>
        {/* The line score spans the full section width (not squeezed into a
            duo column) on every breakpoint — the one row every scorebook page
            reads across in one line. */}
        <Scoreboard away={box.away} home={box.home} innings={box.innings} onSection={onSection} />
        <div className="bs__duo">
          <div className="bs__col">
            <InfoCard fields={awayFields} />
            <TeamBlock side={box.away} feed={feed} sideKey="away" />
          </div>
          <div className="bs__col">
            <InfoCard fields={homeFields} />
            <TeamBlock side={box.home} feed={feed} sideKey="home" />
          </div>
        </div>
        <GameInfo rows={box.footNotes} />
      </section>

      {modalId != null && <UmpireAccuracyModal id={modalId} onClose={() => setModalId(null)} />}
    </div>
  )
}

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
// resolved to the "baseball card" shape PerformerCard renders — same
// resolveCardPlayer lookup daySuperlatives.js uses for the day-recap's own
// Statcast Leaders tiles. Filters out any superlative whose value or player
// couldn't be resolved (most MiLB parks carry no tracking data at all).
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
// full-width card between the linescore/Game Score column and the two team
// cards (see BoxScoreBody) rather than folded into the Insights card below,
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
      <h3 className="bs__insightsTitle">Statcast Leaders</h3>
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
      <h3 className="bs__insightsTitle">Insights</h3>
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

function TeamBlock({ side, feed, sideKey }) {
  return (
    <section className="bs__team">
      <h3 className="bs__teamname">
        <TeamLink id={side.id}>{side.teamName}</TeamLink>
      </h3>

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

      <BoxAbs feed={feed} sideKey={sideKey} abbr={side.abbreviation} />
      <BoxDefense feed={feed} sideKey={sideKey} />
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
// gameHasAbs is false at every MiLB park.
function BoxAbs({ feed, sideKey, abbr }) {
  if (!gameHasAbs(feed)) return null
  const side = selectChallengeState(feed, Infinity, 'bottom')[sideKey]
  return (
    <div className="abs">
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
function BoxDefense({ feed, sideKey }) {
  const defense = defenseEntering(feed, sideKey, Infinity, 'bottom')
  if (defense.length === 0) return null
  return (
    <section className="halfdefense">
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
function Scoreboard({ away, home, innings, onSection }) {
  const rows = [
    { side: away, cells: innings.map((i) => i.away), half: 'top' },
    { side: home, cells: innings.map((i) => i.home), half: 'bottom' },
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
            {rows.map(({ side, cells, half }) => (
              <tr key={side.teamName}>
                <td className="bs__boardName">
                  <TeamLink id={side.id} className="bs__boardLogo">
                    <TeamLogo teamId={side.id} name={side.teamName} size={28} />
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
function PlayOfTheGame({ play, awayAbbr, homeAbbr }) {
  if (!play || !play.desc) return null
  const halfLabel = play.half === 'top' ? 'Top' : 'Bottom'
  const hasScore = play.awayScore != null && play.homeScore != null
  return (
    <div className="bs__potg">
      <h3 className="bs__potgTitle">Play of the game</h3>
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
    </div>
  )
}

// The three stars of the game — the hockey-tradition nod, ranked by
// win-probability added (see computeThreeStars). Hidden entirely when WPA
// isn't available (most MiLB parks). The top mover gets the Game Score
// card's hero treatment (.team-score__grade's inset gradient panel, borrowed
// as .stars3__hero) since it's the single most important line on the card;
// #2/#3 fall into compact rows below, same idiom as .team-score__row--compact.
function ThreeStars({ stars }) {
  if (!stars || stars.length === 0) return null
  const [mvp, ...rest] = stars
  return (
    <div className="bs__stars">
      <h3 className="bs__starsTitle">Three stars</h3>
      <div className="stars3__hero">
        <Headshot personId={mvp.id} name={mvp.name} teamId={mvp.teamId} className="stars3__heroShot" />
        <div className="stars3__heroCopy">
          <span className="stars3__heroKicker" aria-label={`${mvp.stars} star`}>
            {'★'.repeat(mvp.stars)}
          </span>
          <PlayerLink id={mvp.id} className="stars3__heroName">{mvp.name}</PlayerLink>
          {(mvp.teamName || mvp.pos) && (
            <span className="stars3__heroMeta">{[mvp.teamName, mvp.pos].filter(Boolean).join(' · ')}</span>
          )}
        </div>
        <span className="stars3__heroStat">{mvp.stat}</span>
      </div>
      {rest.length > 0 && (
        <ol className="stars3__list">
          {rest.map((s) => (
            <li className="stars3__row" key={s.id}>
              <Headshot personId={s.id} name={s.name} teamId={s.teamId} className="stars3__rowShot" />
              <span className="stars3__rowWho">
                <span className="stars3__rowMarks" aria-label={`${s.stars} star`}>
                  {'★'.repeat(s.stars)}
                </span>
                <PlayerLink id={s.id} className="stars3__rowName">{s.name}</PlayerLink>
                {(s.teamName || s.pos) && (
                  <span className="stars3__rowMeta">{[s.teamName, s.pos].filter(Boolean).join(' · ')}</span>
                )}
              </span>
              <span className="stars3__rowStat">{s.stat}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// What's left of the info block after selectBoxscore peels off the
// structured fill-in-box fields (umpires, weather+wind, venue, attendance,
// first pitch, duration) and splits every per-pitcher row onto its own team's
// TeamBlock (see `pitchNotes` there): whole-game fields with no team owner,
// plus any entry that couldn't be matched to a roster name.
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
