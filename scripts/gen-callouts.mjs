// Regenerates public/data/callouts/<MMDDYYYY>.json — the per-game "call-out"
// enrichment for ONE day's slate, MLB plus the four full-season MiLB levels
// (AAA/AA/A+/A): the season context that makes a live play notable. The
// families, all keyed so the app can look them up at render time with no live
// fetch of its own:
//
//   1. Leader call-outs — for each club playing, the season leader (rank 1) in a
//      handful of marquee categories (HR / triple / double / walk / SB / HBP for
//      hitters, strikeouts for pitchers), so the play card can note "going into
//      today, X leads the Brewers in walks" when that leader does the thing.
//   2. Player streaks — a hitter's current on-base streak (plus the date it
//      began, for the box score's "snapping a streak that began 6/25" prose)
//      and stolen-base run, from his game log.
//   3. Situational team records — extra-inning and one-run W-L (from standings
//      splitRecords); "record when scoring first" / "when the opponent scores
//      first" and record when leading after the 6th/7th/8th/9th (joined from
//      each club's game-by-game linescore); PLUS, from that same linescore walk,
//      record when scoring N+ runs, record when allowing 4+ runs by a given
//      inning, and record in games trailed by 3+ runs at some point (comeback
//      win%) — see scoringRecord's RUN_SCORED_BUCKETS / RUNS_ALLOWED_* /
//      COMEBACK_DEFICIT. The leading-after record is written TWICE: `leadAfter`
//      keeps only the lopsided checkpoints (the blown-lead reversal note's
//      floor, see LEAD_LOPSIDED) while `leadAfterFull` carries every
//      checkpoint's raw {w,l} tally past the sample floor — the live "leading
//      after the 8th" strip and the box score's "moved to 18-2" note need the
//      record however it reads, and need numbers (not a display string) to
//      fold tonight's result in client-side. That walk also tallies
//      `inningRuns` — season runs scored/allowed per inning 1–9 (plus how many
//      games sampled), the "run differential by inning" note's data
//      ("outscored opponents 38-14 in the 7th").
//   4. Player-homer records — a club's W-L in games the hitter homered, kept
//      only when the split is lopsided enough to be worth surfacing.
//   5. Starter records — for every ROSTERED pitcher on either club (not just
//      the day's probable starter — a bullpen call-up can start too), his
//      season home/away decision split, his club's record in his 6+ IP starts,
//      his club's record in ALL his starts (`teamStarts` — the team's result,
//      independent of his personal W-L, for the first-inning "the Brewers are
//      12-5 in his starts" strip note), his count of double-digit-strikeout
//      starts, his season CG/shutout total (straight off the roster's hydrated
//      season stats — no extra fetch), his current scoreless-outing streak,
//      and his appearance count AND pitch count in the last few days (the
//      bullpen-workload notes) — all from one per-pitcher game-log sweep (see
//      pitcherEnrich), same shape/cost as the hitter sweep below. Relievers
//      additionally get a back-to-back-days ERA split (relief outings the day
//      after another appearance vs the rest, derived from the same game log),
//      a pitched-yesterday flag (so tonight's outing is knowably his 2nd
//      straight day), and a leverage split — opponents' AVG/OPS with his club
//      ahead / behind / tied (the API's own sah/sbh/sti sitCodes; the closest
//      the public data gets to "entering with the lead") — one extra
//      statSplits fetch per RELIEVER only.
//   6. Hitter situational splits — season RISP and vs-L/vs-R rate lines, from
//      the API's own statSplits sitCodes (a second per-hitter fetch alongside
//      the game-log sweep — see hitterEnrich).
//   7. Birthday performance — for anyone whose birthday IS the slate date, his
//      career line (AVG / H / AB / HR) in games he's played on his birthday,
//      summed across seasons from his debut (see birthdayLine). Rides alongside
//      the existing "celebrating his birthday today" flag; a tiny fan-out since
//      only the day's birthday boys are swept.
//   8. Hitter season/career lines — AVG/PA/AB/H/HR/BB/XBH for the season
//      (summed from the same game-log rows as #2/#6) and for his whole career
//      (the API's own `career` stat type, folded into the same request — no
//      extra fetch). Not a note on its own; it's the baseline callout-notes.js's
//      vs-opponent note (from vs-team-splits) compares against — batting
//      average, HR share, extra-base share, walk rate — so that note only
//      fires when facing this opponent is actually unusual for him.
//   9. Milestone watch — for any rostered hitter or pitcher within a single
//      game's plausible reach of a round career-total milestone (hits, HR,
//      RBI, runs, SB, doubles for hitters; wins, strikeouts, saves for
//      pitchers), the nearest one ("4 hits shy of 2,000"). Shares its
//      threshold table + distance math (MILESTONE_DEFS/nearestMilestone) with
//      the player page's forward-looking MILESTONE WATCH line
//      (src/api/person.js), just gated to the tighter `gameGate` distance
//      instead of that page's wider `window` — see MILESTONE_DEFS's own
//      comment for why the two windows differ. Read off the same `career`
//      stat type already fetched for #8 (hitters) / a new career fetch added
//      to pitcherEnrich (pitchers) — no extra request for hitters, one more
//      field on the existing pitcher request.
//  10. Times-through-the-order splits — for each PROBABLE STARTER on the
//      slate, opponents' AVG/OPS the 1st / 2nd / 3rd+ time through the order
//      this season, derived from his playLog (one entry per plate appearance,
//      with batter + game attached — trips are counted per batter within each
//      game, the same walk timesFacingPitcher does live). Probables only:
//      playLog is the script's heaviest per-person response, and the pre-half
//      "order turns over a 3rd time" card only ever concerns the starter.
//
// MiLB (sportIds 11–14) gets a TRIMMED family set: leaders, streaks, homer
// records, situational splits, birthdays (flag only), starter/reliever
// records, TTO splits, and the full teamRecords sweep — but NOT career-based
// families (hitterLines/vs-team baselines, milestones, birthday career lines:
// the careers cross levels, the vs-team-splits file is MLB-only, and a MiLB
// "career milestone" isn't a story) and NOT the standings splitRecords
// (extra-inning / one-run records — MLB standings only). Every person-stats
// fetch for a MiLB player carries his level's sportId — without it the API
// silently returns his (usually empty) MLB line.
//
// WHY a nightly precompute (the war.js / minors-leaders.js build-time pattern,
// docs/data-enrichment.md §5) rather than live: scoped to the NEXT day's teams
// this is still ~hundreds of statsapi calls (a roster + a full-season linescore
// sweep per club, a game log + splits pull per player) — far too heavy for a
// phone page load. So .github/workflows/update-nightly-data.yml runs this on a
// nightly cron, commits the small shaped file, and the app (src/api/callouts.js)
// reads it same-origin and degrades to nothing when it's absent (MiLB games, an
// un-generated date, a failed run). Everything written here is a SEASON
// AGGREGATE — spoiler-free; the app's spoiler-safety comes entirely from WHERE
// each note renders (inside an already-revealed play card / on an extras page,
// or the always-open Pitchers table), not from this file.
//
// Like gen-minors-leaders.mjs it is NOT self-contained for RANKING: it imports
// the app's own computeLeaders + category descriptors + normalizeRosterToPool
// (src/api/teamLeaders.js) so a leader here can never drift from the team page.
// The raw fetches are done inline (self-contained, like the other gen-*.mjs) to
// avoid the app's browser-oriented fetch/cache layers.
//
// Runs for TOMORROW's slate by default (the games it precomputes); pass a
// YYYY-MM-DD as argv[2] to (re)generate a specific date by hand:
//   node scripts/gen-callouts.mjs 2026-07-10
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../src/api/statsapi.js'
import {
  computeLeaders,
  HITTING_CATEGORIES,
  PITCHING_CATEGORIES,
} from '../src/api/teamLeaders.js'
import { HIT_CATEGORY_KEYS } from '../src/api/callout-notes.js'
import { MILESTONE_DEFS, nearestMilestone } from '../src/api/person.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'callouts')

