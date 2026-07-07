// Full box-score selector — the complete, MLB.com-style final line for a game:
// each team's batting order (starters with substitutes indented), the pitching
// lines, the BATTING/BASERUNNING/FIELDING notes, per-team footnotes, the
// game-info rows (WP, umpires, weather, T, Att…) and the W/L/S decisions.
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

function positionLabel(boxPlayer) {
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
        name: shortName(gd),
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
// decision (W/L/S) when it earned one.
function pitchingRows(feed, side, decisions) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  const gdPlayers = feed?.gameData?.players ?? {}
  const boxPlayers = team?.players ?? {}
  const order = team?.pitchers ?? []

  return order.map((id) => {
    const box = boxPlayers[`ID${id}`] ?? {}
    const gd = gdPlayers[`ID${id}`] ?? box.person ?? {}
    const s = box.stats?.pitching ?? {}
    let dec = ''
    if (id === decisions.winId) dec = 'W'
    else if (id === decisions.lossId) dec = 'L'
    else if (id === decisions.saveId) dec = 'S'
    return {
      id,
      name: shortName(gd),
      dec,
      // Throwing hand (R/L) and batters faced (BF) are #22-scorebook columns the
      // MLB.com box score omits; both come straight from the feed.
      hand: gd.pitchHand?.code ?? '',
      ip: s.inningsPitched ?? '0.0',
      pitches: s.numberOfPitches ?? s.pitchesThrown ?? 0,
      bf: s.battersFaced ?? 0,
      h: s.hits ?? 0,
      r: s.runs ?? 0,
      er: s.earnedRuns ?? 0,
      bb: s.baseOnBalls ?? 0,
      so: s.strikeOuts ?? 0,
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
// scoreboard strip. Pulled from the same linescore this module already gates
// behind reveal.
function teamLine(feed, side) {
  const t = feed?.liveData?.linescore?.teams?.[side] ?? {}
  return {
    r: t.runs ?? 0,
    h: t.hits ?? 0,
    e: t.errors ?? 0,
    lob: t.leftOnBase ?? 0,
  }
}

// Runs by inning for the scoreboard strip — one entry per inning played,
// including extras (the full box score is a complete reveal, so there's no
// extras-spoiler concern here the way there is in the innings navigator). A half
// the team never batted (a won-at-home bottom of the last inning) carries no
// runs number in the feed, so it shows 'X' the way a printed line score does.
function scoreboardInnings(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  const runsOf = (half) =>
    half && typeof half.runs === 'number' ? half.runs : 'X'
  return innings.map((i) => ({
    num: i.num,
    away: runsOf(i.away),
    home: runsOf(i.home),
  }))
}

// First-pitch and game-end clock times for the scorebook header. The feed gives
// the actual first pitch ("3:06 PM.") and the elapsed time of game ("2:31."); we
// derive the end by adding one to the other, and tag both with the venue's time
// zone (EDT, PDT…) after the AM/PM the way the scorebook's time fields want.
function cleanClock(value) {
  const m = (value ?? '').match(/(\d{1,2}:\d{2})\s*(AM|PM)/i)
  return m ? `${m[1]} ${m[2].toUpperCase()}` : ''
}

function addDuration(clock, dur) {
  const c = clock.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  const d = (dur ?? '').match(/(\d{1,2}):(\d{2})/)
  if (!c || !d) return ''
  let h = Number(c[1]) % 12
  if (/PM/i.test(c[3])) h += 12
  const total =
    (((h * 60 + Number(c[2]) + Number(d[1]) * 60 + Number(d[2])) % 1440) +
      1440) %
    1440
  const hh = Math.floor(total / 60)
  const mm = total % 60
  const ap = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`
}

function gameTimes(feed) {
  const info = feed?.liveData?.boxscore?.info ?? []
  const first = cleanClock(info.find((r) => r.label === 'First pitch')?.value)
  const durRaw = info.find((r) => r.label === 'T')?.value ?? ''
  const duration = (durRaw.match(/\d{1,2}:\d{2}/) ?? [''])[0]
  const end = addDuration(first, duration)
  const tz = feed?.gameData?.venue?.timeZone?.tz ?? ''
  const withTz = (t) => (t && tz ? `${t} ${tz}` : t)
  return { firstPitch: withTz(first), end: withTz(end), duration }
}

// The four umpire assignments (HP/1B/2B/3B) the scorebook lists in its header.
// The feed carries them as one run-together "Umpires" info string
// ("HP: Name. 1B: Name. 2B: Name. 3B: Name."); split it back into slots.
// Each name runs until the NEXT assignment label (or the end), not until the
// first period — "Quinn Wolcott Jr." must not truncate at the "Jr." dot.
function parseUmpires(value) {
  if (!value) return null
  const grab = (key) => {
    const m = value.match(
      new RegExp(`${key}:\\s*(.+?)\\s*(?=(?:HP|1B|2B|3B):|\\.?\\s*$)`),
    )
    return m ? m[1].replace(/\.$/, '').trim() : ''
  }
  const u = {
    hp: grab('HP'),
    first: grab('1B'),
    second: grab('2B'),
    third: grab('3B'),
  }
  return u.hp || u.first || u.second || u.third ? u : null
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

function oneSide(feed, side, decisions) {
  const meta =
    feed?.gameData?.teams?.[side] ??
    feed?.liveData?.boxscore?.teams?.[side]?.team ??
    {}
  return {
    teamName: meta.name ?? meta.teamName ?? (side === 'away' ? 'Away' : 'Home'),
    abbreviation: meta.abbreviation ?? '',
    batters: battingRows(feed, side),
    batTotals: battingTotals(feed, side),
    pitchers: pitchingRows(feed, side, decisions),
    pitchTotals: pitchingTotals(feed, side),
    line: teamLine(feed, side),
    notes: teamNoteGroups(feed, side),
    footnotes: footnotes(feed, side),
  }
}

// The complete box score. `gameInfo` are the label/value rows at the foot
// (Pitches-strikes, Umpires, Weather, T, Att…); `dateLabel` is the lone
// date row the feed appends with no value; `decisions` are the pitchers of
// record with their short names.
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
  const dateRow = infoRows.find((r) => r.label && r.value == null)

  return {
    away: oneSide(feed, 'away', decisions),
    home: oneSide(feed, 'home', decisions),
    innings: scoreboardInnings(feed),
    decisions,
    umpires,
    times: gameTimes(feed),
    gameInfo,
    dateLabel: dateRow?.label ?? '',
  }
}

// THREE STARS — the game's three most valuable players by win-probability added,
// the hockey-style nod under the pitchers of record. Reveal-only, SAME rule as
// selectBoxscore: only ever call this inside the SealBox's reveal render. WPA is
// NOT in the feed — it comes from the separate /winProbability endpoint — so the
// per-play array is passed in; absent at most MiLB parks, so a null/empty array
// returns [] and the card hides.
//
// A play's WPA (`homeTeamWinProbabilityAdded`, in percentage points) is credited
// to the two players in the box: the BATTER earns his own team's win-prob swing,
// the PITCHER the opposite. Which team bats is `about.isTopInning` (away bats the
// top). Sum per player, take the three biggest movers, and attach each one's
// game line (pitching if he recorded an out, otherwise batting).
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
  return [...wpa.values()]
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((e, i) => {
      const line = starLine(feed, e.id)
      // stars: 3 for the top mover, 2 for the second, 1 for the third.
      return line ? { ...line, stars: 3 - i } : null
    })
    .filter(Boolean)
}

// A star's identity + one-line game stat, found by scanning both boxscores (the
// player sits on one side or the other). Pitching line if he recorded an out,
// else his batting line.
function starLine(feed, id) {
  for (const side of ['away', 'home']) {
    const bp = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]
    if (!bp) continue
    const gd = feed?.gameData?.players?.[`ID${id}`] ?? bp.person ?? {}
    const pit = bp.stats?.pitching ?? {}
    const bat = bp.stats?.batting ?? {}
    const pitched = (pit.outs ?? 0) > 0
    return {
      id,
      name: shortName(gd),
      teamAbbr: feed?.gameData?.teams?.[side]?.abbreviation ?? '',
      pos: pitched ? 'P' : positionLabel(bp),
      stat: pitched ? pitchingStat(pit) : battingStat(bat),
    }
  }
  return null
}

// "6.0 IP, 3 H, 1 ER, 7 K" — the pitcher's story in the order a line score reads.
function pitchingStat(s) {
  return [
    `${s.inningsPitched ?? '0.0'} IP`,
    `${s.hits ?? 0} H`,
    `${s.earnedRuns ?? 0} ER`,
    `${s.strikeOuts ?? 0} K`,
  ].join(', ')
}

// "2-4, HR, 3 RBI, 2 R" — hits-for-at-bats, then extra-base hits, RBI, runs,
// steals; each count only shown when it happened (a count >1 prefixes the tag).
function battingStat(b) {
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
  return shortName(gd ?? person)
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
