// THE ABS CHALLENGES CARD'S MODEL — one club, two jobs (hitting, catching), and
// the figures the card draws from the per-club file (abs-exposure-clubs-*.json,
// ADR-0076). Pure: season totals over completed games, no game
// can be read back out of them.
//
// WHAT THE CARD SHOWS, AND WHERE EACH FIGURE COMES FROM
//   called   how often a man challenges, as a SHARE of the pitches he saw (a
//            hitter) or received (a catcher). The league plot is his reviews
//            against that exposure, with the league's own share as the line a
//            man sits on if he argues at exactly the league pace.
//   success  how often he was right: reviews won over reviews called. Needs
//            `wonBatter` / `wonCatcher`, so a file written before the generator
//            added them gives no success view (`hasSuccess` false) rather than
//            a card of dashes.
//
// THE RATE IS OVER THE CALLS A MAN COULD HAVE CHALLENGED. A batter can only
// challenge a called strike, a catcher only a called ball, so the share is his
// reviews over the strikes he saw or the balls he received, counted by the
// umpire's ORIGINAL call (`strikesSeen`, `ballsReceived` in the club file: an
// overturned strike is still a strike seen). Until the generator's backfill has
// written those, the card keeps the rate it had before: all pitches seen for a
// hitter, innings caught (per nine) for a catcher, so it never reads a column
// that is not there. The basis is named on the model (`basis`: 'calls',
// 'pitches' or 'innings') so the caption can say which one it is.
//
// SHARES ARE CUT, NOT ROUNDED. 0.249% prints 0.2%, and 29 of 100 prints 29.0%.
// `cutPercent` does it in integer arithmetic, so a float's last digit cannot
// move a figure across a boundary.

import { MIN_CATCHER_INNINGS, MIN_PLATE_APPEARANCES } from './absExposure.js'

const num0 = (n) => Math.round(n).toLocaleString('en-US')

// "0.2%" for 7 of 2,890 at one place. Null when there is nothing to divide.
export function cutPercent(part, whole, places = 2) {
  if (!(whole > 0) || part == null) return null
  const scale = 10 ** (places + 2)
  return `${(Math.floor((part * scale) / whole + 1e-9) / 10 ** places).toFixed(places)}%`
}

const per9 = (calls, innings) => (innings > 0 ? ((calls / innings) * 9).toFixed(2) : null)

// The two jobs, as data.
const JOBS = {
  batter: {
    key: 'batter',
    tab: 'At the plate',
    where: 'at the plate',
    plural: 'hitters',
    callsOn: 'asBatter',
    wonOn: 'wonBatter',
    resultsOn: 'resultsBatter',
    floorOn: 'plateAppearances',
    floor: MIN_PLATE_APPEARANCES,
    floorText: '200+ plate appearances',
    // The chances (original called strikes), then the pitch count it replaces.
    callsFieldOn: 'strikesSeen',
    fallbackOn: 'pitches',
    fallbackBasis: 'pitches',
    callWord: 'Called strikes seen',
    callLabel: 'Strikes',
  },
  catcher: {
    key: 'catcher',
    tab: 'Behind it',
    where: 'behind it',
    plural: 'catchers',
    callsOn: 'asCatcher',
    wonOn: 'wonCatcher',
    resultsOn: 'resultsCatcher',
    floorOn: 'catcherInnings',
    floor: MIN_CATCHER_INNINGS,
    floorText: '200+ innings caught',
    callsFieldOn: 'ballsReceived',
    fallbackOn: 'catcherInnings',
    fallbackBasis: 'innings',
    callWord: 'Called balls received',
    callLabel: 'Balls',
  },
}

const sum = (list, f) => list.reduce((t, x) => t + (f(x) ?? 0), 0)

// One club's roster rows for one job, every man who had any exposure, with the
// figures the card prints. `basis` is 'calls' (the chances), or the older
// 'pitches' (hitters) / 'innings' (catchers) until the file carries them.
const shareBasis = (basis) => basis === 'calls' || basis === 'pitches'
const fieldOf = (job, basis) => (basis === 'calls' ? job.callsFieldOn : job.fallbackOn)

function rowsOf(rows, job, basis) {
  const exposureField = fieldOf(job, basis)
  return (rows ?? [])
    .filter((r) => (r[exposureField] ?? 0) > 0)
    .map((r) => {
      const calls = r[job.callsOn] ?? 0
      const exposure = r[exposureField]
      const won = typeof r[job.wonOn] === 'number' ? r[job.wonOn] : null
      return {
        playerId: r.playerId,
        name: r.name,
        calls,
        exposure,
        exposureText: num0(exposure),
        // The plotted share is calls over exposure on the card's basis; for a
        // catcher on innings, calls per innings (the same order as per nine).
        frac: calls / exposure,
        rateText: shareBasis(basis) ? cutPercent(calls, exposure, 1) : per9(calls, exposure),
        won,
        pct: won != null && calls > 0 ? won / calls : null,
        successText: won != null && calls > 0 ? cutPercent(won, calls, 1) : '—',
        results: typeof r[job.resultsOn] === 'string' ? r[job.resultsOn] : null,
        qualified: (r[job.floorOn] ?? 0) >= job.floor,
      }
    })
    .sort((a, b) => b.exposure - a.exposure)
}