// The levels swept: MLB + the four full-season MiLB levels (mirrors
// src/lib/teams.js's SPORT_IDS, inlined like the rest of this script's
// self-contained fetches). Rookie/complex ball (16) is skipped, same call
// gen-former-teammates.mjs makes.
const MLB = 1
const SWEPT_SPORT_IDS = [1, 11, 12, 13, 14]
// Person-stats endpoints default to MLB; a MiLB player's rows only come back
// when his level's sportId is passed explicitly.
const sportParam = (sportId) => (sportId === MLB ? '' : `&sportId=${sportId}`)

// One team's roster → PoolPlayer[] (see teamLeaders.js's PoolPlayer shape),
// self-contained like the rest of this script's fetches — `normalizeRosterToPool`
// used to live in teamLeaders.js itself but was replaced there by the
// roster-INDEPENDENT `loadCombinedPoolForTeams` (see PR #25, "Include departed
// players in team/league leader boards"); this script still wants the CURRENT
// roster (a departed player has no bearing on tonight's game), so the
// normalizer is kept here instead of re-added to the app module.
function splitFor(person, group) {
  return (
    (person?.stats ?? []).find((s) => s.group?.displayName === group)?.splits?.[0]?.stat ?? null
  )
}
function normalizeRosterToPool(roster, team) {
  return (roster ?? [])
    .filter((r) => r.person?.id)
    .map((r) => ({
      id: r.person.id,
      name: r.person.fullName ?? '',
      teamId: team?.id ?? null,
      teamAbbr: team?.abbreviation ?? '',
      sportId: team?.sport?.id ?? null,
      position: r.position?.abbreviation ?? '',
      hitting: splitFor(r.person, 'hitting'),
      pitching: splitFor(r.person, 'pitching'),
    }))
}

const DAY_MS = 24 * 60 * 60 * 1000
const iso = (d) => d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

// The slate to precompute: tomorrow by default, or an explicit YYYY-MM-DD.
const arg = process.argv[2]
const target = arg ? new Date(`${arg}T12:00:00Z`) : new Date(Date.now() + DAY_MS)
const targetApi = iso(target)
// "Entering the game day" cutoff for streaks/records — the day before the slate.
const asOf = iso(new Date(target.getTime() - DAY_MS))
const season = target.getUTCFullYear()
const [ty, tm, td] = targetApi.split('-')
const outFile = join(outDir, `${tm}${td}${ty}.json`)

// Pitcher strikeouts (not a hit category, so separate from HIT_CATEGORY_KEYS).
const PIT_KEYS = ['so_p']

// Show floors — a streak/split only surfaces once it's genuinely notable, so the
// feed isn't peppered with "2-game on-base streak" noise.
const ONBASE_FLOOR = 8
const SB_FLOOR = 4
const HOMER_MIN_GAMES = 5
const HOMER_LOPSIDED = 0.7 // win% ≥ .700 or ≤ .300

// Innings checked for the "leading after N" record (see leadAfterRecord),
// and the same show floors as HOMER_MIN_GAMES/HOMER_LOPSIDED — a club needs a
// real sample AND a genuinely lopsided record for it to be worth flagging
// tonight's game as a reversal of it (see buildLeadReversalNote in
// src/api/callout-notes.js, the only place this ever gets read).
const LEAD_CHECKPOINTS = [6, 7, 8, 9]
const LEAD_MIN_GAMES = 5
const LEAD_LOPSIDED = 0.85 // win% ≥ .85 or ≤ .15

// Run-total buckets for "win% when scoring N+ runs" — unlike LEAD_LOPSIDED
// above, this isn't hunting for a reversal, so no lopsidedness floor: the
// record itself ("38-3 when scoring 6+") is the whole point, win-heavy or not.
// Only a sample-size floor applies. buildRunsScoredNote (callout-notes.js)
// picks the highest bucket tonight's own final score actually clears.
const RUN_SCORED_BUCKETS = [4, 6, 8]
const RUN_SCORED_MIN_GAMES = 5

// "Record when allowing N+ runs by inning M" — symmetric to LEAD_CHECKPOINTS/
// LEAD_LOPSIDED but for runs ALLOWED rather than a lead, and a single run
// threshold across every checkpoint inning (an early-game blowup and a late
// one are both "4+ allowed", just at a different point in the game).
const RUNS_ALLOWED_THRESHOLD = 4
const RUNS_ALLOWED_CHECKPOINTS = [5, 6, 7, 8]
const RUNS_ALLOWED_MIN_GAMES = 5
const RUNS_ALLOWED_LOPSIDED = 0.85 // win% ≤ .15 — allowing that many that early is normally a loss

// "Comeback win%" — record in games the club trailed by DEFICIT+ runs at some
// point (checked against the same cumulative-score walk as everything above),
// regardless of who was leading when. No lopsidedness floor (a genuine ~50/50
// comeback record is itself the interesting fact); just a sample floor.
const COMEBACK_DEFICIT = 3
const COMEBACK_MIN_GAMES = 5

// Per-inning run tallies ("outscored opponents 38-14 in the 7th") cover the
// regulation innings only — extras are a different animal (ghost runners) and
// already have their own extra-inning record note. No noteworthiness gate at
// the data layer: the note layer (callout-notes.js / prehalf-callouts.js)
// judges the differential against the games sampled, so it needs the raw
// numbers either way.
const INNING_RUNS_MAX = 9

// Starter-record thresholds (see pitcherEnrich) — a 6+ IP start, a double-
// digit-strikeout start, and the trailing window for a "Nth appearance in the
// last N days" bullpen-rest note. Mirrors HOMER_MIN_GAMES's role: a floor
// before a split is worth surfacing at all.
const SIX_IP_OUTS = 18 // 6.0 innings, in outs
const TEN_K_THRESHOLD = 10
const STARTER_MIN_GAMES = 3
const RECENT_APPEARANCE_WINDOW_DAYS = 4

// Reliever-only enrichments (see pitcherEnrich). "Reliever" is inferred from
// the game log itself — a real relief workload, not a starter with one bulk
// outing. The back-to-back split needs a few games on BOTH sides before an
// ERA contrast means anything; the leverage split needs real innings in a
// bucket before its opponents' line does.
const RELIEVER_MIN_G = 8 // relief outings before he's treated as a reliever
const RELIEVER_START_RATIO = 3 // relief outings ≥ 3× starts
const B2B_MIN_G = 4 // back-to-back outings (and non-b2b outings) sampled
const LEVERAGE_MIN_OUTS = 24 // 8 IP in a bucket before it's kept

// Situational hitting splits (see hitterSituational) — a rate stat needs real
// plate appearances behind it or a small sample reads as a false certainty.
const SPLIT_MIN_PA = 15

