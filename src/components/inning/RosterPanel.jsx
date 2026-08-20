import { memo, useState } from 'react'
import { enteredAsOf } from '../../api/select.js'
import { prospectBadge } from '../../api/prospects.js'
import { showRookiePill } from '../../api/rookies.js'
import { headerThemeFor, headerThemeStyle, headerThemeClass, themeKeyFor } from '../../lib/headerTheme.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { ProspectPill } from '../badges/ProspectPill.jsx'
import { RookiePill } from '../badges/RookiePill.jsx'

// Persistent roster reference, collapsed by default: starters (who won't
// enter once the rotation's set), the bullpen (with handedness as LHP/RHP),
// and the bench (with position) as they stood at first pitch, for lookup
// while scoring. A player who has entered the game is struck through — no
// longer eligible — but only as of the half this page is showing AND only
// once his entry sits at or below the reveal mark. Both ceilings live in
// `enteredAsOf` (api/select.js); read its header before touching `halfIdx`
// below. The short of it: the reveal mark keeps the card from hinting at a
// sealed inning, and `halfIdx` keeps it honest about the half on screen when
// a reader pages BACK through a game they have already unsealed — a
// pinch-hitter who bats in the 8th was on the bench in the 1st, and the
// 1st is what that page is showing.
// Memoized: this panel's props (the split roster card, the reveal mark, the
// half on screen, the badge data) change only when the feed, the reveal mark
// or the page does, but it hangs off InningViewer, which re-renders on every
// scorebug/step/live report during a live game. Two of these render at once,
// each a full player list.
//
// The collapsed header wears the club's own bar — the SAME curated
// bar/accent/text triad TeamInfo.jsx, BoxScore.jsx's team cards, the fielding
// diamond and the innings lineup masthead already wear (headerTheme.js,
// ADR-0030), with the knockout mark bled against its right edge. It was the
// last reference card on this surface still showing a club as plain paper-and-
// ink text, which read as two unlabeled drawers rather than two teams. Untuned
// (club, treatment) pairs fall back to the app's default navy bar, same as
// every other caller — never a synthesised triad (see headerTheme.js's header).
//
// TWO PROPS EXIST FOR FOCUS MODE'S REFERENCE PANEL, and both default to
// today's behaviour so the ordinary stacked page is untouched.
//
//  • `defaultOpen` — collapsed is right on a page that stacks two of these
//    under everything else, and wrong inside a TAB, where the tab itself is
//    already the disclosure. Opening the Bench tab used to answer with two
//    shut drawers and nothing else: three taps to read a bench.
//  • `groups` — which of the three lists to draw, as a subset of
//    ['bullpen', 'bench', 'starters']. Null means all three, in the source
//    order below. Focus mode asks each club for the ONE list that is useful
//    while its half is being scored — the batting side's bench (who is left
//    to hit for) and the fielding side's bullpen (which arm is next) — so a
//    scorer reaches the name they want without paging past the two lists
//    they do not. Names, not counts: a player who has already entered stays
//    on the list, struck through, because "used" is a fact a scorer wants
//    just as much as "available" (see `entered` below).
export const RosterPanel = memo(function RosterPanel({ title, roster, teamId = null, side, treatment, revealedThrough, halfIdx = null, prospectsData, rookiesData, isMlb, defaultOpen = false, groups = null }) {
  const [open, setOpen] = useState(defaultOpen)
  const shows = (g) => (groups ? groups.includes(g) : true)
  const empty =
    (!shows('starters') || roster.starters.length === 0) &&
    (!shows('bullpen') || roster.bullpen.length === 0) &&
    (!shows('bench') || roster.bench.length === 0)
  const entered = (p) => enteredAsOf(p, revealedThrough, halfIdx)
  const rowClass = (p) => `roster__row ${entered(p) ? 'is-entered' : ''}`
  const theme = headerThemeFor(teamId, themeKeyFor(teamId, side, treatment))
  return (
    <section className={`roster ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      <button
        className="roster__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="roster__club">{title}</span>
        {teamId != null && (
          <TeamLogo teamId={teamId} name={title} size={20} variant="mono" crop="bar" className="metricbar__logo" />
        )}
        <span className="roster__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="roster__body">
          {empty && <p className="hint">Not posted yet.</p>}

          {shows('bullpen') && roster.bullpen.length > 0 && (
            <>
              <h4 className="roster__group">Bullpen</h4>
              <ul className="roster__list">
                {roster.bullpen.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                      <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{handAbbr(p.hand)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {shows('bench') && roster.bench.length > 0 && (
            <>
              <h4 className="roster__group">Bench</h4>
              <ul className="roster__list">
                {roster.bench.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                      <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{p.position}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {shows('starters') && roster.starters.length > 0 && (
            <>
              <h4 className="roster__group">Starters</h4>
              <ul className="roster__list">
                {roster.starters.map((p) => (
                  <li key={p.id} className={rowClass(p)}>
                    <span className="roster__namewrap">
                      <PlayerLink id={p.id} className="roster__name">
                        {p.nameLastFirst}
                      </PlayerLink>
                      <ProspectPill {...prospectBadge(prospectsData, p.id)} />
                      <RookiePill active={showRookiePill(rookiesData, p.id, isMlb)} />
                    </span>
                    <span className="roster__jersey">{p.jersey || ''}</span>
                    <span className="roster__pos">{handAbbr(p.hand)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
})

// 'Left' / 'Right' handedness -> pitcher shorthand.
function handAbbr(hand) {
  const h = (hand || '').toLowerCase() // caps-js-exempt: normalizing for comparison below, not display casing
  if (h.startsWith('l')) return 'LHP'
  if (h.startsWith('r')) return 'RHP'
  return ''
}
