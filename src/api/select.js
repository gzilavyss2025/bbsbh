// Pure selectors that pull structured, spoiler-free data out of the raw
// feed/live response. None of these touch runs/hits/errors — score-revealing
// numbers are handled separately (see linescore.js) so they are only computed
// on reveal.

// Build a fast lookup of player id -> gameData player record.
function playerIndex(feed) {
  return feed?.gameData?.players ?? {}
}

// "LAST, FIRST" for a gameData player record. The API already provides
// lastFirstName; fall back to fullName if it's absent (flakier MiLB feeds, or
// the plain /roster endpoint's thinner person object — see TeamInfo.jsx's
// full-roster fallback).
export function lastFirst(person) {
  return person?.lastFirstName ?? person?.fullName ?? 'TBD'
}

// Just the surname (the opposing-defense diamond, the box score's compact
// rows). boxscoreName is the club's own short form ("Gurriel Jr."); fall back
// to the pre-comma slice of lastFirstName, then the last token of fullName.
// When two players share a surname the club disambiguates with a trailing
// token after a comma — usually one initial ("Suárez, E" / "Pérez, W"), but
// sometimes a short name fragment when initials alone don't disambiguate
// ("Contreras, Wm" for William vs. "Contreras, Wn" for Willson) — so drop
// everything from the first comma on, not just a single trailing letter, to
// leave a plain "SUÁREZ" / "CONTRERAS". Real suffixes like "Jr." never carry
// a comma in boxscoreName (it's "Guerrero Jr.", not "Guerrero, Jr."), so this
// can't clip one. Exported as the one name-shortening rule; boxscore.js
// shares it rather than growing a twin.
export function lastName(person) {
  const raw = person?.boxscoreName
    ? person.boxscoreName
    : person?.lastFirstName
      ? person.lastFirstName
      : person?.fullName
        ? person.fullName.split(' ').slice(-1)[0]
        : ''
  return raw.split(',')[0].trim()
}

// The {last, first} display pair for a gameData player record — the form the
// pitcher table and play-by-play cards print ("MISIOROWSKI, Jacob"). useName is
// the player's preferred first name ("A.J.", "Duke"). Shared by pitchers.js and
// playbyplay.js so the two card styles can't drift apart.
export function personNameParts(person) {
  return {
    last: (person?.lastName ?? person?.boxscoreName ?? person?.fullName ?? '').trim(),
    first: (person?.useName ?? person?.firstName ?? '').trim(),
  }
}

function otherSide(side) {
  return side === 'away' ? 'home' : 'away'
}

// Whether a player is a pitcher BY TRADE (primary position, two-way players
// included), not by what he happens to be doing in this game. Roster-card
// membership must key on this: a bench catcher mopping up a blowout gets an
// in-game box position of 'P', and classifying him by that would move him
// from the Bench card to the Bullpen card the moment he enters — an
// unmistakable hint of a sealed-inning blowout. Primary position is fixed at
// first pitch, so membership never shifts on a sealed event; only the
// reveal-gated strike-through changes. Falls back to the in-game box position
// for thin MiLB feeds that omit primaryPosition.
function isPitcherByTrade(person, box) {
  const abbr =
    person?.primaryPosition?.abbreviation ??
    box?.position?.abbreviation ??
    ''
  return abbr === 'P' || abbr === 'TWP'
}

// The ids of every player in this game whose birthday falls on the game's own
// date — matched by MM-DD against gameData.datetime.officialDate, off each
// player's gameData birthDate. Spoiler-free (a birthday is not a score) and
// MiLB-safe: it reads straight from the feed, so it needs no callouts file and
// works wherever the feed carries birthDate. A Feb-29 birthday simply never
// matches in a non-leap year, same as how anyone actually celebrates it.
// Returns a Set for O(1) membership at render time.
export function selectBirthdayIds(feed) {
  const ids = new Set()
  const mmdd = (feed?.gameData?.datetime?.officialDate ?? '').slice(5)
  if (!mmdd) return ids
  for (const p of Object.values(feed?.gameData?.players ?? {})) {
    if (p?.id != null && typeof p.birthDate === 'string' && p.birthDate.slice(5) === mmdd) {
      ids.add(p.id)
    }
  }
  return ids
}