// Birthday performance history (see birthdayLine) — the fun "career .350 on his
// birthday" note that rides alongside the existing "celebrating his birthday
// today" one. Only players whose birthday IS the slate date are swept, so this
// is a tiny fan-out; the floors just keep a one-game coincidence from reading as
// a career trend.
const BIRTHDAY_MIN_GAMES = 2
const BIRTHDAY_MIN_AB = 5

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// Whether a 'YYYY-MM-DD' birth date falls on the slate's own date — compared
// by MM-DD only (a leap-year Feb 29 birthday just never matches in a non-leap
// year, same as how anyone actually celebrates it). Precomputed here rather
// than shipping raw birth dates, so the app never has to do date math itself.
function isBirthdayOn(birthDate, dateApi) {
  if (!birthDate) return false
  return birthDate.slice(5) === dateApi.slice(5)
}

// Innings pitched ("104.1" = 104 ⅓) -> outs, so a 6.0-IP-or-better check
// compares linearly (raw "104.1" < "104.2" happens to work, but "104.2" plus
// one more out is "105.0", not "104.3"). Self-contained copy of the same helper
// in teamLeaders.js/statsLevels.js (not exported there).
const ipToOuts = (ip) => {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}

// A tiny bounded-concurrency map so the per-hitter game-log sweep doesn't open
// hundreds of sockets at once. Failures degrade to null for that item.
async function mapPool(items, size, fn) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        out[i] = await fn(items[i], i)
      } catch {
        out[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, worker))
  return out
}

// One club's 40-man roster with season hitting+pitching hydrated — the exact
// request fetchTeamRoster builds, inlined so this script needn't import the
// app's browser-oriented team.js. rosterType=40Man so an injured leader (e.g. a
// club's HR leader on the IL) still counts; for a MiLB affiliate it resolves to
// the affiliate's own roster (same as team.js's fetchTeamIl notes). The season
// stats hydrate is scoped to the club's own level so minor leaguers rank on
// their level's line, not an empty MLB one.
async function fetchRoster(teamId, sportId) {
  const data = await getJson(
    `/api/v1/teams/${teamId}/roster?rosterType=40Man&hydrate=person(stats(type=season,group=[hitting,pitching],sportId=${sportId},season=${season}))`,
  )
  return data.roster ?? []
}

// The rank-1 leader (id + formatted value) per marquee category for one club,
// ranked by the app's own computeLeaders so it can't drift from the team page.
// A category with no qualifying leader (nobody's done it — computeLeaders drops
// zeroes for "most" stats) simply doesn't appear.
function clubLeaders(pool) {
  const hitting = {}
  for (const key of HIT_CATEGORY_KEYS) {
    const cat = HITTING_CATEGORIES.find((c) => c.key === key)
    const top = computeLeaders(pool, cat, { limit: 1 })[0]
    if (top) hitting[key] = { id: top.id, display: top.display }
  }
  const pitching = {}
  for (const key of PIT_KEYS) {
    const cat = PITCHING_CATEGORIES.find((c) => c.key === key)
    const top = computeLeaders(pool, cat, { limit: 1 })[0]
    if (top) pitching[key] = { id: top.id, display: top.display }
  }
  return { hitting, pitching }
}

// Extra-inning + one-run W-L for every club, from the standings splitRecords as
// of the slate's eve (the endpoint honors `date`, so tonight's-in-progress games
// never fold in). Keyed by teamId; degrades to an empty map on failure.
async function fetchSplitRecords() {
  const map = {}
  const leagues = await Promise.allSettled(
    [103, 104].map((leagueId) =>
      getJson(
        `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason&date=${asOf}`,
      ),
    ),
  )
  for (const res of leagues) {
    if (res.status !== 'fulfilled') continue
    for (const rec of res.value.records ?? []) {
      for (const t of rec.teamRecords ?? []) {
        const id = t.team?.id
        if (id == null) continue
        const splits = t.records?.splitRecords ?? []
        const wl = (type) => {
          const s = splits.find((x) => x.type === type)
          return s ? `${s.wins}-${s.losses}` : null
        }
        map[id] = { extraInning: wl('extraInning'), oneRun: wl('oneRun') }
      }
    }
  }
  return map
}

// "Record when scoring first" / "when the opponent scores first", AND record
// when leading after the 6th/7th/8th/9th, for one club — both joined from the
// SAME full-season schedule + per-inning linescore sweep (one fetch covers
// both families). Who scored first = the first inning (top before bottom) in
// which either side put up a run; leading-after-N walks the innings in order,
// stopping at the first one whose bottom half never happened (a walk-off, or
// a suspended/truncated game) since "leading after N" isn't well-defined past
// that point. W/L from the club's own isWinner. Cut off at `asOf` so a slate
// scored later never folds tonight's result into either record.
async function scoringRecord(teamId, sportId) {
  const data = await getJson(
    `/api/v1/schedule?sportId=${sportId}&teamId=${teamId}&season=${season}&gameType=R&hydrate=team,linescore`,
  )
  const games = (data.dates ?? []).flatMap((d) => d.games ?? [])
  let sfW = 0, sfL = 0, osW = 0, osL = 0
  let cbW = 0, cbL = 0 // comeback: trailed by COMEBACK_DEFICIT+ at some point
  const leadTally = {} // inning num -> { w, l }
  for (const n of LEAD_CHECKPOINTS) leadTally[n] = { w: 0, l: 0 }
  const raTally = {} // inning num -> { w, l } (allowed RUNS_ALLOWED_THRESHOLD+ by that inning)
  for (const n of RUNS_ALLOWED_CHECKPOINTS) raTally[n] = { w: 0, l: 0 }
  const rsTally = {} // run bucket -> { w, l } (scored bucket+ runs, final)
  for (const n of RUN_SCORED_BUCKETS) rsTally[n] = { w: 0, l: 0 }
  const runsTally = {} // inning num (1..INNING_RUNS_MAX) -> { f, a, g }
  for (let n = 1; n <= INNING_RUNS_MAX; n++) runsTally[n] = { f: 0, a: 0, g: 0 }
  const seen = new Set()
  for (const g of games) {
    if (g.status?.abstractGameState !== 'Final') continue
    const date = g.officialDate ?? (g.gameDate ?? '').slice(0, 10)
    if (date && date > asOf) continue
    if (seen.has(g.gamePk)) continue
    seen.add(g.gamePk)
    const away = g.teams?.away
    const home = g.teams?.home
    const isHome = home?.team?.id === teamId
    const me = isHome ? home : away
    if (me?.isWinner == null) continue
    const won = me.isWinner === true

    let firstScorer = null // 'away' | 'home'
    let cumAway = 0, cumHome = 0
    let minDeficit = 0 // most negative (meRuns - oppRuns) reached, 0 if never trailed
    for (const inn of g.linescore?.innings ?? []) {
      const aR = inn.away?.runs, hR = inn.home?.runs
      if (!firstScorer) {
        if (num(aR) > 0) firstScorer = 'away'
        else if (num(hR) > 0) firstScorer = 'home'
      }
      // Per-inning run tallies, counted half by half BEFORE the break below —
      // a home win's skipped bottom 9th still has the top half's runs on the
      // books (aR is a number, hR is not), and those belong in the 9th's
      // scored/allowed totals even though "through inning 9" cumulative
      // checkpoints aren't well-defined for that game.
      const t = runsTally[inn.num]
      if (t) {
        const meR = isHome ? hR : aR
        const opR = isHome ? aR : hR
        if (typeof meR === 'number') t.f += meR
        if (typeof opR === 'number') t.a += opR
        if (typeof meR === 'number' || typeof opR === 'number') t.g++
      }
      if (typeof aR !== 'number' || typeof hR !== 'number') break
      cumAway += aR
      cumHome += hR
      const meRuns = isHome ? cumHome : cumAway
      const oppRuns = isHome ? cumAway : cumHome
      minDeficit = Math.min(minDeficit, meRuns - oppRuns)
      const bucket = leadTally[inn.num]
      if (bucket && meRuns > oppRuns) won ? bucket.w++ : bucket.l++
      const raBucket = raTally[inn.num]
      if (raBucket && oppRuns >= RUNS_ALLOWED_THRESHOLD) won ? raBucket.w++ : raBucket.l++
    }

    if (minDeficit <= -COMEBACK_DEFICIT) won ? cbW++ : cbL++

    const meFinal = num(me?.score)
    for (const n of RUN_SCORED_BUCKETS) {
      if (meFinal >= n) won ? rsTally[n].w++ : rsTally[n].l++
    }

    if (!firstScorer) continue
    const meScoredFirst = (firstScorer === 'home') === isHome
    if (meScoredFirst) won ? sfW++ : sfL++
    else won ? osW++ : osL++
  }

  const leadAfter = {}
  const leadAfterFull = {}
  for (const n of LEAD_CHECKPOINTS) {
    const { w, l } = leadTally[n]
    const total = w + l
    if (total < LEAD_MIN_GAMES) continue
    // The full tally (numbers, not a display string) for the live strip and
    // the box score's fold-tonight's-result-in note, however the record reads…
    leadAfterFull[n] = { w, l }
    // …and the lopsided-only string the blown-lead reversal note keys on.
    const pct = w / total
    if (pct >= LEAD_LOPSIDED || pct <= 1 - LEAD_LOPSIDED) leadAfter[n] = `${w}-${l}`
  }

  const inningRuns = {}
  for (let n = 1; n <= INNING_RUNS_MAX; n++) {
    const { f, a, g: played } = runsTally[n]
    if (played > 0) inningRuns[n] = { f, a, g: played }
  }

  const runsAllowedByInning = {}
  for (const n of RUNS_ALLOWED_CHECKPOINTS) {
    const { w, l } = raTally[n]
    const total = w + l
    if (total < RUNS_ALLOWED_MIN_GAMES) continue
    const pct = w / total
    if (pct <= 1 - RUNS_ALLOWED_LOPSIDED) runsAllowedByInning[n] = `${w}-${l}`
  }

  const runsScored = {}
  for (const n of RUN_SCORED_BUCKETS) {
    const { w, l } = rsTally[n]
    if (w + l < RUN_SCORED_MIN_GAMES) continue
    runsScored[n] = `${w}-${l}`
  }

  const comebackTotal = cbW + cbL
  const comeback = comebackTotal >= COMEBACK_MIN_GAMES ? `${cbW}-${cbL}` : null

  return {
    scoringFirst: `${sfW}-${sfL}`,
    opponentScoringFirst: `${osW}-${osL}`,
    leadAfter,
    leadAfterFull,
    inningRuns,
    runsScored,
    runsAllowedByInning,
    comeback,
  }
}

