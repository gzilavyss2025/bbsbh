// THE SLATE DAY (#3035): everything the slate needs to know about one date at one level,
// as one value — the season phase, the day's games, the level-ladder stops, and what is
// still on its way. GameSelect only draws it.
//
// A pure loader with injected fetchers. It owns the ORDER of the fetches, which used to be
// spread across nine useAsync calls in GameSelect.jsx, and every rule about which one waits
// on which signal lives here, where test/slate-day.test.js can drive it with fakes:
//
//   - The season row is asked only once the slate (and the favourite's affiliates) say the
//     day is EMPTY. Its answer, even a failed one, is the signal that a level's own /league
//     rows may be asked (levelFetchYear, #2907, #2936). A day with games asks neither.
//   - Rows saved on this device (`readSeasonRow`) decide the phase before any of that lands,
//     so the winter's chunk can start on the first frame (#2907).
//   - `offseason.pending` stays true while a level's rows or next season's are in flight,
//     so the slate draws no stand-in it would throw away a beat later. A rejection settles it.
//   - On the winter tab the league comes off the calendar once it lands; until then the URL's
//     league is fetched, and a winter tab with neither fetches nothing.
//
// SPOILER-FREE. The value carries the schedule's games exactly as fetchSchedule returns
// them (its `fields=` prunes the score, spoiler-manifest.json's schedule entry), counts,
// clubs and season dates. It never fetches, holds or derives a score.
//
// `onUpdate` gets a fresh value each time a fetch lands, so the page still paints in stages.
// The return is { reload(part), cancel() }: `reload('slate')` keeps the last-good games
// (an error retry), `reload('counts')` re-reads the ladder counts (on foreground).
import { LEVELS, SPORT_IDS } from '../teams.js'
import { WINTER_SPORT_ID, isWinterSport } from '../winter/leagues.js'
import {
  defaultWinterLeagueId,
  hasWinterTab,
  leaguesOnDate,
  resolveWinterLeagueId,
  winterSeasonFor,
} from '../winter/window.js'
import { isPostseasonWindow } from '../postseason/capSlateDate.js'
import { ladderStops } from './ladder.js'
import { levelFetchYear, phaseOf, winterOf } from './phase.js'

// What the winter calendar says for this date, the shape useWinter used to return:
// `tabVisible` (a sixth stop), `leagues` (the picker's chips), `leagueId` (the league to
// fetch), `games` (the Winter stop's count), `defaultLeagueId` and `ready`. All fail closed.
function winterBallOf(calendar, dateStr, sportId, leagueId, ready) {
  const onWinter = isWinterSport(sportId)
  return {
    tabVisible: hasWinterTab(calendar, dateStr),
    ready,
    leagues: onWinter ? leaguesOnDate(calendar, dateStr) : [],
    leagueId: onWinter ? resolveWinterLeagueId(calendar, dateStr, leagueId) : null,
    games: leaguesOnDate(calendar, dateStr).reduce((n, l) => n + l.games, 0),
    defaultLeagueId: defaultWinterLeagueId(calendar, dateStr),
  }
}

// Each slot's own key: what it was fetched FOR. A slot whose key did not change keeps its
// answer across a new date, level or favourite (the ladder counts are one per date, the club
// list one per level, the bracket's season row one per year), so paging re-fetches nothing it
// already knows and the masthead does not blank and refill.
function slotKeys(input) {
  const { dateStr, sportId, leagueId = null, favoriteTeamId = null } = input
  const year = Number(dateStr.slice(0, 4))
  const noAffiliates = sportId === SPORT_IDS.MLB || isWinterSport(sportId)
  return {
    bracket: sportId === SPORT_IDS.MLB ? year : null,
    calendar: winterSeasonFor(dateStr),
    counts: dateStr,
    affiliates: noAffiliates ? null : `${favoriteTeamId}|${year}|${sportId}`,
    slate: `${dateStr}|${sportId}|${leagueId}`,
    teams: sportId,
    rows: `${dateStr}|${sportId}`,
  }
}

// The state before anything has answered, plus whatever `seed` (the last run's state) already
// answered for a slot whose key is unchanged. Shared with the hook's first frame.
function freshState(input, seed = null) {
  const { sportId } = input
  const keys = slotKeys(input)
  const same = (slot) => Boolean(seed) && seed.keys[slot] === keys[slot]
  const s = {
    keys,
    bracketMeta: sportId === SPORT_IDS.MLB ? undefined : null,
    calendar: undefined,
    counts: null,
    affiliates: keys.affiliates === null ? [] : undefined,
    affiliateIds: new Set(),
    league: undefined, // the league the slate was last asked for
    slate: { data: null, error: null, loading: true },
    teamsLeague: undefined, // the league the club list was last asked for
    teams: null,
    seasonAsked: false,
    seasonRow: undefined, // undefined until answered; a rejection leaves it undefined
    seasonSettled: false,
    level: { key: null, rows: undefined, settled: false },
    next: { key: null, rows: undefined, settled: false },
  }
  if (!seed) return s
  if (same('bracket') && keys.bracket) s.bracketMeta = seed.bracketMeta
  if (same('calendar')) s.calendar = seed.calendar
  if (same('counts')) s.counts = seed.counts
  if (same('affiliates') && keys.affiliates) {
    s.affiliates = seed.affiliates
    s.affiliateIds = seed.affiliateIds
  }
  if (same('slate') && !seed.slate.loading) {
    s.league = seed.league
    s.slate = seed.slate
  }
  if (same('teams') && seed.teams) {
    s.teamsLeague = seed.teamsLeague
    s.teams = seed.teams
  }
  if (same('rows') && seed.seasonSettled) {
    s.seasonAsked = true
    s.seasonRow = seed.seasonRow
    s.seasonSettled = true
    if (seed.level.settled) s.level = seed.level
    if (seed.next.settled) s.next = seed.next
  }
  return s
}