// A total order over half-innings: top of the 1st = 0, bottom = 1, top of the
// 2nd = 2, … Lets a single number express "revealed through here". Structural,
// never a score — safe to compute anywhere.
export function halfIndex(inning, half /* 'top' | 'bottom' */) {
  return (inning - 1) * 2 + (half === 'top' ? 0 : 1)
}

// First half-index (see halfIndex) at which each substitute entered the game:
// pitchers from the first play they threw, position players from their
// substitution announcement. Spoiler-free — this reads only inning numbers and
// who took the field, never a score. Field paths verified against gamePk
// 824902 (2026-07-05 NYM@ATL): a substitution playEvent carries the INCOMING
// player in `player.id` and one of the eventTypes below ('defensive_switch' is
// deliberately excluded — that's a player already in the game changing
// positions, not an entry).
const ENTRY_EVENT_TYPES = new Set([
  'pitching_substitution',
  'offensive_substitution',
  'defensive_substitution',
])
const entryIndexCache = new WeakMap()
export function entryIndexById(feed) {
  if (!feed || typeof feed !== 'object') return {}
  const cached = entryIndexCache.get(feed)
  if (cached) return cached

  const entered = {}
  const mark = (id, idx) => {
    if (id != null && (entered[id] == null || idx < entered[id])) entered[id] = idx
  }
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = p?.about?.inning
    const half = p?.about?.halfInning
    if (!inn || !half) continue
    const idx = halfIndex(inn, half)
    mark(p?.matchup?.pitcher?.id, idx)
    for (const ev of p.playEvents ?? []) {
      if (ENTRY_EVENT_TYPES.has(ev?.details?.eventType)) mark(ev.player?.id, idx)
    }
  }
  entryIndexCache.set(feed, entered)
  return entered
}

// The chronological walk over a half's pre-first-pitch events
// (forEachEventBeforeFirstPitch) and the id set it derives
// (entrantsBeforeFirstPitch) — the shared building blocks for the "entering
// the half" selectors (api/defense.js's defenseEntering, api/battingorder.js's
// lineupEntering) — now live in api/enteringHalf.js alongside the
// spoiler-safety gate that guards them (safeToShowEntering). They moved out
// of this file because they're specific to that one concern, unlike
// everything else here.

// Resolve the batting order for one side into a printable lineup — the
// STARTING nine, the names you stage onto the sheet before first pitch.
//
// team.battingOrder tracks each slot's CURRENT occupant, so once a
// pinch-hitter enters it shows the sub (position "PH") instead of the starter
// — late in a game the staged lineup would sprout PH rows and the defense
// diamond would lose whole positions. Each boxscore player carries his own
// `battingOrder` value instead: a starter's is an exact multiple of 100
// (slot × 100), a sub in that slot is offset (801, 802…) — verified against
// gamePk 823036 (2026-07-06 MIL@STL). Prefer the multiples; fall back to the
// live array for thin MiLB feeds that don't post per-player slots.
// Cross-references gameData.players for names and the team's boxscore
// players[] for jersey number and position.
export function selectLineup(feed, side /* 'away' | 'home' */) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []

  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)

  const starters = []
  for (const box of Object.values(boxPlayers)) {
    const bo = Number(box?.battingOrder)
    if (Number.isFinite(bo) && bo >= 100 && bo % 100 === 0) {
      starters[bo / 100 - 1] = box.person?.id
    }
  }
  // A sparse slot (feed posted some multiples but not all nine) means the
  // convention isn't trustworthy here — fall back to the live array. filter()
  // skips holes, so the count only matches when every slot resolved.
  const complete =
    starters.length >= 9 &&
    starters.filter((id) => id != null).length === starters.length
  const order = complete ? starters : team.battingOrder ?? []

  return order.map((rawId, i) => {
    const id = typeof rawId === 'string' ? Number(rawId) : rawId
    const key = `ID${id}`
    const box = boxPlayers[key] ?? {}
    const person = players[key] ?? box.person ?? {}
    return {
      order: i + 1,
      id,
      name: person.fullName ?? box.person?.fullName ?? 'TBD',
      nameLastFirst: lastFirst(person.fullName ? person : box.person),
      last: lastName(person.fullName ? person : box.person),
      jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
      // box.position is the player's CURRENT/final fielding spot, which for
      // anyone who changed positions mid-game is NOT where he started —
      // verified against gamePk 823035 (2026-07-07 MIL@STL g2), where a
      // starter's box.position read out his third position of the night.
      // box.allPositions[] is the same player's positions in the order he
      // played them, so its first entry is the true starting spot; only fall
      // back to box.position for thin MiLB feeds that omit allPositions.
      position: box.allPositions?.[0]?.abbreviation ?? box.position?.abbreviation ?? '',
    }
  })
}

