import { selectBoxscore, computePlayOfTheGame } from '../api/boxscore.js'
import { useNav } from '../lib/nav.js'
import { favoriteAccentColor } from '../lib/teams.js'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { doubleHeaderLabel } from './GameCard.jsx'
import { PerformerCard } from './PerformerCard.jsx'

// Pill category label + a plain, ungated "this is a fact about the card"
// treatment for every scenario except the crown (which alone gets the
// filled amber "big deal" chrome — see .flipback__pill--crown in index.css).
const SCENARIO_LABEL = {
  dominant: 'Dominant Performance',
  blowout: 'Blowout',
  close: 'Close Game',
  extras: 'Extra Innings',
}

// The flip card's back face: what a past, Final game's card turns into once
// revealed. Deliberately a SUMMARY, not the full box score — final R/H/E, the
// pitchers of record, and the game's single most memorable play — with a
// link through to the complete page for anyone who wants more. `feed`/
// `winProb` are only ever passed in once the game has been revealed, so
// selectBoxscore/computePlayOfTheGame (both reveal-only, see boxscore.js's
// header) are safe to call directly here. `hidePlayOfGame` lets a caller with
// its own, roomier Play of the Game treatment (the Postseason Series page's
// per-game ledger entry builds a headshot-led version from the same
// computePlayOfTheGame call) suppress this compact text-only one instead of
// showing both — the flip card itself keeps rendering it by default.
//
// `game`/`pinnedTeamId`/`cardMeta` are optional — only the slate's day-wide
// pill redesign (GameSelect.jsx, via useDayCardMeta) passes them; the
// Postseason Series page's per-game ledger entry doesn't, and simply gets no
// pills row (same graceful-omission convention as `hidePlayOfGame` above).
// `cardMeta` is one entry from dayHighlights.js's classifyGameCards — see
// that module for what each field means.
export function GameResultFace({
  feed,
  winProb,
  boxScorePath,
  hidePlayOfGame = false,
  game = null,
  pinnedTeamId = null,
  cardMeta = null,
}) {
  const navigate = useNav()
  const box = selectBoxscore(feed)
  const potg = computePlayOfTheGame(winProb, feed)
  const totalInnings = box.innings?.length ?? 9
  const wentToExtras = totalInnings > 9

  const { scenario, playChoice, performer, isGameOfTheNight } = cardMeta ?? {}
  // A performer card replaces the default Play of the Game block only for a
  // Dominant Performance, or a Blowout/Extra-Innings card whose deterministic
  // playChoice landed on the performer variant — and only when a performer
  // actually exists (no performer just falls through to the default play,
  // same as an ungated card would render anyway).
  const showPerformerInstead =
    !!performer &&
    (scenario === 'dominant' || ((scenario === 'blowout' || scenario === 'extras') && playChoice === 'performer'))
  // The crowned game's second beat: the turning point PLUS the top
  // performer's stat line underneath, when there is one. Only when we didn't
  // already show that same performer above (avoids a Dominant Performance
  // crown showing its one performer twice), and only when the performer is a
  // genuinely different person than the turning-point's own batter — a
  // walk-off's performer IS its turning-point batter, and a card showing the
  // same face and name twice reads as a glitch, not a bonus fact.
  const showSecondBeat =
    !!isGameOfTheNight && !showPerformerInstead && !!performer && performer.id !== potg?.batterId

  return (
    <div className="flipback">
      <ResultPills game={game} pinnedTeamId={pinnedTeamId} box={box} cardMeta={cardMeta} />
      <button
        type="button"
        className="btn flipback__boxbtn"
        onClick={() => navigate(boxScorePath)}
      >
        Box score
      </button>
      <div className="flipback__linescore">
        {wentToExtras && (
          <div className="flipback__extras">{totalInnings} innings</div>
        )}
        <div className="flipback__lsHeader" aria-hidden="true">
          <span className="flipback__lsTeamCol" />
          <span className="flipback__lsCol">R</span>
          <span className="flipback__lsCol">H</span>
          <span className="flipback__lsCol">E</span>
        </div>
        <TeamLine side={box.away} />
        <TeamLine side={box.home} />
      </div>
      <Decisions decisions={box.decisions} />
      {showPerformerInstead ? (
        <ul className="playercard__list flipback__perfcard">
          <PerformerCard entry={performer} />
        </ul>
      ) : (
        potg?.desc && !hidePlayOfGame && <PlayOfTheGame potg={potg} box={box} />
      )}
      {showSecondBeat && (
        <ul className="playercard__list flipback__perfcard">
          <PerformerCard entry={performer} />
        </ul>
      )}
    </div>
  )
}

// The pills row: at most one "formatting scenario" pill (the crown always
// wins visually — amber fill — with the underlying category pill still
// shown alongside it, per product decision) plus the two independent
// modifiers (doubleheader, favorite team), in that fixed order. Renders
// nothing at all for a quiet game with no scenario/modifiers — same
// graceful-omission convention as the rest of this component.
function ResultPills({ game, pinnedTeamId, box, cardMeta }) {
  const { scenario, isGameOfTheNight } = cardMeta ?? {}
  const dhLabel = game ? doubleHeaderLabel(game) : null
  const pinnedSide = pinnedTeamId === box.away.id ? 'away' : pinnedTeamId === box.home.id ? 'home' : null
  const pinnedResult =
    pinnedSide == null
      ? null
      : box.home.line.r === box.away.line.r
        ? 'Your Team'
        : box[pinnedSide].line.r > box[pinnedSide === 'away' ? 'home' : 'away'].line.r
          ? 'Your Team · Won'
          : 'Your Team · Lost'

  if (!isGameOfTheNight && !scenario && !dhLabel && !pinnedResult) return null
  return (
    <div className="flipback__pills">
      {isGameOfTheNight && <span className="flipback__pill flipback__pill--crown">★ Game of the Night</span>}
      {scenario && <span className="flipback__pill flipback__pill--tag">{SCENARIO_LABEL[scenario]}</span>}
      {dhLabel && <span className="flipback__pill flipback__pill--tag">{dhLabel}</span>}
      {pinnedResult && (
        <span
          className="flipback__pill flipback__pill--team"
          style={{ '--pin-accent': favoriteAccentColor(pinnedTeamId) }}
        >
          {pinnedResult}
        </span>
      )}
    </div>
  )
}