// Which exposure a job runs on. A job runs on the calls it could challenge only
// when at least one man in the whole file has them: a half-filled file is the
// generator's backfill mid-run, and a mixed card would compare two bases.
function basisFor(job, clubs) {
  return clubs.some((rows) => rows.some((r) => (r[job.callsFieldOn] ?? 0) > 0)) ? 'calls' : job.fallbackBasis
}

function totals(rows, job, basis) {
  const list = rowsOf(rows, job, basis)
  const withWins = list.filter((r) => r.won != null)
  return {
    calls: sum(list, (r) => r.calls),
    exposure: sum(list, (r) => r.exposure),
    won: sum(withWins, (r) => r.won),
    called: sum(withWins, (r) => r.calls),
  }
}

// The model for one job at one club, or null when the club has no rows.
function jobModel(job, mine, clubs, teamId) {
  const basis = basisFor(job, clubs)
  const club = totals(mine, job, basis)
  const league = totals(clubs.flat(), job, basis)
  const leagueFrac = league.exposure > 0 ? league.calls / league.exposure : null
  const fracOf = (t) => (t.exposure > 0 ? t.calls / t.exposure : null)

  const fracs = clubs.map((rows) => fracOf(totals(rows, job, basis))).filter((f) => f != null)
  const clubFrac = fracOf(club)
  const rank = clubFrac == null ? null : { rank: fracs.filter((f) => f > clubFrac).length + 1, of: fracs.length }

  const rows = rowsOf(mine, job, basis).map((r) => ({ ...r, over: leagueFrac != null && r.frac > leagueFrac }))

  // THE AVERAGE QUALIFIED PLAYER, league-wide: where a man sits on the plot if
  // he sees the average workload of a regular and argues at the league's pace.
  const regulars = rowsOf(clubs.flat(), job, basis).filter((r) => r.qualified)
  const average =
    regulars.length > 0
      ? { exposure: sum(regulars, (r) => r.exposure) / regulars.length, calls: sum(regulars, (r) => r.calls) / regulars.length, of: regulars.length }
      : null

  // The club's overturn rate ranked against every club's, on the same job.
  const successFracs = clubs.map((c) => totals(c, job, basis)).filter((x) => x.called > 0).map((x) => x.won / x.called)
  const successRank = club.called > 0 ? { rank: successFracs.filter((f) => f > club.won / club.called).length + 1, of: successFracs.length } : null

  const hasSuccess = rows.some((r) => r.won != null)
  const leagueSuccess = league.called > 0 ? league.won / league.called : null
  return {
    key: job.key,
    tab: job.tab,
    where: job.where,
    plural: job.plural,
    floorText: job.floorText,
    basis,
    exposureLabel: basis === 'calls' ? job.callLabel : basis === 'pitches' ? 'Pitches' : 'Innings',
    exposureTitle: basis === 'calls' ? job.callWord : basis === 'pitches' ? 'Pitches seen' : 'Innings caught',
    teamId,
    rows,
    plotted: rows.filter((r) => r.qualified),
    club,
    league: { ...league, frac: leagueFrac, success: leagueSuccess },
    rank,
    average,
    hasSuccess,
    hasResults: rows.some((r) => r.results != null),
    // Strings the lead tile prints, per measure.
    lead: {
      called: {
        label: basis === 'calls' ? `${job.callWord}, challenged` : basis === 'pitches' ? 'Pitches seen, challenged' : 'Per 9 innings caught',
        value: shareBasis(basis) ? cutPercent(club.calls, club.exposure, 1) : per9(club.calls, club.exposure),
        rank,
        caption: `MLB average ${shareBasis(basis) ? cutPercent(league.calls, league.exposure, 1) : per9(league.calls, league.exposure)}`,
      },
      success: {
        label: `Overturned ${job.where}, ${num0(club.won)} of ${num0(club.called)}`,
        value: cutPercent(club.won, club.called, 1),
        rank: successRank,
        caption: `MLB average ${cutPercent(league.won, league.called, 1)}`,
      },
    },
    averageRate: shareBasis(basis) ? cutPercent(league.calls, league.exposure, 1) : per9(league.calls, league.exposure),
    averageSuccess: cutPercent(league.won, league.called, 1),
  }
}

// The review marks a hover card draws: one per challenge, oldest first, '1' for
// a call overturned (he was right) and '0' for one that stood. Only the latest
// `cap` are drawn, so a catcher with 185 reviews does not fill the card; the
// counts cover every one.
export function resultsStrip(results, cap = 40) {
  if (typeof results !== 'string' || results === '') return null
  const right = (results.match(/1/g) ?? []).length
  const marks = results.slice(-cap)
  return { marks, right, wrong: results.length - right, total: results.length, shown: marks.length }
}

// The card's whole model, or null for a club the file has nothing on (every
// affiliate below Triple-A, a club the sweep failed to read).
export function challengeCard(data, teamId, level = 'MLB') {
  const byTeam = data?.levels?.[level]?.byTeam
  const mine = byTeam?.[String(teamId)]
  if (!mine?.length) return null
  const clubs = Object.values(byTeam)
  const jobs = {}
  for (const job of Object.values(JOBS)) jobs[job.key] = jobModel(job, mine, clubs, teamId)
  if (!jobs.batter.rows.length && !jobs.catcher.rows.length) return null
  return jobs
}