// A hitter's game-log-derived enrichment: current on-base streak (consecutive
// games PLAYED reaching base, plus the date of the game it began — the box
// score's "snapping a streak that began 6/25" prose), a conservative
// stolen-base run (SB accumulated back to his last caught stealing — a
// game-level view can't see intra-game order, so it stops at any CS rather
// than over-claiming), his club's W-L in games he homered, and his
// season/career AVG+HR lines (see `seasonLine` below).
// Cut off at `asOf`. For an MLB hitter, fetches `gameLog,career` together —
// one request, no extra fetch — so the "career X against the Y" note
// (callout-notes.js) has a same-player baseline to check for a significant
// deviation against, rather than firing on a bare vs-team-splits line. A MiLB
// hitter gets the gameLog only, scoped to his level's sportId: his "career"
// crosses levels and the career-based families are MLB-only anyway.
async function hitterEnrich(personId, sportId) {
  const mlb = sportId === MLB
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=${mlb ? 'gameLog,career' : 'gameLog'}&group=hitting&season=${season}${sportParam(sportId)}`,
  )
  const rows = (data.stats ?? [])
    .find((b) => b.type?.displayName === 'gameLog')
    ?.splits?.filter((s) => s.date && s.date <= asOf)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) ?? [] // newest first

  let onBase = 0
  let onBaseStart = null // date of the streak's first game
  for (const s of rows) {
    const st = s.stat ?? {}
    if (num(st.plateAppearances) === 0) continue // didn't bat — neither breaks nor counts
    if (num(st.hits) + num(st.baseOnBalls) + num(st.hitByPitch) > 0) {
      onBase++
      onBaseStart = s.date
    } else break
  }

  let stolenBase = 0
  for (const s of rows) {
    const st = s.stat ?? {}
    if (num(st.caughtStealing) > 0) break
    stolenBase += num(st.stolenBases)
  }

  let hw = 0, hl = 0
  for (const s of rows) {
    if (num(s.stat?.homeRuns) > 0) s.isWin ? hw++ : hl++
  }

  // Season totals, summed from the same asOf-cut rows rather than the API's
  // own running `avg` (which — like formatAvg's birthday line — would include
  // tonight's not-yet-played game if read off the last row instead). PA/BB/XBH
  // ride along as the baselines the vs-opponent callout's rate comparisons
  // (walk rate, extra-base share — see callout-notes.js) are judged against.
  let sPa = 0, sAb = 0, sH = 0, sHr = 0, sBb = 0, sXbh = 0
  for (const s of rows) {
    const st = s.stat ?? {}
    sPa += num(st.plateAppearances)
    sAb += num(st.atBats)
    sH += num(st.hits)
    sHr += num(st.homeRuns)
    sBb += num(st.baseOnBalls)
    sXbh += num(st.doubles) + num(st.triples) + num(st.homeRuns)
  }
  const seasonLine = { pa: sPa, ab: sAb, h: sH, hr: sHr, bb: sBb, xbh: sXbh, avg: formatAvg(sH, sAb) }

  // Career totals straight off the API's own `career` stat type — a season-
  // level aggregate through his most recently completed game, same spoiler
  // profile as the rest of this file's season aggregates. MLB only (the
  // request above simply didn't ask for it otherwise).
  const cSt = (data.stats ?? []).find((b) => b.type?.displayName === 'career')?.splits?.[0]?.stat
  const careerLine = cSt
    ? {
        pa: num(cSt.plateAppearances),
        ab: num(cSt.atBats),
        h: num(cSt.hits),
        hr: num(cSt.homeRuns),
        bb: num(cSt.baseOnBalls),
        xbh: num(cSt.doubles) + num(cSt.triples) + num(cSt.homeRuns),
        avg: cSt.avg ?? formatAvg(num(cSt.hits), num(cSt.atBats)),
      }
    : null

  // Milestone watch (family #9) — the same `cSt` career stat object already
  // fetched above, checked against the hitting half of MILESTONE_DEFS at the
  // tight single-game-plausible `gameGate` (not the player page's wider
  // `window`). Nearest one only, or null.
  const milestone = cSt ? nearestHitterMilestone(cSt) : null

  return { onBase, onBaseStart, stolenBase, homerW: hw, homerL: hl, seasonLine, careerLine, milestone }
}

// The nearest milestone (any hitting stat family) a raw career stat object
// (`cSt`, the API's own field names) is within single-game-plausible reach
// of, or null. Shared field-name mapping between MILESTONE_DEFS's
// aggregateSplits()-shaped keys (hits/homeRuns/rbi/runs/stolenBases/doubles —
// the same names the raw API stat object already uses for these fields) and
// `cSt` — no translation needed, they line up.
function nearestHitterMilestone(cSt) {
  return MILESTONE_DEFS.filter((d) => d.group === 'hitting')
    .map((d) => {
      const m = nearestMilestone(cSt[d.stat], d.thresholds, d.gameGate)
      return m && { ...m, stat: d.stat, label: d.label }
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining)[0] ?? null
}

// Pitching counterpart to nearestHitterMilestone — same shared table, the
// pitching field names (wins/strikeOuts/saves) also line up 1:1 with the raw
// API stat object's own names.
function nearestPitcherMilestone(cSt) {
  return MILESTONE_DEFS.filter((d) => d.group === 'pitching')
    .map((d) => {
      const m = nearestMilestone(cSt[d.stat], d.thresholds, d.gameGate)
      return m && { ...m, stat: d.stat, label: d.label }
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining)[0] ?? null
}

// A hitter's season situational splits (RISP, vs-L, vs-R), straight from the
// API's own statSplits sitCodes — one fetch, all three at once. Each split is
// kept only once it clears SPLIT_MIN_PA (a 20-PA RISP average reads as
// certainty it isn't). Returns `{ risp, vl, vr }`, each `{ avg, ops } | null`.
async function hitterSituational(personId, sportId) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=statSplits&sitCodes=risp,vl,vr&group=hitting&season=${season}${sportParam(sportId)}`,
  )
  const splits = data.stats?.[0]?.splits ?? []
  const byCode = {}
  for (const s of splits) {
    const code = s.split?.code
    const st = s.stat ?? {}
    if (!code || num(st.plateAppearances) < SPLIT_MIN_PA) continue
    byCode[code] = { avg: st.avg ?? null, ops: st.ops ?? null }
  }
  return { risp: byCode.risp ?? null, vl: byCode.vl ?? null, vr: byCode.vr ?? null }
}

