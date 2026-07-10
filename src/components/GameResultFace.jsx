import { selectBoxscore, computePlayOfTheGame } from '../api/boxscore.js'
import { useNav } from '../lib/nav.js'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// The flip card's back face: what a past, Final game's card turns into once
// revealed. Deliberately a SUMMARY, not the full box score — final R/H/E, the
// pitchers of record, and the game's single most memorable play — with a
// link through to the complete page for anyone who wants more. `feed`/
// `winProb` are only ever passed in once the game has been revealed, so
// selectBoxscore/computePlayOfTheGame (both reveal-only, see boxscore.js's
// header) are safe to call directly here.
export function GameResultFace({ feed, winProb, boxScorePath }) {
  const navigate = useNav()
  const box = selectBoxscore(feed)
  const potg = computePlayOfTheGame(winProb, feed)
  const totalInnings = box.innings?.length ?? 9
  const wentToExtras = totalInnings > 9

  return (
    <div className="flipback">
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
      {potg?.desc && <PlayOfTheGame potg={potg} box={box} />}
      <button
        type="button"
        className="btn btn--next flipback__full"
        onClick={() => navigate(boxScorePath)}
      >
        Box score
      </button>
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

// "MIL 5, STL 3" — the leading team is whoever was ahead at the moment of the
// play (not always the eventual winner for an earlier-game play, but for the
// game's single most decisive moment it usually is).
function scoreLine(box, potg) {
  const { awayScore, homeScore } = potg
  if (awayScore == null || homeScore == null) return null
  const away = `${box.away.abbreviation} ${awayScore}`
  const home = `${box.home.abbreviation} ${homeScore}`
  return awayScore >= homeScore ? `${away}, ${home}` : `${home}, ${away}`
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
      return id ? (
        <PlayerLink key={i} id={id}>
          {part}
        </PlayerLink>
      ) : (
        <span key={i}>{part}</span>
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
  const { desc, batterId, batterName, inning, half, runners } = potg
  const mentions = [{ id: batterId, name: batterName }, ...(runners ?? [])]
  const inningLabel = inning != null ? `${half === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)}` : null
  const score = scoreLine(box, potg)
  return (
    <div className="flipback__potgWrap">
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
  )
}
