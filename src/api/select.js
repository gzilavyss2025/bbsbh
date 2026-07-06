// Pure selectors that pull structured, spoiler-free data out of the raw
// feed/live response. None of these touch runs/hits/errors — score-revealing
// numbers are handled separately (see linescore.js) so they are only computed
// on reveal.

// Build a fast lookup of player id -> gameData player record.
function playerIndex(feed) {
  return feed?.gameData?.players ?? {}
}

// "LAST, FIRST" for a gameData player record. The API already provides
// lastFirstName; fall back to fullName if it's absent (flakier MiLB feeds).
function lastFirst(person) {
  return person?.lastFirstName ?? person?.fullName ?? 'TBD'
}

// Just the surname (for the compact opposing-defense list). boxscoreName is the
// club's own short form ("Gurriel Jr."); fall back to the pre-comma slice.
// When two players share a surname the club disambiguates with a trailing
// initial ("Suárez, E") — drop it so the defense list reads plain "SUÁREZ",
// while keeping real suffixes like "Jr." intact.
function lastName(person) {
  const raw = person?.boxscoreName
    ? person.boxscoreName
    : person?.lastFirstName
      ? person.lastFirstName.split(',')[0].trim()
      : person?.fullName ?? ''
  return raw.replace(/,\s*[A-Z]\.?$/, '').trim()
}

function otherSide(side) {
  return side === 'away' ? 'home' : 'away'
}

// Resolve the batting order for one side into a printable lineup. battingOrder
// is an array of player ids (as strings) in slot order. Cross-references
// gameData.players for names and the team's boxscore players[] for jersey
// number and position.
export function selectLineup(feed, side /* 'away' | 'home' */) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []

  const order = team.battingOrder ?? []
  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)

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

// The opposing defensive alignment the batting side faces: the other team's
// starters at their fielding positions. The DH is excluded (not on defense) and
// so is the pitcher, who is listed separately as the opposing pitcher.
export function selectOpposingDefense(feed, battingSide) {
  return selectLineup(feed, otherSide(battingSide))
    .filter((p) => p.position && p.position !== 'DH' && p.position !== 'P')
    .map((p) => ({ id: p.id, last: p.last, position: p.position }))
}

// Relievers who have NOT yet entered the game (boxscore.bullpen shrinks as
// pitchers are used). Name / number / handedness, matching the scorebook.
export function selectBullpen(feed, side) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []
  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)
  return (team.bullpen ?? []).map((id) => {
    const box = boxPlayers[`ID${id}`] ?? {}
    const person = players[`ID${id}`] ?? {}
    return {
      id,
      nameLastFirst: lastFirst(person.fullName ? person : box.person),
      jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
      hand: person.pitchHand?.description ?? '', // 'Left' | 'Right'
    }
  })
}

// Position players on the bench who have NOT yet entered the game.
// Name / number / position.
export function selectBench(feed, side) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []
  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)
  return (team.bench ?? []).map((id) => {
    const box = boxPlayers[`ID${id}`] ?? {}
    const person = players[`ID${id}`] ?? {}
    return {
      id,
      nameLastFirst: lastFirst(person.fullName ? person : box.person),
      jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
      position: box.position?.abbreviation ?? '',
    }
  })
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
