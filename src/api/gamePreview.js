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

// A hitter's season slash — AVG/OBP/OPS, already formatted by the feed as
// ".278" / ".341" / ".821", so nothing here rounds or divides.
//
// A SEASON aggregate, which is an open surface (ADR-0034): a stat line is not
// a score, and gating one is the mistake that ADR undid. Unlike the club record
// above, this one needs no started-game gate — a slash that moved by .003
// because of the game you are previewing says nothing about it, and the same
// numbers are already on the lineup pages, the player page, and the back of
// every baseball card. Blank for a hitter with no plate appearances yet.
function battingFor(feed, side, personId) {
  const b = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${personId}`]?.seasonStats?.batting
  if (!b || !b.avg || !b.atBats) return null
  return {
    avg: b.avg ?? '',
    obp: b.obp ?? '',
    slg: b.slg ?? '',
    ops: b.ops ?? '',
    homeRuns: b.homeRuns ?? null,
    rbi: b.rbi ?? null,
    stolenBases: b.stolenBases ?? null,
  }
}

// A posted batting order, trimmed to what a poster row prints. Empty array
// when the card hasn't posted — the painter draws the "posts close to first
// pitch" notice instead of an empty grid, the same fallback TeamInfo uses.
function lineupFor(feed, side) {
  return selectLineup(feed, side).map((p) => ({
    order: p.order,
    id: p.id,
    // The full name in natural order. The scorebook's surname-only column is
    // right on a page you read next to a game; a poster is read by people who
    // do not have the roster in their head.
    name: p.name || p.nameLastFirst,
    last: p.last || '',
    position: p.position || '',
    jersey: p.jersey || '',
    batting: battingFor(feed, side, p.id),
  }))
}

// The plate umpire's season accuracy, reshaped off loadUmpire()'s object. Only
// the four tiles and the zone grid the poster has room for — the full card
// (UmpireTendencies) stays the place to read the rest. Null for a crew with no
// plate assignment yet, a MiLB ump, or one the nightly sweep hasn't reached:
// `umpire.accuracy.season.called` is loadUmpire's own "is there anything here"
// test, asked the same way.
// "How they win" — the four situational records the poster compares side by
// side, off the nightly callouts bundle's `teamRecords` (docs/callouts.md).
//
// THESE ARE RECORDS ENTERING TONIGHT, by construction rather than by luck, and
// that is why they are here when the club's own W-L is not. `gen-callouts.mjs`
// sets `asOf` to the day BEFORE the slate and bounds its schedule pull to it,
// so the shard written for a date holds only games already played when that
// date began. The feed's `teams[side].record` has no such property — it moves
// the moment the game ends — which is what recordFor above has to refuse.
//
// The four families are FIXED rather than picked per club: a row only means
// something if it says the same thing on both sides, and choosing each club's
// most lopsided line would make the two columns incomparable. Every one of them
// is present for both clubs in every shard checked, MLB and MiLB alike.
const RECORD_ROWS = [
  { key: 'scoringFirst', label: 'Scoring first' },
  { key: 'opponentScoringFirst', label: 'Opponent scores first' },
  { key: 'leadAfter7', label: 'Leading after 7' },
  { key: 'oneRun', label: 'One-run games' },
]

function recordsFor(bundle, side) {
  const r = bundle?.teamRecords?.[side]
  if (!r) return null
  // Read from `leadAfterFull`, which always carries 6/7/8 — `leadAfter` keeps
  // only the innings lopsided enough to be worth an in-game note, so it can be
  // missing the very one this row wants.
  //
  // The SEVENTH, not the eighth. A club's record leading after eight is nearly
  // a tautology at this point in a season (49-0 is a fact about how saves work);
  // after seven there is still a game left to lose, so the number says something
  // about the club rather than about the rulebook.
  const lead7 = r.leadAfterFull?.['7']
  const values = {
    scoringFirst: r.scoringFirst || '',
    opponentScoringFirst: r.opponentScoringFirst || '',
    leadAfter7: lead7 ? `${lead7.w}-${lead7.l}` : r.leadAfter?.['7'] || '',
    oneRun: r.oneRun || '',
  }
  return RECORD_ROWS.some((row) => values[row.key]) ? values : null
}

// The plate umpire, in the shape UmpireTendencies reads — the poster's block is
// that card, so it takes the same fields rather than a flattened summary of
// them. Null for a crew with no plate assignment yet; the bare `{ id, name }`
// for a MiLB umpire or one the nightly sweep hasn't reached, which is
// loadUmpire's own `accuracy.season.called` test asked the same way.
function plateFor(officials, umpire) {
  const hp = officials.find((o) => o.role === 'HP') ?? null
  if (!hp) return null
  const season = umpire?.accuracy?.season
  const base = { id: hp.id, name: hp.name || '' }
  if (!season?.called) return base
  const games = Array.isArray(umpire?.games) ? umpire.games : []
  return {
    ...base,
    // The card's season year and its identity sub-line ("97 games · 21 behind
    // the plate") — a tally of assignments, never of results.
    year: umpire?.season ?? null,
    gameCount: games.length,
    plateCount: games.filter((g) => g.role === 'HP').length,
    accuracy: season.accuracy,
    consistency: season.consistency,
    favorPerGame: season.favorPerGame,
    called: season.called,
    scoredGames: season.games,
    rank: umpire?.rank ? { rank: umpire.rank.rank, total: umpire.rank.total } : null,
    // The five-band zone-lean scale: which band, and where inside the
    // continuum the caret falls. Null below the ranking floor, exactly as the
    // card's own `{lean && <LeanScale/>}` handles it.
    lean: umpire?.lean ? { tier: umpire.lean.tier, z: umpire.lean.z } : null,
    // The 3×3 league-relative grid. A cell's `over` is how far its MISS share
    // runs above the league's for that cell — not a strike-call rate. The map
    // outlines the ones over the floor; it does not shade all nine.
    zoneCells: Array.isArray(umpire?.zoneCells) ? umpire.zoneCells : null,
    watch: umpire?.watchArea ? { phrase: umpire.watchArea.phrase, hand: umpire.watchArea.hand } : null,
    // The ABS challenge pair plus the league baseline — counts of ball/strike
    // JUDGMENT challenges and their outcomes, never a run or result, the same
    // footing as every other figure here. Null on a row set swept before the
    // challenge schema shipped, exactly as the card's own guard handles it.
    challenges:
      umpire?.challenges?.perGame != null
        ? { perGame: umpire.challenges.perGame, overturnRate: umpire.challenges.overturnRate }
        : null,
    leagueChallenges:
      umpire?.leagueChallenges?.overturnRate != null
        ? { overturnRate: umpire.leagueChallenges.overturnRate }
        : null,
  }
}

// `extras` carries what the screen already had in hand from useGameData —
// nothing here fetches. `starterLines` is keyed by side the way GameView holds
// it; `broadcast` is fetchGameBroadcast's already-summarised line; `umpire` is
// loadUmpire()'s object for the plate umpire; `callouts` is the per-game bundle
// GameView already threads down as `gameCallouts`.
export function buildPreviewModel(feed, extras = {}) {
  if (!feed) return null
  // Read with `?.` and `??` rather than destructuring defaults. Every one of
  // these arrives from a `useAsync`, which holds **null** while it is in flight
  // and again after a deps change — and a default parameter only fires on
  // `undefined`, so `starterLines.away` threw on first paint and the whole
  // screen unmounted until the fetch landed. It looked like a flaky page.
  const starterLines = extras.starterLines ?? {}
  const broadcast = extras.broadcast ?? ''
  const umpire = extras.umpire ?? null
  const callouts = extras.callouts ?? null
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
    recordRows: RECORD_ROWS,
    records: { away: recordsFor(callouts, 'away'), home: recordsFor(callouts, 'home') },
  }
}
