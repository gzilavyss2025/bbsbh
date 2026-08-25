// The pure half of the Game Notes curation signal (issue #774): the vocabulary,
// the validation, and the staleness window that turn one agent's classification
// of a club's own press notes into the `corroborated` map gen-callouts.mjs
// writes onto a game bundle.
//
// WHY THIS EXISTS. A club's PR staff writes its own pre-game notes PDF. When
// those notes independently write about a fact bbsbh ALSO computes — this
// hitter leads the club in walks, that one is riding an on-base streak — the
// club has told us the fact is worth a reader's attention. That is a curation
// signal, and the only thing it is allowed to do here is NUDGE the worthiness
// score of a callout we already generate (see corroborationBonus in
// src/api/callout-notes/shared.js). It never writes a note, never adds a
// surface, and never invents a fact: an entry that joins to no computed callout
// changes nothing at all.
//
// WHY A MANUAL SCAN, NOT A CRON. The classification step is a reading job — the
// per-club PDF parses are messy enough (a prospect note spliced mid-sentence, a
// leaderboard table folded into a blurb) that a rule-based matcher would be
// wrong more often than right, while a reader gets through the mess fine. The
// exploration that settled this is .scratch/game-notes/INSIGHTS-EXPLORATION.md.
// scripts/scan-game-notes-insights.mjs is that reading job's harness: it is run
// BY HAND by an agent who classifies what it extracts. No API key, no workflow.
//
// THE SPOILER RULE APPLIES IN FULL. A club's notes are written after a game and
// are full of recaps ("dropped Game 1, 5-3") — those are `result` tier and are
// refused outright, not merely ignored, because a recap is the score of a game
// the reader has not watched. Only `timeless` (a career/franchise fact that
// cannot change) and `standing` (a season-to-date fact that changes slowly)
// may reach a score. Even then nothing from the notes is ever RENDERED: the
// only thing that crosses into the app is a number nudge on a note bbsbh wrote
// itself from the stats feed.

import { readFile } from 'node:fs/promises'

// The closed signal vocabulary. A classifier may only name these, and each maps
// to the callout `kind`s it corroborates (src/api/callout-notes/*.js). Kept
// small on purpose: every signal here has to name a family that is keyed BY
// PERSON in a callouts bundle, or there is nothing to join a nudge to.
export const CORROBORATION_SIGNALS = {
  // "X leads the club in walks / steals / strikeouts" — bundle.leaders /
  // bundle.pitcherLeaders.
  leader: ['leader'],
  // "X has reached base in 14 straight" — bundle.streaks[id].onBase, in all
  // three tenses the streak is told in (entering, extended, ended).
  onBase: ['onBaseRiding', 'onBaseExtended', 'onBaseEnded'],
  // "X is 12-for-12 on the bases" — bundle.streaks[id].stolenBase.
  sbStreak: ['sbStreak'],
  // "the club is 18-4 when X homers" — bundle.homerRecords[id].
  homerRec: ['homerRec'],
  // "X is unscored upon in his last 11 games" — bundle.starterRecords[id]
  // .scorelessStreak, told by Margin Notes (src/api/pitcher-callouts.js). The
  // one signal whose family lives outside callout-notes/: a club's notes write
  // about a reliever's scoreless run more often than about anything else on
  // this list, so leaving it out would have made the scan's own best material
  // unusable.
  scorelessStreak: ['scorelessStreak'],
}

// Tiers a blurb may be classified as, and which of them may ever touch a score.
export const SPOILER_TIERS = ['timeless', 'standing', 'result']
export const SCORABLE_TIERS = new Set(['timeless', 'standing'])

// A club's notes go stale: the season fact it wrote about on the 3rd is not
// evidence about the 20th, and the file is committed, so an old scan would
// otherwise keep nudging forever. Entries older than this many days before the
// slate date are ignored at read time (not deleted — a re-scan is cheap, and a
// dropped entry should read as "stale", not as "never scanned").
export const MAX_AGE_DAYS = 7

// A cap per club, so a scan can never turn into a blanket boost. This is a
// curation signal about a handful of facts, not a re-ranking of the slate.
export const MAX_ENTRIES_PER_TEAM = 12

const DAY_MS = 86400000
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
// A positive integer, not merely an integer: `Number(null)` is 0, and a 0 id
// would sail through a plain isInteger check and then join to nothing.
const isId = (n) => Number.isInteger(n) && n > 0
const dayNum = (s) => Date.parse(`${s}T00:00:00Z`) / DAY_MS

