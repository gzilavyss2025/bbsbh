// The game-preview poster's data model — one plain object, built once, holding
// every string and number the poster prints.
//
// WHY THIS IS ITS OWN MODULE, AND WHY IT IS THE WHOLE SPOILER STORY.
// The poster is an IMAGE the user posts in public, so it is the one surface
// here where a leaked number can't be un-leaked by re-sealing a card. Rather
// than trust a painter spread across half a dozen draw functions to stay
// clean, every value the poster can print is assembled HERE, in one function,
// from spoiler-free selectors only — and the painter is given this object and
// nothing else (no feed, no gamePk). Auditing the poster is therefore reading
// this file, not tracing the canvas code.
//
// Everything below is pre-game by nature: a matchup, a scheduled time, a
// ballpark, a posted lineup, a probable starter's SEASON line, an umpire's
// season accuracy. None of it moves when the game does. That is why the poster
// renders the same before first pitch and after a final — a preview of a game
// already played is still a preview, and this module has no path to a run.
//
// NOT IMPORTED HERE, DELIBERATELY: linescore.js, derive.js, boxscore.js,
// gameStory.js (all reveal-only), and the caller-gated staging selectors
// (lineupEntering/defenseEntering/selectPrePitchChanges) — a poster has no
// half-inning to be "entering", so selectLineup's posted card is the only
// correct source. See src/api/CLAUDE.md and spoiler-manifest.json.
//
// Field paths verified against gamePk 823263 (2026-08-12 MIL @ SD) — the
// record/venue-location/roof/weather paths below are the ones this file adds
// beyond what the shared selectors already cover.
import {
  selectGameInfo,
  selectHasStarted,
  selectLineup,
  selectOfficials,
  selectTeamMeta,
} from './select.js'
import { splitName } from '../lib/teamSplits.js'

// "2026-08-12" -> { weekday: 'Wednesday', monthDay: 'August 12', year: '2026' }.
// Parsed as parts rather than `new Date(iso)`, which reads a bare date as UTC
// and rolls back a day for anyone west of Greenwich — the same trap
// lib/dates.js avoids for every other date line in the app.
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function posterDateParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return { weekday: '', monthDay: '', year: '' }
  const [, y, mo, d] = m
  const local = new Date(Number(y), Number(mo) - 1, Number(d))
  return {
    weekday: WEEKDAYS[local.getDay()] ?? '',
    monthDay: `${MONTHS[Number(mo) - 1]} ${Number(d)}`,
    year: y,
  }
}

// "74-46" plus the winning percentage the feed already formatted (".617").
//
// ONLY BEFORE FIRST PITCH, and that is a correctness rule rather than a spoiler
// one — a club's record is a standings fact, and standings are an open surface
// here (ADR-0034). The problem is what the number MEANS. Verified against
// gamePk 823035 (2026-07-07 MIL @ STL g2): `gameData.teams[side].record` is the
// record INCLUDING that game's result — it reads 58-33, matching the schedule
// row's post-game leagueRecord, not the 57-33 Milwaukee carried into it. Before
// first pitch there is no result yet, so the same field is exactly the "record
// entering" a preview graphic is supposed to show; afterwards it silently
// becomes a different statistic, on a sheet that still says preview. Rather
// than print a number that means one thing on Tuesday and another on Wednesday,
// a started game's poster simply carries no record.
//
// Null also when the feed has no record at all — every MiLB level, and MLB
// spring games before the standings open.
function recordFor(team, started) {
  if (started) return null
  const r = team?.record
  if (r?.wins == null || r?.losses == null) return null
  return { wins: r.wins, losses: r.losses, line: `${r.wins}-${r.losses}`, pct: r.pct ?? '' }
}

// The club's identity as the poster prints it: place over nickname, the same
// two-line stack the slate card uses (MILWAUKEE / BREWERS). splitName is the
// shared resolver, so a club whose feed name doesn't split cleanly reads the
// same here as it does on the card.
function clubFor(feed, side, started) {
  const meta = selectTeamMeta(feed, side)
  const { location, mascot } = splitName(meta.name || '', meta.clubName || '')
  return {
    id: meta.id ?? null,
    abbr: meta.abbreviation || '',
    place: location || meta.franchiseName || '',
    nick: mascot || meta.clubName || meta.teamName || '',
    sportId: meta.sportId ?? null,
    record: recordFor(feed?.gameData?.teams?.[side], started),
  }
}