const keyOf = (id, year) => (year ? `${id}:${year}` : null)

// The value the slate draws, from the state so far. Pure.
function view(input, s, load) {
  const { dateStr, sportId, leagueId = null } = input
  const year = Number(dateStr.slice(0, 4))
  const onWinter = isWinterSport(sportId)
  const winterBall = winterBallOf(s.calendar ?? null, dateStr, sportId, leagueId, s.calendar !== undefined)
  const activeLeagueId = onWinter ? (winterBall.leagueId ?? leagueId ?? null) : null
  const levels = winterBall.tabVisible
    ? [...LEVELS, { label: 'WINTER', sportId: WINTER_SPORT_ID, leagueId: winterBall.defaultLeagueId }]
    : LEVELS
  const stops = ladderStops({ levels, counts: s.counts, sportId, winterGames: winterBall.games })

  // Hold the cards until the affiliates answer too: the pinned card re-sorts to the top (CLS 0.31).
  const affLoading = s.affiliates === undefined
  const loading = s.slate.loading || affLoading
  const games = affLoading ? null : s.slate.data
  const isEmptyDay = !loading && !s.slate.error && (games?.length ?? 0) === 0

  // The season row counts only while the day is empty (it is asked for no other day).
  const seasonRow = isEmptyDay ? s.seasonRow : undefined
  const seasonMeta = {
    loading: isEmptyDay && !s.seasonSettled,
    data: seasonRow,
  }
  const levelYear = levelFetchYear(year, sportId, seasonRow)
  const levelRows = s.level.key === keyOf(sportId, levelYear) ? s.level.rows : undefined
  const base = phaseOf(dateStr, sportId, { season: seasonRow, level: levelRows }, load)
  const nx = nextKeyOf(sportId, base.phase)
  const nextRows = s.next.key === nx.key ? s.next.rows : undefined
  const winter = winterOf(dateStr, sportId, base, nextRows, load)
  const pending =
    (Boolean(levelYear) && !(s.level.key === keyOf(sportId, levelYear) && s.level.settled)) ||
    (Boolean(nx.key) && !(s.next.key === nx.key && s.next.settled))

  const bracketSeasonMeta = s.bracketMeta ?? null
  return {
    dateStr,
    sportId,
    season: year,
    onWinter,
    activeLeagueId,
    winterBall,
    levels,
    stops,
    // The bracket draws the 12-club format (2022 on); an older postseason keeps the plain slate.
    inPostseasonWindow:
      sportId === SPORT_IDS.MLB && year >= 2022 && isPostseasonWindow(dateStr, bracketSeasonMeta),
    slate: { games, loading, error: s.slate.error },
    affiliateIds: s.affiliateIds,
    levelTeams: s.teams,
    isEmptyDay,
    seasonMeta,
    offseason: { phase: base.phase, winter, pending, expectWinter: base.expectWinter },
    // Internal: which rows to ask for next. Not drawn.
    _want: { levelYear, next: nx },
  }
}

// November and December read next season's row for the dates the winter counts to (MLB's
// spring, a level's opener). January on, both are on the row already in hand.
function nextKeyOf(sportId, phase) {
  const id = phase?.springFromNextSeason ? SPORT_IDS.MLB : sportId
  const year = phase?.springFromNextSeason ?? phase?.openerFromNextSeason ?? null
  return { id, year, key: keyOf(id, year), mlb: Boolean(phase?.springFromNextSeason) }
}

// The value without the loader's own bookkeeping.
const strip = (v) => {
  const out = { ...v }
  delete out._want
  return out
}

export function initialSlateDay(input, load, seed = null) {
  return strip(view(input, freshState(input, seed), load))
}

