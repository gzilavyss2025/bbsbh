// Shared pieces for the postseason bracket (#1224, slice 5): the pencil pips,
// a club's mark (full color, or the eliminated club's gray knockout), and a
// future slot's blank ruled line. No baseball data of their own — every
// value is handed in already derived from src/api/postseason/bracket.js.
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { teamLogoUrl } from '../../lib/teams.js'

// One series' win pips for one club. `winsNeeded` is the series' own field
// (bestOf 3/5/7 -> 2/3/4 pips) — never recomputed here, so a caller can't
// drift from bracket.js's own rounding. Pencil (graphite) until the series is
// decided, then ink (accent-primary). Visually the count IS the label, so the
// accessible name lives on the row that wraps both clubs' pips, not here.
export function Pips({ winsNeeded, wins = 0, inked = false, size = 'md' }) {
  return (
    <span className={`pbkt-pips pbkt-pips--${size}${inked ? ' pbkt-pips--inked' : ''}`} aria-hidden="true">
      {Array.from({ length: winsNeeded }, (_, i) => (
        <span key={i} className={`pbkt-pip${i < wins ? ' pbkt-pip--on' : ''}`} />
      ))}
    </span>
  )
}

// A club's mark. `eliminated` draws the same one-color knockout art
// TeamLogo's own `mono` variant serves, masked in graphite — "a gray pencil
// logo... with a light strike" (the brief's theme) — rather than the club's
// full colors. No `club` at all is a not-yet-known slot (see BlankSlot).
export function ClubMark({ club, eliminated = false, size = 20 }) {
  if (!club) {
    return (
      <span
        className="pbkt-mark pbkt-mark--empty"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }
  if (eliminated) {
    return (
      <span
        className="pbkt-mark pbkt-mark--out"
        style={{ width: size, height: size, '--pbkt-mono': `url(${teamLogoUrl(club.id, 'mono')})` }}
        aria-hidden="true"
      />
    )
  }
  return <TeamLogo teamId={club.id} name={club.name} size={size} className="pbkt-mark" />
}

// A future slot: a blank ruled line, never the word "TBD" (the brief's
// theme). `label` is the screen-reader text naming what fills it.
export function BlankSlot({ label, className = '' }) {
  return (
    <span className={`pbkt-blank ${className}`}>
      <span className="sr-only">{label}</span>
    </span>
  )
}

// The World Series art (public/brand/), reused as-is — see root CLAUDE.md's
// "Reuse" list. Decorative: the surrounding heading already says what it is.
export function Trophy({ size = 44 }) {
  return (
    <img
      src="/brand/world-series-trophy.png"
      alt=""
      aria-hidden="true"
      className="pbkt-trophy"
      style={{ height: size, width: 'auto' }}
    />
  )
}
