// Data + pure shaping for the global player hover card (PlayerLink, desktop
// only). Deliberately NOT loadPlayer.js: the player page fetches career
// splits, arsenal, milestones, game log and a dozen other sections, while a
// hover card fires on every mouse pass over a name and only ever needs four
// numbers — so this makes exactly three requests (bio, transactions, one
// season stat line) and reuses loadPlayer.js's own current-level/rehab-pin
// reasoning rather than a second copy of it.
//
// Open surface, same as the player page (root CLAUDE.md's spoiler scope):
// season stats are never gated. See spoiler-manifest.json.

import { fetchPerson, fetchPersonStats, fetchTransactions } from './person-fetch.js'
import { aggregateSplits } from './person/stats.js'
import {
  personBio,
  personSportId,
  pitcherRole,
  isPitcher,
  rosterStatusView,
} from './person/identity.js'
import { detectInjuredList, detectRehabAssignment } from './person/activity.js'
import { DASH, num } from './person/shared.js'
import { SPORT_LABEL } from '../lib/teams.js'

// A reliever leads with SV once he clears this many saves; below it (and for
// a starter, always) the lead stat is W-L. Its own threshold, deliberately
// NOT person/identity.js's pitcherRole 'CL' cut (8 saves) — that one tunes a
// different surface's lead stat, and this card's cut is its own product call.
const SAVES_THRESHOLD = 5

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// Starter or reliever-with-fewer-than-SAVES_THRESHOLD-saves: W-L / ERA / K /
// WHIP. A reliever at or above the threshold: SV / ERA / K / WHIP. Pure —
// takes an already-resolved, already-aggregated season stat line
// (aggregateSplits' pitching shape), or null (no splits at this level yet —
// a September call-up, a level with no games logged). A null stat still
// returns the full four-field shape with every value dashed, never an empty
// array, so the card always has a label to show, same as the rest of the
// app's "not posted yet" convention.
export function pitcherHoverFields(stat) {
  const role = stat ? pitcherRole(stat) : null
  const leadsWithSaves = Boolean(stat) && role !== 'SP' && num(stat.saves) >= SAVES_THRESHOLD
  return [
    leadsWithSaves
      ? { k: 'SV', v: stat.saves != null ? String(stat.saves) : DASH }
      : { k: 'W–L', v: stat ? `${num(stat.wins)}–${num(stat.losses)}` : DASH },
    { k: 'ERA', v: stat?.era ?? DASH },
    { k: 'K', v: stat?.strikeOuts != null ? String(stat.strikeOuts) : DASH },
    { k: 'WHIP', v: stat?.whip ?? DASH },
  ]
}

// AVG / HR / RBI / OPS, always. Same pure shape and null handling as
// pitcherHoverFields.
export function hitterHoverFields(stat) {
  return [
    { k: 'AVG', v: stat?.avg ?? DASH },
    { k: 'HR', v: stat?.homeRuns != null ? String(stat.homeRuns) : DASH },
    { k: 'RBI', v: stat?.rbi != null ? String(stat.rbi) : DASH },
    { k: 'OPS', v: stat?.ops ?? DASH },
  ]
}

// Where the card's stats should be scoped, and what identity chip (if any)
// to show beside the name — pure, given a fetched person + his transactions.
// Mirrors loadPlayer.js's own onRehab/currentActivitySportId reasoning
// exactly (same two detectors, same rosterStatus-gated liveSportId) rather
// than a second copy of it: a rehab assignment is a major leaguer passing
// through the minors, not a demotion, so the STAT LINE stays MLB even
// though the player's own current club (the crest, `team` below) is
// whichever affiliate he's actually at.
export function resolveHoverIdentity({ person, transactions, endDate }) {
  const bio = personBio(person)
  const debutYear = bio.debut ? Number(bio.debut.slice(0, 4)) : null
  const rosterStatus = rosterStatusView(person, endDate)
  // A gap to the present (released/unsigned/retired) means `currentTeam` is a
  // stale pointer — see rosterStatusView's header — so neither the crest nor
  // the level chip should trust it.
  const team = rosterStatus ? null : bio.team
  const liveSportId = rosterStatus && bio.debut ? 1 : personSportId(person)
  const onIL = Boolean(detectInjuredList(transactions, endDate))
  const rehab = Boolean(detectRehabAssignment(transactions, debutYear, endDate)) && onIL
  const statSportId = rehab ? 1 : liveSportId
  return {
    bio,
    team,
    onRehab: rehab,
    // The level of `team` itself (his live club), regardless of where the
    // stat line is scoped — null for a current MLB player (nothing to
    // label; SPORT_LABEL[1] is 'MLB', which is not a chip worth showing),
    // set for a MiLB level OR the rehab affiliate he's actually at.
    teamLevelLabel: liveSportId === 1 ? null : SPORT_LABEL[liveSportId] ?? null,
    statSportId,
    statSeason: Number(endDate.slice(0, 4)),
    group: isPitcher(person) ? 'pitching' : 'hitting',
  }
}

// personId -> the hover card's full view model, or null (bad id / no
// person). Three requests: bio + transactions in parallel, then one season
// stat line at the resolved level.
export async function loadHoverCardStats(personId) {
  if (!personId) return null
  const endDate = isoToday()
  const [person, transactions] = await Promise.all([
    fetchPerson(personId),
    fetchTransactions(personId, endDate),
  ])
  if (!person) return null
  const { bio, team, onRehab, teamLevelLabel, statSportId, statSeason, group } =
    resolveHoverIdentity({ person, transactions, endDate })
  const splits = await fetchPersonStats(personId, {
    type: 'byDateRange',
    group,
    season: statSeason,
    startDate: `${statSeason}-01-01`,
    endDate,
    sportId: statSportId,
  })
  const stat = aggregateSplits(splits, group)
  return {
    id: person.id,
    fullName: bio.fullName,
    posAbbr: bio.posAbbr,
    number: bio.number,
    bats: bio.bats,
    throws: bio.throws,
    isPitcher: group === 'pitching',
    team,
    onRehab,
    teamLevelLabel,
    fields: group === 'pitching' ? pitcherHoverFields(stat) : hitterHoverFields(stat),
  }
}