// `seed` is the last run's state (the second argument `onUpdate` gets), carried per slot.
export function loadSlateDay(input, f, onUpdate, seed = null) {
  const { dateStr, sportId, favoriteTeamId = null } = input
  const year = Number(dateStr.slice(0, 4))
  const onWinter = isWinterSport(sportId)
  const load = f.readSeasonRow
  const s = freshState(input, seed)
  let dead = false
  let last = null
  const tokens = {}

  // Run one fetch under a named slot: a newer run of the same slot, or cancel(), voids it.
  const track = (slot, run, onOk, onErr) => {
    const t = (tokens[slot] = (tokens[slot] ?? 0) + 1)
    const live = () => !dead && tokens[slot] === t
    Promise.resolve()
      .then(run)
      .then((d) => live() && onOk(d), (e) => live() && onErr(e))
      .catch((e) => live() && onErr(e)) // an onOk that throws settles the slot as a failure, never wedges it
      .then(() => live() && safeStep())
  }
  // A throw while building the value is a bug: report it, and keep the last value on screen.
  const safeStep = () => {
    try {
      step()
    } catch (err) {
      console.error('slate day:', err)
    }
  }

  const startSlate = (keep) => {
    const lg = s.league
    s.slate = { data: keep ? s.slate.data : null, error: null, loading: true }
    track(
      'slate',
      () => (onWinter && !lg ? [] : f.fetchSchedule(dateStr, sportId, undefined, lg)),
      (data) => (s.slate = { data, error: null, loading: false }),
      (error) => (s.slate = { ...s.slate, error, loading: false }),
    )
  }
  // The club list is per level and league, never per date.
  const startTeams = (lg) => {
    s.teamsLeague = lg
    s.teams = null
    track('teams', () => f.fetchTeams(sportId, lg), (d) => (s.teams = d), () => {})
  }
  const startLeague = (lg) => {
    s.league = lg
    startSlate(false)
  }
  const startCounts = () =>
    track('counts', () => f.fetchLevelCounts(dateStr), (d) => (s.counts = d), () => {})

  // Every update re-reads the value, then asks for whatever it now says is wanted.
  const step = () => {
    if (dead) return
    let v = view(input, s, load)
    if (v.activeLeagueId !== s.league) {
      startLeague(v.activeLeagueId)
      v = view(input, s, load)
    }
    if (s.teamsLeague !== s.league) startTeams(s.league)
    if (v.isEmptyDay && !s.seasonAsked) {
      s.seasonAsked = true
      // On MLB the bracket already asked for this very row: reuse its answer once it is in.
      const known = s.bracketMeta !== undefined && sportId === SPORT_IDS.MLB
      track(
        'season',
        () => (known ? s.bracketMeta : f.fetchSeasonMeta(year)),
        (row) => {
          s.seasonRow = row
          s.seasonSettled = true
          f.saveSeasonRow(SPORT_IDS.MLB, year, row)
        },
        () => (s.seasonSettled = true),
      )
    }
    const { levelYear, next } = v._want
    const lk = keyOf(sportId, levelYear)
    if (lk && s.level.key !== lk) {
      s.level = { key: lk, rows: undefined, settled: false }
      track(
        'level',
        () => f.fetchLevelSeasonDates(sportId, levelYear),
        (rows) => {
          s.level = { key: lk, rows, settled: true }
          f.saveSeasonRow(sportId, levelYear, rows)
        },
        () => (s.level = { key: lk, rows: undefined, settled: true }),
      )
      v = view(input, s, load)
    }
    if (next.key && s.next.key !== next.key) {
      s.next = { key: next.key, rows: undefined, settled: false }
      track(
        'next',
        () => (next.mlb ? f.fetchSeasonMeta(next.year) : f.fetchLevelSeasonDates(sportId, next.year)),
        (rows) => {
          s.next = { key: next.key, rows, settled: true }
          f.saveSeasonRow(next.id, next.year, rows)
        },
        () => (s.next = { key: next.key, rows: undefined, settled: true }),
      )
      v = view(input, s, load)
    }
    const out = strip(v)
    // An unchanged offseason keeps its identity, so the winter page does not re-render for nothing.
    if (last && JSON.stringify(last.offseason) === JSON.stringify(out.offseason)) out.offseason = last.offseason
    last = out
    onUpdate(out, s)
  }

  if (sportId === SPORT_IDS.MLB && s.bracketMeta === undefined)
    track('bracket', () => f.fetchSeasonMeta(year), (d) => (s.bracketMeta = d), () => (s.bracketMeta = null))
  if (s.calendar === undefined) {
    track(
      'calendar',
      () => f.fetchWinterCalendar(winterSeasonFor(dateStr)),
      (d) => (s.calendar = d ?? null),
      () => (s.calendar = null),
    )
  }
  if (!s.counts) startCounts()
  if (s.affiliates === undefined)
    track(
      'affiliates',
      () => f.fetchAffiliates(favoriteTeamId, year),
      (d) => {
        s.affiliates = d ?? []
        s.affiliateIds = new Set(s.affiliates.map((a) => a.id))
      },
      () => (s.affiliates = []),
    )
  safeStep()

  return {
    reload(part) {
      if (dead) return
      if (part === 'slate') startSlate(true)
      else if (part === 'counts') startCounts()
      safeStep()
    },
    cancel() {
      dead = true
    },
  }
}
