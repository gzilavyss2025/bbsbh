// Pure, spoiler-aware shaping of the /people responses into the view model the
// player & team pages render. No fetching here (that's mlb.js) — every function
// takes raw API pieces and returns display-ready data, degrading to null/'—'
// for the fields MiLB feeds omit, per the app's "degrade, don't assume" rule.
//
// Spoiler note: these builders NEVER touch the live game feed. The player page
// fetches its own stats cut off at the day before the game date ("entering
// today"), so nothing here can leak the game being scored. The full-season
// figures that can't be date-cut by the API — the current-season register row,
// the vs-L/R splits, and the promoted other-level tiles (see
// otherLevelSeasonBlocks) — are labeled as such by the UI, not frozen; each is
// a stat at a level OTHER than the game being scored, never that game's own line.

import { SPORT_LABEL, MILB_LEVELS } from '../lib/teams.js'

const DASH = '—'

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// ".302" style rate: three decimals, no leading zero (baseball convention).
function rate3(x) {
  if (!Number.isFinite(x)) return DASH
  return x.toFixed(3).replace(/^0(?=\.)/, '')
}

// Innings pitched ("104.1" = 104 ⅓) <-> outs, so multi-stint lines sum right.
function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}
function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

// A minor-league stint's size, in the group's natural unit (games for a hitter,
// outs for a pitcher). The single knob the rehab/option classifier turns on.
function stintWork(stat, group) {
  return group === 'pitching' ? ipToOuts(stat?.inningsPitched) : num(stat?.gamesPlayed)
}

// The ceiling of a rehab-assignment window (~20 days ≈ 20 G for a position
// player, ~30 days ≈ 30 IP for a pitcher). A POST-DEBUT minor-league stint at
// or above this is too big to be rehab — a real option-down or demotion, shown
// as its own row; below it, it's rehab-or-shuttle noise that drops to a caption.
// Deliberately an ABSOLUTE cap, not "was the player MiLB-primary that year": an
// injured pitcher who threw 5 MLB innings and 14 rehab innings has MORE minor-
// league work but was never demoted (verified against Kodai Senga's 2024), so a
// relative test would wrongly promote his rehab to a demotion row.
const REHAB_CAP = { games: 20, outs: 90 }
function meetsStintCap(stat, group) {
  return stintWork(stat, group) >= (group === 'pitching' ? REHAB_CAP.outs : REHAB_CAP.games)
}

// ---------------------------------------------------------------------------
// Player identity
// ---------------------------------------------------------------------------

export function personSportId(person) {
  return person?.currentTeam?.sport?.id ?? 1
}

export function isPitcher(person) {
  const p = person?.primaryPosition
  return p?.type === 'Pitcher' || p?.code === '1'
}

// Ohtani-type: a distinct primary position ('TWP' / code 'Y' / type
// 'Two-Way Player'). Such a player gets BOTH a batting and a pitching block.
export function isTwoWay(person) {
  const p = person?.primaryPosition
  return p?.abbreviation === 'TWP' || p?.code === 'Y' || p?.type === 'Two-Way Player'
}

// Starter / closer / reliever from a season pitching stat line. Only CL-vs-not
// changes the season tiles (closer leads with SV); the roster chip shows all
// three. Heuristic, since the API has no role field: mostly-starts => SP; else
// a real save count => CL; otherwise RP (incl. swing arms like Chad Patrick,
// who by design fall here and get the W-L-led tile set). Returns null when the
// season stat has no games yet (e.g. the "entering today" cutoff lands before
// a rookie's first appearance) rather than guessing RP — a starter making his
// MLB debut has zero starts logged the moment before that first game, and
// defaulting to RP there mislabeled him as a reliever; the UI falls back to
// the primary-position abbreviation ('P') instead.
export function pitcherRole(stat) {
  if (!stat) return null
  const g = num(stat.gamesPitched ?? stat.gamesPlayed)
  if (g === 0) return null
  const gs = num(stat.gamesStarted)
  if (gs / g >= 0.5) return 'SP'
  if (num(stat.saves) >= 8) return 'CL'
  return 'RP'
}

// The signed draft, matched to the person's draftYear — NOT drafts[0], which
// can be an earlier UNSIGNED draft (Judge was a 31st-round 2010 pick out of
// high school before his 2013 first round). Undrafted / international players
// carry no draft, so this returns null and the fact box shows "—".
export function draftInfo(person) {
  const year = person?.draftYear
  const drafts = person?.drafts ?? []
  const signed =
    drafts.find((d) => String(d.year) === String(year)) ??
    (drafts.length ? drafts[drafts.length - 1] : null)
  if (!signed && !year) return null
  return {
    year: year ?? signed?.year ?? '',
    round: signed?.pickRound ?? '',
    overall: signed?.pickNumber ?? '',
    teamId: signed?.team?.id ?? null,
    teamName: signed?.team?.name ?? '',
  }
}

// First name / surname for the two-line hero treatment. A plain split on the
// first space handles suffixes and multi-word surnames correctly without
// needing the API's separate firstName/lastName fields ("Vladimir Guerrero
// Jr." -> "Vladimir" / "Guerrero Jr.", "Elly De La Cruz" -> "Elly" / "De La
// Cruz"). A one-word name (rare) renders with no first-name line.
export function splitDisplayName(fullName) {
  const s = (fullName || '').trim()
  if (!s) return { first: '', last: '' }
  const i = s.indexOf(' ')
  if (i === -1) return { first: '', last: s }
  return { first: s.slice(0, i), last: s.slice(i + 1) }
}