// Batting average as the API formats it (".350", "1.000") from summed hits/AB —
// the birthday line is aggregated across seasons here, so its average has to be
// recomputed rather than read from any one game log's own `avg`.
function formatAvg(h, ab) {
  if (ab <= 0) return '.000'
  return (h / ab).toFixed(3).replace(/^0/, '')
}

// A hitter's CAREER line in games played on his own birthday, summed across
// every season from his debut through the slate's eve — the "career .350 on his
// birthday" note. Unlike every other sweep here this walks MULTIPLE seasons
// (debut year → this season), but only players whose birthday is actually the
// slate date are ever passed in, so the extra per-season game-log fetches are a
// handful of players' worth. `asOf`-cut like the rest, so this year's birthday
// game (tonight's, on the slate date itself) never folds in — it hasn't
// happened yet and would be a spoiler if it had. Returns null below the floors.
async function birthdayLine(personId, birthDate, debutDate) {
  if (!birthDate || !debutDate) return null
  const mmdd = birthDate.slice(5)
  const startYear = num(debutDate.slice(0, 4))
  if (!startYear) return null
  let g = 0, ab = 0, h = 0, hr = 0
  for (let y = startYear; y <= season; y++) {
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=gameLog&group=hitting&season=${y}`,
    )
    for (const s of data.stats?.[0]?.splits ?? []) {
      if (!s.date || s.date.slice(5) !== mmdd || s.date > asOf) continue
      const st = s.stat ?? {}
      g += 1
      ab += num(st.atBats)
      h += num(st.hits)
      hr += num(st.homeRuns)
    }
  }
  if (g < BIRTHDAY_MIN_GAMES || ab < BIRTHDAY_MIN_AB) return null
  return { g, ab, h, hr, avg: formatAvg(h, ab) }
}

// A pitcher's game-log-derived enrichment: home/away decision split, the 6+ IP
// start record, a count of double-digit-strikeout starts, a current scoreless-
// outing streak (consecutive most-recent APPEARANCES — not innings — with zero
// earned runs; stops at the first one that allowed an earned run), and how many
// times he's pitched — and how many PITCHES he's thrown — in the last
// RECENT_APPEARANCE_WINDOW_DAYS days (the bullpen-workload notes). Cut off at
// `asOf`, same as hitterEnrich. Season CG/shutout TOTALS aren't derived here —
// those come straight off the roster's hydrated season pitching stats (see
// clubLeaders's pool), no need to re-sum a game log for a number the API
// already aggregates.
//
// A RELIEVER (inferred from the log itself — see RELIEVER_MIN_G) additionally
// gets: `pitchedYesterday` (an appearance dated the slate's eve, so tonight's
// outing is knowably his 2nd straight day), `backToBack` (his ERA in relief
// outings the day after another appearance vs the rest of his relief work),
// and `leverage` (opponents' AVG/OPS with his club ahead / behind / tied —
// the API's sah/sbh/sti sitCodes, one extra statSplits fetch, relievers only
// so the fan-out stays bounded).
async function pitcherEnrich(personId, sportId) {
  const mlb = sportId === MLB
  const data = await getJson(
    // `career` rides along for the milestone-watch check (family #9) — one
    // request, no extra fetch, same pattern as hitterEnrich's gameLog,career.
    // MLB only, like the hitter side.
    `/api/v1/people/${personId}/stats?stats=${mlb ? 'gameLog,career' : 'gameLog'}&group=pitching&season=${season}${sportParam(sportId)}`,
  )
  const rows = (data.stats ?? [])
    .find((b) => b.type?.displayName === 'gameLog')
    ?.splits?.filter((s) => s.date && s.date <= asOf)
    .sort((a, b) => (a.date < b.date ? 1 : -1)) ?? [] // newest first

  let homeW = 0, homeL = 0, awayW = 0, awayL = 0
  let sixIpW = 0, sixIpL = 0
  let tenK = 0
  for (const s of rows) {
    const st = s.stat ?? {}
    if (num(st.gamesStarted) === 0) continue // relief outing — not a "start" for any of these
    const won = s.isWin === true
    if (s.isHome) won ? homeW++ : homeL++
    else won ? awayW++ : awayL++
    if (ipToOuts(st.inningsPitched) >= SIX_IP_OUTS) won ? sixIpW++ : sixIpL++
    if (num(st.strikeOuts) >= TEN_K_THRESHOLD) tenK++
  }
  // The club's record across ALL his starts (`isWin` is the team's result, not
  // his decision — same field homerRecords reads on the hitter side), which is
  // exactly the home + away tallies above summed. Written as numbers so the
  // box score can fold tonight's result in ("moved to 13-5 in his starts").
  const teamStartsW = homeW + awayW
  const teamStartsL = homeL + awayL

  let scorelessStreak = 0
  for (const s of rows) {
    if (num(s.stat?.earnedRuns) > 0) break
    scorelessStreak++
  }

  const asOfMs = Date.parse(`${asOf}T12:00:00Z`)
  let recentAppearances = 0
  let recentPitches = 0
  for (const s of rows) {
    const days = (asOfMs - Date.parse(`${s.date}T12:00:00Z`)) / DAY_MS
    if (days >= 0 && days < RECENT_APPEARANCE_WINDOW_DAYS) {
      recentAppearances++
      recentPitches += num(s.stat?.numberOfPitches)
    }
  }

  const homeAwayGames = homeW + homeL + awayW + awayL

  // --- reliever-only enrichments -------------------------------------------
  // Relief workload shape, from the same rows: starts vs relief outings, an
  // appearance on the slate's eve, and the back-to-back ERA split (relief
  // outings dated the day after ANY other appearance vs his remaining relief
  // work — ERA recomputed from summed ER/outs on each side).
  const starts = rows.filter((s) => num(s.stat?.gamesStarted) > 0).length
  const reliefRows = rows.filter((s) => num(s.stat?.gamesStarted) === 0)
  const isReliever = reliefRows.length >= RELIEVER_MIN_G && reliefRows.length >= RELIEVER_START_RATIO * starts
  const pitchedYesterday = rows.some((s) => s.date === asOf)

  const eraOf = (er, outs) => (outs > 0 ? Math.round(((er * 27) / outs) * 100) / 100 : null)
  let backToBack = null
  if (isReliever) {
    const appearanceDates = new Set(rows.map((s) => s.date))
    let bEr = 0, bOuts = 0, bG = 0, rEr = 0, rOuts = 0, rG = 0
    for (const s of reliefRows) {
      const dayBefore = iso(new Date(Date.parse(`${s.date}T12:00:00Z`) - DAY_MS))
      const st = s.stat ?? {}
      if (appearanceDates.has(dayBefore)) {
        bG += 1
        bEr += num(st.earnedRuns)
        bOuts += num(st.outs)
      } else {
        rG += 1
        rEr += num(st.earnedRuns)
        rOuts += num(st.outs)
      }
    }
    if (bG >= B2B_MIN_G && rG >= B2B_MIN_G && bOuts > 0 && rOuts > 0) {
      backToBack = { g: bG, era: eraOf(bEr, bOuts), restEra: eraOf(rEr, rOuts) }
    }
  }

  // Leverage split — opponents' line with his club ahead / behind / tied. Its
  // own fetch, relievers only; a failure just drops the field, never the
  // pitcher's whole enrichment.
  let leverage = null
  if (isReliever) {
    try {
      const lev = await getJson(
        `/api/v1/people/${personId}/stats?stats=statSplits&sitCodes=sah,sbh,sti&group=pitching&season=${season}${sportParam(sportId)}`,
      )
      const byCode = {}
      for (const s of lev.stats?.[0]?.splits ?? []) {
        const code = s.split?.code
        const st = s.stat ?? {}
        if (!code || num(st.outsPitched ?? st.outs) < LEVERAGE_MIN_OUTS) continue
        byCode[code] = { avg: st.avg ?? null, ops: st.ops ?? null, ip: st.inningsPitched ?? null }
      }
      // Ahead plus at least one contrast bucket, or there's nothing to compare.
      if (byCode.sah && (byCode.sbh || byCode.sti)) {
        leverage = { ahead: byCode.sah, behind: byCode.sbh ?? null, tied: byCode.sti ?? null }
      }
    } catch {
      /* leverage is optional enrichment */
    }
  }

  // Milestone watch (family #9) — same shared table as the hitter side, the
  // pitching career stat carried alongside the gameLog fetch above (MLB only).
  const cSt = (data.stats ?? []).find((b) => b.type?.displayName === 'career')?.splits?.[0]?.stat
  const milestone = cSt ? nearestPitcherMilestone(cSt) : null

  return {
    homeAway:
      homeAwayGames >= STARTER_MIN_GAMES ? { home: `${homeW}-${homeL}`, away: `${awayW}-${awayL}` } : null,
    teamStarts:
      teamStartsW + teamStartsL >= STARTER_MIN_GAMES ? { w: teamStartsW, l: teamStartsL } : null,
    sixIp: sixIpW + sixIpL >= STARTER_MIN_GAMES ? `${sixIpW}-${sixIpL}` : null,
    tenK,
    scorelessStreak,
    recentAppearances,
    recentPitches,
    isReliever,
    pitchedYesterday,
    backToBack,
    leverage,
    milestone,
  }
}

// --- times-through-the-order splits (family #10) -----------------------------
// Opponents' AVG/OPS against one pitcher the 1st / 2nd / 3rd+ time batters see
// him in a game, from his playLog (one entry per plate appearance, batter and
// game attached). Trips are counted per batter within each game — the same
// definition the app's live timesFacingPitcher walk uses — so bucket 3 is
// "batters facing him a 3rd-or-later time". Rate lines are recomputed from
// summed components; a bucket with no PAs simply isn't written.
const TTO_TOTAL_BASES = { single: 1, double: 2, triple: 3, home_run: 4 }
async function ttoSplits(personId, sportId) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=playLog&group=pitching&season=${season}${sportParam(sportId)}`,
  )
  const splits = ((data.stats ?? []).find((b) => b.type?.displayName === 'playLog')?.splits ?? [])
    .filter((s) => s.stat?.play?.details?.isPlateAppearance && s.date && s.date <= asOf)

  const byGame = new Map() // gamePk -> PA rows
  for (const s of splits) {
    const pk = s.game?.gamePk ?? s.date
    if (!byGame.has(pk)) byGame.set(pk, [])
    byGame.get(pk).push(s)
  }

  const mk = () => ({ pa: 0, ab: 0, h: 0, bb: 0, hbp: 0, sf: 0, tb: 0 })
  const tally = { 1: mk(), 2: mk(), 3: mk() }
  for (const plays of byGame.values()) {
    plays.sort((a, b) => num(a.stat?.play?.atBatNumber) - num(b.stat?.play?.atBatNumber))
    const seen = new Map() // batterId -> times faced in this game
    for (const s of plays) {
      const bid = s.batter?.id
      if (bid == null) continue
      const trips = (seen.get(bid) ?? 0) + 1
      seen.set(bid, trips)
      const d = s.stat.play.details
      const t = tally[Math.min(trips, 3)]
      t.pa++
      if (d.isAtBat) t.ab++
      if (d.isBaseHit) t.h++
      const et = d.eventType
      if (et === 'walk' || et === 'intent_walk') t.bb++
      else if (et === 'hit_by_pitch') t.hbp++
      else if (et === 'sac_fly') t.sf++
      if (d.isBaseHit) t.tb += TTO_TOTAL_BASES[et] ?? 1
    }
  }

  const out = {}
  for (const trip of [1, 2, 3]) {
    const t = tally[trip]
    if (t.pa === 0) continue
    const obpDen = t.ab + t.bb + t.hbp + t.sf
    const ops =
      t.ab > 0 && obpDen > 0
        ? ((t.h + t.bb + t.hbp) / obpDen + t.tb / t.ab).toFixed(3).replace(/^0/, '')
        : null
    out[trip] = { pa: t.pa, ab: t.ab, h: t.h, avg: formatAvg(t.h, t.ab), ops }
  }
  return Object.keys(out).length > 0 ? out : null
}

