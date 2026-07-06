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

// Short surname for display. Prefer the club's own boxscoreName ("Gurriel Jr.",
// "Pérez, W"); drop a trailing disambiguating initial ("Pérez, W" -> "Pérez")
// but keep real suffixes. Falls back to the last token of the full name.
function shortName(person) {
  const raw =
    person?.boxscoreName ??
    (person?.fullName ? person.fullName.split(' ').slice(-1)[0] : '')
  return raw.replace(/,\s*[A-Za-z]\.?$/, '').trim()
}

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

// The four umpire assignments (HP/1B/2B/3B) the scorebook lists in its header.
// The feed carries them as one run-together "Umpires" info string
// ("HP: Name. 1B: Name. 2B: Name. 3B: Name."); split it back into slots.
function parseUmpires(value) {
  if (!value) return null
  const grab = (key) => {
    const m = value.match(new RegExp(`${key}:\\s*([^.]+)`))
    return m ? m[1].trim() : ''
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
    gameInfo,
    dateLabel: dateRow?.label ?? '',
  }
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