function TeamLine({ side }) {
  return (
    <div className="flipback__team">
      <span className="flipback__abbr">
        <TeamLogo teamId={side.id} name={side.teamName} size={32} />
        <TeamLink id={side.id}>{side.clubName || side.abbreviation}</TeamLink>
      </span>
      <span className="flipback__lsCol flipback__lsVal">{side.line.r}</span>
      <span className="flipback__lsCol flipback__lsVal">{side.line.h}</span>
      <span className="flipback__lsCol flipback__lsVal">{side.line.e}</span>
    </div>
  )
}

// W/L/S, each pitcher's name a clickable PlayerLink with his season record
// trailing in parens as plain text (the record isn't a name, so it doesn't
// need to be part of the link).
function Decisions({ decisions }) {
  const rows = [
    decisions.win && { k: 'W', id: decisions.winId, name: decisions.win, rec: decisions.winRecord },
    decisions.loss && { k: 'L', id: decisions.lossId, name: decisions.loss, rec: decisions.lossRecord },
    decisions.save && { k: 'S', id: decisions.saveId, name: decisions.save, rec: decisions.saveRecord },
  ].filter(Boolean)
  if (rows.length === 0) return null
  return (
    <div className="flipback__decisions">
      {rows.map((r) => (
        <span className="flipback__decision" key={r.k}>
          <b>{r.k}</b> <PlayerLink id={r.id}>{r.name}</PlayerLink>
          {r.rec ? ` (${r.rec})` : ''}
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

// "MIL 5, STL 3" — comma-joined "ABBR score" pairs, in caller-supplied order.
// Exported so any other "final score, plain text" spot (e.g. PastDayRecapBox's
// GameScoreLink) renders the same shape instead of hand-rolling its own.
export function scorePairsLine(pairs) {
  return pairs.map(([abbr, score]) => `${abbr} ${score}`).join(', ')
}

// The leading team is whoever was ahead at the moment of the play (not always
// the eventual winner for an earlier-game play, but for the game's single
// most decisive moment it usually is).
function scoreLine(box, potg) {
  const { awayScore, homeScore } = potg
  if (awayScore == null || homeScore == null) return null
  const pairs = [
    [box.away.abbreviation, awayScore],
    [box.home.abbreviation, homeScore],
  ]
  return scorePairsLine(awayScore >= homeScore ? pairs : [pairs[1], pairs[0]])
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Turns every exact occurrence of a mentioned player's name in `text` into a
// PlayerLink, leaving the rest as plain text. Safe here specifically because
// every name comes straight from this same play's own batter/runner identity
// (computePlayOfTheGame's `runners`) rather than a guessed roster-wide
// search — the names we look for are exactly the names MLB's own description
// generator used to build the sentence. Longest names first in the
// alternation so one name can't be swallowed by a shorter overlapping one.
function linkifyNames(text, mentions) {
  const named = mentions.filter((m) => m.id && m.name)
  if (named.length === 0) return text
  const byName = new Map(named.map((m) => [m.name, m.id]))
  const pattern = new RegExp(
    `(${[...byName.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`,
    'g',
  )
  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part, i) => {
      const id = byName.get(part)
      // A plain string (not wrapped in an element) for the non-name parts —
      // `#root *`'s uppercase rule matches ELEMENTS directly, so wrapping
      // this in a <span> would force it back to caps despite .flipback__potg's
      // exemption (inheritance loses to a rule that hits the element itself).
      // Bare text stays a text node, so it correctly inherits sentence case.
      return id ? (
        <PlayerLink key={i} id={id}>
          {part}
        </PlayerLink>
      ) : (
        part
      )
    })
}

// The night's single most memorable moment (see computePlayOfTheGame). Reads
// as a natural-case sentence in the app's serif "read" face (see --font-read
// / .pbp__desc for the established precedent) rather than the app's usual
// all-caps display type — approved caps-exempt, see the CSS block comment.
// Every player MLB's own description names — the batter and any runner it
// says scored — becomes a clickable PlayerLink (see linkifyNames above); the
// label carries the half+inning ("Top 8th") after a centered dot; the
// description ends with the bolded score, leading team first.
function PlayOfTheGame({ potg, box }) {
  const { desc, batterId, batterName, batterTeamId, inning, half, runners } = potg
  const mentions = [{ id: batterId, name: batterName }, ...(runners ?? [])]
  const inningLabel = inning != null ? `${half === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)}` : null
  const score = scoreLine(box, potg)
  return (
    <div className="flipback__potgWrap">
      <Headshot
        personId={batterId}
        name={batterName}
        teamId={batterTeamId}
        className="flipback__potgShot"
      />
      <div className="flipback__potgMain">
        <span className="flipback__potgLabel">
          Play of the game
          {inningLabel && (
            <>
              <span className="flipback__potgDot" aria-hidden="true">
                {' '}
                &middot;{' '}
              </span>
              {inningLabel}
            </>
          )}
        </span>
        <p className="flipback__potg">
          {linkifyNames(desc, mentions)}
          {score && (
            <>
              {' '}
              <b>{score}</b>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
