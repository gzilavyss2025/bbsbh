import { useEffect, useState } from 'react'
import { computeTopPerformersByResult } from '../api/topPerformers.js'
import { rankDayHighlights, selectGameResults } from '../api/dayHighlights.js'
import { computeDaySuperlatives } from '../api/daySuperlatives.js'
import { fetchCallouts } from '../api/callouts.js'
import { fetchDayRecap, recapForSport } from '../api/dayRecap.js'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { useNav } from '../lib/nav.js'
import { apiDateToUrl } from '../lib/route.js'
import { LinkScope } from '../lib/nav.jsx'
import { SealBox } from './SealBox.jsx'
import { Loader } from './Loader.jsx'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { ProspectPill } from './ProspectPill.jsx'
import { scorePairsLine } from './GameResultFace.jsx'

// Final dates normally read one precomputed day-recap artifact. The per-game
// signal path remains as a fallback for dates not yet generated, and shares the
// same cache as a flipped slate card so revealing both never double-fetches a
// gamePk. Top Performers' fallback uses the lighter boxscore endpoint instead.

// "Face the Story": a row shows the winning signal's protagonist (headshot +
// name + team + stat, "baseball card" idiom matching Top Performers/Statcast
// Leaders) when dayHighlights.js resolved one, or falls back to a lighter
// team-logo-pair row for the signals with no single protagonist (margin/
// length storylines, the win-probability comeback) — see dayHighlights.js's
// `performer` field. The box-score link lives on the headline text itself, a
// button, rather than wrapping the whole row: the performer variant also
// needs its own PlayerLink/TeamLink buttons alongside, and HTML disallows
// nesting interactive elements inside a button.
function DayHighlightRow({ entry, dhLabel }) {
  const navigate = useNav()
  const goToBox = () => navigate(entry.boxScorePath)

  if (entry.performer) {
    const { performer } = entry
    // The headline already leads with the player's name ("Drake Baldwin: 2 HR
    // — …"), so the meta line carries only the team + notes, never the name
    // again — the repeated name read as a glitch.
    return (
      <li className="dayhl__row dayhl__row--performer">
        <span className="dayhl__rowShotwrap">
          <Headshot
            personId={performer.id}
            name={performer.name}
            teamId={performer.teamId}
            className="dayhl__rowShot"
          />
          {performer.position && <span className="playercard__posbadge">{performer.position}</span>}
        </span>
        <div className="dayhl__rowBody">
          <button type="button" className="dayhl__rowHeadlineBtn" onClick={goToBox}>
            {entry.headline}
          </button>
          <div className="dayhl__rowMeta">
            <TeamLogo teamId={performer.teamId} name={performer.teamAbbr} size={14} />
            <TeamLink id={performer.teamId}>{performer.teamAbbr}</TeamLink>
            {dhLabel && <span className="dayhl__rowSub">· {dhLabel}</span>}
            {entry.subCaption && <span className="dayhl__rowSub">· {entry.subCaption}</span>}
          </div>
        </div>
      </li>
    )
  }

  const { teams } = entry
  return (
    <li className="dayhl__row">
      <button type="button" className="dayhl__rowBtn dayhl__rowBtn--teams" onClick={goToBox}>
        <span className="dayhl__rowLogos">
          <TeamLogo teamId={teams?.winner?.id} name={teams?.winner?.abbr} size={20} />
          <TeamLogo teamId={teams?.loser?.id} name={teams?.loser?.abbr} size={20} />
        </span>
        <span className="dayhl__rowText">
          {entry.headline}
          {dhLabel && <span className="dayhl__rowGame"> · {dhLabel}</span>}
        </span>
      </button>
    </li>
  )
}

// n → "1st"/"2nd"/"7th" for the turning-point inning tag.
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

