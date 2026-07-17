// Full box-score selector — the complete, MLB.com-style final line for a game:
// each team's batting order (starters with substitutes indented), the pitching
// lines, the BATTING/BASERUNNING/FIELDING notes, per-team footnotes, the
// info-block rows (WP, umpires, weather, T, Att…) — deduped against the
// structured fields and split per-pitcher onto each team (see
// splitGameNotes) — and the W/L/S decisions.
//
// SPOILER RULE — read before touching this. Every number here is
// score-revealing, so this module is reveal-only exactly like linescore.js and
// derive.js: `selectBoxscore` must ONLY be called from inside a SealBox's reveal
// render function. Never call it at render top-level or in a pre-reveal useMemo —
// there must be no fetched-then-hidden box score sitting in the DOM.

// Short surname for display — the one shared name-shortening rule (prefer the
// club's boxscoreName, drop a trailing disambiguating initial, keep real
// suffixes). Lives in select.js so this module and the spoiler-free selectors
// can't drift apart.
import { lastName as shortName } from './select.js'

// Context-neutral half of the three-stars blend (ADR-0013).
import { contextNeutralPoints } from './performanceScore.js'

// The linescore/pitching-line primitives every other reveal-only surface
// (RollingLine, StatBox, PitchersSection) already reads — sourced once here
// too instead of this module re-deriving the same liveData fields a second
// way. See revealTotals/revealInning and computePitcherLines below.
import { revealTotals, revealInning } from './linescore.js'
import { computePitcherLines } from './pitchers.js'

// "Cooper Pratt" — first name ahead of the shortened surname, for the three
// stars' full-name style (the batting/pitching tables use the LAST, First
// order instead — see lastFirst below). Reuses shortName so
// suffixes/disambiguation stay consistent.
function firstLast(person) {
  const first = (person?.useName ?? person?.firstName ?? '').trim()
  const last = shortName(person)
  return first ? `${first} ${last}` : last
}

// "Contreras, William" — the shortened surname followed by the first name,
// matching the LAST, First convention the pitcher table and play-by-play
// cards use elsewhere (select.js's personNameParts covers those; the box
// score needs shortName's disambiguation-stripping instead, so it builds the
// pair itself). Falls back to just the surname when the feed has no first
// name (thin MiLB records).
function lastFirst(person) {
  const first = (person?.useName ?? person?.firstName ?? '').trim()
  const last = shortName(person)
  return first ? `${last}, ${first}` : last
}

export function positionLabel(boxPlayer) {
  const all = (boxPlayer.allPositions ?? [])
    .map((p) => p.abbreviation)
    .filter(Boolean)
  if (all.length) return all.join('-')
  return boxPlayer.position?.abbreviation ?? ''
}

// One side's batting table: every player who occupied a lineup slot, ordered by
// the API's battingOrder code (slot * 100 + substitution sequence). A code
// ending in 00 is the slot's starter; 01/02… are substitutes, flagged so the UI
// can indent them under the starter the way a printed box score does.
function battingRows(feed, side) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  const gdPlayers = feed?.gameData?.players ?? {}
  const boxPlayers = team?.players ?? {}

  const rows = Object.values(boxPlayers)
    .filter((p) => p.battingOrder != null)
    .map((p) => {
      const code = Number(p.battingOrder)
      const gd = gdPlayers[`ID${p.person?.id}`] ?? p.person ?? {}
      const b = p.stats?.batting ?? {}
      return {
        id: p.person?.id,
        code,
        slot: Math.floor(code / 100),
        isSub: code % 100 !== 0,
        name: lastFirst(gd),
        // Uniform number, penciled in red before the position on the sheet.
        num: p.jerseyNumber ?? gd.primaryNumber ?? '',
        position: positionLabel(p),
        // Footnote marker ("a", "b"…) tying a sub to the team.note list.
        mark: (b.note ?? '').replace(/[-\s]/g, '').trim(),
        ab: b.atBats ?? 0,
        r: b.runs ?? 0,
        h: b.hits ?? 0,
        rbi: b.rbi ?? 0,
        bb: b.baseOnBalls ?? 0,
        so: b.strikeOuts ?? 0,
        avg: feedAvg(p),
      }
    })
    .sort((a, b) => a.code - b.code)

  return rows
}