// The opposing pitcher a given batting side faces = the OTHER team's probable
// starter, with jersey and handedness. Spoiler-safe.
export function selectOpposingPitcher(feed, battingSide) {
  return selectTeamMeta(feed, otherSide(battingSide)).probablePitcher
}

// Fixed display order for the opposing-defense list, independent of batting
// order — the scorebook always reads C through DH the same way.
const DEFENSE_POSITION_ORDER = [
  'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH',
]

// The opposing defensive alignment the batting side faces: the other team's
// starters at their fielding positions plus the DH, sorted into a rigid
// C/1B/2B/SS/3B/LF/CF/RF/DH order every time. The pitcher is excluded — he's
// listed separately as the opposing pitcher.
export function selectOpposingDefense(feed, battingSide) {
  return selectLineup(feed, otherSide(battingSide))
    .filter((p) => p.position && p.position !== 'P')
    .map((p) => ({ id: p.id, last: p.last, position: p.position }))
    .sort(
      (a, b) =>
        DEFENSE_POSITION_ORDER.indexOf(a.position) -
        DEFENSE_POSITION_ORDER.indexOf(b.position)
    )
}

// The bullpen card as it stood at first pitch: relievers still available
// (boxscore.bullpen, which shrinks as pitchers are used) PLUS relievers who
// have since entered (boxscore.pitchers minus its first entry — the starter,
// who was never in the bullpen). An entered pitcher carries `enteredIdx`, the
// half-index at which he first pitched, so the caller can strike him through
// once the reveal mark reaches his entry; until then he renders like any other
// available arm. Sorted by name, matching the API's own bullpen ordering, so
// rows don't jump around as pitchers enter. Name / number / handedness.
export function selectBullpen(feed, side) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []
  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)
  const entered = entryIndexById(feed)

  // team.pitchers includes ANYONE who has pitched — position players mopping
  // up included — so filter entrants to pitchers by trade (see
  // isPitcherByTrade) or the card's membership itself leaks a sealed blowout.
  const enteredArms = (team.pitchers ?? [])
    .slice(1)
    .filter((id) => isPitcherByTrade(players[`ID${id}`], boxPlayers[`ID${id}`]))
  const ids = [...new Set([...(team.bullpen ?? []), ...enteredArms])]
  return ids
    .map((id) => {
      const box = boxPlayers[`ID${id}`] ?? {}
      const person = players[`ID${id}`] ?? {}
      return {
        id,
        nameLastFirst: lastFirst(person.fullName ? person : box.person),
        jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
        hand: person.pitchHand?.description ?? '', // 'Left' | 'Right'
        enteredIdx: entered[id] ?? null,
      }
    })
    .sort((a, b) => a.nameLastFirst.localeCompare(b.nameLastFirst))
}