// ---------------------------------------------------------------------------

const slate = await getJson(
  `/api/v1/schedule?sportId=${SWEPT_SPORT_IDS.join(',')}&date=${targetApi}&hydrate=team,probablePitcher`,
)
const games = (slate.dates ?? []).flatMap((d) => d.games ?? [])
if (games.length === 0) {
  console.log(`no games on ${targetApi} — nothing to generate`)
  process.exit(0)
}

// Every club on the slate, and the metadata each game needs. A club's own
// sportId (its level) rides along — it scopes every stats fetch below and
// names the peer group for the bullpen-workload baseline.
const teamMeta = new Map() // teamId -> { name, sportId }
// Probable starters, for the times-through-the-order sweep (family #10):
// playLog is heavy, so ONLY the slate's announced probables are swept.
const probableSport = new Map() // personId -> sportId
for (const g of games) {
  const sportId = g.teams?.home?.team?.sport?.id ?? MLB
  for (const side of ['away', 'home']) {
    const t = g.teams?.[side]?.team
    if (t?.id != null && !teamMeta.has(t.id)) {
      teamMeta.set(t.id, { name: t.teamName ?? t.name ?? '', sportId })
    }
    const pid = g.teams?.[side]?.probablePitcher?.id
    if (pid != null) probableSport.set(pid, sportId)
  }
}
const teamIds = [...teamMeta.keys()]