// Season AVG shown to the right of a batter's game line, mirroring MLB.com.
function feedAvg(boxPlayer) {
  return boxPlayer.seasonStats?.batting?.avg ?? '.---'
}

function battingTotals(feed, side) {
  const t = feed?.liveData?.boxscore?.teams?.[side]?.teamStats?.batting ?? {}
  return {
    ab: t.atBats ?? 0,
    r: t.runs ?? 0,
    h: t.hits ?? 0,
    rbi: t.rbi ?? 0,
    bb: t.baseOnBalls ?? 0,
    so: t.strikeOuts ?? 0,
  }
}

// One side's pitching table, in order of appearance, each line tagged with its
// decision (W/L/S) when it earned one. The IP/P/BF/H/R/ER/BB/K numbers come
// from `pitcherLines` (computePitcherLines(feed, Infinity), computed once in
// selectBoxscore) — the same per-pitcher accumulator PitchersSection reads
// mid-game — rather than this function re-deriving them a second way from
// box.stats.pitching. Only the box-score-specific display (the disambiguated
// "Last, First" name, jersey number, decision tag) stays local.
function pitchingRows(feed, side, decisions, pitcherLines) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  const gdPlayers = feed?.gameData?.players ?? {}
  const boxPlayers = team?.players ?? {}
  const order = team?.pitchers ?? []
  const lineById = new Map((pitcherLines?.[side] ?? []).map((p) => [p.id, p]))
  const emptyLine = { ip: '0.0', pitches: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, k: 0 }

  return order.map((id) => {
    const box = boxPlayers[`ID${id}`] ?? {}
    const gd = gdPlayers[`ID${id}`] ?? box.person ?? {}
    const s = lineById.get(id) ?? emptyLine
    let dec = ''
    if (id === decisions.winId) dec = 'W'
    else if (id === decisions.lossId) dec = 'L'
    else if (id === decisions.saveId) dec = 'S'
    return {
      id,
      name: lastFirst(gd),
      num: box.jerseyNumber ?? gd.primaryNumber ?? '',
      dec,
      // Throwing hand (R/L) is a #22-scorebook column the MLB.com box score
      // omits; comes straight from the feed (pitcherLines has no use for it).
      hand: gd.pitchHand?.code ?? '',
      ip: s.ip,
      pitches: s.pitches,
      bf: s.bf,
      h: s.h,
      r: s.r,
      er: s.er,
      bb: s.bb,
      so: s.k,
    }
  })
}

function pitchingTotals(feed, side) {
  const t = feed?.liveData?.boxscore?.teams?.[side]?.teamStats?.pitching ?? {}
  return {
    ip: t.inningsPitched ?? '0.0',
    bf: t.battersFaced ?? 0,
    h: t.hits ?? 0,
    r: t.runs ?? 0,
    er: t.earnedRuns ?? 0,
    bb: t.baseOnBalls ?? 0,
    so: t.strikeOuts ?? 0,
  }
}

// Final R/H/E/LOB for one side, the numbers that fill the #22 scorebook's
// scoreboard strip. `revealTotals` (linescore.js) is the one place that reads
// liveData.linescore.teams[side] — also used by the printable scorecard — so
// this module doesn't keep its own second copy of that read.
function teamLine(feed, side) {
  const t = revealTotals(feed, side) ?? {}
  return {
    r: t.runs ?? 0,
    h: t.hits ?? 0,
    e: t.errors ?? 0,
    lob: t.leftOnBase ?? 0,
  }
}

// Runs by inning for the scoreboard strip — one entry per inning played,
// including extras (the full box score is a complete reveal, so there's no
// extras-spoiler concern here the way there is in the innings navigator).
// Built on `revealInning` (linescore.js) — the same per-half reader
// RollingLine/StatBox use — rather than a second walk of
// liveData.linescore.innings[]. A half the team never batted (a won-at-home
// bottom of the last inning) has no linescore entry at all, so revealInning
// returns null and this shows 'X' the way a printed line score does.
function scoreboardInnings(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  return innings.map((i) => ({
    num: i.num,
    away: revealInning(feed, i.num, 'away')?.runs ?? 'X',
    home: revealInning(feed, i.num, 'home')?.runs ?? 'X',
  }))
}