// The bench card as it stood at first pitch: position players still available
// (boxscore.bench, which shrinks as subs enter) PLUS those who have since
// entered — recovered via each boxscore player's gameStatus.isSubstitute flag
// (position players only; substitute pitchers belong to the bullpen card).
// Entered players carry `enteredIdx` exactly as in selectBullpen. Sorted by
// name for the same row-stability. Name / number / position.
export function selectBench(feed, side) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []
  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)
  const entered = entryIndexById(feed)

  // Recover entered subs by PRIMARY position, not the in-game box position: a
  // bench player who ends up pitching still belongs on the Bench card (his
  // box position flips to 'P'), and a pitcher who pinch-runs must not appear
  // here — either misclassification shifts card membership on a sealed-inning
  // event. See isPitcherByTrade.
  const benchIds = team.bench ?? []
  const subIds = Object.values(boxPlayers)
    .filter(
      (p) =>
        p?.gameStatus?.isSubstitute &&
        !isPitcherByTrade(players[`ID${p.person?.id}`], p),
    )
    .map((p) => p.person?.id)
    .filter((id) => id != null && !benchIds.includes(id))

  return [...benchIds, ...subIds]
    .map((id) => {
      const box = boxPlayers[`ID${id}`] ?? {}
      const person = players[`ID${id}`] ?? {}
      return {
        id,
        nameLastFirst: lastFirst(person.fullName ? person : box.person),
        jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
        // Primary position, not the in-game one: an entered sub's box position
        // reads 'PH'/'PR' (or 'P' for a mop-up cameo), which would flag his
        // still-sealed entry the moment it happened. Primary is fixed pre-game.
        position:
          person.primaryPosition?.abbreviation ??
          box.position?.abbreviation ??
          '',
        enteredIdx: entered[id] ?? null,
      }
    })
    .sort((a, b) => a.nameLastFirst.localeCompare(b.nameLastFirst))
}

// Team-level meta for a side: name, record, manager placeholder (manager is
// fetched separately), and probable pitcher with handedness.
export function selectTeamMeta(feed, side) {
  const box = feed?.liveData?.boxscore?.teams?.[side]?.team ?? {}
  const gdTeam = feed?.gameData?.teams?.[side] ?? {}
  const probable = feed?.gameData?.probablePitchers?.[side]
  const players = playerIndex(feed)

  let pitcher = null
  if (probable?.id) {
    const p = players[`ID${probable.id}`] ?? {}
    pitcher = {
      id: probable.id,
      name: probable.fullName ?? p.fullName ?? 'TBD',
      nameLastFirst: lastFirst(p.fullName ? p : probable),
      jersey: p.primaryNumber ?? '',
      hand: p.pitchHand?.code ?? '', // 'L' | 'R'
    }
  }

  return {
    id: box.id ?? gdTeam.id,
    // The club's level (1 MLB, 11 AAA, …) — lets a roster fetch hydrate the
    // right level's season stats (see fetchTeamRoster); null at parks that omit it.
    sportId: gdTeam.sport?.id ?? box.sport?.id ?? null,
    name: gdTeam.name ?? box.name ?? '',
    teamName: gdTeam.teamName ?? box.teamName ?? '',
    // The spelled-out nickname ("Diamondbacks"), distinct from teamName, which
    // can be a marketing short form ("D-backs"). Falls back to teamName/name.
    clubName: gdTeam.clubName ?? box.clubName ?? gdTeam.teamName ?? gdTeam.name ?? '',
    abbreviation: gdTeam.abbreviation ?? box.abbreviation ?? '',
    probablePitcher: pitcher,
  }
}

