import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherPhoto } from './PitcherNotice.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { TABS, delaySentence, delayTab, ejectedClub, moundPips, playerClubId } from './cardCopy.js'
import { formatDelay } from '../inning/DelayCard.jsx'
import { eventCardClass } from '../../lib/design/cardClass.js'
import { teamClubName } from '../../lib/teams.js'

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
// appearance of its own — and all three render in the SAME marker-wash card
// (the stamped event card, `eventCardClass()` here; an actor card's caller
// passes the same call, ADR-0113), distinguished by what is inside
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

// The name tab of an EventCard (ADR-0113), by its shorthand code. The code
// stays in the row; the tab is the card's heading.
export const EVENT_NAMES = {
  SB: 'Stolen base', CS: 'Caught stealing', PK: 'Pickoff', WP: 'Wild pitch', PB: 'Passed ball',
  BK: 'Balk', RP: 'Runner placed', DI: 'Defensive indifference',
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

// A mound visit: the stamped event card (ADR-0113). The body is the club's name, five
// square pips (ink = used, yellow = open) and the club's logo; the "N left" count tag rides
// the top right edge. The trip that pulled the pitcher is not charged (`remaining` null):
// no pips, no tag (moundPips).
export function MoundVisitBar({ team, teamId, remaining, allowed }) {
  const pips = moundPips({ remaining, allowed })
  return (
    <div className={`change ${eventCardClass()} change--event change--mv`}>
      <h4 className="card__name">{TABS.moundVisit}</h4>
      {pips && <span className="card__count">{pips.tag}</span>}
      <span className="change__club">{team}</span>
      {pips && (
        <span className="change__pips" role="img" aria-label={pips.label}>
          {Array.from({ length: pips.total }, (_, i) => (
            <span key={i} className={`change__pip${i < pips.used ? ' change__pip--used' : ''}`} />
          ))}
        </span>
      )}
      <TeamLogo teamId={teamId} name={team} size={36} className="change__logo" />
    </div>
  )
}

// An ejection: the ejected person's photo (a manager's resolves on the chain's coach rung),
// the feed's one sentence, and the club's logo, which ejectedClub finds (the boxscore roster's club for a
// player, the sentence's leading club name for a manager); no club, no logo. No photo, no box.
export function EjectionBar({ text, playerId = null, clubs = [], feed = null }) {
  const club = ejectedClub(text, clubs, feed, playerId)
  return (
    <div className={`change ${eventCardClass()} change--event`}>
      <h4 className="card__name">{TABS.ejection}</h4>
      {playerId != null && <PitcherPhoto personId={playerId} teamId={club?.id ?? null} bare large />}
      <span className="change__eventtext">{text}</span>
      {club && <TeamLogo teamId={club.id} name={club.name} size={36} className="change__logo" />}
    </div>
  )
}

// A baserunning/misc event with no plate appearance of its own (steal, caught stealing,
// pickoff, wild pitch, passed ball, balk): the tab names it, the runner's (or pitcher's)
// photo leads, the feed's sentence follows and the club's logo ends the row. "Pitch N"
// rides the count tag. The logo is the club of the person in the photo (playerClubId); a person
// in no roster gets `teamId`, the club his photo's fallback already uses, so the two agree. The scorer's shorthand (EVENT_CODES) is no longer drawn: the trail
// and the scorebook still read it.
export function EventCard({ code, runnerId, teamId, feed = null, segments, pitchLabel = null }) {
  const logoId = playerClubId(feed, runnerId) ?? teamId
  return (
    <div className={`change ${eventCardClass()} change--event`}>
      <h4 className="card__name">{EVENT_NAMES[code]}</h4>
      {pitchLabel && <span className="card__count">{pitchLabel}</span>}
      {runnerId != null && <PitcherPhoto personId={runnerId} teamId={teamId} stamped />}
      <span className="change__eventtext">
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
      {logoId != null && <TeamLogo teamId={logoId} name={teamClubName(logoId) ?? ''} size={32} className="change__logo" />}
    </div>
  )
}

// A DELAY that came to something (ADR-0060): the tab is the headline ("Injury delay"),
// the sentence is the man who left or, with nobody, how long play stopped (delaySentence).
// He is `playerId`, not the batter the feed names. A rain delay has no club and no logo.
export function DelayNotice({ entry, teamId }) {
  const { title, playerId } = entry
  const club = playerId != null ? teamId : null
  return (
    <div className={`change ${eventCardClass()} change--event`}>
      <h4 className="card__name">{delayTab(title)}</h4>
      {playerId != null && <PitcherPhoto personId={playerId} teamId={teamId} bare large />}
      <span className="change__eventtext">{delaySentence(entry, formatDelay)}</span>
      {club != null && <TeamLogo teamId={club} name={teamClubName(club) ?? ''} size={36} className="change__logo" />}
    </div>
  )
}
