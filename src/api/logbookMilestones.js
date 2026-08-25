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
// These computed objects now feed TWO surfaces, and only one of them may
// print a count: the retrospective's shelf does, the book page's own stamp
// sheet (components/logbook/ClubsSeen.jsx) draws the identical slots with the
// counts switched off. That is what keeps the rule above intact while the art
// is shared — see components/logbook/StampSheet.jsx's `counts` prop.
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
// THE SLOT LIST IS A LEVEL'S ROSTER, PASSED IN — NOT A CONSTANT
// ===========================================================================
// Both collections used to hard-code the 30 current MLB clubs. They now take
// a ROSTER (`rosterFor` below, off the weekly public/data/teams.json
// snapshot), so the same two collections describe MLB, AAA, AA, A+ and A —
// which is the whole of the level toggle on both surfaces. The MLB roster
// stays the default for a caller that passes nothing, so an offline visit and
// every existing caller keep the exact list they had.
//
// Note what the level does NOT change: which stamps are counted. Every stamp
// is offered to every roster, because a AAA club's id can only ever appear in
// the AAA roster — the filtering falls out of the ids themselves, and
// re-filtering the stamps by `fact.sportId` on top of that could only
// introduce a disagreement between the two.
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
    venueName: '',
  })).sort((a, b) => a.label.localeCompare(b.label))
}

// One level's clubs, shaped into slots, from the weekly static team snapshot
// (api/teams-static.js — `bySportId`, keyed by the sportId as a STRING).
//
// `venueName` rides along on the slot because it is the one per-club fact the
// "parks" shelf needs that no milestone math carries, and that shelf's art is
// looked up by venue NAME (lib/ballpark/ballparkArt.js is keyed on the name,
// not a team id). Carrying it here rather than rebuilding a second
// id-to-venue map in the component is what makes the parks shelf work at
// every level for free.
//
// Degrades the way every other reader of that snapshot does: an unresolved or
// empty snapshot falls back to the built-in MLB league for sportId 1 (so the
// default surface is never blank offline) and to an empty roster for a minor
// level, which the callers say in words rather than drawing as zero progress
// against a real set.
export function rosterFor(staticTeams, sportId = 1) {
  const rows = staticTeams?.bySportId?.[String(sportId)] ?? []
  const roster = rows
    .filter((team) => team?.id != null)
    .map((team) => ({
      id: team.id,
      // MLB keeps the short club name the rest of the app already uses; a
      // minor-league club has no entry there and takes the snapshot's own
      // `teamName` ("Mud Hens"), falling back to the full name.
      label: teamClubNameShort(team.id) ?? team.teamName ?? team.name ?? '',
      venueName: team.venueName ?? '',
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  if (roster.length) return roster
  return sportId === 1 ? league() : []
}

export const MILESTONE_COLLECTIONS = [
  {
    id: 'clubs',
    title: 'Every club',
    slots: (roster) => roster ?? league(),
    // Both sides fill a slot: you sat with whichever club you logged, home
    // or away. (Mirrors ClubsSeen.jsx's own `seen` set.)
    fillsFor: (fact) => [fact?.away?.id, fact?.home?.id].filter((id) => id != null),
  },
  {
    id: 'parks',
    title: 'Every ballpark',
    slots: (roster) => roster ?? league(),
    // Only the HOME club's slot: that's whose park the game was played at.
    // No two clubs at a level share a home park, so a level's own club list
    // stands in for its parks without a separate venue-id lookup — a
    // deliberate simplification carried over from the MLB-only version, not
    // a claim that a club and its park are the same thing.
    fillsFor: (fact) => [fact?.home?.id].filter((id) => id != null),
  },
]

export function isMilestoneCollectionId(id) {
  return MILESTONE_COLLECTIONS.some((c) => c.id === id)
}

// One collection's progress over a set of stamps + their resolved facts.
// `stamps` is whatever the retrospective is already showing (whole
// collection, or one book) and `factsByPk` is the same `api/logbook.js`
// result the page already fetched — no new data source. `roster` is the
// level's slot list (`rosterFor`); omitted, it means MLB.
export function computeMilestoneProgress(collection, stamps, factsByPk, roster) {
  const slots = collection.slots(roster)
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
  // Counted off the SLOTS, not off `filledBy`. A stamp fills club ids that
  // belong to some other level's roster — every minor-league stamp does,
  // against the MLB roster — and crediting those would report "34 of 30" the
  // moment a user stamped a single Mud Hens game.
  const count = filledSlots.filter((slot) => slot.filled).length
  return {
    id: collection.id,
    title: collection.title,
    total: slots.length,
    count,
    complete: slots.length > 0 && count >= slots.length,
    slots: filledSlots,
  }
}

export function computeAllMilestones(stamps, factsByPk, roster) {
  return MILESTONE_COLLECTIONS.map((collection) =>
    computeMilestoneProgress(collection, stamps, factsByPk, roster),
  )
}