// The umpire crew, in standard scorecard order. Crew SIZE varies: a full
// four-man infield crew is the regular-season norm, but MiLB games are often
// worked by two or three (the missing bases simply aren't in the feed), and the
// All-Star Game + postseason add Left Field and Right Field for a six-man crew.
// `order` lists every role we know how to place; the filter below keeps only the
// ones actually present, so any crew size renders correctly.
const UMP_LABELS = {
  'Home Plate': 'HP',
  'First Base': '1B',
  'Second Base': '2B',
  'Third Base': '3B',
  'Left Field': 'LF',
  'Right Field': 'RF',
}

export function selectOfficials(feed) {
  const officials = feed?.liveData?.boxscore?.officials ?? []
  const order = ['Home Plate', 'First Base', 'Second Base', 'Third Base', 'Left Field', 'Right Field']
  const byType = {}
  for (const o of officials) {
    if (o.officialType) byType[o.officialType] = o.official
  }
  return order
    .filter((t) => byType[t])
    .map((t) => ({ role: UMP_LABELS[t] ?? t, name: byType[t]?.fullName, id: byType[t]?.id ?? null }))
}

// Venue / weather / attendance / first pitch. MLB populates these; MiLB may
// not, so every field is optional.
export function selectGameInfo(feed) {
  const gameData = feed?.gameData ?? {}
  const venue = gameData.venue?.name ?? ''
  const weather = gameData.weather ?? {}

  // boxscore.info[] is a list of { label, value } rows.
  const infoRows = feed?.liveData?.boxscore?.info ?? []
  const infoByLabel = {}
  for (const row of infoRows) {
    if (row.label) infoByLabel[row.label] = (row.value ?? '').replace(/\.$/, '')
  }

  const base =
    weather.temp && weather.condition
      ? `${weather.temp}°, ${weather.condition}`
      : infoByLabel['Weather'] ?? ''
  const wind = weather.wind ?? infoByLabel['Wind'] ?? ''
  // Wind and weather are combined into one field; drop wind entirely when it's
  // calm ("0 mph, None") or unreported so it never shows a meaningless "0 mph".
  const windMeaningful = wind && !/^0\s*mph/i.test(wind) && !/^none/i.test(wind)

  return {
    venue,
    weather: [base, windMeaningful ? wind : ''].filter(Boolean).join(' · '),
    attendance: infoByLabel['Att'] ?? '',
    firstPitch: infoByLabel['First pitch'] ?? '',
    // YYYY-MM-DD in the park's sense — the scorebook's date line.
    officialDate: gameData.datetime?.officialDate ?? '',
    // 'day' | 'night' | '' — lets a card say "starting today" vs "tonight".
    dayNight: gameData.datetime?.dayNight ?? '',
  }
}

// Defensive subs/switches, pitching changes, and pinch-hitters/pinch-runners
// announced before a half's own first pitch — the same thing a broadcast
// tells you before the half starts, so it carries no more spoiler risk than
// the starting lineup. Spoiler-free: reads only eventType/description off
// each playEvent, never an event's awayScore/homeScore (present on every
// event, deliberately unread here). Verified against gamePk 823035
// (2026-07-07 MIL@STL g2): a half's pre-pitch cluster of subs all land as
// leading, non-pitch playEvents on that half's FIRST play, immediately before
// its first isPitch:true event — so a single scan that stops at the half's
// first pitch is sufficient; it never needs to look past it into the half's
// actual at-bats.
//
// The caller must gate WHEN this is shown: it's meant only for the half that
// is the user's own next one to reveal (halfIndex(inning, half) ===
// revealedThrough + 1). For a half further out, this is exactly the "flurry
// of substitutions telegraphs a still-sealed blowout" risk api/defense.js
// guards against — this selector itself has no opinion on reveal state, it
// just reads one half's pre-pitch events.
const PRE_PITCH_EVENT_TYPES = new Set([
  'defensive_substitution',
  'defensive_switch',
  'pitching_substitution',
  'offensive_substitution',
])

