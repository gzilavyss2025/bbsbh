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
function entryIndexById(feed) {
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
      position: box.position?.abbreviation ?? '',
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
    name: gdTeam.name ?? box.name ?? '',
    teamName: gdTeam.teamName ?? box.teamName ?? '',
    abbreviation: gdTeam.abbreviation ?? box.abbreviation ?? '',
    probablePitcher: pitcher,
  }
}

// The four umpires. officialType is one of Home Plate / First Base /
// Second Base / Third Base.
const UMP_LABELS = {
  'Home Plate': 'HP',
  'First Base': '1B',
  'Second Base': '2B',
  'Third Base': '3B',
}

export function selectOfficials(feed) {
  const officials = feed?.liveData?.boxscore?.officials ?? []
  const order = ['Home Plate', 'First Base', 'Second Base', 'Third Base']
  const byType = {}
  for (const o of officials) {
    if (o.officialType) byType[o.officialType] = o.official?.fullName
  }
  return order
    .filter((t) => byType[t])
    .map((t) => ({ role: UMP_LABELS[t] ?? t, name: byType[t] }))
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
  }
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
