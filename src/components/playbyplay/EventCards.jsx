import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherPhoto } from './PitcherNotice.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { UsagePips } from '../charts/UsagePips.jsx'
import { formatDelay } from '../inning/DelayCard.jsx'

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
  // A delay advisory (injury, on-field, weather). Belt and braces only:
  // PlayByPlay routes every delay that reaches the feed to DelayNotice below,
  // so nothing has taken this path — it is here so a future caller that hands
  // EventNote a delay gets a pause glyph rather than the swap arrows.
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

// An ejection: the same kraft-amber notification card, captioned in the
// negative accent instead of an icon — the description sentence already
// carries every detail worth showing (who, by which umpire), so there's
// nothing else to add.
//
// This used to caption delay advisories too, on the reasoning that a delay had
// no one person to card. It has one — just not the one the feed names — so
// delays moved to DelayNotice below (ADR-0060). The `code` prop stays because
// it costs nothing and the default is what every caller passes.
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

// A DELAY that came to something — an injury or on-field stoppage that took a
// player out of the game, an umpire change, or a stoppage long enough to be
// worth a mark on its own. The same kraft-amber notification card as an
// ejection, given the one thing a delay card was always missing: a subject.
//
// The feed's own account of a delay is two words ("Injury Delay.") attached to
// whoever happened to be batting, so the card used to land beside a plate
// appearance it had nothing to do with and say nothing about it. Everything
// here is the answer to that — `title` is the stoppage in readable words,
// `detail` says what became of the man it was actually about, `playerId` is
// that man rather than the batter, and `minutes` is how long play stopped. A
// delay that can fill none of them never reaches this component: the feed
// builder drops it (api/playbyplay/notificationCards.js's delayNoteFields,
// ADR-0060), which is four delay advisories in five.
//
// The whole entry comes in rather than five props because the caller has one
// thing left to decide — `teamId`, the club the subject came off, which the
// entry gives as a side ('pitching'/'batting') and only PlayByPlay can resolve
// to an id. An umpire change belongs to neither club and carries no headshot.
export function DelayNotice({ entry, teamId }) {
  const { title, detail, minutes, playerId } = entry
  // The length rides INSIDE the heading rather than as a right-hand tail like
  // the mound-visit card's "N left". Tried as a tail first and it loses at
  // phone width: the tail will not shrink, so the sentence absorbs every pixel
  // it takes and "Inclement weather delay — Grant Taylor leaves the game"
  // broke over five lines beside it. In the heading it costs four words and
  // the sentence keeps the whole card.
  const lead = minutes != null ? `${title} (${formatDelay(minutes)})` : title
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event">
      <span className="pitchernotice__code pitchernotice__code--alert">DELAY</span>
      {playerId != null && <PitcherPhoto personId={playerId} teamId={teamId} />}
      <span className="pitchernotice__eventtext">
        <b>{lead}</b>
        {detail ? ` — ${detail}` : ''}
      </span>
    </div>
  )
}