// First-pitch, time-of-game, delay, and game-end clock times for the scorebook
// header. The feed gives the actual first pitch ("3:06 PM.") and, in the "T"
// row, the elapsed PLAYING time — which excludes stoppages: "2:23 (2:44 delay)"
// is 2:23 of ball with a separate 2:44 rain delay. So the wall-clock end is NOT
// first pitch + T; it's first pitch + playing + delay. We take the end straight
// from the last play's own timestamp (delays and all) read in the park's zone,
// which is right no matter when or how many delays fell, and surface the delay
// as its own field. Times are tagged with the venue zone (EDT, PDT…) after the
// AM/PM the way the scorebook's time fields want.
function cleanClock(value) {
  const m = (value ?? '').match(/(\d{1,2}:\d{2})\s*(AM|PM)/i)
  return m ? `${m[1]} ${m[2].toUpperCase()}` : ''
}

// Minutes in the first "H:MM" of a string ("2:23 (2:44 delay)." -> 143), or null.
function parseClockMinutes(str) {
  const m = (str ?? '').match(/(\d{1,2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

// Minutes -> "2 HRS 44 MINS" — the scorebook fill-in box spells out the units
// rather than using the feed's bare clock-style reading. '' for null.
function spellMinutes(min) {
  return min == null ? '' : `${Math.floor(min / 60)} HRS ${min % 60} MINS`
}

// Add whole minutes to a "7:16 PM" clock, rolling past midnight. Fallback for a
// lean feed with no play timestamps to read the true end from. '' if unparsable.
function addMinutes(clock, minutes) {
  const c = (clock ?? '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!c || minutes == null) return ''
  let h = Number(c[1]) % 12
  if (/PM/i.test(c[3])) h += 12
  const total = (((h * 60 + Number(c[2]) + minutes) % 1440) + 1440) % 1440
  const hh = Math.floor(total / 60)
  const mm = total % 60
  const ap = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`
}

// An ISO timestamp as a "12:23 AM" clock in the given IANA zone. '' if either
// is missing/unparsable — callers fall back to the arithmetic end.
function clockInZone(iso, tzId) {
  if (!iso || !tzId) return ''
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  try {
    return t.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tzId,
    })
  } catch {
    return ''
  }
}

function gameTimes(feed) {
  const info = feed?.liveData?.boxscore?.info ?? []
  const gi = feed?.gameData?.gameInfo ?? {}
  const tzInfo = feed?.gameData?.venue?.timeZone ?? {}
  const tz = tzInfo.tz ?? ''
  const withTz = (t) => (t && tz ? `${t} ${tz}` : t)

  const first = cleanClock(info.find((r) => r.label === 'First pitch')?.value)
  const durRaw = info.find((r) => r.label === 'T')?.value ?? ''

  // Playing time (excludes stoppages): the numeric gameInfo field when present,
  // else the leading H:MM of the T string.
  const playMin = Number.isFinite(gi.gameDurationMinutes)
    ? gi.gameDurationMinutes
    : parseClockMinutes(durRaw)

  // Total delay. Prefer the numeric gameInfo field; else parse the
  // "(H:MM delay)" the T string carries when there was one. None -> 0.
  const delayNote = (durRaw.match(/\(([^)]*)\)/) ?? [])[1] ?? ''
  const delayMin = Number.isFinite(gi.delayDurationMinutes)
    ? gi.delayDurationMinutes
    : (/delay/i.test(delayNote) ? parseClockMinutes(delayNote) : null) ?? 0

  // The authoritative end is the last play's own timestamp — it already
  // includes every delay — read in the park's zone. Fall back to first pitch +
  // playing + delay when a lean feed carries no play timestamps.
  const lastEndIso = feed?.liveData?.plays?.allPlays?.at(-1)?.about?.endTime
  const end =
    clockInZone(lastEndIso, tzInfo.id) ||
    (playMin != null ? addMinutes(first, playMin + delayMin) : '')

  return {
    firstPitch: withTz(first),
    end: withTz(end),
    duration: spellMinutes(playMin),
    delay: delayMin > 0 ? spellMinutes(delayMin) : '',
  }
}

// The umpire assignments the scorebook lists in its header — HP/1B/2B/3B
// always, plus LF/RF on the six-man All-Star/postseason crews (see
// selectOfficials in select.js). The feed carries them as one run-together
// "Umpires" info string ("HP: Name. 1B: Name. 2B: Name. 3B: Name."); split it
// back into slots. Each name runs until the NEXT assignment label (or the
// end), not until the first period — "Quinn Wolcott Jr." must not truncate at
// the "Jr." dot.
function parseUmpires(value) {
  if (!value) return null
  const grab = (key) => {
    const m = value.match(
      new RegExp(`${key}:\\s*(.+?)\\s*(?=(?:HP|1B|2B|3B|LF|RF):|\\.?\\s*$)`),
    )
    return m ? m[1].replace(/\.$/, '').trim() : ''
  }
  const u = {
    hp: grab('HP'),
    first: grab('1B'),
    second: grab('2B'),
    third: grab('3B'),
    left: grab('LF'),
    right: grab('RF'),
  }
  return u.hp || u.first || u.second || u.third || u.left || u.right ? u : null
}

// Info-block rows already shown structured elsewhere in the box score (the
// fill-in boxes' Umpires/Weather/Venue/Attendance/First-Pitch/duration
// fields) — dropped from the shared foot rather than repeated verbatim. Wind
// belongs here too: it's folded into the weather box we compute ourselves
// (see src/api/weather.js), so the feed's raw Wind row is redundant.
const DEDUPED_INFO_LABELS = new Set([
  'Umpires',
  'Weather',
  'Wind',
  'First pitch',
  'T',
  'Att',
  'Venue',
])

// Rows shaped "Name stat; Name stat…" — one entry per pitcher.
const STAT_SPLIT_LABELS = new Set([
  'Pitches-strikes',
  'Groundouts-flyouts',
  'Batters faced',
  'Inherited runners-scored',
])

// Rows shaped "Name (detail); Name (detail)…" or bare "Name; Name…" — no
// trailing numeric stat, just a name and an optional parenthetical (an
// outcome, a role, or a "by Pitcher" attribution).
const NAME_SPLIT_LABELS = new Set([
  'Balk',
  'WP',
  'IBB',
  'HBP',
  'ABS Challenge',
  'Pitch timer violations',
])

// Every player in the game, keyed by the exact `boxscoreName` string the feed
// also uses inside the info-block text (MLB disambiguates same-surname
// players game-wide, e.g. "Contreras, Wm", so this lookup can't collide
// across the two teams).
function nameTeamMap(feed) {
  const map = new Map()
  const gdPlayers = feed?.gameData?.players ?? {}
  for (const side of ['away', 'home']) {
    const boxPlayers = feed?.liveData?.boxscore?.teams?.[side]?.players ?? {}
    for (const key of Object.keys(boxPlayers)) {
      const name = gdPlayers[key]?.boxscoreName
      if (name) map.set(name, side)
    }
  }
  return map
}

function splitEntries(value) {
  return (value ?? '')
    .split(';')
    .map((s) => s.trim().replace(/\.\s*$/, '').trim())
    .filter(Boolean)
}

// "Holmes, C 90-57" -> { name: 'Holmes, C', stat: '90-57' }
function splitNameStat(entry) {
  const m = entry.match(/^(.+?)\s+(\d[\d-]*)$/)
  return m ? { name: m[1].trim(), stat: m[2] } : { name: entry, stat: '' }
}

// "Soto, J (by Soriano, G)" -> { name: 'Soto, J', count: '', detail: 'by Soriano, G' }
// "Jackson, A 4 (Ball-Confirmed, …)" -> { name: 'Jackson, A', count: '4', detail: '…' } —
// an ABS Challenge row tallies a repeat challenger as "Name N (result; result…)"; the
// count must be split off before matching, or a player who challenged more than once
// fails the roster-name lookup below and falls into the unattributed `shared` bucket
// instead of his own team's (regardless of which side he's on — this isn't a
// home/away-specific bug, just any name this pattern applies to). Kept separate from
// `name` so the caller can still show the count in the rendered text.
function splitNameDetail(entry) {
  const m = entry.match(/^(.+?)(?:\s+(\d+))?\s*\(([^)]*)\)$/)
  return m
    ? { name: m[1].trim(), count: m[2] ?? '', detail: m[3].trim() }
    : { name: entry, count: '', detail: '' }
}

// Splits the info block's per-pitcher/per-player rows onto the team of the
// player named — the pitcher in a "(by X)" attribution (HBP, IBB), else the
// leading name (Balk, WP, Pitches-strikes…). Anything that can't be matched
// to a roster name is kept, under its original label, in `shared` rather than
// dropped or guessed onto the wrong side.
function splitGameNotes(feed) {
  const info = feed?.liveData?.boxscore?.info ?? []
  const teamOf = nameTeamMap(feed)
  const bucket = { away: [], home: [], shared: [] }

  for (const row of info) {
    if (!row.label || row.value == null) continue
    if (DEDUPED_INFO_LABELS.has(row.label)) continue

    const isStat = STAT_SPLIT_LABELS.has(row.label)
    if (!isStat && !NAME_SPLIT_LABELS.has(row.label)) {
      bucket.shared.push(row)
      continue
    }

    const bySide = { away: [], home: [], other: [] }
    for (const entry of splitEntries(row.value)) {
      let name, text, side
      if (isStat) {
        const parsed = splitNameStat(entry)
        name = parsed.name
        text = parsed.stat ? `${parsed.name} ${parsed.stat}` : parsed.name
      } else {
        const parsed = splitNameDetail(entry)
        const byMatch = parsed.detail.match(/^by\s+(.+)$/i)
        name = byMatch ? byMatch[1].trim() : parsed.name
        const nameWithCount = parsed.count ? `${parsed.name} ${parsed.count}` : parsed.name
        text = parsed.detail ? `${nameWithCount} (${parsed.detail})` : nameWithCount
      }
      side = teamOf.get(name)
      ;(bySide[side] ?? bySide.other).push(text)
    }
    for (const side of ['away', 'home']) {
      if (bySide[side].length) {
        bucket[side].push({ label: row.label, value: `${bySide[side].join('; ')}.` })
      }
    }
    if (bySide.other.length) {
      bucket.shared.push({ label: row.label, value: `${bySide.other.join('; ')}.` })
    }
  }

  return bucket
}

// The BATTING / BASERUNNING / FIELDING note groups a printed box score carries
// under each team (HR detail, 2-out RBI, SB, DP, Team LOB…).
function teamNoteGroups(feed, side) {
  const groups = feed?.liveData?.boxscore?.teams?.[side]?.info ?? []
  return groups
    .map((g) => ({
      title: g.title ?? '',
      rows: (g.fieldList ?? []).filter((r) => r.label || r.value),
    }))
    .filter((g) => g.rows.length)
}

// Per-team footnotes ("a-Homered for Ibáñez in the 6th.") keyed by the marker
// shown next to a substitute's name.
function footnotes(feed, side) {
  return (feed?.liveData?.boxscore?.teams?.[side]?.note ?? []).filter(
    (n) => n.label && n.value,
  )
}

function oneSide(feed, side, decisions, pitchNotes, pitcherLines) {
  const meta =
    feed?.gameData?.teams?.[side] ??
    feed?.liveData?.boxscore?.teams?.[side]?.team ??
    {}
  return {
    id: meta.id ?? null,
    teamName: meta.name ?? meta.teamName ?? (side === 'away' ? 'Away' : 'Home'),
    abbreviation: meta.abbreviation ?? '',
    batters: battingRows(feed, side),
    batTotals: battingTotals(feed, side),
    pitchers: pitchingRows(feed, side, decisions, pitcherLines),
    pitchTotals: pitchingTotals(feed, side),
    line: teamLine(feed, side),
    notes: teamNoteGroups(feed, side),
    footnotes: footnotes(feed, side),
    // This team's half of the info block's per-pitcher rows (Pitches-strikes,
    // Groundouts-flyouts, Batters faced, HBP, Balk, WP…) — see splitGameNotes.
    pitchNotes,
  }
}

// The complete box score. `gameInfo` are the label/value rows at the foot
// (Pitches-strikes, Umpires, Weather, T, Att…); `decisions` are the pitchers
// of record with their short names.
export function selectBoxscore(feed) {
  const d = feed?.liveData?.decisions ?? {}
  const decisions = {
    winId: d.winner?.id ?? null,
    lossId: d.loser?.id ?? null,
    saveId: d.save?.id ?? null,
    win: decisionName(feed, d.winner),
    loss: decisionName(feed, d.loser),
    save: decisionName(feed, d.save),
    // Season line shown in parens after the name: (W-L) for the win/loss,
    // (saves) for the closer — the standard box-score decision format.
    winRecord: recordStr(feed, d.winner?.id),
    lossRecord: recordStr(feed, d.loser?.id),
    saveRecord: savesStr(feed, d.save?.id),
  }

  const infoRows = feed?.liveData?.boxscore?.info ?? []
  // Umpires are also broken into their own HP/1B/2B/3B fill-in boxes at the top,
  // but the combined "Umpires" row stays in the full game-info foot so the text
  // box score at the bottom is complete.
  const umpires = parseUmpires(
    infoRows.find((r) => r.label === 'Umpires')?.value,
  )
  const gameInfo = infoRows.filter((r) => r.label && r.value)
  const gameNotes = splitGameNotes(feed)
  // The same per-pitcher accumulator PitchersSection reads mid-game
  // (src/api/pitchers.js), computed once here at full reveal — Infinity as
  // "the whole game", same sentinel defenseEntering uses for the box score's
  // whole-game defensive alignment — and shared by both sides' pitchingRows
  // instead of each re-deriving its own numbers from the boxscore stats.
  const pitcherLines = computePitcherLines(feed, Infinity)

  return {
    away: oneSide(feed, 'away', decisions, gameNotes.away, pitcherLines),
    home: oneSide(feed, 'home', decisions, gameNotes.home, pitcherLines),
    innings: scoreboardInnings(feed),
    decisions,
    umpires,
    times: gameTimes(feed),
    gameInfo,
    // The leftover info-block rows: whole-game fields with no team owner,
    // plus any per-pitcher entry splitGameNotes couldn't match to a roster
    // name — kept here, under their original label, so nothing is lost.
    footNotes: gameNotes.shared,
  }
}

// PLAY OF THE GAME — the single most memorable play, distinct from the three
// stars below (which rank PLAYERS by their cumulative score over the whole
// game; this ranks one PLAY). Reveal-only, same rule as computeThreeStars:
// WPA and captivatingIndex both come from the /winProbability endpoint, so
// only ever call this inside the SealBox's reveal render.
//
// Ranking (ADR-0013): each play scores |WPA| + 0.5 * captivatingIndex — the
// win-probability swing carries the game's actual story, with MLB's own
// (undocumented) `about.captivatingIndex` as a highlight-reel bonus (it isn't
// blind to plays like a bases-loaded slam in a decided game, but on its own
// it loves fireworks regardless of consequence). A play that moved the game
// TOWARD the eventual loser keeps only 40% of its score: the losing side's
// 7th-inning go-ahead shot is precisely the moment the winner then overcame,
// and it read wrong as "the play of the game" — a loser's play now wins only
// when it truly dwarfs everything the winner did. captivatingIndex is absent
// or zero at most MiLB parks; the WPA half still ranks fine there.
export function computePlayOfTheGame(winProb, feed) {
  if (!Array.isArray(winProb) || winProb.length === 0) return null
  // The eventual winner, read off the final play's running score (null when
  // tied — a live look mid-game — where no side gets the discount).
  const final = winProb[winProb.length - 1]?.result
  const awayFinal = typeof final?.awayScore === 'number' ? final.awayScore : null
  const homeFinal = typeof final?.homeScore === 'number' ? final.homeScore : null
  const homeWon =
    awayFinal != null && homeFinal != null && awayFinal !== homeFinal ? homeFinal > awayFinal : null
  let best = null
  let bestScore = -Infinity
  for (const e of winProb) {
    const h = typeof e.homeTeamWinProbabilityAdded === 'number' ? e.homeTeamWinProbabilityAdded : 0
    const captivating = e.about?.captivatingIndex ?? 0
    let score = Math.abs(h) + 0.5 * captivating
    const benefitsWinner = homeWon == null || (homeWon ? h > 0 : h < 0)
    if (!benefitsWinner) score *= 0.4
    if (score > bestScore) {
      best = e
      bestScore = score
    }
  }
  if (!best) return null
  const batterId = best.matchup?.batter?.id ?? null
  const found = batterId ? findBoxscorePlayer(feed?.liveData?.boxscore, batterId) : null
  const batterGd = found ? feed?.gameData?.players?.[`ID${batterId}`] ?? found.player.person : null
  return {
    desc: best.result?.description ?? '',
    inning: best.about?.inning ?? null,
    half: best.about?.isTopInning ? 'top' : 'bottom',
    batterId,
    batterName: batterGd ? firstLast(batterGd) : '',
    // Team + position, same lookup shape as starLine below — lets the card
    // render the batter's identity (headshot + name + team/pos) the same way
    // the three stars do.
    batterTeamAbbr: found ? feed?.gameData?.teams?.[found.side]?.abbreviation ?? '' : '',
    batterTeamId: found ? feed?.gameData?.teams?.[found.side]?.id ?? null : null,
    batterPos: found ? positionLabel(found.player) : '',
    // The running score right after this play — the box score's Play of the
    // Game card appends it as "MIL 5, STL 3" so the moment reads with its
    // consequence attached, not just the bare description.
    awayScore: typeof best.result?.awayScore === 'number' ? best.result.awayScore : null,
    homeScore: typeof best.result?.homeScore === 'number' ? best.result.homeScore : null,
    // Every runner the description names as scoring on this play ("Matt
    // Olson scores.") — same firstLast identity lookup as the batter above,
    // so a caller can link each mentioned name to its player page the same
    // way. The winProbability endpoint's play entries carry the full
    // `runners` array (same shape as a play-by-play play), not just WPA.
    runners: (best.runners ?? [])
      .filter((r) => r.details?.isScoringEvent && r.details?.runner?.id)
      .map((r) => {
        const id = r.details.runner.id
        const gd = feed?.gameData?.players?.[`ID${id}`] ?? r.details.runner
        return { id, name: firstLast(gd) }
      }),
  }
}

// THREE STARS — the game's three most valuable players, the hockey-style nod
// under the pitchers of record. Reveal-only, SAME rule as selectBoxscore: only
// ever call this inside the SealBox's reveal render. WPA is NOT in the feed —
// it comes from the separate /winProbability endpoint — so the per-play array
// is passed in; absent at most MiLB parks, so a null/empty array returns []
// and the card hides.
//
// Each player's score is his summed WPA plus his stat line's context-neutral
// points (ADR-0013 — WPA alone buried a dominant start in a blowout, where
// the win probability has nothing left to move). WPA credit: a play's WPA
// (`homeTeamWinProbabilityAdded`, in percentage points) goes to the two
// players in the box — the BATTER earns his own team's win-prob swing, the
// PITCHER the opposite. Which team bats is `about.isTopInning` (away bats the
// top). Take the three biggest scores and attach each one's game line
// (pitching if he recorded an out, otherwise batting).
export function computeThreeStars(winProb, feed) {
  if (!Array.isArray(winProb) || winProb.length === 0) return []
  const wpa = new Map()
  const add = (person, v) => {
    if (!person?.id) return
    const e = wpa.get(person.id) ?? { id: person.id, w: 0 }
    e.w += v
    wpa.set(person.id, e)
  }
  for (const e of winProb) {
    const h = e.homeTeamWinProbabilityAdded
    if (typeof h !== 'number') continue
    const top = e.about?.isTopInning
    add(e.matchup?.batter, top ? -h : h) // away (top) batter earns −h
    add(e.matchup?.pitcher, top ? h : -h)
  }
  const scored = [...wpa.values()].map((e) => {
    const stats = findBoxscorePlayer(feed?.liveData?.boxscore, e.id)?.player?.stats
    return { ...e, score: e.w + contextNeutralPoints(stats) }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((e, i) => {
      const line = starLine(feed, e.id)
      // stars: 3 for the top mover, 2 for the second, 1 for the third.
      return line ? { ...line, stars: 3 - i } : null
    })
    .filter(Boolean)
}

// Finds a player's boxscore entry by scanning both sides (the player sits on
// one team or the other) — shared by starLine here and by topPerformers.js,
// which calls this same lookup against the standalone /boxscore endpoint's
// response (same teams.{away,home}.players[...] shape as feed.liveData.boxscore).
export function findBoxscorePlayer(boxscore, id) {
  for (const side of ['away', 'home']) {
    const player = boxscore?.teams?.[side]?.players?.[`ID${id}`]
    if (player) return { side, player }
  }
  return null
}

// A player's identity fields a "baseball card" tile needs — headshot,
// team, position — resolved from his personId within one game's feed. Shared
// by the box score's own Insights card (Statcast superlatives) and
// daySuperlatives.js's day-recap tiles, so the two PerformerCard surfaces
// can't drift on how a player's team/position get resolved. Caller adds its
// own `stat` line (the two surfaces format that differently).
export function resolveCardPlayer(feed, personId) {
  if (personId == null) return null
  const found = findBoxscorePlayer(feed?.liveData?.boxscore, personId)
  if (!found) return null
  const { side, player: bp } = found
  const team = feed?.gameData?.teams?.[side]
  const gd = feed?.gameData?.players?.[`ID${personId}`]
  return {
    id: personId,
    name: bp.person?.fullName ?? gd?.fullName ?? '',
    teamId: team?.id ?? null,
    teamAbbr: team?.abbreviation ?? '',
    // A MiLB player's parent MLB org id (his own team for an MLB player) — the
    // headshot's fallback team-logo tint, matching topPerformers' resolveEntry.
    parentOrgId: bp.parentTeamId ?? team?.id ?? null,
    position: positionLabel(bp),
  }
}

// A star's identity + one-line game stat, found by scanning both boxscores.
// Pitching line if he recorded an out, else his batting line.
function starLine(feed, id) {
  const found = findBoxscorePlayer(feed?.liveData?.boxscore, id)
  if (!found) return null
  const { side, player: bp } = found
  const gd = feed?.gameData?.players?.[`ID${id}`] ?? bp.person ?? {}
  const pit = bp.stats?.pitching ?? {}
  const bat = bp.stats?.batting ?? {}
  const pitched = (pit.outs ?? 0) > 0
  return {
    id,
    name: firstLast(gd),
    teamName: feed?.gameData?.teams?.[side]?.teamName ?? '',
    teamId: feed?.gameData?.teams?.[side]?.id ?? null,
    pos: pitched ? 'P' : positionLabel(bp),
    stat: pitched ? pitchingStat(pit) : battingStat(bat),
  }
}

// "6.0 IP, 3 H, 1 ER, 7 K" — the pitcher's story in the order a line score reads.
export function pitchingStat(s) {
  return [
    `${s.inningsPitched ?? '0.0'} IP`,
    `${s.hits ?? 0} H`,
    `${s.earnedRuns ?? 0} ER`,
    `${s.strikeOuts ?? 0} K`,
  ].join(', ')
}

// "2-4, HR, 3 RBI, 2 R" — hits-for-at-bats, then extra-base hits, RBI, runs,
// steals; each count only shown when it happened (a count >1 prefixes the tag).
export function battingStat(b) {
  const n = (count, tag) =>
    count > 0 ? `${count > 1 ? `${count} ` : ''}${tag}` : ''
  const parts = [`${b.hits ?? 0}-${b.atBats ?? 0}`]
  for (const p of [n(b.homeRuns, 'HR'), n(b.triples, '3B'), n(b.doubles, '2B')]) {
    if (p) parts.push(p)
  }
  if (b.rbi > 0) parts.push(`${b.rbi} RBI`)
  if (b.runs > 0) parts.push(`${b.runs} R`)
  if (b.stolenBases > 0) parts.push(`${b.stolenBases} SB`)
  return parts.join(', ')
}

function decisionName(feed, person) {
  if (!person?.id) return ''
  const gd = feed?.gameData?.players?.[`ID${person.id}`]
  return lastFirst(gd ?? person)
}

// A decision pitcher's season pitching line — used for the "(W-L)" / "(SV)"
// the box-score foot appends after each name. The pitcher sits on one team or
// the other, so look in both.
function pitcherSeason(feed, id) {
  if (!id) return null
  for (const side of ['away', 'home']) {
    const bp = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]
    if (bp) return bp.seasonStats?.pitching ?? null
  }
  return null
}

function recordStr(feed, id) {
  const s = pitcherSeason(feed, id)
  return s ? `${s.wins ?? 0}-${s.losses ?? 0}` : ''
}

function savesStr(feed, id) {
  const s = pitcherSeason(feed, id)
  return s ? String(s.saves ?? 0) : ''
}