export function personBio(person) {
  if (!person) return null
  const born = [person.birthCity, person.birthStateProvince ?? person.birthCountry]
    .filter(Boolean)
    .join(', ')
  return {
    id: person.id,
    fullName: person.fullName ?? '',
    number: person.primaryNumber ?? '',
    posAbbr: person.primaryPosition?.abbreviation ?? '',
    posName: person.primaryPosition?.name ?? '',
    bats: person.batSide?.code ?? '',
    throws: person.pitchHand?.code ?? '',
    isPitcher: isPitcher(person),
    twoWay: isTwoWay(person),
    heightWeight:
      person.height && person.weight
        ? `${person.height} · ${person.weight}`
        : person.height || DASH,
    age: person.currentAge ?? DASH,
    born: born || DASH,
    debut: person.mlbDebutDate ?? '',
    draft: draftInfo(person),
    // `parentOrgId`/`parentOrgName` ride along on `currentTeam` for a MiLB
    // club (verified live) — the parent MLB org that team is affiliated with.
    // Absent for an MLB team, so this doubles as the "is this a MiLB player"
    // signal the hero uses to show the affiliate mark.
    team: person.currentTeam
      ? {
          id: person.currentTeam.id,
          name: person.currentTeam.name,
          parentOrgId: person.currentTeam.parentOrgId ?? null,
          parentOrgName: person.currentTeam.parentOrgName ?? '',
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Stat aggregation
// ---------------------------------------------------------------------------

// byDateRange emits duplicate rows (verified: two identical splits for a
// single-team player); a genuinely traded player would return distinct stints.
// So: dedupe identical rows, then if more than one remains, SUM counting stats
// and RECOMPUTE rates from the sums (never average rates). One row → passthrough
// (exact API values). Returns a single stat-like object, or null.
function statSig(s) {
  return [s.atBats, s.hits, s.inningsPitched, s.strikeOuts, s.gamesPlayed].join('|')
}
export function aggregateSplits(splits, group) {
  const stats = (splits ?? []).map((s) => s.stat).filter(Boolean)
  if (stats.length === 0) return null
  const seen = new Set()
  const uniq = stats.filter((s) => {
    const sig = statSig(s)
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
  if (uniq.length === 1) return uniq[0]
  const sum = (k) => uniq.reduce((t, s) => t + num(s[k]), 0)
  if (group === 'pitching') {
    const outs = uniq.reduce((t, s) => t + ipToOuts(s.inningsPitched), 0)
    const ip = outs / 3
    const er = sum('earnedRuns')
    const h = sum('hits')
    const bb = sum('baseOnBalls')
    return {
      wins: sum('wins'),
      losses: sum('losses'),
      saves: sum('saves'),
      inningsPitched: outsToIp(outs),
      strikeOuts: sum('strikeOuts'),
      baseOnBalls: bb,
      earnedRuns: er,
      gamesPlayed: sum('gamesPlayed'),
      gamesStarted: sum('gamesStarted'),
      // ERA/WHIP are 2-decimal by baseball convention ("4.27", "1.30"), matching
      // the API's own single-stint values — never rate3's three, which would make
      // a mid-season-trade season read differently from every other row.
      era: ip ? ((er * 9) / ip).toFixed(2) : DASH,
      whip: ip ? ((bb + h) / ip).toFixed(2) : DASH,
    }
  }
  const ab = sum('atBats')
  const h = sum('hits')
  const bb = sum('baseOnBalls')
  const hbp = sum('hitByPitch')
  const sf = sum('sacFlies')
  const tb = sum('totalBases')
  const obpDen = ab + bb + hbp + sf
  const obp = obpDen ? (h + bb + hbp) / obpDen : 0
  const slg = ab ? tb / ab : 0
  return {
    atBats: ab,
    hits: h,
    homeRuns: sum('homeRuns'),
    rbi: sum('rbi'),
    runs: sum('runs'),
    strikeOuts: sum('strikeOuts'),
    stolenBases: sum('stolenBases'),
    baseOnBalls: bb,
    gamesPlayed: sum('gamesPlayed'),
    avg: ab ? rate3(h / ab) : DASH,
    obp: rate3(obp),
    slg: rate3(slg),
    ops: rate3(obp + slg),
  }
}

// ---------------------------------------------------------------------------
// Season tiles — the finalized card set
// ---------------------------------------------------------------------------

function tile(k, v, tone) {
  return { k, v: v === undefined || v === null || v === '' ? DASH : String(v), tone }
}

// Batter: AVG · HR · RBI · SO · SB.
export function hitterTiles(stat) {
  if (!stat) return []
  return [
    tile('AVG', stat.avg),
    tile('HR', stat.homeRuns, 'run'),
    tile('RBI', stat.rbi),
    tile('SO', stat.strikeOuts),
    tile('SB', stat.stolenBases),
  ]
}

// Pitcher: closer => SV·IP·ERA·K·BB; everyone else (SP + swing/RP) =>
// W-L·IP·ERA·K·BB. The trailing four are shared; only the lead tile differs.
export function pitcherTiles(stat, role) {
  if (!stat) return []
  const lead =
    role === 'CL'
      ? tile('SV', stat.saves)
      : tile('W–L', `${num(stat.wins)}–${num(stat.losses)}`)
  return [
    lead,
    tile('IP', stat.inningsPitched),
    tile('ERA', stat.era),
    tile('K', stat.strikeOuts, 'run'),
    tile('BB', stat.baseOnBalls),
  ]
}

// ---------------------------------------------------------------------------
// vs-L/R splits (full season — the UI labels them so, not "entering today")
// ---------------------------------------------------------------------------

// One side (vs L or vs R) as a full stat line: the AVG/OBP/OPS slash plus HR,
// RBI, XBH, and the strikeout/walk RATES. The rates need a plate-appearance
// denominator, which the API names differently by group — `plateAppearances`
// on a hitter's line, `battersFaced` on a pitcher's opponent line (verified
// live) — so the group picks the field. A side the player never saw (faced
// only righties, say) has no stat and renders as all dashes.
function splitSide(stat, group) {
  if (!stat) {
    return { count: DASH, slash: DASH, hr: DASH, rbi: DASH, xbh: DASH, soPct: DASH, bbPct: DASH }
  }
  const pa = group === 'pitching' ? num(stat.battersFaced) : num(stat.plateAppearances)
  const pct = (x) => (pa ? `${Math.round((num(x) / pa) * 100)}%` : DASH)
  const slash = [stat.avg, stat.obp, stat.ops].map((v) => v ?? DASH).join('/')
  return {
    count: group === 'pitching' ? num(stat.battersFaced) : num(stat.atBats),
    slash,
    hr: num(stat.homeRuns),
    rbi: num(stat.rbi),
    xbh: num(stat.doubles) + num(stat.triples) + num(stat.homeRuns),
    soPct: pct(stat.strikeOuts),
    bbPct: pct(stat.baseOnBalls),
  }
}

export function splitsView(lrSplits, group) {
  const byCode = {}
  for (const s of lrSplits ?? []) {
    const code = s.split?.code
    if (code) byCode[code] = s.stat
  }
  const l = byCode.vl
  const r = byCode.vr
  if (!l && !r) return null
  return { left: splitSide(l, group), right: splitSide(r, group) }
}

// ---------------------------------------------------------------------------
// Game log — the back-of-the-card ledger, spoiler-safe by date cutoff
// ---------------------------------------------------------------------------

// Short, correct opponent label from the full name (abbreviation is blank in
// gameLog rows): the team nickname is the last word — "Tampa Bay Rays" → "Rays".
function oppLabel(opponent) {
  const name = opponent?.teamName || opponent?.name || ''
  if (!name) return DASH
  return opponent?.teamName || name.split(/\s+/).slice(-1)[0]
}

// A count-tagged token for a stat line — "HR" for one, "2 HR" for several, ''
// for none — so a line reads like a broadcast chyron ("2B, HR, 2 RBI, K").
function tag(n, label) {
  const v = num(n)
  if (!v) return null
  return v === 1 ? label : `${v} ${label}`
}

// A hitter's one-game line, TV-lower-third style: "2-4, 2B, HR, 2 RBI, K"
// (hits-for-atBats, then extra-base hits, then RBI / walks / steals / strikeouts,
// each shown only when it happened).
function hitterLine(st) {
  const parts = [`${num(st.hits)}-${num(st.atBats)}`]
  for (const t of [
    tag(st.doubles, '2B'),
    tag(st.triples, '3B'),
    tag(st.homeRuns, 'HR'),
    tag(st.rbi, 'RBI'),
    tag(st.baseOnBalls, 'BB'),
    tag(st.stolenBases, 'SB'),
    tag(st.strikeOuts, 'K'),
  ]) {
    if (t) parts.push(t)
  }
  return parts.join(', ')
}

// A pitcher's one-game line: "GS, 6.0 IP, 2 H, 1 R, 1 ER, 4 BB, 6 K" (leads
// with GS when he started; the counting stats always show, zeros included, the
// way a box-score pitching line reads).
function pitcherLine(st) {
  const parts = []
  if (num(st.gamesStarted) > 0) parts.push('GS')
  parts.push(`${st.inningsPitched ?? DASH} IP`)
  parts.push(`${num(st.hits)} H`)
  parts.push(`${num(st.runs)} R`)
  parts.push(`${num(st.earnedRuns)} ER`)
  parts.push(`${num(st.baseOnBalls)} BB`)
  parts.push(`${num(st.strikeOuts)} K`)
  return parts.join(', ')
}

// Rows are filtered to games BEFORE `cutoff` (YYYY-MM-DD) — the day the game
// being scored starts — then shown newest first. That cutoff is the whole
// spoiler defense: the log can never surface tonight's line or anything after
// it. `cutoff` null (context-free cold link) shows the most recent games. Each
// row carries a single broadcast-style stat `line` (see hitterLine/pitcherLine)
// rather than a grid of columns.
export function gameLogView(splits, group, cutoff, limit = 8, { tagLevel = false } = {}) {
  const rows = (splits ?? [])
    .filter((s) => s.date && (!cutoff || s.date < cutoff))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((s) => {
      const st = s.stat ?? {}
      const md = (s.date || '').slice(5).replace('-', '/').replace(/^0/, '')
      return {
        date: md,
        home: s.isHome,
        opp: oppLabel(s.opponent),
        gamePk: s.game?.gamePk ?? null,
        // A per-row level pill only when the log mixes levels (a rehabbing big
        // leaguer's combined MLB + MiLB log); a single-level log leaves it blank
        // so every row isn't stamped with a redundant "MLB".
        level: tagLevel ? SPORT_LABEL[s.sport?.id] ?? '' : '',
        line: group === 'pitching' ? pitcherLine(st) : hitterLine(st),
      }
    })
  if (!rows.length) return null
  return { rows }
}

// ---------------------------------------------------------------------------
// Firsts — first career instances of a handful of milestones, read off the
// debut season's game log (a hitter's "first start" needs the game's own
// boxscore rather than a gameLog field — see mlb.js's findFirstStart; a
// pitcher's first strikeout needs the game's own play-by-play for the batter
// faced — see mlb.js's findFirstStrikeoutBatter). Scoped to the debut year
// only: that's the data this page already fetches for the debut-game deep
// link, so no extra request is needed, and it covers every player who sees
// meaningful debut-year playing time. Cutoff-filtered exactly like
// gameLogView — a still-active debut season could otherwise reveal a
// not-yet-revealed game's date and outcome.
// ---------------------------------------------------------------------------

export const FIRSTS_DEFS = [
  { key: 'hit', label: 'First Hit', test: (st) => num(st.hits) > 0 },
  {
    key: 'xbh',
    label: 'First Extra-Base Hit',
    test: (st) => num(st.doubles) + num(st.triples) + num(st.homeRuns) > 0,
  },
  { key: 'hr', label: 'First Home Run', test: (st) => num(st.homeRuns) > 0 },
  { key: 'run', label: 'First Run Scored', test: (st) => num(st.runs) > 0 },
  { key: 'so', label: 'First Strikeout', test: (st) => num(st.strikeOuts) > 0 },
]

// Pitching counterpart. Every field but the strikeout victim is a direct
// gameLog stat (verified live: pitching gameLog rows carry gamesStarted,
// wins, losses, saves per game), unlike the hitter "first start" case.
// `appearance` matches unconditionally, so it always resolves to the
// earliest row — the debut game itself.
export const PITCHER_FIRSTS_DEFS = [
  { key: 'appearance', label: 'First Appearance', test: () => true },
  { key: 'start', label: 'First Start', test: (st) => num(st.gamesStarted) > 0 },
  { key: 'win', label: 'First Win', test: (st) => num(st.wins) > 0 },
  { key: 'loss', label: 'First Loss', test: (st) => num(st.losses) > 0 },
  { key: 'save', label: 'First Save', test: (st) => num(st.saves) > 0 },
  { key: 'so', label: 'First Strikeout', test: (st) => num(st.strikeOuts) > 0 },
]

// Returns { events, rowsAscending }: `events` maps each def's key to the
// earliest qualifying split (or null), `rowsAscending` is the full cutoff-safe
// debut-year log oldest-first — callers reuse it to also search for the first
// start (hitters) or the first strikeout's batter (pitchers).
export function firstsFromGameLog(splits, cutoff, defs = FIRSTS_DEFS) {
  const rowsAscending = (splits ?? [])
    .filter((s) => s.date && (!cutoff || s.date < cutoff) && s.game?.gamePk)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const events = {}
  for (const def of defs) {
    const found = rowsAscending.find((s) => def.test(s.stat ?? {}))
    events[def.key] = found
      ? { label: def.label, date: found.date, gamePk: found.game.gamePk, isHome: found.isHome }
      : null
  }
  return { events, rowsAscending }
}

// The debut season's game log alone misses any milestone a player first reached
// in a LATER season — a late-September cameo debut (Bethancourt: one 2013 game,
// only a strikeout) gets his first hit/HR/run seasons later. So use the
// per-season year-by-year splits to find the earliest SEASON each milestone
// occurred; the caller then fetches just those seasons' game logs to pin the
// exact game. A milestone the player never reached (a reliever's save, a slap
// hitter's home run) maps to null and costs no fetch. Capped at `throughYear`
// (the as-of / current season) so a scoped past view never reaches past it;
// the same-season game-log date filter in firstsFromGameLog still trims within
// the boundary season. Same monotonic `stat > 0` tests as the game-log defs, so
// a season aggregate that passes is exactly a season where the milestone
// happened. Returns the sorted, de-duplicated set of seasons to fetch.
export function firstMilestoneSeasons(ybySplits, defs, throughYear) {
  const seasons = new Set()
  for (const def of defs) {
    let earliest = null
    for (const s of ybySplits ?? []) {
      const yr = Number(s.season)
      if (!Number.isFinite(yr) || (throughYear && yr > throughYear)) continue
      if (def.test(s.stat ?? {}) && (earliest === null || yr < earliest)) earliest = yr
    }
    if (earliest !== null) seasons.add(earliest)
  }
  return [...seasons].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Pitch arsenal — the unique pitch types a pitcher throws and their average
// velocity, from stats=pitchArsenal, ordered by usage. Statcast-derived, so
// absent at parks without pitch tracking (most AA/High-A, some Single-A) —
// degrades to null and the UI hides the section, per "degrade, don't assume".
// ---------------------------------------------------------------------------

export function arsenalView(splits) {
  const rows = (splits ?? [])
    .map((s) => s.stat)
    .filter((st) => st?.type?.code)
    .map((st) => {
      const velo = Number(st.averageSpeed)
      const usage = Number(st.percentage)
      return {
        code: st.type.code,
        name: st.type.description || st.type.code,
        velo: Number.isFinite(velo) && velo > 0 ? velo : null,
        usage: Number.isFinite(usage) ? usage : null,
      }
    })
    .sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
  return rows.length ? rows : null
}

// ---------------------------------------------------------------------------
// Career register support — the shared per-row cells and the season/level
// aggregation the register builds on (see careerRegisterView below).
// ---------------------------------------------------------------------------

// One season / career / level row's cells, in the group's register columns. A
// pitching row leads its counting stats with G/GS, then the role stat (SV for a
// closer, W–L otherwise — mirroring the season tiles), and closes with the rate
// pair K/BB and WHIP. The narrower secondary columns (GS, K, BB) drop out on a
// phone (see CareerRegister's hideNarrow), so the essentials stay legible there.
function yearByYearCells(st, group, role) {
  if (group === 'pitching') {
    const lead = role === 'CL' ? num(st.saves) : `${num(st.wins)}–${num(st.losses)}`
    return [
      num(st.gamesPlayed),
      num(st.gamesStarted),
      lead,
      st.era ?? DASH,
      st.inningsPitched ?? DASH,
      num(st.strikeOuts),
      num(st.baseOnBalls),
      st.whip ?? DASH,
    ]
  }
  return [num(st.gamesPlayed), num(st.atBats), num(st.homeRuns), num(st.rbi), st.avg ?? DASH, st.ops ?? DASH]
}

// A season's yearByYear splits at one level can include a synthetic,
// team-less aggregate row alongside the per-team rows when a same-level trade
// happened mid-season (verified live: Soto's 2022 trade returned Nationals +
// Padres + a third team-less row equal to their sum). Summing every row
// double-counts that season, so: prefer summing the per-team rows, and only
// fall back to the lone aggregate row when no team-tagged row exists.
function levelSeasonStat(rows, group) {
  const teamRows = (rows ?? []).filter((s) => s.team?.id)
  return aggregateSplits(teamRows.length ? teamRows : rows, group)
}

// Display order for a season's per-level sub-rows: MLB first (for the rare
// debuted-mid-multi-level case), then AAA down to Rookie.
const LEVEL_ORDER_DESC = [1, 11, 12, 13, 14, 16]

// Career order, LOW level to high — Rookie ball up through MLB — so a career
// timeline reads left-to-right as a climb, and a mid-season promotion within
// one year sorts up the ladder.
const CAREER_ORDER = [16, 14, 13, 12, 11, 1]

// ---------------------------------------------------------------------------
// Career register — the unified MLB + MiLB stat table (replaces the separate
// MLB year-by-year and minor-league tables). One row per (season, level),
// newest season first, MLB rows inked and MiLB rows penciled with a level pill.
//
// A DEBUTED player's pre-debut minor-league seasons (and the debut year's own
// pre-call-up stint) fold into ONE collapsed "climb" row — his backstory —
// while a post-debut minor-league stint is a real row only when it clears the
// rehab cap (meetsStintCap); a smaller stint drops to a neutral caption so a
// handful of rehab at-bats doesn't clutter the ledger. A PRE-DEBUT player has
// no debut to fold toward, so every level is a real row (his whole career),
// with a MiLB-only total and no caption.
//
// Totals never blend levels: a separate MLB and MiLB footer, each footing only
// the rows shown (captioned stints stay out of both the rows AND the totals, so
// the MiLB column actually sums to its total). The MLB total uses the API's own
// career line when supplied (authoritative), the MiLB total sums the shown rows.
// ---------------------------------------------------------------------------

function stintLabel(st, group) {
  const w = group === 'pitching' ? `${st.stat?.inningsPitched ?? DASH} IP` : `${num(st.stat?.gamesPlayed)} G`
  return `${w} at ${SPORT_LABEL[st.sid] ?? ''} (${st.year})`
}

// The neutral one-line caption for the small post-debut stints kept out of the
// ledger: the most recent few spelled out, the rest summarized as a count + a
// two-digit year range. Deliberately says "at AAA", never "rehab" — the
// workload can't prove intent (a shuttle option and an injury rehab look
// identical here), so the caption states what happened, not why.
function stintCaption(stints, group, shown = 3) {
  if (!stints.length) return null
  const head = stints.slice(0, shown).map((s) => stintLabel(s, group))
  let text = `Also: ${head.join(' · ')}`
  const rest = stints.slice(shown)
  if (rest.length) {
    const yrs = rest.map((s) => s.year)
    const a = Math.min(...yrs), b = Math.max(...yrs)
    const range = a === b ? `’${String(a).slice(2)}` : `’${String(a).slice(2)}–’${String(b).slice(2)}`
    text += ` · +${rest.length} more, ${range}`
  }
  return text
}

export function careerRegisterView({ mlbSplits, milbSplits, group, role, debutYear, currentStat, currentSeason, currentSportId, careerStat }) {
  // Group every split (MLB + all MiLB levels) into season -> sportId -> rows.
  const bySeason = new Map()
  for (const s of [...(mlbSplits ?? []), ...(milbSplits ?? [])]) {
    const yr = Number(s.season)
    const sid = s.sport?.id
    if (!yr || !sid) continue
    if (!bySeason.has(yr)) bySeason.set(yr, new Map())
    const byLevel = bySeason.get(yr)
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  const cur = Number(currentSeason)
  // Guarantee a stint for the current season at the player's current level even
  // if the year-by-year fetch hasn't caught up — its row uses the date-cut
  // currentStat, so it can't move mid-game (the spoiler defense).
  if (currentStat && currentSportId) {
    if (!bySeason.has(cur)) bySeason.set(cur, new Map())
    if (!bySeason.get(cur).has(currentSportId)) bySeason.get(cur).set(currentSportId, [])
  }
  // One stint per (season, level): the current level's current season uses the
  // date-cut aggregate; every other stint is the deduped per-team sum
  // (levelSeasonStat drops the synthetic team-less row a mid-season trade emits).
  const stints = []
  for (const [yr, byLevel] of bySeason) {
    for (const [sid, rows] of byLevel) {
      const isCurLevel = yr === cur && sid === currentSportId && currentStat
      const stat = isCurLevel ? currentStat : levelSeasonStat(rows, group)
      if (!stat) continue
      stints.push({
        year: yr,
        sid,
        tier: sid === 1 ? 'mlb' : 'milb',
        stat,
        teamIds: [...new Set(rows.map((r) => r.team?.id).filter(Boolean))],
      })
    }
  }
  if (!stints.length) return null

  // Classify. MLB is always a full row. A minor-league stint in the ascent
  // (pre-debut, or the debut year itself) folds into the climb; a post-debut
  // stint is a full row only when it clears the rehab cap, else a caption.
  const real = []
  const climbing = []
  const foot = []
  for (const st of stints) {
    if (st.tier === 'mlb') { real.push(st); continue }
    if (!debutYear || st.year <= debutYear) { climbing.push(st); continue }
    if (meetsStintCap(st.stat, group)) real.push(st)
    else foot.push(st)
  }
  // A pre-debut player has no debut to fold toward: his climb IS his career, so
  // every level stays a full row and nothing is captioned.
  if (!debutYear) { real.push(...climbing); climbing.length = 0 }

  const bySeasonOrder = (a, b) => b.year - a.year || LEVEL_ORDER_DESC.indexOf(a.sid) - LEVEL_ORDER_DESC.indexOf(b.sid)
  real.sort(bySeasonOrder)
  foot.sort(bySeasonOrder)

  const rows = real.map((st) => ({
    key: `${st.year}-${st.sid}`,
    year: String(st.year),
    tier: st.tier,
    level: SPORT_LABEL[st.sid] ?? '',
    sportId: st.sid,
    pill: st.tier === 'milb' ? SPORT_LABEL[st.sid] ?? '' : '',
    teamIds: st.teamIds,
    cells: yearByYearCells(st.stat ?? {}, group, role),
  }))

  // The collapsed climb (debuted players only): one aggregate row plus the
  // per-season sub-rows it expands to, oldest folded away as backstory.
  let climb = null
  if (climbing.length) {
    const climbStat = aggregateSplits(climbing.map((s) => ({ stat: s.stat })), group)
    const years = climbing.map((s) => s.year)
    const minY = Math.min(...years)
    const maxY = Math.max(...years)
    climb = {
      key: 'climb',
      yearText: minY === maxY ? `${minY}` : `${minY}–${String(maxY).slice(2)}`,
      teamIds: [...new Set(climbing.flatMap((s) => s.teamIds))],
      cells: yearByYearCells(climbStat ?? {}, group, role),
      subSeasons: [...climbing].sort(bySeasonOrder).map((s) => ({
        key: `${s.year}-${s.sid}`,
        year: String(s.year),
        level: SPORT_LABEL[s.sid] ?? '',
        teamIds: s.teamIds,
        cells: yearByYearCells(s.stat ?? {}, group, role),
      })),
    }
  }

  // Split totals — never blend levels. MLB uses the API career line when we have
  // it; MiLB sums the rows actually shown (climb + real demotions).
  const totals = []
  const mlbStints = real.filter((s) => s.tier === 'mlb')
  const milbVisible = [...real.filter((s) => s.tier === 'milb'), ...climbing]
  if (mlbStints.length) {
    totals.push({
      label: 'MLB',
      tier: 'mlb',
      cells: yearByYearCells(careerStat ?? aggregateSplits(mlbStints.map((s) => ({ stat: s.stat })), group) ?? {}, group, role),
    })
  }
  if (milbVisible.length) {
    totals.push({
      label: 'MiLB',
      tier: 'milb',
      cells: yearByYearCells(aggregateSplits(milbVisible.map((s) => ({ stat: s.stat })), group) ?? {}, group, role),
    })
  }

  const columns = group === 'pitching'
    ? ['G', 'GS', role === 'CL' ? 'SV' : 'W–L', 'ERA', 'IP', 'K', 'BB', 'WHIP']
    : ['G', 'AB', 'HR', 'RBI', 'AVG', 'OPS']
  return { columns, rows, climb, totals, footnote: stintCaption(foot, group) }
}

// A one-line "converted to pitcher" note for a debuted pitcher who has a real
// position-player past in the minors that his (pitching-only) register can't
// show — Kenley Jansen caught for four years before he ever took the mound.
// Fed the player's minor-league HITTING year-by-year; returns null unless the
// pre-debut hitting workload is big enough to be a genuine career (a normal
// pitcher's few token minor-league at-bats fall well short of the threshold).
export function positionPlayerPastNote(hittingMilbSplits, debutYear) {
  const bySL = new Map()
  for (const s of hittingMilbSplits ?? []) {
    const yr = Number(s.season)
    const sid = s.sport?.id
    if (!yr || !sid) continue
    if (debutYear && yr > debutYear) continue
    const key = `${yr}-${sid}`
    if (!bySL.has(key)) bySL.set(key, { yr, rows: [] })
    bySL.get(key).rows.push(s)
  }
  let games = 0
  const years = []
  for (const { yr, rows } of bySL.values()) {
    games += num(levelSeasonStat(rows, 'hitting')?.gamesPlayed)
    years.push(yr)
  }
  if (games < 150) return null
  const a = Math.min(...years)
  const b = Math.max(...years)
  const span = a === b ? `${a}` : `${a}–${String(b).slice(2)}`
  return `Converted to pitcher — ${games} G as a position player in the minors (${span}).`
}

// ---------------------------------------------------------------------------
// Level progression — for a pre-debut MiLB player, one row per level from
// wherever his career actually started up through AAA (a rung above his
// current level still renders dimmed, to complete the "climb to MLB"
// narrative — but rungs below his starting level are dropped outright: a
// player who debuted at A, say, is never going back to Rookie ball) built
// from the same multi-level yearByYear splits already fetched for the nested
// ledger above — no extra request.
// ---------------------------------------------------------------------------

export function levelProgressionView(splits, group, currentSportId) {
  const byLevel = new Map()
  for (const s of splits ?? []) {
    const sid = s.sport?.id
    if (!sid) continue
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  const levels = MILB_LEVELS.map(({ sportId, label }) => {
    const rows = byLevel.get(sportId) ?? []
    const stat = levelSeasonStat(rows, group)
    const years = rows.map((s) => Number(s.season)).filter(Boolean)
    return {
      sportId,
      label,
      reached: rows.length > 0,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      stat:
        group === 'pitching'
          ? `${stat?.inningsPitched ?? DASH} IP`
          : `${num(stat?.atBats)} AB`,
      isCurrent: sportId === currentSportId,
    }
  })
  const startIndex = levels.findIndex((l) => l.reached)
  if (startIndex === -1) return null
  return { levels: levels.slice(startIndex) }
}

// Rehab-assignment noise. Once a player has reached the majors, any later
// minor-league stint is a rehab appointment (or a brief option down), not part
// of his climb — an established MLB regular like Christian Yelich logging a
// handful of AA at-bats years after his debut would otherwise light up a level
// on the "Path to the Majors" card and add a stray row to the minor-league
// table. Keep only MiLB seasons up to and including the debut year (the
// ascent); drop everything after it. A pre-debut player has no debutYear, so
// nothing is dropped.
export function dropRehabStints(splits, debutYear) {
  if (!debutYear) return splits ?? []
  return (splits ?? []).filter((s) => Number(s.season) <= debutYear)
}

// ---------------------------------------------------------------------------
// Career timeline — the chronological team-by-team map shown above the "Path to
// the Majors" card: one stop per CONTINUOUS stint with a club the player logged
// REAL time with, earliest first, with the year(s) that stint spanned. A club
// left and later rejoined gets a fresh stop each visit (see the stint fold
// below), so the run reads in true career order. "Real time" is a threshold (10
// games as a batter, 20 IP for a pitcher) applied per team-season to MINOR-
// league stints only — any MLB appearance always counts (even one AB / a third
// of an inning) — so a MiLB cup of coffee or a pre-debut rehab stint drops out
// but no big-league club ever does. A team is a single level, so
// this also decides the level example: Yelich's 2013 keeps AA (49 G) but not
// his 7 G at A+ or 5 G in the complex league. A post-debut MiLB season needs
// more (see qualifies): it survives only when the minors were the primary home
// that year, so a big leaguer's short rehab or option down doesn't append a
// misleading season to his old farm club. Fed the player's full year-by-year
// splits (MLB + every MiLB level) plus his debutYear; each stop's tint and
// hover label (its parent org, for a farm club) are resolved separately by the
// caller, since this stays a pure shaper.
// ---------------------------------------------------------------------------

// Consecutive seasons collapse to a range with a two-digit tail ("2018–21"),
// gaps split into a comma list ("2018, 2020"). Input already sorted ascending.
function formatSeasonRuns(seasons) {
  const runs = []
  for (const y of seasons) {
    const last = runs[runs.length - 1]
    if (last && y === last.end + 1) last.end = y
    else runs.push({ start: y, end: y })
  }
  return runs
    .map((r) => (r.start === r.end ? `${r.start}` : `${r.start}–${String(r.end).slice(2)}`))
    .join(', ')
}

export function careerTimelineView(splits, group, debutYear) {
  // Sum the workload per team-season (a mid-season same-level trade can split
  // one club's year across rows; a team-less synthetic aggregate row carries no
  // team.id and is skipped by the guard, so it can't double-count). Also tally
  // MLB workload per season so the post-debut rehab test below can compare.
  const byKey = new Map()
  for (const s of splits ?? []) {
    const season = Number(s.season)
    const teamId = s.team?.id
    const sportId = s.sport?.id
    if (!season || !teamId || !sportId) continue
    const games = num(s.stat?.gamesPlayed)
    const outs = ipToOuts(s.stat?.inningsPitched)
    const key = `${season}|${teamId}`
    if (!byKey.has(key)) {
      byKey.set(key, { season, teamId, sportId, teamName: s.team?.name ?? '', games: 0, outs: 0 })
    }
    const acc = byKey.get(key)
    acc.games += games
    acc.outs += outs
  }
  const work = (a) => (group === 'pitching' ? a.outs : a.games)
  const minWork = group === 'pitching' ? 60 : 10
  const capWork = group === 'pitching' ? REHAB_CAP.outs : REHAB_CAP.games
  const qualifies = (a) => {
    // Any MLB action at all is real team history — even a single AB or a third
    // of an inning puts that club on the map. The cup-of-coffee floor and the
    // rehab test below apply to the MINORS only; a well-traveled reliever's
    // sub-20-IP major-league stints must never be filtered (that left JP
    // Feyereisen with only the Rays — his one 20+ IP club — of the several MLB
    // teams he pitched for).
    if (a.sportId === 1) return a.games >= 1 || a.outs >= 1
    // Below the cup-of-coffee threshold (10 G / 20 IP) a MiLB stint never counts.
    if (work(a) < minWork) return false
    // A MiLB stint AFTER the debut year is rehab-assignment noise (or a brief
    // option down), NOT real team history — an established regular's stray AAA
    // games would otherwise append a misleading season to his old farm club.
    // Keep such a season only when it clears the rehab cap (a real option-down
    // or demotion) — the SAME absolute test the career register uses, so the
    // timeline and the table always agree on which post-debut stints are real.
    // The ascent (seasons up to and including the debut year) is always kept.
    if (debutYear && a.season > debutYear && work(a) < capWork) return false
    return true
  }
  const kept = [...byKey.values()].filter(qualifies)
  if (!kept.length) return null

  // Walk the qualifying team-seasons in chronological order — earliest year
  // first, and within a year lower level first so a same-year climb reads
  // bottom-up — and fold each run of consecutive same-club seasons into ONE
  // stint. A club the player leaves and later rejoins (Gary Sánchez's Brewers
  // in 2024, then again in 2026 after a year with Baltimore) yields a separate
  // stint each time, so its logo repeats in its own chronological slot rather
  // than collapsing the two visits into one badge.
  kept.sort(
    (a, b) =>
      a.season - b.season ||
      CAREER_ORDER.indexOf(a.sportId) - CAREER_ORDER.indexOf(b.sportId),
  )
  const stints = []
  for (const a of kept) {
    const open = stints[stints.length - 1]
    if (open && open.teamId === a.teamId) open.seasons.push(a.season)
    else stints.push({ teamId: a.teamId, sportId: a.sportId, teamName: a.teamName, seasons: [a.season] })
  }
  const entries = stints.map((t) => {
    const seasons = [...new Set(t.seasons)].sort((x, y) => x - y)
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      sportId: t.sportId,
      level: SPORT_LABEL[t.sportId] ?? '',
      minSeason: seasons[0],
      yearText: formatSeasonRuns(seasons),
    }
  })
  return { entries }
}

// ---------------------------------------------------------------------------
// Transaction timeline — the career roster-move ledger at the foot of the
// player page. The raw /transactions feed is verbose and duplicative (a single
// IL stint emits 3-4 near-identical "Status Change" rows; the #42/#21
// ceremonial number swaps repeat every April and September), so this CURATES it
// down to the moves that tell a career story and drops the administrative noise:
//
//   • KEEP by type (TXN_TYPES whitelist): trades, signings (FA / int'l /
//     amateur), the draft & Rule 5, contract selections & purchases, recalls &
//     options, waivers & claims, DFAs & releases, retirements, suspensions.
//   • KEEP an "Assigned" (ASG) row ONLY when it moves the player BETWEEN two
//     clubs (both fromTeam + toTeam) and isn't a rehab — that isolates genuine
//     affiliate-to-affiliate promotions/demotions (a prospect's climb up the
//     farm) while dropping rehab stints, spring-training invites, and All-Star /
//     winter-ball / national-team call-ups (which all lack a fromTeam).
//   • DROP everything else: Status Change (IL / roster / paternity), number
//     changes, arbitration filings, and the rest.
//
// Then dedupe exact repeats (same type + date + teams) and sort NEWEST-first,
// so the strip reads top-to-bottom as most-recent to least-recent. Synthetic
// award and draft rows (which aren't in the raw feed) are merged in by the
// caller-supplied enrichment before the sort. Degrades to null when nothing
// survives.
// ---------------------------------------------------------------------------

// typeCode -> { label (short chip text), tone }. `tone` drives the chip/node
// color: 'add' a club gained him, 'out' a club lost him, 'move' a lateral or
// administrative move. ASG (an affiliate transfer) is handled separately below.
const TXN_TYPES = {
  TR:  { label: 'Trade',        tone: 'move' },
  SFA: { label: 'Signed',       tone: 'add' },
  SGN: { label: 'Signed',       tone: 'add' },
  IFA: { label: 'Signed',       tone: 'add' },
  DR:  { label: 'Drafted',      tone: 'add' },
  R5:  { label: 'Rule 5',       tone: 'add' },
  R5M: { label: 'Rule 5',       tone: 'add' },
  SE:  { label: 'Selected',     tone: 'add' },
  CU:  { label: 'Recalled',     tone: 'add' },
  PUR: { label: 'Purchased',    tone: 'add' },
  CP:  { label: 'Purchased',    tone: 'add' },
  CLW: { label: 'Claimed',      tone: 'add' },
  ACQ: { label: 'Acquired',     tone: 'add' },
  OBT: { label: 'Acquired',     tone: 'add' },
  AWD: { label: 'Awarded',      tone: 'add' },
  OPT: { label: 'Optioned',     tone: 'out' },
  OUT: { label: 'Outrighted',   tone: 'out' },
  DES: { label: 'DFA',          tone: 'out' },
  WA:  { label: 'Waived',       tone: 'out' },
  REL: { label: 'Released',     tone: 'out' },
  URL: { label: 'Released',     tone: 'out' },
  DFA: { label: 'Free Agent',   tone: 'out' },
  RET: { label: 'Retired',      tone: 'out' },
  SU:  { label: 'Suspended',    tone: 'move' },
  NC:  { label: 'New Contract', tone: 'move' },
}

// Competition level rank, high number = higher level, so an ASG that moves a
// prospect between affiliates reads as a promotion (CALLED UP) or demotion
// (SENT DOWN) by comparing the two clubs' ranks. Unknown sportIds (complex
// leagues, alternate sites) have no rank, so their move stays a plain "Assigned".
const LEVEL_RANK = { 1: 6, 11: 5, 12: 4, 13: 3, 14: 2, 16: 1 }

// The awards worth a timeline row — the majors only, keyed by the stable award
// `id` (league-prefixed AL*/NL* pairs), mapped to the short chip label. Every
// other award the feed carries (Player of the Week/Month, MiLB honors, Futures
// Game, etc.) is noise and dropped by falling outside this allowlist. All-Star
// selections (ALAS/NLAS) live here too — the awards feed carries them with the
// game's own date, so they need no separate roster lookup. Verified live.
const MAJOR_AWARDS = {
  ALMVP: 'MVP', NLMVP: 'MVP',
  ALCY: 'Cy Young', NLCY: 'Cy Young',
  ALROY: 'Rookie of the Year', NLROY: 'Rookie of the Year',
  ALSS: 'Silver Slugger', NLSS: 'Silver Slugger',
  ALGG: 'Gold Glove', NLGG: 'Gold Glove',
  ALPG: 'Platinum Glove', NLPG: 'Platinum Glove',
  ALREL: 'Reliever of the Year', NLREL: 'Reliever of the Year',
  ALAS: 'All-Star', NLAS: 'All-Star',
  ALCPOY: 'Comeback Player', NLCPOY: 'Comeback Player',
  ALHAA: 'Hank Aaron Award', NLHAA: 'Hank Aaron Award',
  MLBRC: 'Roberto Clemente Award',
  MLBAFIRST: 'All-MLB First Team', MLBSECOND: 'All-MLB Second Team',
}

// MLB Draft first-round (Day 1) dates — the API carries no draft date anywhere
// (verified: neither the person `drafts` hydrate nor /draft/{year} has one), so
// a draft record is pinned to a small hand-kept table. Approximate by design
// (the user only wants "the day of that year's first round"); years outside the
// table fall back by era — the draft sat in early June through 2020, then moved
// to All-Star week in July from 2021 on.
const DRAFT_DATES = {
  2012: '06-04', 2013: '06-06', 2014: '06-05', 2015: '06-08', 2016: '06-09',
  2017: '06-12', 2018: '06-04', 2019: '06-03', 2020: '06-10', 2021: '07-11',
  2022: '07-17', 2023: '07-09', 2024: '07-14', 2025: '07-13', 2026: '07-12',
}
function draftDate(year) {
  const md = DRAFT_DATES[year] ?? (year >= 2021 ? '07-14' : '06-06')
  return `${year}-${md}`
}

// A trade's identity, independent of which player's feed it came from: the day
// plus the unordered club pair. Both the queried player's TR row and every
// other player's row in the same swap hash to this, so the caller can attach
// the cohort of other players to the right trade.
export function tradeKey(date, aId, bId) {
  const [lo, hi] = [aId, bId].sort((x, y) => x - y)
  return `${date}|${lo ?? ''}|${hi ?? ''}`
}

// Rebuild an "Assigned" description with each club's level tagged after its
// name — "SS Cooper Pratt assigned to Nashville Sounds (AAA) from Biloxi
// Shuckers (AA)." — reusing the feed's own "{POS} {Name} assigned to …" prefix
// so the player descriptor stays exact. Falls back to the raw description if
// the prefix can't be parsed.
function assignedDescription(t, fromLevel, toLevel) {
  const desc = t.description || ''
  const prefix = desc.match(/^(.*?)\s+assigned to\s+/i)?.[1]
  const toName = t.toTeam?.name || ''
  const fromName = t.fromTeam?.name || ''
  if (!prefix || !toName || !fromName) return desc
  const withLevel = (name, lvl) => (lvl ? `${name} (${lvl})` : name)
  return `${prefix} assigned to ${withLevel(toName, toLevel)} from ${withLevel(fromName, fromLevel)}.`
}

// Curate + shape the career roster-move ledger. `transactions` is the raw
// player-scoped feed; the rest is async-resolved enrichment the caller gathers
// (see loadPlayer): `levelByTeamId` maps a club id to its sportId (for the
// CALLED UP / SENT DOWN direction and the level tags), `tradeOthers` maps a
// tradeKey to the other players in that swap (for the in-description links),
// `awards` is the raw awards feed, and `draft` is the shaped draft record. Rows
// dated after `endDate` (the spoiler cutoff) are dropped. Newest first.
export function transactionTimelineView(
  transactions,
  { selfId, levelByTeamId = new Map(), tradeOthers = new Map(), awards = [], draft = null, endDate = null } = {},
) {
  const rows = []
  const seen = new Set()
  const push = (row) => {
    if (endDate && row.date > endDate) return
    const sig = row.sig ?? `${row.code}|${row.date}`
    if (seen.has(sig)) return
    seen.add(sig)
    delete row.sig
    rows.push({ ...row, year: Number(row.date.slice(0, 4)) })
  }

  for (const t of transactions ?? []) {
    const code = t.typeCode
    const fromId = t.fromTeam?.id ?? null
    const toId = t.toTeam?.id ?? null
    const desc = t.description || ''
    const date = t.effectiveDate || t.date
    if (!date) continue
    let label
    let tone
    let description = desc
    let links = null
    if (code === 'ASG') {
      // Real affiliate-to-affiliate move only — both clubs present, not rehab.
      if (!fromId || !toId || /rehab/i.test(desc)) continue
      const fromLvl = levelByTeamId.get(fromId)
      const toLvl = levelByTeamId.get(toId)
      const fRank = LEVEL_RANK[fromLvl]
      const tRank = LEVEL_RANK[toLvl]
      if (fRank && tRank && tRank > fRank) { label = 'Called Up'; tone = 'add' }
      else if (fRank && tRank && tRank < fRank) { label = 'Sent Down'; tone = 'out' }
      else { label = 'Assigned'; tone = 'move' }
      description = assignedDescription(t, SPORT_LABEL[fromLvl], SPORT_LABEL[toLvl])
    } else {
      const type = TXN_TYPES[code]
      if (!type) continue
      label = type.label
      tone = type.tone
      if (code === 'TR') {
        // Linkify the other players in this swap — resolved by tradeKey from a
        // team+date lookup (the player-scoped feed names them only as free text).
        const others = tradeOthers.get(tradeKey(date, fromId, toId)) ?? []
        links = others.filter((p) => p.id !== selfId)
      }
    }
    push({
      sig: `${code}|${date}|${fromId ?? ''}|${toId ?? ''}`,
      date,
      code,
      label,
      tone,
      description,
      links,
      // The club to anchor the row's logo: the destination the move put him at,
      // else the club he left (a release/DFA carries only a toTeam = old club).
      club: toId
        ? { id: toId, name: t.toTeam.name }
        : fromId
          ? { id: fromId, name: t.fromTeam.name }
          : null,
    })
  }

  // Draft — a synthetic row on that year's first-round date, alongside (not
  // instead of) the signing the raw feed already carries.
  if (draft && draft.year && draft.round && draft.overall) {
    push({
      code: 'DRAFT',
      date: draftDate(Number(draft.year)),
      label: 'Drafted',
      tone: 'add',
      description: `Drafted by the ${draft.teamName || 'club'} in Round ${draft.round} (#${draft.overall} overall).`,
      links: null,
      club: draft.teamId ? { id: draft.teamId, name: draft.teamName } : null,
    })
  }

  // Awards — one synthetic row per major award, on its announcement/game date.
  for (const a of awards ?? []) {
    const short = MAJOR_AWARDS[a.id]
    if (!short || !a.date) continue
    const isAllStar = a.id === 'ALAS' || a.id === 'NLAS'
    // A roster/team honor is one you're "named to"; a trophy is one you "win".
    const named = a.id === 'MLBAFIRST' || a.id === 'MLBSECOND'
    push({
      sig: `AWD|${a.id}|${a.season}`,
      code: 'AWD',
      date: a.date,
      label: short,
      tone: 'award',
      description: isAllStar
        ? `Selected to the ${a.season} MLB All-Star Game.`
        : named
          ? `Named to the ${a.season} ${a.name}.`
          : `Won the ${a.season} ${a.name}.`,
      links: null,
      club: a.team?.id ? { id: a.team.id, name: a.team.teamName || a.team.name || '' } : null,
    })
  }

  if (!rows.length) return null
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { rows }
}

// ---------------------------------------------------------------------------
// Rehab assignment — whether the player is CURRENTLY on a minor-league rehab
// stint, inferred from the same roster-move feed the timeline uses. A rehab
// starts with an "Assigned" (ASG) row whose description says "rehab" (verified
// live: "sent RHP Coleman Crow on a rehab assignment to Nashville Sounds") and
// ends when he returns to the majors — a recall, an activation off the MLB
// injured list, a real option down, or any non-rehab reassignment. So: find the
// most recent rehab ASG, and treat it as active only when no such closing move
// is dated after it. The feed is already capped at the spoiler cutoff, so a
// game-scoped view reflects his status AS OF that game (a big leaguer only, so
// it's gated on debutYear). Returns the rehab club { id, name } or null — the
// caller shows a banner and pins his current-activity sections to MLB, since a
// rehabber is a major leaguer passing through the minors, not a demotion.
// ---------------------------------------------------------------------------
// The move types that CLOSE OUT a rehab stint — a return to the majors (recall,
// contract selection), a real option down, a release/retirement, any non-rehab
// reassignment, or an activation off the injured list. Shared by the single-
// player detector and the league-wide selector so the two agree on when a rehab
// is over.
const REHAB_END_CODES = new Set(['CU', 'OPT', 'SE', 'REL', 'RET'])
function txnDate(t) {
  return t.effectiveDate || t.date || ''
}
function isRehabTxn(t) {
  return t.typeCode === 'ASG' && /rehab/i.test(t.description || '')
}
function isRehabEndingTxn(t) {
  const c = t.typeCode
  if (REHAB_END_CODES.has(c)) return true
  if (c === 'ASG' && !isRehabTxn(t)) return true
  return c === 'SC' && /activat/i.test(t.description || '') && /injured list/i.test(t.description || '')
}

export function detectRehabAssignment(transactions, debutYear) {
  if (!debutYear) return null
  const rehabs = (transactions ?? []).filter((t) => isRehabTxn(t) && txnDate(t))
  if (!rehabs.length) return null
  const latest = rehabs.reduce((a, b) => (txnDate(a) >= txnDate(b) ? a : b))
  const start = txnDate(latest)
  const ends = (transactions ?? []).some((t) => txnDate(t) > start && isRehabEndingTxn(t))
  if (ends) return null
  const club = latest.toTeam
  return club?.id ? { id: club.id, name: club.name || '' } : null
}

// Injured-list stint detection — the same most-recent-open-stint shape as the
// rehab detector, over the same (already spoiler-capped) transactions feed. A
// placement is an SC row reading "…placed/transferred … on/to the N-day injured
// list"; it closes on a later SC "activated …" (a club reactivating him — the
// minor-league form often DOESN'T name the injured list, e.g. "Myrtle Beach
// Pelicans activated OF …"), a trade (TR — a traded player isn't on the old
// club's IL; if still hurt, the new club's re-placement becomes the latest
// placement anyway), or a roster-removing move (release / free agency / DFA /
// retirement).
const IL_END_CODES = new Set(['REL', 'RET', 'DFA', 'SFA', 'FA', 'DES', 'TR'])
function isIlPlacementTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /injured list/i.test(t.description || '') &&
    /(placed|transferred)/i.test(t.description || '')
  )
}
function isIlEndingTxn(t) {
  if (IL_END_CODES.has(t.typeCode)) return true
  return t.typeCode === 'SC' && /activat/i.test(t.description || '')
}

// The player's CURRENT injured-list stint, or null. Takes the most recent IL
// placement and treats it as active unless a later transaction closes it. The day
// count ('7'|'10'|'15'|'60') is parsed from the placement description; a placement
// with no day count (a plain / full-season "injured list") yields days:null and a
// generic label. Score-safe: transactions are already capped at the spoiler
// cutoff by the caller, so this reflects IL status AS OF the game being viewed.
export function detectInjuredList(transactions) {
  const placements = (transactions ?? []).filter((t) => isIlPlacementTxn(t) && txnDate(t))
  if (!placements.length) return null
  const latest = placements.reduce((a, b) => (txnDate(a) >= txnDate(b) ? a : b))
  const start = txnDate(latest)
  const ends = (transactions ?? []).some((t) => txnDate(t) > start && isIlEndingTxn(t))
  if (ends) return null
  const days = (latest.description || '').match(/(\d+)-day injured list/i)?.[1] ?? null
  return { days, label: days ? `${days}-Day` : 'Injured List' }
}

// The league-wide counterpart to detectRehabAssignment — every big leaguer
// currently on a rehab assignment, for the standalone Rehab Assignments page —
// no longer lives here: that list can't be built spoiler-cheaply on a page load
// (each stint has to be verified against the player's game log to drop ones that
// have really ended), so it's precomputed on a cron into public/data/rehab.json.
// See scripts/gen-rehab.mjs (which keeps its own copy of the transaction-scan
// logic above) and src/api/rehab.js.

// ---------------------------------------------------------------------------
// Promoted other-level tiles — the current season's line at each level the
// player appeared at this year OTHER than his current-activity level: the AAA
// half of an up-and-down big leaguer (Rowdy Tellez — Braves + Gwinnett), or the
// MLB half of a player currently optioned down. Surfaced as their own tile row
// (see PlayerPage) right beside the main "Current season" tiles, so a split
// season shows BOTH levels prominently instead of leaving one buried in the
// career register's "Also:" footnote.
//
// Rules — deliberately the SAME ones the career register already applies, so the
// promoted tiles and the register rows never disagree on which stints are real:
//   • the current-activity level is skipped — its line already leads the main
//     "Current season" tiles;
//   • MLB action is always real team history, so an MLB stint always promotes;
//   • a MiLB stint promotes only when it clears the rehab cap (meetsStintCap) —
//     the same absolute test the register uses to tell a genuine option-down
//     from rehab/shuttle noise, so a handful of rehab at-bats never lights up a
//     promoted tile row.
// Full-season figures (like the register rows they mirror — NOT the date-cut
// "entering today" the main tiles use), highest level first. Null when the
// player stayed at one level all year (the common case).
// ---------------------------------------------------------------------------

export function otherLevelSeasonBlocks({ mlbSplits, milbSplits, group, currentSeason, currentSportId }) {
  const cur = Number(currentSeason)
  const byLevel = new Map()
  for (const s of [...(mlbSplits ?? []), ...(milbSplits ?? [])]) {
    if (Number(s.season) !== cur) continue
    const sid = s.sport?.id
    if (!sid || sid === currentSportId) continue
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  if (!byLevel.size) return null
  const order = (sid) => {
    const i = LEVEL_ORDER_DESC.indexOf(sid)
    return i < 0 ? LEVEL_ORDER_DESC.length : i
  }
  const out = []
  for (const sid of [...byLevel.keys()].sort((a, b) => order(a) - order(b))) {
    const stat = levelSeasonStat(byLevel.get(sid), group)
    if (!stat) continue
    if (sid !== 1 && !meetsStintCap(stat, group)) continue
    const role = group === 'pitching' ? pitcherRole(stat) : null
    out.push({
      sportId: sid,
      level: SPORT_LABEL[sid] ?? '',
      role,
      tiles: group === 'pitching' ? pitcherTiles(stat, role) : hitterTiles(stat),
    })
  }
  return out.length ? out : null
}

// ---------------------------------------------------------------------------
// One stat block (a group's tiles + career + splits + logs). A normal player
// has one block; a two-way player has two (batting then pitching).
// ---------------------------------------------------------------------------

export function buildBlock({ group, role, seasonSplits, careerSplits, lrSplits, gameLogSplits, arsenalSplits, mlbYbySplits, milbYbySplits, cutoff, currentSeason, currentSportId, debutYear, tileStat, logTagLevel = false }) {
  // The date-cut current-season stat at the player's CURRENT level. It leads
  // the "Current season" tiles AND stands in for the register's current-season
  // row (see careerRegisterView), so that row can't move mid-game. `tileStat`
  // (see loadPlayer) resolves to the live level for an active MLB/single-level
  // player but combines every MiLB level played this year when he hasn't
  // appeared in the majors this season.
  const season = aggregateSplits(seasonSplits, group)
  const career = aggregateSplits(careerSplits, group)
  const tile = tileStat ?? season
  return {
    group,
    role,
    title: group === 'pitching' ? 'Pitching' : 'Batting',
    tiles: group === 'pitching' ? pitcherTiles(tile, role) : hitterTiles(tile),
    // The level the "Current season" tiles belong to (MLB for an up-and-down big
    // leaguer even while his live club is a MiLB affiliate) — the label uses it,
    // and it's the level the promoted other-level tiles below skip.
    tileSportId: currentSportId,
    // The current season's line at each OTHER level he played this year (the
    // AAA half of an up-and-down big leaguer, say) — promoted to their own tile
    // row beside the main tiles rather than buried in the register footnote.
    otherLevels: otherLevelSeasonBlocks({
      mlbSplits: mlbYbySplits, milbSplits: milbYbySplits, group, currentSeason, currentSportId,
    }),
    arsenal: group === 'pitching' ? arsenalView(arsenalSplits) : null,
    splits: splitsView(lrSplits, group),
    splitsLabel: group === 'pitching' ? 'opp. batter' : '',
    gameLog: gameLogView(gameLogSplits, group, cutoff, group === 'pitching' ? 6 : 8, { tagLevel: logTagLevel }),
    // The unified MLB + MiLB career table. `career` (the API's MLB career line
    // for a debuted player) foots the MLB total; the current-season row uses
    // the date-cut `tile` so it can't move mid-game.
    register: careerRegisterView({
      mlbSplits: mlbYbySplits, milbSplits: milbYbySplits, group, role, debutYear,
      currentStat: tile, currentSeason, currentSportId, careerStat: career,
    }),
  }
}

// ---------------------------------------------------------------------------
// Position innings — the "where he's played" diamond (fielding innings per
// position) and the starter/reliever IP pair. Innings ("2039.2" = 2039 ⅔) sum
// through the same outs math as pitching IP, so a career scope adds correctly
// across levels. See api/positionInnings scope loader for the fetch side.
// ---------------------------------------------------------------------------

// The eight defensive spots plus the mound, in the diamond's render order.
const FIELD_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P']

// Sum fielding innings per position across raw fielding splits. A mid-season
// trade emits per-team rows PLUS a team-less synthetic sum for a position
// (verified: Jazz Chisholm's 2024 CF = a team-less 829.1 alongside 815.1 MIA +
// 14.0 NYY), so per position prefer the team-tagged rows and drop the synthetic
// — the same guard levelSeasonStat uses. A career / multi-level fan-out carries
// only team-less rows (one per level), so those still sum across levels. DH
// carries no defensive innings (verified: innings 0.0), so it rides a games-only
// line beneath the diamond instead of a spot on it.
export function fieldingView(splits) {
  const byPos = new Map()
  for (const s of splits ?? []) {
    const pos = s.position?.abbreviation
    if (!pos) continue
    if (!byPos.has(pos)) byPos.set(pos, [])
    byPos.get(pos).push(s)
  }
  const preferTeamRows = (rows) => {
    const teamRows = rows.filter((r) => r.team?.id)
    return teamRows.length ? teamRows : rows
  }
  const outsByPos = new Map()
  let dhGames = 0
  for (const [pos, rows] of byPos) {
    const use = preferTeamRows(rows)
    if (pos === 'DH') {
      dhGames = use.reduce((t, r) => t + num(r.stat?.gamesPlayed), 0)
      continue
    }
    outsByPos.set(pos, use.reduce((t, r) => t + ipToOuts(r.stat?.innings), 0))
  }
  const positions = FIELD_POSITIONS.filter((pos) => outsByPos.has(pos)).map((pos) => {
    const outs = outsByPos.get(pos)
    return { pos, innings: outsToIp(outs), played: outs > 0 }
  })
  if (!positions.length && !dhGames) return null
  return { positions, dh: dhGames ? { games: dhGames } : null }
}

// Dedupe one stint's SP/RP splits per code — prefer the team-tagged rows,
// dropping the team-less synthetic aggregate a mid-season trade emits — and
// return outs per code.
function stintStarterRelieverOuts(splits) {
  const byCode = { sp: [], rp: [] }
  for (const s of splits ?? []) {
    const code = s.split?.code
    if (byCode[code]) byCode[code].push(s)
  }
  const outs = (rows) => {
    const teamRows = rows.filter((s) => s.team?.id)
    return (teamRows.length ? teamRows : rows).reduce((t, s) => t + ipToOuts(s.stat?.inningsPitched), 0)
  }
  return { sp: outs(byCode.sp), rp: outs(byCode.rp) }
}

// One (season, level) stint's SP/RP as IP strings.
export function starterRelieverView(splits) {
  const { sp, rp } = stintStarterRelieverOuts(splits)
  if (!sp && !rp) return null
  return { starter: outsToIp(sp), reliever: outsToIp(rp) }
}

// Career SP/RP: sum outs across several stints (each deduped first, so a traded
// season isn't double-counted), then format. Input is fetchStarterRelieverStints'
// [{ stint, splits }].
export function starterRelieverCareer(stintSplits) {
  let sp = 0
  let rp = 0
  for (const { splits } of stintSplits ?? []) {
    const o = stintStarterRelieverOuts(splits)
    sp += o.sp
    rp += o.rp
  }
  if (!sp && !rp) return null
  return { starter: outsToIp(sp), reliever: outsToIp(rp) }
}

// The unique (season, sportId) stints a pitcher appeared in, from his raw
// year-by-year splits — the fan-out list for a lazy career SP/RP fetch.
export function pitchingStints(splits) {
  const seen = new Set()
  const out = []
  for (const s of splits ?? []) {
    const season = Number(s.season)
    const sportId = s.sport?.id
    if (!season || !sportId) continue
    const key = `${season}-${sportId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ season, sportId })
  }
  return out
}

// ---------------------------------------------------------------------------
// Team page helpers
// ---------------------------------------------------------------------------

export function ordinal(n) {
  const v = num(n)
  if (!v) return DASH
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return `${v}${s[(m - 20) % 10] ?? s[m] ?? s[0]}`
}

// This team's rank (1 = best) among all clubs for one stat. Lower-is-better for
// ERA/WHIP, higher-is-better otherwise. Returns null if the team isn't found.
export function rankTeam(leagueStats, teamId, key, lowerBetter = false) {
  const rows = (leagueStats ?? []).filter((r) => r.stat?.[key] != null)
  if (!rows.length) return null
  rows.sort((a, b) => {
    const av = num(a.stat[key])
    const bv = num(b.stat[key])
    return lowerBetter ? av - bv : bv - av
  })
  const idx = rows.findIndex((r) => r.teamId === teamId)
  return idx < 0 ? null : { rank: idx + 1, of: rows.length }
}

// The pitcher role chip label for a roster row, from hydrated season pitching.
// Select the pitching split by group name rather than by index: fetchTeamRoster
// now hydrates BOTH hitting and pitching, so stats[0] is no longer guaranteed to
// be the pitching split (a two-way arm carries a hitting split too).
export function rosterPitcherRole(rosterEntry) {
  const stats = rosterEntry?.person?.stats ?? []
  const pit = stats.find((s) => s.group?.displayName === 'pitching') ?? stats[0]
  return pitcherRole(pit?.splits?.[0]?.stat)
}

// "First Last" (natural title case) — the team page shows names this way, unlike
// the scorebook's surname-first lineup rows.
export function firstLast(person) {
  return person?.fullName ?? person?.useName ?? ''
}

// Roster sort order by position abbreviation — catcher through DH, the
// scorebook's usual reading order. Shared by the team page's roster cards and
// the pregame lineup page's full-roster fallback (see TeamInfo.jsx).
export const POS_ORDER = { C: 1, '1B': 2, '2B': 3, SS: 3.5, '3B': 4, LF: 6, CF: 7, RF: 8, OF: 6.5, DH: 9 }
