import { TeamTreatmentMark } from '../logo/TeamTreatmentMark.jsx'
import { BreakableLocation } from '../ui/BreakableLocation.jsx'
import { splitName } from '../../lib/teamSplits.js'
import { defaultTreatmentFor } from '../../lib/teams.js'
import { selectGameStatus } from '../../api/select.js'
import { rescheduleLabel, resumeLabel } from '../../lib/resultCards.js'
import { jerseyTreatmentFor } from '../../api/jerseys.js'
import { liveTreatmentFor } from '../../api/uniforms.js'
import { broadcastLogoFor } from '../../lib/broadcastLogos.js'

// Pure (no JSX), so it also has to be importable from a plain Node test and
// from the team hub's identity drawer (test/identity-drawer-fields.test.js
// loads identityFields.js directly, which cannot pull in a .jsx module) —
// lives in lib/ballpark/parkWash.js and is re-exported here so every existing
// `import { tileColorFor } from './GameCardParts.jsx'` keeps working.
export { tileColorFor } from '../../lib/ballpark/parkWash.js'

// Split out of GameCard.jsx to keep that file under the 600-line budget
// (check-file-size.mjs, ADR-0038) — everything here is a small piece GameCard
// composes, none of it meaningful read on its own. `PostponedBanner` is the
// one export another screen also reaches for directly (AnimationLab.jsx);
// everything else here is private to GameCard.

// Which uniform a team is wearing this game — pulled out of GameCard's own
// body so the home side's colour can also feed the ballpark backdrop's hover
// tint (GameCard.jsx's `parkTint`), not just the tile TeamMark renders below.
// Preferred order: (1) `liveJerseys`, a same-day batched live fetch
// (GameSelect.jsx), classified via the exact same classifyUniformAsset the
// nightly cron uses — closes the gap where a same-day posting didn't show on
// the slate until tomorrow's cron run; (2) jerseyTreatmentFor's nightly
// precompute (scripts/gen-jerseys.mjs); (3) defaultTreatmentFor's guess for a
// game outside both sources' coverage: away grey/road by default, City
// Connect for a Friday home game if the club has one.
export function resolveTreatment(team, side, gamePk, officialDate, jerseysData, liveJerseys) {
  return (
    liveTreatmentFor(liveJerseys, gamePk, team.id, team.teamName) ??
    jerseyTreatmentFor(jerseysData, gamePk, team.id) ??
    defaultTreatmentFor(team.id, side, officialDate)
  )
}