// Whole days from `from` to `to`, both 'YYYY-MM-DD'. Negative when `to` is
// earlier. null when either is not a date.
export function daysBetween(from, to) {
  if (!isDate(from) || !isDate(to)) return null
  return dayNum(to) - dayNum(from)
}

// The callout kinds a set of signal names corroborates, deduped and ordered.
export function kindsForSignals(signals) {
  const out = []
  for (const s of signals ?? []) {
    for (const kind of CORROBORATION_SIGNALS[s] ?? []) {
      if (!out.includes(kind)) out.push(kind)
    }
  }
  return out
}

// Validate + fold one classification pass into the committed file's `teams`
// map. Returns `{ teams, kept, dropped }`, where `dropped` counts every reason
// an entry did not make it — a silent drop is how a scan starts lying about
// what it found, so the CLI prints these.
//
// An entry is `{ teamId, personId, signals: [...], tier, date, player?, quote? }`.
// `player` and `quote` are carried through for a human reading the committed
// file; nothing in the app reads them.
export function normalizeVerdicts(entries) {
  const teams = {}
  const dropped = { shape: 0, result: 0, tier: 0, signal: 0, capped: 0 }
  let kept = 0

  for (const e of entries ?? []) {
    const teamId = Number(e?.teamId)
    const personId = Number(e?.personId)
    if (!isId(teamId) || !isId(personId) || !isDate(e?.date)) {
      dropped.shape += 1
      continue
    }
    // The one refusal that is not a shrug: a recap of a game the reader may not
    // have watched has no business influencing anything this app shows.
    if (e.tier === 'result') {
      dropped.result += 1
      continue
    }
    if (!SCORABLE_TIERS.has(e.tier)) {
      dropped.tier += 1
      continue
    }
    const kinds = kindsForSignals(e.signals)
    if (!kinds.length) {
      dropped.signal += 1
      continue
    }

    const key = String(teamId)
    const list = (teams[key] ??= [])
    // One row per person per club — a second blurb about the same player folds
    // its kinds in rather than doubling his weight.
    const existing = list.find((row) => row.personId === personId)
    if (existing) {
      for (const kind of kinds) if (!existing.kinds.includes(kind)) existing.kinds.push(kind)
      if (e.date > existing.date) existing.date = e.date
      continue
    }
    if (list.length >= MAX_ENTRIES_PER_TEAM) {
      dropped.capped += 1
      continue
    }
    list.push({
      personId,
      kinds,
      tier: e.tier,
      date: e.date,
      ...(e.player ? { player: String(e.player) } : {}),
      ...(e.quote ? { quote: String(e.quote) } : {}),
    })
    kept += 1
  }

  for (const list of Object.values(teams)) list.sort((a, b) => a.personId - b.personId)
  return { teams, kept, dropped }
}

// The committed file, from one classification pass.
export function buildCorroborationFile(entries, { generatedAt, scannedThrough } = {}) {
  const { teams, kept, dropped } = normalizeVerdicts(entries)
  return {
    file: {
      generatedAt: generatedAt ?? null,
      scannedThrough: scannedThrough ?? null,
      source: 'club game notes (team PR), classified by hand — see scripts/scan-game-notes-insights.mjs',
      teams,
    },
    kept,
    dropped,
  }
}

// The committed file at `path`, or null. Fails open on every error — a missing
// or malformed file must degrade to no nudge, never to a failed nightly run.
export async function loadCorroborationFile(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

// personId -> [kind] for one club, as of one slate date: the shape
// gen-callouts.mjs merges into a bundle. Entries outside the staleness window
// (and anything shaped wrong) simply do not appear — this read never throws, so
// a malformed committed file degrades to no nudge rather than a failed nightly.
export function corroboratedFor(file, teamId, slateDate) {
  const out = {}
  const list = file?.teams?.[String(teamId)]
  if (!Array.isArray(list)) return out
  for (const row of list) {
    const age = daysBetween(row?.date, slateDate)
    if (age == null || age < 0 || age > MAX_AGE_DAYS) continue
    const kinds = (row.kinds ?? []).filter((k) => typeof k === 'string')
    if (!isId(row.personId) || !kinds.length) continue
    out[row.personId] = [...new Set([...(out[row.personId] ?? []), ...kinds])]
  }
  return out
}