// Per-club: roster pool → leaders, and the sets of hitter/pitcher ids to sweep.
const splitRecords = await fetchSplitRecords() // MLB standings only — MiLB clubs just aren't in it
const leadersByTeam = new Map()
const scoringByTeam = new Map()
const poolById = new Map() // personId -> his own PoolPlayer (for season CG/shutout lookup)
const birthDateById = new Map() // personId -> 'YYYY-MM-DD', free off the same roster fetch
const debutById = new Map() // personId -> mlbDebutDate 'YYYY-MM-DD', also free off the roster hydrate
const sportIdByPerson = new Map() // personId -> his club's level, scoping every stats fetch
const hitterIdsByTeam = new Map() // teamId -> [personId] (position players)
const pitcherIdsByTeam = new Map() // teamId -> [personId]
const allHitterIds = new Set()
const allPitcherIds = new Set()

await mapPool(teamIds, 6, async (teamId) => {
  const sportId = teamMeta.get(teamId)?.sportId ?? MLB
  const roster = await fetchRoster(teamId, sportId)
  const pool = normalizeRosterToPool(roster, {
    id: teamId,
    abbreviation: '',
    sport: { id: sportId },
  })
  leadersByTeam.set(teamId, clubLeaders(pool))
  for (const p of pool) poolById.set(p.id, p)
  for (const r of roster) {
    if (r.person?.id != null && r.person.birthDate) birthDateById.set(r.person.id, r.person.birthDate)
    if (r.person?.id != null && r.person.mlbDebutDate) debutById.set(r.person.id, r.person.mlbDebutDate)
    if (r.person?.id != null) sportIdByPerson.set(r.person.id, sportId)
  }
  const hitters = roster
    .filter((r) => r.position?.type !== 'Pitcher' && r.person?.id)
    .map((r) => r.person.id)
  const pitchers = roster
    .filter((r) => r.position?.type === 'Pitcher' && r.person?.id)
    .map((r) => r.person.id)
  hitterIdsByTeam.set(teamId, hitters)
  pitcherIdsByTeam.set(teamId, pitchers)
  for (const id of hitters) allHitterIds.add(id)
  for (const id of pitchers) allPitcherIds.add(id)
  scoringByTeam.set(teamId, await scoringRecord(teamId, sportId))
})

// Per-hitter game-log + situational-splits sweep (the heaviest fan-out) —
// bounded concurrency, each hitter fetched once even if his club plays a
// doubleheader. Two independent endpoints per hitter, run together so the
// concurrency cap covers both without a second full pass over the list.
const hitterList = [...allHitterIds]
const enrichList = await mapPool(hitterList, 8, (id) =>
  Promise.all([
    hitterEnrich(id, sportIdByPerson.get(id) ?? MLB),
    hitterSituational(id, sportIdByPerson.get(id) ?? MLB),
  ]),
)
const enrichById = new Map()
const situationalById = new Map()
hitterList.forEach((id, i) => {
  const [enrich, situational] = enrichList[i] ?? [null, null]
  enrichById.set(id, enrich)
  situationalById.set(id, situational)
})

// Per-pitcher game-log sweep — every rostered pitcher on either club, not just
// probable starters (a bullpen call-up can start; a reliever's own scoreless
// streak/rest note fires whenever HE actually takes the mound tonight).
const pitcherList = [...allPitcherIds]
const pitcherEnrichList = await mapPool(pitcherList, 8, (id) =>
  pitcherEnrich(id, sportIdByPerson.get(id) ?? MLB),
)
const pitcherEnrichById = new Map()
pitcherList.forEach((id, i) => pitcherEnrichById.set(id, pitcherEnrichList[i]))

// The bullpen-workload baseline: the average pitch count an ACTIVE reliever at
// each level has thrown over the trailing window — the peer group the
// Pitchers-table workload note compares a reliever's own count against.
// Averaged over every swept reliever at the level, including the rested ones
// sitting on zero, which is exactly what "the average reliever" means.
const bullpenAvgBySport = {}
{
  const agg = new Map() // sportId -> { pitches, n }
  for (const id of pitcherList) {
    const e = pitcherEnrichById.get(id)
    if (!e?.isReliever) continue
    const sportId = sportIdByPerson.get(id) ?? MLB
    const a = agg.get(sportId) ?? { pitches: 0, n: 0 }
    a.pitches += e.recentPitches ?? 0
    a.n += 1
    agg.set(sportId, a)
  }
  for (const [sportId, a] of agg) {
    if (a.n > 0) bullpenAvgBySport[sportId] = Math.round(a.pitches / a.n)
  }
}

// Times-through-the-order sweep — the slate's probable starters only (see
// ttoSplits). Keyed by personId; a failed/empty playLog simply drops out.
const ttoById = new Map()
{
  const ids = [...probableSport.keys()]
  const results = await mapPool(ids, 6, (id) => ttoSplits(id, probableSport.get(id) ?? MLB))
  ids.forEach((id, i) => {
    if (results[i]) ttoById.set(id, results[i])
  })
}

// Birthday performance sweep — ONLY players (across every club on the slate)
// whose birthday actually falls on the slate date, so this is a handful of
// people even though birthdayLine itself walks a whole career. Keyed by
// personId; a null (below the sample floors, or no debut date) simply drops
// out. MLB only — birthdayLine's season-by-season walk reads MLB game logs.
const birthdayIds = [...birthDateById.keys()].filter(
  (id) =>
    (sportIdByPerson.get(id) ?? MLB) === MLB && isBirthdayOn(birthDateById.get(id), targetApi),
)
const birthdayStatsById = new Map()
await mapPool(birthdayIds, 4, async (id) => {
  const line = await birthdayLine(id, birthDateById.get(id), debutById.get(id))
  if (line) birthdayStatsById.set(id, line)
})