// The Scores Unlocked run totals, one per team column (away left, home right,
// matching the marks above), with the game-state token optically centered
// between them (absolutely positioned, so its width never nudges the numerals
// off the column centers). Winner/loser inking applies only once the game is
// FINAL — the settled scorebook convention — never mid-game. The visual spans
// are aria-hidden and the full screen-reader sentence rides in one .sr-only
// span, because "4 … BOT 7 … 2" read aloud in DOM order carries no team
// context. (.sr-only's absolute positioning is also what keeps that span from
// becoming the grid's first item and shoving both numerals a track over.)
export function ScoreLine({ liveLine }) {
  const { awayRuns, homeRuns, state, final, awayResult, homeResult, label } = liveLine
  // 'winner'/'loser' only once a Final settles it; null (no modifier) while
  // live and on a tie — the formatter owns that rule (slateScoreLine.js).
  const mod = (result) => (result ? ` gamecard__runs--${result}` : '')
  return (
    <div className={`gamecard__scoreline${final ? '' : ' gamecard__scoreline--live'}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className={`gamecard__runs t-num gamecard__runs--away${mod(awayResult)}`}>
        {awayRuns}
      </span>
      <span aria-hidden="true" className="gamecard__scorestate t-label">
        {state}
      </span>
      <span aria-hidden="true" className={`gamecard__runs t-num gamecard__runs--home${mod(homeResult)}`}>
        {homeRuns}
      </span>
    </div>
  )
}

// The postponed treatment: a kraft-tape strip under the matchup carrying a
// rubber-stamped "POSTPONED", the cause ("Inclement Weather"), and — once MLB
// has set one — the make-up date the game moved to (rescheduleGameDate, a
// spoiler-free calendar date, never a score). Replaces both the corner delay
// pill and the readiness strip: neither applies to a game that isn't happening.
export function PostponedBanner({ game, status }) {
  const makeup = rescheduleLabel(game)
  return (
    <div className="postponed" role="status">
      <span className="postponed__stamp">Postponed</span>
      {(status.reason || makeup) && (
        <span className="postponed__lines">
          {status.reason && (
            <span className="postponed__reason">{status.reason}</span>
          )}
          {makeup && (
            <span className="postponed__makeup">Makeup&nbsp;·&nbsp;{makeup}</span>
          )}
        </span>
      )}
    </div>
  )
}

// Scorebook-readiness pill: four small checkbox pips, in a fixed order (each
// team's batting order, the umpire crew, both starting pitchers), telling you
// at a glance whether the basics you'd pencil in pre-game are posted yet. The
// green pill chrome (background/border) and the "Ready" word both only show
// up once all four have posted — `--complete` below — since a tinted "good
// status" background around a still-incomplete checklist would claim a state
// that isn't true yet, the same problem as the old red-while-idle chips.
// While incomplete it's just the bare pips: each one already draws its own
// checkbox border, so the row still reads as a deliberate checklist with no
// outer chrome needed. Deliberately unlabeled beyond "Ready" — the pip
// position is the label, learned once, since it never changes card to card —
// so a not-yet-posted item is just a hollow box, not a red ✗. Rides the same
// line as the game's start time (`.gamecard__metaright` in GameCard) rather
// than its own row, at that line's regular weight — a status, not a
// headline. Spoiler-free; none of these reveal a score. Uniforms used to
// ride along as a fifth pip, but that data never posts until first pitch, so
// it carried no pre-game signal — dropped rather than shown red for the
// entire wait.
export function ReadyPill({ game }) {
  const r = game.readiness ?? {}
  const items = [
    { ok: !!r.awayLineup, label: `${game.away.abbreviation || 'Away'} lineup` },
    { ok: !!r.homeLineup, label: `${game.home.abbreviation || 'Home'} lineup` },
    { ok: !!r.umpires, label: 'Umpires' },
    { ok: !!r.pitchers, label: 'Starting pitchers' },
  ]
  const readyCount = items.filter((it) => it.ok).length
  const allReady = readyCount === items.length
  return (
    <span
      className={`gamecard__readypill ${allReady ? 'gamecard__readypill--complete' : ''}`}
      aria-label={`Scorebook readiness, ${readyCount} of ${items.length} posted`}
    >
      {allReady && 'Ready'}
      <span className="gamecard__readypill-pips">
        {items.map((it) => (
          <span
            key={it.label}
            className={`pip ${it.ok ? 'pip--on' : 'pip--off'}`}
            title={`${it.label}: ${it.ok ? 'posted' : 'not posted yet'}`}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="1.5" y="1.5" width="13" height="13" rx="3" />
              <path className="pip__tick" d="M4 8.5l2.5 2.5L12 5.5" />
            </svg>
          </span>
        ))}
      </span>
    </span>
  )
}

// A small TV-screen glyph + the network name (FOX/ESPN/TBS/Apple TV+/…) —
// the fact a local viewer needs to know their own regional feed of this game
// is blacked out. Rides the same .gamecard__metaright line as the ready pill
// and start time/FINAL, between the two (after the pips, before the time —
// the pips only show pre-game, so this is the first thing on the line for a
// Final). The name prints as-is (ESPN's own casing) with CSS text-transform
// doing the visual uppercase, per the ALL-CAPS invariant (no per-component
// .toUpperCase() — scripts/check-name-casing.mjs). The logo alone is the
// label, with no exceptions: ESPN's streaming-only "Unlmtd" tier used to earn
// a red tag beside the bare ESPN mark, but it is an out-of-market
// subscription package rather than a national TV broadcast and api/broadcast.js
// now filters it out the same way it filters MLB.TV, so it never reaches here.
export function NationalTvIcon({ network }) {
  const logo = broadcastLogoFor(network)
  if (logo) {
    // No title tooltip — the logo alone is the label (see the header comment),
    // so `aria-label` on the wrapper is what gives a screen reader the network
    // name; the image's own `alt` stays empty rather than doubling it up.
    return (
      <span className="gamecard__nationaltv" aria-label={`National broadcast: ${network}`}>
        <img className="gamecard__nationaltv-logo" src={logo} alt="" />
      </span>
    )
  }
  return (
    <span className="gamecard__nationaltv">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="9" rx="1.5" />
        <path d="M5 14.5h6" />
        <path d="M8 12v2.5" />
      </svg>
      {network}
    </span>
  )
}

// A team's mark, framed in a uniform bordered square so the two logos read at a
// consistent size. The mark is overscaled to bleed to the frame like a printed
// badge (the tile clips the overflow), the way Caught Looking tiles its club
// marks. Full color here on the slate — elsewhere (the in-game masthead, the
// logo sheet) the marks stay grayscale. Sits in the top grid row.
//
// A per-team tinted tile fill for the DEFAULT/Main logo was tried here once
// (first a teamTintColor soft wash, then a hand-picked solid color) and
// reverted: a dense/large club mark (the Yankees' interlocking NY, at
// minimum) read as if it colored the whole tile even against a light fill.
// That first attempt's hand-picked color list is preserved in
// .scratch/gamecard-team-colors/issues/01-solid-tile-colors.md for reference,
// but it's not what's live now — Team Identity Lab separately solved the same
// dense-mark problem (a per-team edge-bleed scale-down, MAIN_OVERRIDES in
// teams.js) for its own Main-tile prototype, and that's the version wired in
// below: every tile (Main, Alternate, City Connect alike) gets its curated
// background + scale + optional recolored mark from teams.js, so a team's
// mark always reads legibly against its own fill.
export function TeamMark({ team, side, gamePk, officialDate, jerseysData, liveJerseys = null, eager = false }) {
  // Swaps to a team's curated Alternate/City Connect mark when that's what
  // it's actually wearing this game — see resolveTreatment above for the
  // three-source precedence. Coverage is partial by design — TeamLogo's own
  // fallback chain quietly drops back to the base logo for any team without
  // curated art. The tile itself is the shared TeamTreatmentMark, the same
  // square the in-game masthead shows.
  const treatment = resolveTreatment(team, side, gamePk, officialDate, jerseysData, liveJerseys)
  return (
    <TeamTreatmentMark
      teamId={team.id}
      name={team.name}
      treatment={treatment}
      side={side}
      size={56}
      block="gamecard__logobox"
      className={`gamecard__logobox--${side}`}
      eager={eager}
    />
  )
}

// The team's name under its mark (location on the first line, mascot on the
// second). Falls back to the full name when we can't cleanly split off a
// location (some MiLB clubs). Sits in the bottom grid row so names align
// independently of the marks above them.
export function TeamName({ team, side }) {
  const { location, mascot } = splitName(team.name, team.teamName)
  return (
    <span className={`gamecard__name gamecard__name--${side}`}>
      {location && <BreakableLocation text={location} className="gamecard__loc" />}
      <span className="gamecard__mascot">{mascot}</span>
    </span>
  )
}

// Pre-game start time. Primary read is the VIEWER's local clock (where they're
// watching), with the park's local time — labeled with its zone ("10:10 PDT")
// — trailing in smaller parentheses so a west-coast game still shows when it
// starts on-site. The parenthetical is dropped when the feed carries no venue
// timezone (lean MiLB rows) or when the two clocks read the same (viewer is in
// the park's zone) — no redundant "(7:10 CDT)".
export function StatusText({ game, hasScoreLine = false }) {
  const status = selectGameStatus(game)
  if (status.isSuspended) {
    // The corner pill alone just says SUSPENDED; once the league has set a
    // continuation date this slot — otherwise empty for a suspended game,
    // since the pill already ate the ready-pips/start-time job — carries it.
    // Same idea as PostponedBanner's makeup line, just in the ordinary
    // corner-text slot rather than a stamp, since a suspended game keeps its
    // normal matchup card.
    const resume = resumeLabel(game)
    return resume ? <span className="gamecard__status">Resumes {resume}</span> : null
  }
  if (status.label) return null // the delay pill carries it; no redundant text
  const s = game.abstractState
  if (s === 'Final') {
    // While the Scores Unlocked line renders, its centered state slot already
    // says FINAL (or F/n) right between the run totals — the corner text here
    // would be the same word orphaned a row below, so it moves, not repeats.
    if (hasScoreLine) return null
    return <span className="gamecard__status">Final</span>
  }
  if (s === 'Live') return null // the LIVE pill carries it; no redundant text
  let local
  let park = null
  try {
    const t = new Date(game.gameDate)
    const { tz, tzId } = game.venue ?? {}
    local = t.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    if (tzId) {
      const parkTime = t.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tzId,
      })
      if (parkTime !== local) park = tz ? `${parkTime} ${tz}` : parkTime
    }
  } catch {
    return (
      <span className="gamecard__status">
        {game.detailedState ?? 'Scheduled'}
      </span>
    )
  }
  return (
    <span className="gamecard__status">
      {local}
      {park && <span className="gamecard__status-park"> ({park})</span>}
    </span>
  )
}
