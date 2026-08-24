import { ALL_MLB_TEAM_IDS, teamClubName, teamClubNameShort } from '../lib/teams.js'

// The Game Log retrospective's milestone shelf — completion sets over the
// user's own stamped games (ADR-0035; `docs/design-inspiration.md` §8 has the
// research trail and the decision that put this here rather than on the
// passport book itself).
//
// ===========================================================================
// WHY THIS LIVES OUTSIDE THE "NOT A CHECKLIST" RULE
// ===========================================================================
// docs/game-log.md §1/§3 and ADR-0036 say the Game Log has no completion
// state, and ClubsSeen.jsx's header is explicit that its own grid is the one
// surface where inventing "N of 30" would be a single word's work — and must
// not. That rule still governs the passport BOOK: the pages, the stamp
// itself, the placement flow. It does not, by deliberate decision, extend to
// the retrospective's milestone shelf, which is a different register on
// purpose — real progress and real completion, expressed as little as
// possible in words (no "Nice!", no streak language, no praise) and as much
// as possible in the physical presentation the app already uses for its one
// other celebratory beat (the stamp-land animation). Read the ADR before
// touching either rule; this module is downstream of that decision, not a
// place to relitigate it.
//
// ===========================================================================
// EVERY COLLECTION IS THE SAME SHAPE
// ===========================================================================
// A finite, named list of slots, and a rule for which of a stamped game's
// facts fills which slot. "All 30 clubs", "all 30 parks", a club's affiliate
// tree, every team at a level, every park in a state, "a perfect inning
// witnessed in each of the 9 innings" — all reduce to this. Only `fillsFor`
// differs per collection; `computeMilestoneProgress` is the one engine.
// Adding a collection later is a registry entry, not new plumbing.
//
// ===========================================================================
// SPOILER FOOTING — same as ClubsSeen.jsx, and for the same reason
// ===========================================================================
// Every collection here reads only team identity off a stamped game's facts
// (api/logbook.js's stampGameFacts) — which club played, which club was
// home — never a score, a result, or a decision. A stamp's two clubs say who
// played, never who won, so this needs no seal and no gate: it is spoiler-
// free on the same footing as the clubs-seen grid it sits beside on the
// retrospective. Do not extend `fillsFor` to read `runs`/`winnerId`/
// `decisions` off a fact without re-classifying this module in
// spoiler-manifest.json first.

// Alphabetical by short name — the order a shelf of slots reads in, and the
// only order here that doesn't imply a ranking. Built once; the league does
// not change between calls.
function league() {
  return ALL_MLB_TEAM_IDS.map((id) => ({
    id,
    label: teamClubNameShort(id) ?? teamClubName(id) ?? '',
  })).sort((a, b) => a.label.localeCompare(b.label))
}

export const MILESTONE_COLLECTIONS = [
  {
    id: 'clubs',
    title: 'Every club',
    lede: 'Stamp a game against all 30 — either dugout counts.',
    slots: league,
    // Both sides fill a slot: you sat with whichever club you logged, home
    // or away. (Mirrors ClubsSeen.jsx's own `seen` set.)
    fillsFor: (fact) => [fact?.away?.id, fact?.home?.id].filter((id) => id != null),
  },
  {
    id: 'parks',
    title: 'Every ballpark',
    lede: 'Stamp a game AT each of the 30 — the home club is the park.',
    slots: league,
    // Only the HOME club's slot: that's whose park the game was played at.
    // Current MLB has no two clubs sharing a home park, so the same 30-club
    // list stands in for the 30 parks without a separate venue-id lookup —
    // a deliberate v1 simplification, not a claim that a club and its park
    // are the same thing.
    fillsFor: (fact) => [fact?.home?.id].filter((id) => id != null),
  },
]

export function isMilestoneCollectionId(id) {
  return MILESTONE_COLLECTIONS.some((c) => c.id === id)
}

// One collection's progress over a set of stamps + their resolved facts.
// `stamps` is whatever the retrospective is already showing (whole
// collection, or one book) and `factsByPk` is the same `api/logbook.js`
// result the page already fetched — no new data source.
export function computeMilestoneProgress(collection, stamps, factsByPk) {
  const slots = collection.slots()
  const filledBy = new Map()
  for (const stamp of stamps ?? []) {
    const fact = factsByPk?.[stamp.gamePk]
    if (!fact) continue
    for (const id of collection.fillsFor(fact)) {
      // First stamp to fill a slot is the one credited — later repeats of
      // the same club/park don't move the date.
      if (!filledBy.has(id)) filledBy.set(id, { gamePk: stamp.gamePk, date: fact.date })
    }
  }
  const filledSlots = slots.map((slot) => ({
    ...slot,
    filled: filledBy.has(slot.id),
    gamePk: filledBy.get(slot.id)?.gamePk ?? null,
    date: filledBy.get(slot.id)?.date ?? null,
  }))
  return {
    id: collection.id,
    title: collection.title,
    lede: collection.lede,
    total: slots.length,
    count: filledBy.size,
    complete: slots.length > 0 && filledBy.size >= slots.length,
    slots: filledSlots,
  }
}

export function computeAllMilestones(stamps, factsByPk) {
  return MILESTONE_COLLECTIONS.map((collection) =>
    computeMilestoneProgress(collection, stamps, factsByPk),
  )
}
