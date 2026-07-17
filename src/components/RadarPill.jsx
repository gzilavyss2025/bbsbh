import { useState } from 'react'
import { teamPrimaryColor } from '../lib/teams.js'

// A small "scout's glyph" for the breakout/fade prospect radar (see
// src/api/feverRadar.js + gen-fever-radar.mjs) — a magnifying glass rather
// than upfront jargon or a board rank (a static "#8" reads as "8th most
// likely," which overstates what an ordinal position on a ~20-name board
// actually means — see the plain-text note instead), so the row stays quiet
// until someone taps it. Tapping presses the glyph in place (reuses
// .postponed's stamp-press) and tints it the player's own club color via
// teamPrimaryColor (teams.js) — falls back to plain ink for a team with no
// known color (MiLB) rather than rendering a wrong one. The revealed note's
// up/down direction (breakout vs. fade) lives on its own tag, in
// green/clay-red — the one place this component borrows the app's
// --accent-positive/--accent-negative pairing. Never styled with the
// kraft-seal amber — that's reserved for score covers (see CLAUDE.md's
// spoiler rule). The source itself isn't named here — it's a third-party
// model, attributed on the About page's data-sources note instead of
// in-line on every row. `entry` comes from radarEntryFor; renders nothing
// when the player isn't on either MLB board, so callers can splice it in
// unconditionally.
// Same claim, many voices (beat writer, casual fan, wise fan, scout) — one
// gets picked per player per day (see pickPlainText) so the note doesn't
// read identically on every visit, but two taps on the same guy today still
// show the same line.
const PLAIN_TEXT = {
  mlb_breakout: [
    // Beat writer
    'Hitting the ball hard — the results haven’t caught up yet.',
    'His contact quality has outpaced his production for weeks now.',
    'The underlying numbers point to better results than he’s gotten.',
    'He’s squaring up pitches at an elite rate; the box score hasn’t noticed.',
    'Hard contact has been a constant, even as the results lagged.',
    'The exit velocity says one thing; the batting average says another.',
    // Casual fan
    'Man, he’s crushing the ball — it just keeps finding a glove.',
    'This guy’s been smoking it right at people all week.',
    'He’s hitting rockets — the luck’s gotta turn eventually.',
    'Dude is hitting missiles and getting absolutely nothing to show for it.',
    'I don’t know how this guy doesn’t have five more hits by now.',
    'Every time he squares one up, somebody’s standing right there.',
    // Wise fan
    'I’ve seen this before — a hitter squares the ball up long enough, the results follow.',
    'Contact like that doesn’t stay hidden for long.',
    'He’s hitting the ball too hard for the gloves to keep finding it.',
    'Watched enough baseball to know: barrel the ball enough, and the hits come.',
    'Baseball has a way of evening out — this is a hitter waiting on that.',
    'The ball’s coming off his bat the same as it always has; the box score just hasn’t noticed.',
    // Scout
    'Bat speed and barrel control are big-league quality — the results should follow.',
    'Above-average bat-to-ball skills; this is a better hitter than his numbers show.',
    'Handles velocity well and controls the zone — his tools are ahead of his production.',
    'Everything you want to see in the swing is there; the results just haven’t arrived yet.',
    'This is a hitter whose production should catch up to his tools soon.',
    'Clean swing, strong contact — nothing here looks like a fluke.',
  ],
  mlb_fade: [
    // Beat writer
    'Riding a hot streak his contact quality doesn’t quite support.',
    'The results are hot; the contact behind them isn’t quite there.',
    'Running hotter than how hard he’s actually hitting the ball.',
    'A hot streak that’s outrunning his underlying contact.',
    'Producing more than his contact quality usually supports.',
    'A batting surge that looks stronger than the contact behind it.',
    // Casual fan
    'He’s on a heater right now, but he’s not really squaring the ball up.',
    'Feels like every one of his at-bats is finding a hole lately.',
    'He’s been living off soft contact and good bounces.',
    'Guy’s just finding grass right now — it’s not the loudest contact.',
    'Every ball he hits seems to sneak through somehow.',
    'He’s putting up numbers, but he’s not squaring much of anything up.',
    // Wise fan
    'Seen this movie before — the numbers come back down to the swing.',
    'Hot bats cool. Doesn’t mean he’s not good, just means it won’t stay this hot.',
    'He’s been getting the friendly bounces; those don’t last a whole season.',
    'A good stretch, sure, but the swing hasn’t changed as much as the results have.',
    'Baseball humbles everybody eventually — even guys on a run like this.',
    'The swing looks the same as it did during the quiet stretch. Just falling in now.',
    // Scout
    'Good approach, but the contact quality doesn’t match the recent production.',
    'Bat-to-ball skills are solid, not special — this pace won’t hold.',
    'Solid hitter, but this kind of production needs more than what’s in the swing.',
    'The contact isn’t loud enough to sustain what he’s doing right now.',
    'Nothing in the swing has changed — the results have just been more forgiving.',
    'A fine everyday bat, but this level of production is hard to sustain.',
  ],
}