// Position abbreviation -> lowercase phrase, for the "now playing {phrase}"
// fielder-entry card below — mirrors api/playbyplay.js's own copy of this map
// (kept separate rather than imported to avoid a select.js <-> playbyplay.js
// circular import; both are 9 fixed baseball positions, not a value that
// drifts). No DH entry — a DH never takes the field.
const POSITION_LOWER = {
  C: 'catcher',
  '1B': 'first base',
  '2B': 'second base',
  '3B': 'third base',
  SS: 'shortstop',
  LF: 'left field',
  CF: 'center field',
  RF: 'right field',
  P: 'pitcher',
}

export function selectPrePitchChanges(feed, inning, half) {
  const changes = []
  const players = playerIndex(feed)
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    if (play?.about?.inning !== inning || play?.about?.halfInning !== half) continue
    for (const ev of play.playEvents ?? []) {
      if (ev.isPitch) return changes
      const type = ev.details?.eventType
      if (!PRE_PITCH_EVENT_TYPES.has(type)) continue
      // A pitching change becomes a "now pitching" announcement (jersey + hand
      // resolved from the incoming pitcher's record) rather than the raw
      // "Pitching Change: X replaces Y" description; other subs keep their text.
      if (type === 'pitching_substitution' && ev.player?.id != null) {
        const person = players[`ID${ev.player.id}`] ?? {}
        changes.push({
          eventType: type,
          pitcher: {
            id: ev.player.id,
            name: lastFirst(person),
            jersey: boxscoreJersey(feed, ev.player.id) || person.primaryNumber || '',
            hand: person.pitchHand?.code ?? '', // 'L' | 'R'
          },
        })
      } else if (
        (type === 'defensive_substitution' || type === 'defensive_switch') &&
        ev.player?.id != null
      ) {
        // Same "now playing {position}" card api/playbyplay.js's
        // defensiveChangeFielder builds for a mid-inning change — a fresh
        // fielder or a position switch announced before this half's first
        // pitch is exactly as worth a scorer's notice, so it gets the same
        // headshot card instead of a plain list line.
        const person = players[`ID${ev.player.id}`] ?? {}
        const { last, first } = personNameParts(person)
        const name = last ? `${last}${first ? `, ${first}` : ''}` : person.fullName ?? ''
        changes.push({
          eventType: type,
          fielder: {
            id: ev.player.id,
            name,
            jersey: person.primaryNumber ?? '',
            position: POSITION_LOWER[ev.position?.abbreviation] ?? '',
          },
        })
      } else {
        changes.push({ eventType: type, text: ev.details.description })
      }
    }
  }
  return changes
}

// The game jersey number for a player id, checked across both boxscore sides
// (the incoming pitcher's side isn't known here). Falls back to '' so callers
// can drop to gameData's primaryNumber.
function boxscoreJersey(feed, id) {
  const teams = feed?.liveData?.boxscore?.teams ?? {}
  for (const side of ['away', 'home']) {
    const num = teams[side]?.players?.[`ID${id}`]?.jerseyNumber
    if (num) return num
  }
  return ''
}

// Regulation length of the game (7 for some MiLB / doubleheader games, else 9).
// Spoiler-safe: it's a fixed structural number, never a score. Drives how many
// inning columns the boxscore shows before extra innings unlock one at a time.
export function selectRegulationInnings(feed) {
  return feed?.liveData?.linescore?.scheduledInnings ?? 9
}

// Number of innings the linescore knows about (drives the inning navigator).
export function selectInningCount(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  const scheduled = feed?.liveData?.linescore?.scheduledInnings ?? 9
  return Math.max(innings.length, scheduled)
}

// Whether the game has started at all (used for the "not started yet" state).
export function selectHasStarted(feed) {
  const abstract = feed?.gameData?.status?.abstractGameState
  return abstract === 'Live' || abstract === 'Final'
}

