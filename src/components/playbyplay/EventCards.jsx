import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherPhoto } from './PitcherNotice.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { UsagePips } from '../charts/UsagePips.jsx'

// THE NOTIFICATION-CARD FAMILY of the half-inning feed — everything
// PlayByPlay.jsx renders BETWEEN plate appearances, plus the two shorthand
// lookups those cards are captioned from.
//
// Split out of PlayByPlay.jsx rather than grown there: that file is over
// ADR-0038's file-size ceiling and its own budget, and these five components
// are the part of it with no reveal reasoning in them at all. Nothing about
// them changed in the move — same markup, same classes, same comments.
//
// Read ADR-0017 before touching any of them. Every mid-inning "something
// happened" moment sorts into one of three tiers — a fresh/changed actor, a
// team/administrative event, or a baserunning/misc event with no plate
// appearance of its own — and all three render in the SAME kraft-amber
// `.pitchernotice.pitchernotice--pbp` card, distinguished by what is inside
// (a headshot vs. a scorer's shorthand code) rather than by a coloured accent
// rail. That is the decision, and it is easy to undo by accident.

// Icons for EventNote. For a substitution this is a FALLBACK, reached only
// when the fielder/pitcher/runner can't be resolved from gameData.players (a
// thin feed) and the entry stays a plain note instead of the FielderNotice/
// PitcherNotice/PinchRunNotice card. Baserunning/misc events never fall back
// here — they always resolve to EventCard (see EVENT_CODES below).
const EVENT_ICONS = {
  mound_visit: '⏱',
  pitching_substitution: '🔄',
  defensive_substitution: '👥',
  defensive_switch: '🧤',
  ejection: '🚫',
  pinch_running: '🏃',
  pinch_hitting: '🏏',
  // A delay advisory (injury, on-field, weather) — why a half stopped. Unlike
  // the rows above, EventNote is this one's INTENDED home rather than a
  // fallback: there is no person to card, and nothing to add to the sentence
  // the feed already wrote.
  game_advisory: '⏸',
}

// The real scorer's shorthand for a baserunning/misc event with no plate
// appearance of its own — the same abbreviation a scorer pencils on paper,
// captioning EventCard instead of an emoji.
//
// A pickoff is PK, not PO, and the tags here must keep matching the two places
// in api/playbyplay.js that write the same event onto a diamond —
// runnerOutCode's out notation ("PK 1-3") and interruptedCode's carry-over
// mark ("PK →"). Two spellings for one event on the same page reads as two
// different events, and "PO" is doubly wrong here: it's already this app's
// mark for a POP OUT (loadScorecard.js's classifyOut), besides being the
// scorebook's own abbreviation for a putout.
export const EVENT_CODES = {
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  caught_stealing_2b: 'CS', caught_stealing_3b: 'CS', caught_stealing_home: 'CS',
  pickoff_1b: 'PK', pickoff_2b: 'PK', pickoff_3b: 'PK',
  pickoff_caught_stealing_2b: 'PK', pickoff_caught_stealing_3b: 'PK', pickoff_caught_stealing_home: 'PK',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  // Not observed as a standalone top-level play in either sampled game (both
  // always nested inside a real plate appearance) — included for the same
  // reason every other NON_PA-adjacent code above is, so IF one ever does
  // surface on its own, it gets this card's real shorthand instead of
  // EventNote's generic fallback icon.
  runner_placed: 'RP', defensive_indiff: 'DI',
}

// Which side EventCard's one named person belongs to, for its headshot's team
// logo fallback: a steal/pickoff/placement is about the BASERUNNER (batting
// team); a wild pitch/passed ball/balk is about the pitcher or catcher
// (pitching team). Defensive indifference has no single player it's really
// "about" — defaults to the pitching team below along with the WP/PB/BK group.
export const BASERUNNER_EVENTS = new Set([
  'stolen_base_2b', 'stolen_base_3b', 'stolen_base_home',
  'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_1b', 'pickoff_2b', 'pickoff_3b',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
  'runner_placed',
])

