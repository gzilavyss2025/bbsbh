import { useState } from 'react'
import { teamLogoUrl } from '../../lib/teams.js'
import { ordinal } from '../../lib/format.js'
import { Stack } from '../ui/layout/Stack.jsx'

// One club's ABS challenges: the club logo, then a pip per challenge the club
// MADE — colored by outcome (overturned = won, stood = lost, in the order they
// happened) — followed by any still-unused challenges as kraft-brown pips. A
// success is RETAINED and a failure SPENDS one (the real rule — see
// api/challenges.js), so a club that keeps winning shows a long green run and
// still has its full bank. `remaining` is challengesLeft's count
// (api/challenges.js), the one rule every surface reads: it gives a club that
// enters an extra inning with none left one more, so the row no longer says
// "none left" when the club has one (Gary, 2026-10-26). A challenge given back
// that way draws as an ordinary open pip. The logo falls back to the abbreviation for a club with no
// mark — which a MiLB club can be, now that Triple-A and the Florida State
// League reach this row too.
// Exported: the box score's pitching-notes area reuses this exact row for the
// whole-game challenge tally instead of growing a second copy.
//
// The whole row is a toggle button (covers "tap a pip" too — the pips sit
// inside it) that expands a detail list underneath: who challenged, which
// half, and the outcome in words — the same three facts the pips encode as
// color, spelled out for a tap-to-open reader. Disabled/inert with no
// affordance when there's nothing to challenge yet (outcomes.length === 0).
//
// `showOpenPips` (default on) draws the kraft-brown unused-challenge pips.
// BoxAbs (BoxScore.jsx) turns it off: once the game is final an unused
// challenge can't be spent, so the open pip is redundant with the "N left"
// text right after it — it only earns its place live, previewing what's
// still in the bank.
export function AbsRow({ teamId, abbr, outcomes, remaining, showOpenPips = true }) {
  const [logoBroken, setLogoBroken] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const hasChallenges = outcomes.length > 0
  const failed = outcomes.filter((o) => o.outcome === 'fail').length
  const won = outcomes.length - failed
  const logo = teamId != null ? teamLogoUrl(teamId) : null
  const left = remaining === 0 ? 'none left' : `${remaining} left`
  const label = `${abbr}: ${won} of ${outcomes.length} challenge${
    outcomes.length === 1 ? '' : 's'
  } overturned, ${left}`
  return (
    <div className="abs__row">
      <button
        type="button"
        className="abs__rowbtn"
        onClick={() => setExpanded((v) => !v)}
        disabled={!hasChallenges}
        aria-expanded={hasChallenges ? expanded : undefined}
      >
        {logo && !logoBroken ? (
          <img className="abs__logo" src={logo} alt={abbr} onError={() => setLogoBroken(true)} />
        ) : (
          <span className="abs__team">{abbr}</span>
        )}
        <span className="abs__pips" role="img" aria-label={label}>
          {outcomes.map((o, i) => (
            <span
              key={i}
              className={`abs__pip abs__pip--${o.outcome === 'success' ? 'won' : 'lost'}`}
              aria-hidden="true"
            />
          ))}
          {showOpenPips &&
            Array.from({ length: remaining }, (_, i) => (
              <span key={`open-${i}`} className="abs__pip abs__pip--open" aria-hidden="true" />
            ))}
        </span>
        <span className="abs__rec" aria-hidden="true">
          {won}–{failed} · {left}
        </span>
      </button>
      {expanded && hasChallenges && (
        <Stack gap="tight" as="ol" className="abs__detail">
          {outcomes.map((o, i) => (
            <li key={i} className="abs__detailrow">
              <span className="abs__detailhalf">
                {o.half === 'top' ? 'Top' : 'Bot'} {ordinal(o.inning)}
              </span>
              <span className="abs__detailwho">{o.playerName || abbr}</span>
              <span
                className={`abs__detailresult abs__detailresult--${o.outcome === 'success' ? 'won' : 'lost'}`}
              >
                {o.outcome === 'success' ? 'Overturned' : 'Confirmed'}
              </span>
            </li>
          ))}
        </Stack>
      )}
    </div>
  )
}

// The before→after count, animated on mount: the old count fades/strikes
// through, the new one flashes in with --marker (the same highlighter-yellow
// the app already uses as a "watch this" flag) then settles to plain ink.
// `after` is the scorebook code (K, BB) when this pitch itself ended the
// plate appearance, otherwise the count it left behind — see afterLabel in
// api/umpireFavor.js. Fires once per mount (a half-inning's worth of reveals
// remounts this card via the parent's own key, same as the rest of the box
// score), never loops — a live box score re-flashing on its own all game
// would be exhausting to sit next to.
export function CountBlink({ before, after }) {
  return (
    <div className="wcall__count">
      <span className="wcall__count-label">Count</span>
      <span className="wcall__count-old">{before}</span>
      <span className="wcall__count-arrow" aria-hidden="true">→</span>
      <span className="wcall__count-new">{after}</span>
    </div>
  )
}






// One stat cell. Exported because HalfTally.jsx draws the same cells in the
// same `.statline` grid for focus mode's console band — one recipe, two hosts.
// `style` is optional and forwarded as-is: HalfTally is the only caller that
// passes one, an inline `--tally-i` custom property (ADR-0046) that times this
// cell's ink-in against its neighbors — StatBox's own cells pass nothing and
// render exactly as they did before.
export function Stat({ k, v, tone, style }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`} style={style}>
      <span className="stat__v">{v}</span>
      <span className="stat__k">{k}</span>
    </div>
  )
}