// Assemble per-game bundles keyed by gamePk. Everything the render layer needs,
// pre-joined so the app only ever does one static read + object lookups.
const outGames = {}
for (const g of games) {
  const awayId = g.teams?.away?.team?.id
  const homeId = g.teams?.home?.team?.id
  if (awayId == null || homeId == null) continue
  const sportId = teamMeta.get(homeId)?.sportId ?? MLB
  const mlb = sportId === MLB

  // Leaders keyed by playerId across BOTH clubs, so AtBatCard looks up batter.id
  // directly. Each carries the club name for the note ("leads the Brewers …").
  const leaders = {}
  const pitcherLeaders = {}
  for (const teamId of [awayId, homeId]) {
    const teamName = teamMeta.get(teamId)?.name ?? ''
    const cl = leadersByTeam.get(teamId)
    if (!cl) continue
    for (const [key, top] of Object.entries(cl.hitting)) {
      const e = (leaders[top.id] ??= { team: teamName, cats: {} })
      e.cats[key] = top.display
    }
    for (const [key, top] of Object.entries(cl.pitching)) {
      const e = (pitcherLeaders[top.id] ??= { team: teamName, cats: {} })
      e.cats[key] = top.display
    }
  }

  // Streaks + homer records for THIS game's two clubs' rostered hitters,
  // clearing the show floors so the feed isn't peppered with thin notes.
  const streaks = {}
  const homerRecords = {}
  const situational = {}
  const hitterLines = {}
  const milestones = {}
  const gameHitterIds = [
    ...(hitterIdsByTeam.get(awayId) ?? []),
    ...(hitterIdsByTeam.get(homeId) ?? []),
  ]
  for (const id of gameHitterIds) {
    const e = enrichById.get(id)
    if (e) {
      const s = {}
      if (e.onBase >= ONBASE_FLOOR) {
        s.onBase = e.onBase
        // The streak's first game, for the box score's "began 6/25" prose.
        if (e.onBaseStart) s.onBaseStart = e.onBaseStart
      }
      if (e.stolenBase >= SB_FLOOR) s.stolenBase = e.stolenBase
      if (s.onBase || s.stolenBase) streaks[id] = s
      const homerGames = e.homerW + e.homerL
      if (homerGames >= HOMER_MIN_GAMES) {
        const pct = e.homerW / homerGames
        if (pct >= HOMER_LOPSIDED || pct <= 1 - HOMER_LOPSIDED) {
          homerRecords[id] = `${e.homerW}-${e.homerL}`
        }
      }
      // hitterLines exist only to baseline the vs-opponent note, whose data
      // file (vs-team-splits) is MLB-only — skipping them for MiLB keeps the
      // committed file from carrying dead weight for ~120 extra clubs.
      if (mlb && (e.seasonLine || e.careerLine)) {
        hitterLines[id] = { season: e.seasonLine ?? null, career: e.careerLine ?? null }
      }
      if (e.milestone) milestones[id] = e.milestone
    }
    const sit = situationalById.get(id)
    if (sit && (sit.risp || sit.vl || sit.vr)) situational[id] = sit
  }

  // Starter records for every rostered pitcher on either club (see
  // pitcherEnrich's doc comment for why it's not scoped to just the day's two
  // probable starters). CG/shutout are season TOTALS read straight off the
  // pool's own hydrated season stats, not re-derived from the game log.
  const starterRecords = {}
  const gamePitcherIds = [
    ...(pitcherIdsByTeam.get(awayId) ?? []),
    ...(pitcherIdsByTeam.get(homeId) ?? []),
  ]
  for (const id of gamePitcherIds) {
    const e = pitcherEnrichById.get(id)
    if (!e) continue
    const p = poolById.get(id)
    const cgShutout = num(p?.pitching?.completeGames) + num(p?.pitching?.shutouts)
    const entry = {}
    if (e.homeAway) entry.homeAway = e.homeAway
    if (e.teamStarts) entry.teamStarts = e.teamStarts
    if (e.sixIp) entry.sixIp = e.sixIp
    if (e.tenK > 0) entry.tenK = e.tenK
    if (cgShutout > 0) entry.cgShutout = cgShutout
    if (e.scorelessStreak > 0) entry.scorelessStreak = e.scorelessStreak
    if (e.recentAppearances > 0) entry.recentAppearances = e.recentAppearances
    if (e.recentPitches > 0) entry.recentPitches = e.recentPitches
    if (e.isReliever) entry.reliever = true
    if (e.pitchedYesterday) entry.pitchedYesterday = true
    if (e.backToBack) entry.backToBack = e.backToBack
    if (e.leverage) entry.leverage = e.leverage
    if (ttoById.has(id)) entry.tto = ttoById.get(id)
    if (Object.keys(entry).length > 0) starterRecords[id] = entry
    if (e.milestone) milestones[id] = e.milestone
  }

  // A probable starter freshly called up may not be on the 40-man roster
  // sweep — make sure his TTO split still lands in the bundle.
  for (const side of ['away', 'home']) {
    const pid = g.teams?.[side]?.probablePitcher?.id
    if (pid != null && ttoById.has(pid) && !starterRecords[pid]?.tto) {
      starterRecords[pid] = { ...(starterRecords[pid] ?? {}), tto: ttoById.get(pid) }
    }
  }

  // Anyone on either roster (hitter or pitcher) whose birthday IS this
  // slate's date — a personId list, not raw birth dates (see isBirthdayOn).
  const birthdays = [...gameHitterIds, ...gamePitcherIds].filter((id) =>
    isBirthdayOn(birthDateById.get(id), targetApi),
  )

  // A career-on-birthday line for whichever of THIS game's birthday players
  // cleared the sample floors (see birthdayLine) — a subset of `birthdays`.
  const birthdayStats = {}
  for (const id of birthdays) {
    const line = birthdayStatsById.get(id)
    if (line) birthdayStats[id] = line
  }

  outGames[g.gamePk] = {
    sportId,
    away: { teamId: awayId, name: teamMeta.get(awayId)?.name ?? '' },
    home: { teamId: homeId, name: teamMeta.get(homeId)?.name ?? '' },
    // The level's average reliever pitch count over the trailing window — the
    // peer figure the bullpen-workload note reads.
    ...(bullpenAvgBySport[sportId] != null
      ? { bullpen: { avgPitches: bullpenAvgBySport[sportId], windowDays: RECENT_APPEARANCE_WINDOW_DAYS } }
      : {}),
    leaders,
    pitcherLeaders,
    streaks,
    homerRecords,
    situational,
    hitterLines,
    starterRecords,
    milestones,
    birthdays,
    birthdayStats,
    teamRecords: {
      away: { ...(splitRecords[awayId] ?? {}), ...(scoringByTeam.get(awayId) ?? {}) },
      home: { ...(splitRecords[homeId] ?? {}), ...(scoringByTeam.get(homeId) ?? {}) },
    },
  }
}

await mkdir(outDir, { recursive: true })
await writeFile(
  outFile,
  JSON.stringify({ date: targetApi, season, generatedAt: new Date().toISOString(), games: outGames }),
)
console.log(
  `wrote ${outFile} (${Object.keys(outGames).length} games across MLB+MiLB, ${hitterList.length} hitters and ${pitcherList.length} pitchers swept, ${ttoById.size} TTO splits)`,
)

// Prune old per-date files so the committed folder stays small — keep anything
// from the last ~10 days onward (a game scored a few days late still finds its
// file; older ones are unreachable slate history).
const keepFrom = iso(new Date(target.getTime() - 10 * DAY_MS)).replace(/-/g, '')
try {
  for (const name of await readdir(outDir)) {
    const m = name.match(/^(\d{2})(\d{2})(\d{4})\.json$/)
    if (!m) continue
    const ymd = `${m[3]}${m[1]}${m[2]}` // YYYYMMDD
    if (ymd < keepFrom) await rm(join(outDir, name))
  }
} catch {
  /* pruning is best-effort */
}