// The play-by-play prose for a baserunning event (steal, caught stealing, wild
// pitch…), rendered as a secondary line beneath the batter's own description on
// the card of the plate appearance it happened during. Names linkify the same
// way the main description does.
export function BaserunningNote({ segments }) {
  return (
    <div className="pbp__subnote">
      {segments.map((seg, i) =>
        seg.id != null ? (
          <span key={i} className="pbp__name">
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </div>
  )
}

export function EventNote({ entry }) {
  return (
    <div className="pbp__note">
      <span className="pbp__noteicon" aria-hidden="true">
        {EVENT_ICONS[entry.eventType] ?? '🔄'}
      </span>
      <span className="pbp__notetext">
        {entry.segments.map((seg, i) =>
          seg.id != null ? (
            <PlayerLink key={i} id={seg.id}>
              {seg.text}
            </PlayerLink>
          ) : (
            seg.text
          ),
        )}
      </span>
    </div>
  )
}

// A mound visit: the same kraft-amber notification card as a substitution —
// no headshot to show (it's a team-level event, not a person), so the visiting
// club's own mark sits up front instead of a code (the "Mound visit" label
// already says what this is). The useful bit is how many visits the club has
// left (MLB caps them — see moundVisitsAllowed), drawn as used/open pips
// (UsagePips) — the same shared component StatBox.jsx's ABS challenge row
// uses, sized up here (pitchernotice--mv) since this card has no other figure
// competing for attention. A visible "N left" tail rides alongside the pips,
// same idiom as the ABS row's own .abs__rec readout — the dots alone don't
// say which fill state means used vs. still available, so a viewer has to
// guess (verified feedback: kraft-brown fill read as ambiguous either way).
export function MoundVisitBar({ team, teamId, remaining, allowed }) {
  const used = remaining != null && allowed != null ? Math.max(0, allowed - remaining) : null
  const label =
    used != null ? `${used} of ${allowed} mound visits used, ${remaining} left` : undefined
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event pitchernotice--mv">
      <TeamLogo teamId={teamId} name={team} size={20} className="pitchernotice__teammark" />
      <span className="pitchernotice__label">Mound visit{team ? ` — ${team}` : ''}</span>
      <span className="pitchernotice__spacer" />
      {used != null && (
        <>
          <UsagePips allowed={allowed} used={used} label={label} />
          <span className="pitchernotice__mvcount" aria-hidden="true">
            {remaining} left
          </span>
        </>
      )}
    </div>
  )
}

// An ejection (or a delay advisory — injury, on-field, weather — passing
// `code="DELAY"`): the same kraft-amber notification card, captioned in the
// negative accent instead of an icon — the description sentence already
// carries every detail worth showing, so there's nothing else to add. A
// delay has no one person to card the way a substitution does, so it shares
// this shape rather than getting a bespoke one; may be worth its own later.
export function EjectionBar({ text, code = 'EJ' }) {
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event">
      <span className="pitchernotice__code pitchernotice__code--alert">{code}</span>
      <span className="pitchernotice__eventtext">{text}</span>
    </div>
  )
}

// A baserunning/misc event with no plate appearance of its own (steal, caught
// stealing, pickoff, wild pitch, passed ball, balk) — the same kraft-amber
// notification card, captioned with the real scorer's shorthand (EVENT_CODES)
// instead of an emoji, plus the one clear person the event is actually about
// when the feed names one (a runner stealing, the pitcher on a balk/wild
// pitch, the catcher on a passed ball).
export function EventCard({ code, runnerId, teamId, segments }) {
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event">
      <span className="pitchernotice__code">{code}</span>
      {runnerId != null && <PitcherPhoto personId={runnerId} teamId={teamId} />}
      <span className="pitchernotice__eventtext">
        {segments.map((seg, i) =>
          seg.id != null ? (
            <PlayerLink key={i} id={seg.id}>
              {seg.text}
            </PlayerLink>
          ) : (
            seg.text
          ),
        )}
      </span>
    </div>
  )
}