// Coarse game-state flags for the delayed/suspended/postponed banner.
// Structural metadata, not a score — safe to render unconditionally, same as
// selectHasStarted above. `detailedState` carries MLB's specific phrasing
// ("Delayed Start: Rain", "Suspended: Rain", "Postponed"); `reason` is the
// separate free-text cause field the feed sometimes also carries. Works from
// either a full live feed (`feed.gameData.status`) or a slate row already
// normalized by schedule.js's normalizeGame (same field names, flattened).
export function selectGameStatus(source) {
  const status = source?.gameData?.status ?? source ?? {}
  const detailedState = status.detailedState ?? ''
  const reason = status.reason ?? ''
  const lower = detailedState.toLowerCase()
  const isPostponed = lower.includes('postponed')
  const isSuspended = lower.includes('suspended')
  const isDelayed = lower.includes('delayed')
  // Coarsest-first badge label, or null for a normal game. Postponed beats
  // suspended beats delayed, matching how MLB's own detailedState phrasing
  // nests them (a postponed game is never also "delayed").
  const label = isPostponed ? 'Postponed' : isSuspended ? 'Suspended' : isDelayed ? 'Delayed' : null
  return { detailedState, reason, isDelayed, isSuspended, isPostponed, label }
}

// In-game delays (rain, etc.) for the between-half-innings notice (see
// components/DelayCard). Spoiler-FREE: a stoppage carries no score — only WHEN
// it happened, WHY, and (once play resumed) how long it lasted. Each delay is a
// non-pitch "Game Advisory" playEvent whose description reads "Status Change -
// Delayed: <reason>" (or "Delayed Start: <reason>"); the resume is a separate
// "In Progress" advisory. The delay event's own startTime/endTime bracket the
// stoppage — its endTime is when play resumed — so the duration comes straight
// from the event, no pairing needed. A still-ongoing delay has no resume yet
// (endTime absent or == startTime) and reports resolved:false with no duration.
// Attributed to the half-inning of the play it sits inside, so InningViewer can
// surface it on that half's page. Deliberately reads no score field on the
// event (it also carries awayScore/homeScore — left untouched).
export function selectDelays(feed) {
  const delays = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    for (const ev of play.playEvents ?? []) {
      const desc = ev.details?.description ?? ''
      if (!/delayed/i.test(desc)) continue // "In Progress" / "Delay Over" don't match
      // Reason is whatever trails the "Delayed[ Start]: " prefix ("Rain",
      // "Field conditions"), or '' when the advisory carries none.
      const reason = (desc.split(/delayed[^:]*:\s*/i)[1] ?? '').trim()
      const start = ev.startTime ? Date.parse(ev.startTime) : NaN
      const end = ev.endTime ? Date.parse(ev.endTime) : NaN
      const durationMinutes =
        Number.isFinite(start) && Number.isFinite(end) && end - start > 60_000
          ? Math.round((end - start) / 60_000)
          : null
      delays.push({
        inning,
        half,
        reason,
        durationMinutes,
        resolved: durationMinutes != null,
      })
    }
  }
  return delays
}

// "today" for a day game, "tonight" for a night game — the word the callout
// notes (api/callout-notes.js, api/pitcher-callouts.js) use in place of a
// hard-coded "tonight". `dayWordFor` takes the raw 'day'|'night' string
// directly (the callouts bundle carries its own copy — see gen-callouts.mjs —
// so those builders don't need the whole feed); `dayWord` reads it off
// gameData.datetime.dayNight (same field selectVenue's dayNight surfaces
// above) for callers that already have the feed. Both default to 'tonight'
// when the value is missing (an un-generated/older callouts bundle, or a feed
// that hasn't posted it yet) so callers never render a blank.
export function dayWordFor(dayNight) {
  return dayNight === 'day' ? 'today' : 'tonight'
}
export function dayWord(feed) {
  return dayWordFor(feed?.gameData?.datetime?.dayNight)
}
