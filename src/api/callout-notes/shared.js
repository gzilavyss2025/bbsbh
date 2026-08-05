// Pure, cross-cutting helpers/constants shared across the callout-notes/
// modules — worthiness scoring, W-L record parsing/folding, ordinal wording,
// and the small event-type sets both the live at-bat builder (liveAtBat.js)
// and the in-game progress walk (progress.js) trigger on. No fetching, no
// feed-walking of its own. See ../callout-notes.js's header for the overall
// two-tenses rule (ADR-0014) this whole directory implements.

// Marquee hit leader category keys, shared with gen-callouts.mjs (imported there).
export const HIT_CATEGORY_KEYS = ['hr', 'triples', 'doubles', 'bb_b', 'sb', 'hbp']

// Which season leader category each PA result eventType can trigger, and how the
// note reads. Marquee set only — derived from HIT_CATEGORY_KEYS above.
export const HIT_TRIGGERS = {
  home_run: { cat: 'hr', phrase: 'home runs' },
  triple: { cat: 'triples', phrase: 'triples' },
  double: { cat: 'doubles', phrase: 'doubles' },
  walk: { cat: 'bb_b', phrase: 'walks' },
  intent_walk: { cat: 'bb_b', phrase: 'walks' },
  hit_by_pitch: { cat: 'hbp', phrase: 'times hit by a pitch' },
}
export const STRIKEOUT_EVENTS = new Set(['strikeout', 'strikeout_double_play'])
export const SB_EVENTS = new Set(['stolen_base_2b', 'stolen_base_3b', 'stolen_base_home'])
export const CS_EVENTS = new Set([
  'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
])

// PA results that reach base for the on-base streak — the same three families
// the precompute's streak counter reads (hits + walks + HBP, see
// gen-callouts.mjs's hitterEnrich), so a live extension can never disagree
// with the entering number's own definition of "reached".
export const ON_BASE_EVENTS = new Set([
  'single', 'double', 'triple', 'home_run',
  'walk', 'intent_walk', 'hit_by_pitch',
])

export const otherSide = (side) => (side === 'away' ? 'home' : 'away')

export const isNum = Number.isFinite

// --- worthiness ---------------------------------------------------------------
// Every note carries a 0–100 `score` = a per-family base + a magnitude bonus,
// the callouts counterpart to the three stars' WPA ranking (ADR-0013): the
// box score's Insights card sorts by it and shows only the top few up front,
// and the pre-half strip (prehalf-callouts.js) uses it to cap itself. Bases
// encode how rare/dramatic the family is; bonuses reward how far past its own
// floor this instance landed. The full rubric — every family, its trigger,
// its gate, and its score — is docs/callouts.md; tune it there and here
// together.
export const SCORE_BASE = {
  leadReversal: 85,
  birthdayStats: 60,
  birthday: 55,
  homerRec: 55,
  onBaseEnded: 50,
  onBaseExtended: 45,
  onBaseRiding: 40,
  leadHeld: 40,
  bothScoreless: 42, // a 0-0 pitchers' duel — the dramatic framing of tiedAfter, just above it
  tiedAfter: 40,
  starterRec: 40,
  vsTeam: 40,
  leader: 35,
  sbStreak: 35,
  marathonAb: 45,
  bullpenThin: 40,
  foulVolume: 35,
  foulSpoiler: 30,
  runsScored: 35,
  runsAllowed: 35,
  oneRun: 35,
  extraInnings: 35,
  ttoSplit: 35, // the pre-half order-turns-over card WITH a season split behind it
  scorelessThrough: 34, // record when this club is scoreless through inning N
  pitchPace: 32, // the starter's pitches-through-N pace vs his season norm
  comeback: 30,
  scoringFirst: 30,
  inningRunDiff: 30,
  dayOfWeek: 30, // record on tonight's day of the week
  ttoPitches: 30, // pitches per PA escalating each time through the order
  risp: 25,
  platoon: 25,
  tto: 20, // …and the plain trip-fact fallback without one
}
export const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)))
// How far a W-L record sits from .500, 0–0.5 — the lopsidedness bonus scale.
export const skew = (w, l) => (w + l > 0 ? Math.abs(w / (w + l) - 0.5) : 0)

// 'W-L' -> { w, l, total, pct } | null. The precompute writes records both as
// display strings (the older families) and as {w,l} objects (the newer,
// fold-tonight's-result-in families) — this bridges the string ones into math.
export function parseRecord(rec) {
  const m = /^(\d+)-(\d+)$/.exec(rec ?? '')
  if (!m) return null
  const w = Number(m[1])
  const l = Number(m[2])
  const total = w + l
  return { w, l, total, pct: total > 0 ? w / total : 0 }
}

// An entering {w, l} record restated with tonight's result folded in — the
// box-score-only voice ("moved to 18-2"; "just the 2nd loss in 7 games…").
// `team` is the club's display name, `when` the situation clause ("when he
// goes deep", "when scoring first", "in his starts"). The "just the Nth"
// framing only reads right when tonight's result cut against a genuinely
// lopsided record, so it kicks in only while the updated minority side stays
// strictly under RARE_SHARE of the total.
const RARE_SHARE = 1 / 3
export function foldedRecordText(w, l, won, team, when) {
  const nw = won ? w + 1 : w
  const nl = won ? l : l + 1
  const total = nw + nl
  const rec = `${nw}-${nl}`
  if (won && nw / total < RARE_SHARE) {
    return `Just the ${ordinal(nw)} win in ${total} games for the ${team} ${when} (now ${rec})`
  }
  if (!won && nl / total < RARE_SHARE) {
    return `Just the ${ordinal(nl)} loss in ${total} games for the ${team} ${when} (now ${rec})`
  }
  return `The ${team} ${won ? 'moved' : 'dropped'} to ${rec} ${when}`
}

// Whether the feed is a decided, finished game — the gate every result-aware
// (box-score-only) note checks before folding tonight in. A suspended tie or
// a postponed shell reports no winner and stays in entering-tense.
export function gameResult(feed) {
  const isFinal = feed?.gameData?.status?.abstractGameState === 'Final'
  const a = feed?.liveData?.linescore?.teams?.away?.runs
  const h = feed?.liveData?.linescore?.teams?.home?.runs
  const decided = typeof a === 'number' && typeof h === 'number' && a !== h
  return {
    final: isFinal && decided,
    winnerSide: isFinal && decided ? (a > h ? 'away' : 'home') : null,
  }
}

// Ordinal wording ("6th", "9th", "3rd"...) — shared by the checkpoint notes
// (inning number), the folded-record phrasing ("the 2nd loss"), and the
// times-through-the-order card above (trip number).
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