// Deterministic string hash (djb2) — same seed always picks the same index,
// so pickPlainText(entry, today) is stable across re-renders/reopens without
// storing anything, but changes with either the player or the day.
function hashString(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return Math.abs(hash)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function pickPlainText(entry) {
  const variants = PLAIN_TEXT[entry.board]
  const index = hashString(`${entry.playerId}:${entry.board}:${todayKey()}`) % variants.length
  return variants[index]
}

// evPercentile is Baseball Savant's percentile for AVERAGE exit velocity —
// not a hardest-swings/ceiling stat (that's Fever's own ev95, which this
// meter deliberately doesn't show), and not a stand-in for overall hitting
// skill (a contact hitter can have a great batting line with modest exit
// velo, and vice versa). Every line below stays anchored to "how hard the
// ball comes off his bat, on average / night in and night out" — never
// "swing," "bat speed" (a different, real Statcast metric — do not conflate
// it with this one), or generic "good/bad hitter" language. "Hits the ball
// harder than 4% of MLB hitters" is also technically accurate but reads as
// a backhanded insult — below the 50th percentile this restates in the
// natural direction ("softer than 96% of the league") instead of that
// literal, awkward complement. Same rotation mechanism as PLAIN_TEXT, keyed
// separately (":ev:" not ":board:") so it doesn't always land on the same
// index as the plain-language sentence.
const HARD_LABELS = [
  (pct) => `Hits the ball harder, on average, than ${pct}% of MLB hitters`,
  (pct) => `The ball typically comes off his bat harder than ${pct}% of the league`,
  (pct) => `Generates harder contact, night in and night out, than ${pct}% of MLB hitters`,
  (pct) => `His average contact speed tops ${pct}% of the league`,
  (pct) => `When he connects, the ball usually comes off harder than ${pct}% of MLB hitters`,
  (pct) => `One of the harder average-contact bats in the league — tops ${pct}% of hitters`,
]
const SOFT_LABELS = [
  (soft) => `Softer contact, on average, than ${soft}% of MLB hitters`,
  (soft) => `The ball typically doesn’t come off his bat as hard as ${soft}% of the league’s`,
  (soft) => `Generates softer contact, night in and night out, than ${soft}% of MLB hitters`,
  (soft) => `His average contact speed trails ${soft}% of the league`,
  (soft) => `When he connects, the ball usually comes off softer than ${soft}% of MLB hitters`,
  () => `One of the softer average-contact bats in the league`,
]
// Reserved for the extreme low end (below), where a raw count lands harder
// than a percentage — "only 22 other hitters" is viscerally low in a way
// "4%" isn't. Real count from qualifiedCount (savantPercentiles.js), never
// invented; falls back to SOFT_LABELS whenever that count isn't available.
const VERY_SOFT_LABELS = [
  (soft, below) => `The ball typically comes off his bat harder than only ${below} other qualified hitters`,
  (soft, below) => `Just ${below} qualified MLB hitters average softer contact than him`,
  (soft, below) => `One of the softest average-contact bats in the league — only ${below} hit it more softly`,
  (soft, below) => `Barely any pop on contact — only ${below} hitters in MLB average less`,
  (soft) => `Softer contact, on average, than ${soft}% of MLB hitters`,
  () => `Near the bottom of the league in average contact speed`,
]

function pickMeterLabel(entry, percentile, leagueSize) {
  const isHard = percentile >= 50
  const soft = 100 - percentile
  const below = leagueSize ? Math.max(1, Math.round((percentile / 100) * leagueSize)) : null
  let pool
  if (isHard) {
    pool = HARD_LABELS
  } else if (percentile < 20 && below != null) {
    pool = VERY_SOFT_LABELS
  } else {
    pool = SOFT_LABELS
  }
  const index = hashString(`${entry.playerId}:ev:${todayKey()}`) % pool.length
  return pool[index](isHard ? percentile : soft, below)
}

function DirectionTriangle({ up }) {
  return (
    <svg viewBox="0 0 20 20" width="10" height="10" aria-hidden="true">
      {up ? (
        <polygon points="8.5,3.5 14.5,14.5 2.5,14.5" fill="currentColor" />
      ) : (
        <polygon points="2.5,3.5 14.5,3.5 8.5,14.5" fill="currentColor" />
      )}
    </svg>
  )
}

// A real number (Fever's own ev95 mph) is meaningless without knowing what's
// normal — a plain mph figure reads as "roughly league average" only to
// someone with the benchmark memorized. evPercentile (Baseball Savant's own
// season percentile rank for exit velocity, savantPercentiles.js) already
// answers "compared to what" against the real qualified league, not Fever's
// ~35-player flagged sample, so it's shown as a track + fill rather than a
// bare mph value — the fill length IS the comparison, the number is a
// direct label on top of it, same team color as the glyph for continuity.
// Single entity, static (no hover) — matches the dataviz skill's meter form
// for "one value against a benchmark."
function EvMeter({ entry, percentile, leagueSize, teamColor }) {
  if (percentile == null) return null
  return (
    <div className="radarpill__meter">
      <div className="radarpill__meter-track" aria-hidden="true">
        <div
          className="radarpill__meter-fill"
          style={{ width: `${percentile}%`, ...(teamColor ? { '--radar-team-color': teamColor } : {}) }}
        />
      </div>
      <span className="radarpill__meter-label">{pickMeterLabel(entry, percentile, leagueSize)}</span>
    </div>
  )
}

export function RadarPill({ entry, teamId, evPercentile = null, evLeagueSize = 0 }) {
  const [open, setOpen] = useState(false)
  if (!entry) return null
  const isBreakout = entry.board === 'mlb_breakout'
  const label = isBreakout ? 'Breakout' : 'Cooling'
  const movementText = entry.movement
    ? `${entry.movement.delta > 0 ? '+' : ''}${entry.movement.delta} since ${entry.movement.sinceDate}`
    : ''
  const teamColor = teamPrimaryColor(teamId)
  return (
    // Fragment, not a wrapping span: the glyph and the note must be direct
    // siblings in the row's namewrap flex-wrap, not nested inside a shared
    // flex box together — otherwise the note's height drags the glyph
    // toward vertical-center along with it once it opens.
    <>
      <button
        type="button"
        className={`radarpill__glyph${open ? ' radarpill__glyph--pressed' : ''}`}
        style={teamColor ? { '--radar-team-color': teamColor } : undefined}
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={`Scouting note — ${label}`}
      >
        <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
          <circle cx="8.2" cy="8.2" r="5.3" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <line x1="12.3" y1="12.3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span className="radarpill__note">
          <span className={`radarpill__note-tag radarpill__note-tag--${isBreakout ? 'up' : 'down'}`}>
            <DirectionTriangle up={isBreakout} />
            {label}
          </span>
          <span className="radarpill__note-text">{pickPlainText(entry)}</span>
          <EvMeter entry={entry} percentile={evPercentile} leagueSize={evLeagueSize} teamColor={teamColor} />
          {movementText && <span className="radarpill__note-source">{movementText}</span>}
        </span>
      )}
    </>
  )
}
