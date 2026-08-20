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
  veloPeak: 55, // a new season-high or elite-tier (ELITE_VELO_MPH+) single pitch — as rare as homerRec
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
  matchupSkill: 36, // hitter vs the arm he faces on a chase/whiff/hard-contact axis
  matchupStyle: 33, // …and on a pull/ground-ball TENDENCY axis, which is a shade less pointed
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

// --- magnitude bonuses --------------------------------------------------------
// A family's BASE says how rare the family is; its magnitude bonus says how far
// past its own floor THIS instance landed. Those bonuses used to stop wherever
// each family's author happened to stop — 10 here, 15 there, 20 somewhere else —
// so a family whose bonus capped at 10 was ranked almost entirely by its base,
// and no instance of a 25-base family could ever overtake a 40-base one however
// extreme it was. On a two-slot strip that made the base the whole ranking.
//
// Every bonus now lands on ONE scale, 0..MAGNITUDE_MAX. `magnitudeOf(raw, full)`
// is the single converter: `raw` is the family's own measure of how big this
// instance is, `full` the value that earns the whole bonus. It replaces every
// hand-written `Math.min(cap, expr)` and keeps each family's saturation point —
// only what saturation is WORTH changed.
export const MAGNITUDE_MAX = 20
export function magnitudeOf(raw, full) {
  if (!isNum(raw) || !isNum(full) || full <= 0) return 0
  return Math.max(0, Math.min(MAGNITUDE_MAX, (MAGNITUDE_MAX * raw) / full))
}

// The W-L families' shared bonus. skew() maxes at 0.5 (a spotless record), so a
// perfectly lopsided record earns the whole magnitude and a .500 one earns none.
export const skewBonus = (w, l) => magnitudeOf(skew(w, l), 0.5)

// --- repetition: decay, diversity, and the once-per-game families -------------
// Every callout surface rebuilds from scratch on every half, so the same
// high-base note used to win the same sort again and again: a reader who sat
// through nine innings met the same card fifteen times. Three rules answer
// that, all applied by rankNotes below.
//
//   1. DECAY. A note loses SHOWN_DECAY points for each EARLIER half it was
//      already shown in, so a fresher note of a lower family overtakes it.
//      It is a demotion, not a ban — a note with nothing to beat it still
//      shows, which is the right answer for a thin bundle.
//   2. ONCE PER GAME. Some facts cannot change while a game is played: the
//      weekday, a club's record in its starter's starts, a reliever's season
//      splits. A second showing of one of those adds nothing at all, so after
//      one showing they drop rather than decay.
//   3. DIVERSITY. At most one note per KIND per surface per half, and (where
//      the caller asks for it) at most one "the club is W-L when X" note —
//      eleven of the families are that same sentence with a different clause,
//      which is why the voice repeated even when the facts did not.
//
// The ledger of what was already shown is per-game and lives in the React tree
// (src/hooks/useCalloutLedger.js) — every builder here stays pure and only
// READS the counts it is handed.
export const SHOWN_DECAY = 25

// Facts that are fixed for the whole game (or, where the dedupeKey carries an
// inning, for the whole of that inning) — rule 2 above. `sixIp`, `tenK` and
// every health read are deliberately absent: those restate as tonight's line
// grows, and restating IS the note.
export const ONCE_PER_GAME_KINDS = new Set([
  // pre-half / between-innings season and calendar facts
  'starterRec', 'dayOfWeek', 'bullpenThin', 'inningRunDiff',
  // Margin Notes' season aggregates (pitcher-callouts.js's buildPitcherNotes)
  'homeAway', 'cgShutout', 'scorelessStreak', 'workload', 'backToBack',
  'penFatigue', 'leverage', 'centuryClub', 'recentAppearances',
])

// "The club is W-L when X" — one sentence shape, eleven families. A strip that
// caps at two has room for one of them and one of anything else.
export const RECORD_KINDS = new Set([
  'starterRec', 'dayOfWeek', 'leadAfterLive', 'leadHeld', 'tiedAfter',
  'tiedAfterLive', 'scorelessThrough', 'bothScoreless', 'runsScored',
  'runsAllowed', 'comeback', 'oneRun', 'extraInnings', 'homerRec',
  'scoringFirst', 'oppScoringFirst', 'sixIp', 'homeAway',
])

const NO_COUNTS = new Map()

// Rank one surface's candidate notes: decay by what the reader has already
// been shown, drop the facts that cannot change, then take the highest scorer
// of each kind before any second note of a kind it already holds.
//
// `shownCounts` is `Map<dedupeKey, number of EARLIER halves it was shown in>`
// (useCalloutLedger's `countsFor`), which is why re-rendering the half a note
// is currently on never decays it out from under itself.
//
// Notes a diversity rule turns down are DEFERRED, not discarded: they come back
// after the accepted ones in score order. Sorting is stable, so equal scores
// keep build order.
//
// `strictCaps` decides what a CAPPED surface does with that tail, and the two
// surfaces genuinely want opposite things:
//   - The pre-half strip sets it. Its pool for a top half is very often ALL
//     record notes (tiedAfterLive x2, or bothScoreless x2), and letting the tail
//     backfill the two slots is the strip saying the same thing twice — the
//     exact case maxRecordNotes exists to stop.
//   - Between Innings must NOT set it. Its card depth is a spoiler invariant
//     (see between-innings.test.js): a quiet half and a loud half must return
//     the same number of cards once both clear CARD_MAX, so the tail has to
//     backfill or depth would track how eventful the half was.
export function rankNotes(notes, {
  shownCounts = null,
  maxPerKind = 1,
  maxRecordNotes = Infinity,
  limit = Infinity,
  strictCaps = false,
} = {}) {
  const counts = shownCounts ?? NO_COUNTS
  const scored = []
  for (const note of notes ?? []) {
    if (!note) continue
    const seen = counts.get(note.dedupeKey ?? note.text) ?? 0
    if (seen > 0 && ONCE_PER_GAME_KINDS.has(note.kind)) continue
    scored.push({ note, rank: (note.score ?? 0) - SHOWN_DECAY * seen })
  }
  scored.sort((a, b) => b.rank - a.rank)

  const picked = []
  const deferred = []
  const perKind = new Map()
  let records = 0
  for (const { note } of scored) {
    const kind = note.kind ?? ''
    const isRecord = RECORD_KINDS.has(kind)
    if ((perKind.get(kind) ?? 0) >= maxPerKind || (isRecord && records >= maxRecordNotes)) {
      deferred.push(note)
      continue
    }
    perKind.set(kind, (perKind.get(kind) ?? 0) + 1)
    if (isRecord) records += 1
    picked.push(note)
  }
  if (strictCaps) return Number.isFinite(limit) ? picked.slice(0, limit) : picked
  const out = picked.concat(deferred)
  return Number.isFinite(limit) ? out.slice(0, limit) : out
}