// A probable starter, joined to the season line the caller already fetched
// (game.js's fetchPitcherSeasonLine / fetchPitcherLastGame, both season or
// already-final aggregates — never this game's). `line` is null until that
// fetch lands, which is why every consumer treats it as optional.
function starterFor(feed, side, line) {
  const p = selectTeamMeta(feed, side).probablePitcher
  if (!p) return null
  return {
    id: p.id,
    // Natural order ("Dustin May"), not the scorebook's last-first. The starter
    // card inside the app stays last-first because it is a card you read
    // alongside a batting order; a poster is read by whoever it is posted to,
    // and "MAY, DUSTIN" there looks like a roster printout.
    name: p.name || p.nameLastFirst,
    jersey: p.jersey || '',
    // 'LHP' / 'RHP', or '' where the feed carries no pitch hand.
    hand: p.hand ? `${p.hand}HP` : '',
    era: line?.era || '',
    record: line?.wins != null ? `${line.wins}-${line.losses}` : '',
    strikeOuts: line?.strikeOuts != null ? String(line.strikeOuts) : '',
    innings: line?.inningsPitched || '',
    whip: line?.whip || '',
    lastGame: line?.lastGame ?? null,
  }
}

// A posted batting order, trimmed to what a poster row prints. Empty array
// when the card hasn't posted — the painter draws the "posts close to first
// pitch" notice instead of an empty grid, the same fallback TeamInfo uses.
function lineupFor(feed, side) {
  return selectLineup(feed, side).map((p) => ({
    order: p.order,
    name: p.last || p.nameLastFirst,
    position: p.position || '',
    jersey: p.jersey || '',
  }))
}

// The plate umpire's season accuracy, reshaped off loadUmpire()'s object. Only
// the four tiles and the zone grid the poster has room for — the full card
// (UmpireTendencies) stays the place to read the rest. Null for a crew with no
// plate assignment yet, a MiLB ump, or one the nightly sweep hasn't reached:
// `umpire.accuracy.season.called` is loadUmpire's own "is there anything here"
// test, asked the same way.
function plateFor(officials, umpire) {
  const hp = officials.find((o) => o.role === 'HP') ?? null
  if (!hp) return null
  const season = umpire?.accuracy?.season
  const base = { id: hp.id, name: hp.name || '' }
  if (!season?.called) return base
  return {
    ...base,
    accuracy: season.accuracy,
    consistency: season.consistency,
    favorPerGame: season.favorPerGame,
    games: season.games,
    rank: umpire?.rank ? { rank: umpire.rank.rank, total: umpire.rank.total } : null,
    // The 3×3 league-relative grid — each cell's `over` is its strike-call rate
    // above (+) or below (−) the league's for that cell.
    zoneCells: Array.isArray(umpire?.zoneCells) ? umpire.zoneCells : null,
    watch: umpire?.watchArea?.phrase || '',
  }
}

// `extras` carries what the screen already had in hand from useGameData —
// nothing here fetches. `starterLines` is keyed by side the way GameView holds
// it; `broadcast` is fetchGameBroadcast's already-summarised line; `umpire` is
// loadUmpire()'s object for the plate umpire.
export function buildPreviewModel(feed, extras = {}) {
  if (!feed) return null
  const { starterLines = {}, broadcast = '', umpire = null } = extras
  const info = selectGameInfo(feed)
  const officials = selectOfficials(feed)
  const venue = feed?.gameData?.venue ?? {}
  const city = venue.location?.city ?? ''
  const state = venue.location?.stateAbbrev ?? venue.location?.state ?? ''
  // Structural game state, not a score — selectGameStatus's own footing. Only
  // recordFor reads it; see its header for why a started game drops the record.
  const started = selectHasStarted(feed)

  return {
    date: posterDateParts(info.officialDate),
    officialDate: info.officialDate,
    // The scheduled start is the only time value that exists before the
    // lineups post (selectGameInfo's own note), so it leads; `firstPitch`
    // only ever appears once the game is under way.
    startTime: info.scheduledTime || info.firstPitch || '',
    dayNight: info.dayNight || '',
    venue: {
      name: info.venue,
      place: [city, state].filter(Boolean).join(', '),
      // 'Open' | 'Dome' | 'Retractable' — printed only when it isn't Open,
      // since an open-air park is the unremarkable case.
      roof: venue.fieldInfo?.roofType ?? '',
    },
    weather: info.weather,
    // "FS1 · Bally Sports Wisconsin" — already summarised and capped by
    // api/broadcast.js, printed as the poster's "where to watch" chip.
    broadcast: broadcast || '',
    started,
    away: clubFor(feed, 'away', started),
    home: clubFor(feed, 'home', started),
    starters: {
      away: starterFor(feed, 'away', starterLines.away),
      home: starterFor(feed, 'home', starterLines.home),
    },
    lineups: { away: lineupFor(feed, 'away'), home: lineupFor(feed, 'home') },
    crew: officials,
    plate: plateFor(officials, umpire),
  }
}