// The game's turning point — headshot + play-by-play + running score, the same
// idiom as the postseason series recap's Play of the Game (SeriesPlayOfTheGame
// in PostseasonSeriesPage.jsx). Reused here for the Game of the Day hero.
function TurningPoint({ tp }) {
  const halfLabel = tp.half === 'top' ? 'Top' : 'Bottom'
  const hasScore = tp.awayScore != null && tp.homeScore != null
  return (
    <div className="gotd__potg">
      <h4 className="gotd__potgTitle">Turning point</h4>
      <div className="gotd__potgBody">
        <Headshot personId={tp.batterId} name={tp.batterName} teamId={tp.batterTeamId} className="gotd__potgShot" />
        <div className="gotd__potgMain">
          {tp.batterName && (
            <div className="gotd__potgWho">
              <PlayerLink id={tp.batterId} className="gotd__potgName">
                {tp.batterName}
              </PlayerLink>
              {(tp.batterTeamAbbr || tp.batterPos) && (
                <span className="gotd__potgMeta">
                  {[tp.batterTeamAbbr, tp.batterPos].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )}
          <p className="gotd__potgDesc">
            {tp.inning != null && (
              <span className="gotd__potgWhen">
                {halfLabel} {ordinal(tp.inning)}{' '}
              </span>
            )}
            {tp.desc}
            {hasScore && (
              <span className="gotd__potgScore">
                {' '}
                {tp.awayAbbr} {tp.awayScore}, {tp.homeAbbr} {tp.homeScore}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

// "Tyler Tolbert" -> ["Tyler", "Tolbert"] (everything after the first space).
// Used so the name wraps to two lines next to the bigger headshot, without a
// fixed split table.
function splitFirstLast(full) {
  const i = (full ?? '').indexOf(' ')
  return i === -1 ? [full ?? '', ''] : [full.slice(0, i), full.slice(i + 1)]
}

// The game a performance came from, as a plain score line ("MIL 10, STL 2")
// linking to that game's (already-sealed) box score — not a PlayerLink/
// TeamLink, so it navigates directly rather than through LinkScope. Only the
// slate's live Top Performers box (src/components/TopPerformersBox.jsx)
// attaches `entry.game` — a past-day recap's Winners/Losers and Statcast
// tiles already sit inside a single game's own context, so PerformerCard
// renders this line only when the field is present.
function GameScoreLink({ game }) {
  const navigate = useNav()
  if (!game) return null
  return (
    <button
      type="button"
      className="plink playercard__score"
      onClick={() => navigate(game.boxScorePath)}
    >
      {scorePairsLine([
        [game.awayAbbr, game.awayScore],
        [game.homeAbbr, game.homeScore],
      ])}
    </button>
  )
}

// One "baseball card" tile: headshot (with position floated on it as a small
// badge, same idiom as the former-teammates cards' .teammatecard__posbadge),
// name (a clickable PlayerLink), team logo + abbreviation + an optional
// prospect pill, stat line underneath, and an optional game-score line (see
// GameScoreLink above). Exported: the box score's Insights card and the
// slate's live Top Performers box both reuse this exact tile — entry fields
// they don't carry (prospectRank/orgProspectRank, game) simply render nothing,
// rather than growing a second "baseball card" style per caller.
export function PerformerCard({ entry }) {
  const [first, last] = splitFirstLast(entry.name)
  return (
    <li className="playercard">
      <span className="playercard__shotwrap">
        <Headshot personId={entry.id} name={entry.name} teamId={entry.parentOrgId ?? entry.teamId} className="playercard__shot" />
        {entry.position && <span className="playercard__posbadge">{entry.position}</span>}
      </span>
      <div className="playercard__body">
        <div className="playercard__name">
          <PlayerLink id={entry.id}>
            {first} {last && <br className="playercard__namebreak" />}
            {last}
          </PlayerLink>
        </div>
        <div className="playercard__team">
          <TeamLogo teamId={entry.teamId} name={entry.teamAbbr} size={16} />
          <TeamLink id={entry.teamId}>{entry.teamAbbr}</TeamLink>
          {(entry.prospectRank || entry.orgProspectRank) && (
            <ProspectPill
              rank={entry.prospectRank}
              orgRank={entry.orgProspectRank}
              orgTeamId={entry.parentOrgId}
              orgTeamName={entry.teamAbbr}
            />
          )}
        </div>
        <div className="playercard__stat">{entry.stat}</div>
        <GameScoreLink game={entry.game} />
      </div>
    </li>
  )
}

// "Your Team": the favorite club's result up top, the answer to the first
// question a returning fan has ("did my team win?"). Reads the bare result
// (selectGameResults) so it shows even on a game with no standout; the team's
// own top line rides along when there is one. The whole card taps to the box
// score — the performer name stays plain text (not a link) so nothing
// interactive nests inside the button. `label` ("Game 1"/"Game 2") is set only
// on a doubleheader, so a single game shows no redundant tag. The "Your Team"
// heading lives in RecapPanel so both games of a twin bill share one, and the
// club's top performer rides alongside as a full PerformerCard (see RecapPanel).
//
// Score reads winner-first ("BREWERS 3, MARLINS 1"), the way a fan recounts a
// result — regardless of home/away; a tie keeps away/home order.
function winnerFirstPairs(result) {
  const away = [result.away.abbr, result.away.r]
  const home = [result.home.abbr, result.home.r]
  if (result.winnerId == null) return [away, home]
  return result.winnerId === result.home.id ? [home, away] : [away, home]
}
function YourTeamCard({ result, teamId, label }) {
  const navigate = useNav()
  const abbr = result.home.id === teamId ? result.home.abbr : result.away.abbr
  // winnerId is null on a tie (see selectGameResults) — show T, not a bogus L.
  const outcome = result.winnerId == null ? 'tie' : result.winnerId === teamId ? 'win' : 'loss'
  const badge = { win: 'W', loss: 'L', tie: 'T' }[outcome]
  return (
    <button
      type="button"
      className="yourteam"
      onClick={() => result.boxScorePath && navigate(result.boxScorePath)}
    >
      <TeamLogo teamId={teamId} name={abbr} size={34} />
      <span className="yourteam__body">
        {label && <span className="yourteam__game">{label}</span>}
        <span className="yourteam__result">
          <span className={`yourteam__badge yourteam__badge--${outcome}`}>{badge}</span>
          {scorePairsLine(winnerFirstPairs(result))}
        </span>
      </span>
    </button>
  )
}

// "Game of the Day": the day's #1-ranked highlight, promoted to a featured
// lead so the fan gets the story before the lists. Three beats, top to bottom:
// (1) the team logos + winner-first score (taps to the box), (2) the standout
// performer as a full PerformerCard — or, on a storyline with no single
// protagonist (margin/length/comeback), the narrative line instead — and
// (3) the turning point, a headshot + play-by-play (the postseason recap idiom,
// see TurningPoint). `dhLabel` tags a doubleheader game so its matchup isn't
// ambiguous.
function GameOfDayHero({ entry, dhLabel }) {
  const navigate = useNav()
  const { performer, teams, turningPoint } = entry
  return (
    <section className="dayhl__section">
      <h3 className="dayhl__title">Game of the Day</h3>
      <div className="gotd">
        <button type="button" className="gotd__scoreline" onClick={() => navigate(entry.boxScorePath)}>
          <span className="dayhl__rowLogos">
            <TeamLogo teamId={teams?.winner?.id} name={teams?.winner?.abbr} size={28} />
            <TeamLogo teamId={teams?.loser?.id} name={teams?.loser?.abbr} size={28} />
          </span>
          <span className="gotd__score">
            {scorePairsLine([
              [teams?.winner?.abbr, teams?.winner?.r],
              [teams?.loser?.abbr, teams?.loser?.r],
            ])}
          </span>
          {dhLabel && <span className="gotd__game">{dhLabel}</span>}
        </button>
        {performer ? (
          <>
            <ul className="playercard__list gotd__perfcard">
              <PerformerCard entry={performer} />
            </ul>
            {entry.subCaption && <p className="gotd__sub">{entry.subCaption}</p>}
          </>
        ) : (
          entry.story && <p className="gotd__story">{entry.story}</p>
        )}
        {turningPoint && <TurningPoint tp={turningPoint} />}
      </div>
    </section>
  )
}

function RecapPanel({ games, prospects, dateStr, sportId, favoriteTeamId, favoriteAffiliateIds }) {
  const getSignals = usePastGameSignals()
  const [state, setState] = useState({ loading: true, error: false, data: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: false, data: null })
    ;(async () => {
      const artifact = recapForSport(await fetchDayRecap(dateStr), sportId)
      if (artifact) {
        if (!cancelled) {
          setState({ loading: false, error: false, data: artifact })
        }
        return
      }

      const [performersByResult, entries, calloutsData] = await Promise.all([
        computeTopPerformersByResult({ games, prospects, dateStr }),
        Promise.all(
          games.map((game) =>
            getSignals(game.gamePk)
              .then(({ feed, winProb }) => ({ gamePk: game.gamePk, game, feed, winProb, dateStr }))
              .catch(() => null),
          ),
        ),
        // Same nightly bundle the pre-half strip/play cards read — one fetch
        // for the whole date, cached in-memory by fetchCallouts itself. Feeds
        // Day Highlights' protagonist sub-captions (dayHighlights.js); degrades
        // to {games:{}} on any failure or an un-generated date, same as every
        // other callouts consumer.
        fetchCallouts(apiDateToUrl(dateStr)),
      ])
      if (cancelled) return
        setState({
          loading: false,
          error: false,
          data: {
            performersByResult,
            highlights: rankDayHighlights(entries, calloutsData),
            results: selectGameResults(entries),
            superlatives: computeDaySuperlatives(entries),
          },
        })
    })().catch(() => {
        if (!cancelled) setState({ loading: false, error: true, data: null })
    })
    return () => {
      cancelled = true
    }
  }, [games, prospects, dateStr, sportId, getSignals])

  if (state.loading) {
    return <Loader size="inline" message="Crunching this day's games…" />
  }
  if (state.error) {
    return <p className="hint hint--error">Couldn&apos;t load this day&apos;s recap.</p>
  }
  if (!state.data) return null

  const { performersByResult, highlights, superlatives, results } = state.data
  const { winners, losers } = performersByResult

  // The lead: the day's #1 highlight becomes "Game of the Day"; the rest are
  // "What You Missed".
  const hero = highlights[0] ?? null
  const missed = highlights.slice(1)

  // Your Team: the favorite club (or, on a MiLB level, one of its affiliates)
  // if it played today — BOTH games on a doubleheader day, not just the opener.
  // Absent on older artifacts with no `results` array.
  const favIds = [favoriteTeamId, ...(favoriteAffiliateIds ?? [])].filter((id) => id != null)
  const yourGames = (results ?? [])
    .filter((r) => favIds.includes(r.away.id) || favIds.includes(r.home.id))
    .map((result) => {
      const teamId = favIds.includes(result.home.id) ? result.home.id : result.away.id
      // Match the club's own top line to THIS game — the box-score path
      // disambiguates a doubleheader (game 1 vs game 2), so a nightcap
      // performer isn't pinned under the opener's result. Falls back to
      // team-only when the path is absent (older artifact).
      const performer =
        [...winners, ...losers].find(
          (e) =>
            e.teamId === teamId &&
            (!result.boxScorePath || e.game?.boxScorePath === result.boxScorePath),
        ) ?? null
      return { result, teamId, performer }
    })
  // Label each row only when there's more than one — a single game needs no tag.
  const isTwinBill = yourGames.length > 1

  // Doubleheader detection: a matchup that appears twice on the slate. Rows for
  // those games get a "Game 1"/"Game 2" tag so a repeated matchup (e.g. the two
  // LAD/NYY games, one carrying Yamamoto's dominant start) isn't confusing.
  const matchupKey = (a, b) => [a, b].sort((x, y) => x - y).join('-')
  const dhCounts = {}
  for (const r of results ?? []) {
    const k = matchupKey(r.away.id, r.home.id)
    dhCounts[k] = (dhCounts[k] ?? 0) + 1
  }
  const dhLabel = (entry) =>
    entry.gameNumber != null && dhCounts[matchupKey(entry.teams?.winner?.id, entry.teams?.loser?.id)] > 1
      ? `Game ${entry.gameNumber}`
      : null

  // One person, one appearance: a player already carrying a highlight (the hero
  // or any "What You Missed" row) — or either Your Team line — is dropped from
  // Standout Performances, so a name never hits the eye twice in one recap.
  const shownIds = new Set(
    [
      ...highlights.map((h) => h.performer?.id),
      ...yourGames.map((g) => g.performer?.id),
    ].filter(Boolean),
  )
  const dedupe = (arr) => arr.filter((e) => !shownIds.has(e.id))
  const winnersD = dedupe(winners)
  const losersD = dedupe(losers)
  const hasPerformers = winnersD.length > 0 || losersD.length > 0

  const statcastCards = [
    { label: 'Longest HR', entry: superlatives.longestHomeRun },
    { label: 'Hardest Hit', entry: superlatives.hardestBaseHit },
    { label: 'Fastest K', entry: superlatives.fastestStrikeout },
  ].filter((c) => c.entry)

  const nothing = !hero && !hasPerformers && yourGames.length === 0 && statcastCards.length === 0

  // The revealed recap can run long (hero + Your Team + Standouts + What You
  // Missed) and push the game grid below the fold — a jump straight to the
  // sealed game cards, since the grid is the reason most people opened the
  // slate. Targets #slate-games in GameSelect; honors reduced-motion and hands
  // keyboard focus to the grid, not just the viewport.
  const jumpToGames = () => {
    const el = typeof document !== 'undefined' && document.getElementById('slate-games')
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }

  return (
    <LinkScope asOf={dateStr} sportId={sportId}>
      <div className="pastdayrecap__body">
        {!nothing && (
          <button type="button" className="recapjump" onClick={jumpToGames}>
            Jump to games <span aria-hidden="true">↓</span>
          </button>
        )}
        {yourGames.length > 0 && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">Your Team</h3>
            <div className="yourteam__list">
              {yourGames.map(({ result, teamId, performer }) => (
                <div className="yourteam__pair" key={result.gamePk}>
                  <YourTeamCard
                    result={result}
                    teamId={teamId}
                    label={isTwinBill ? `Game ${result.gameNumber ?? ''}`.trim() : null}
                  />
                  {performer && (
                    <ul className="playercard__list yourteam__perfcard">
                      <PerformerCard entry={performer} />
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {hero && <GameOfDayHero entry={hero} dhLabel={dhLabel(hero)} />}
        {hasPerformers && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">Standout Performances</h3>
            {winnersD.length > 0 && (
              <>
                <h4 className="playercard__bucket">In a Win</h4>
                <ul className="playercard__list">
                  {winnersD.map((e) => (
                    <PerformerCard key={e.id} entry={e} />
                  ))}
                </ul>
              </>
            )}
            {losersD.length > 0 && (
              <>
                <h4 className="playercard__bucket">In a Loss</h4>
                <ul className="playercard__list">
                  {losersD.map((e) => (
                    <PerformerCard key={e.id} entry={e} />
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        {/* What You Missed + Odds & Ends share one section — the day's other
            stories, then the freak-physics trivia strip as a footer, no second
            heading. */}
        {(missed.length > 0 || statcastCards.length > 0) && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">What You Missed</h3>
            {missed.length > 0 && (
              <ol className="dayhl__list">
                {missed.map((h) => (
                  <DayHighlightRow key={h.gamePk} entry={h} dhLabel={dhLabel(h)} />
                ))}
              </ol>
            )}
            {statcastCards.length > 0 && (
              <ul className="oddsends">
                {statcastCards.map(({ label, entry }) => (
                  <li key={label} className="oddsends__item">
                    <span className="oddsends__label">{label}</span>
                    <PlayerLink id={entry.id}>{entry.name}</PlayerLink>
                    <span className="oddsends__stat">{entry.stat}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {nothing && <p className="hint hint--prose">Nothing to recap for this day yet.</p>}
      </div>
    </LinkScope>
  )
}

// The past-day replacement for TopPerformersBox: one SealBox, keyed on
// date+level like ADR-0011, whose single reveal renders both Top Performers
// (split into Winners/Losers) and Day Highlights stacked underneath — one
// tap, one recap, since both are the same "flavor" of sealed daily digest.
//
// `revealedAll`/`onRevealAll` link this box's own seal to the page-level
// "Reveal all results" control (see PastPreview.jsx): tapping THIS seal also
// flips every game card (via onRevealAll), and tapping the OTHER control
// force-reveals this box too (via `forceRevealed`) — both buttons do the same
// thing. SealBox's onReveal fires either way shown becomes true, whether from
// this box's own tap or an external forceRevealed flip.
export function PastDayRecapBox({
  dateStr,
  sportId,
  games,
  prospectsData,
  revealedAll,
  onRevealAll,
  favoriteTeamId,
  favoriteAffiliateIds,
}) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [dateStr, sportId])
  const shown = revealed || revealedAll

  return (
    <div className="pastdayrecap">
      {!shown && <h2 className="topperf__banner">Day Recap</h2>}
      <SealBox
        key={`${dateStr}-${sportId}`}
        label="Tap to reveal this day's recap"
        forceRevealed={revealedAll}
        onReveal={() => {
          setRevealed(true)
          onRevealAll?.()
        }}
      >
        {() => (
          <RecapPanel
            games={games}
            prospects={prospectsData}
            dateStr={dateStr}
            sportId={sportId}
            favoriteTeamId={favoriteTeamId}
            favoriteAffiliateIds={favoriteAffiliateIds}
          />
        )}
      </SealBox>
    </div>
  )
}
