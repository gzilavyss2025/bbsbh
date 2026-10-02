// THE ARM AT THE LENS'S FRONTIER (#724, ADR-0092): who pitches to the next
// sealed batter, and whether his entry is news there (the new-pitcher notice).
//
// CALLER-GATED. Unlike its siblings here, this reads the FEED, so it is safe
// only for the half the reader steps next: `revealedThrough` must be the real
// persisted mark and `at` the scorecard page's own step (scorecardStep at that
// mark: { inning, half, count }). It checks the first itself and answers null
// for any other half (G9, ADR-0003, ADR-0010). Inside that half it reads only
// what the cursor has opened (`entries.slice(0, count)`), never past it.
//
// WHEN A CHANGE BECOMES VISIBLE (ADR-0016, "What one step contains"; G19):
//   - LEADOFF. A change at the head of a half is announced before its first
//     pitch, so it shows from the half's first frame (selectPrePitchChanges).
//   - MID-HALF. The change TRAILS the step that retires the batter before the
//     new arm, so it shows right after that tap, before his first batter is
//     opened. That is the order a scorer works in; it is not a peek.
//   - BETWEEN PITCHES (`midAtBat`). The change LEADS the next step, so it is
//     past the cursor until the next tap, and that tap also opens the at-bat
//     he finished. His first batter is then open: no notice.
//
// `fresh` is true while the arm's entry is in view and his first batter is
// still sealed: the notice shows, and the card's label is "Now pitching". At a
// leadoff with no change it is HalfInning.jsx's own rule (selectIsFreshPitcher),
// so the lens and the innings viewer agree. `relief` is the pitcher card's own
// flag (HalfInning.jsx's `inning > 1`, and true for any change made inside a
// half, as PlayByPlay.jsx passes it). `team` is the fielding club, for the
// card's "for the {club}" and its logo fallback.

import { halfIndex, selectIsFreshPitcher, selectPrePitchChanges } from '../../api/select.js'
import { computeHalfInningFeed, pitchingChangePitcher } from '../../api/playbyplay.js'

export function frontierArmChange(feed, revealedThrough, at) {
  const { inning, half, count = 0 } = at ?? {}
  if (!feed || !inning || halfIndex(inning, half) !== revealedThrough + 1) return null
  const fielding = half === 'top' ? 'home' : 'away'
  const club = feed.gameData?.teams?.[fielding] ?? {}
  const team = { id: club.id ?? null, name: club.clubName ?? club.teamName ?? '' }
  const arm = (id, fresh, relief = inning > 1) => {
    const pitcher = pitchingChangePitcher(feed, id)
    return pitcher ? { pitcher, fresh, relief, team } : null
  }

  const opened = computeHalfInningFeed(feed, inning, half, half === 'top' ? 'away' : 'home').slice(0, count)
  const lastAtBat = opened.findLastIndex((e) => e.kind === 'atbat')
  if (lastAtBat >= 0) {
    // A change in the notes that trail the newest opened at-bat is news.
    const change = opened
      .slice(lastAtBat + 1)
      .findLast((e) => e.eventType === 'pitching_substitution' && e.playerId != null)
    if (change) return arm(change.playerId, true, true)
    // Else the arm who finished that at-bat, a midAtBat change included.
    const id = opened[lastAtBat].pitcher?.id
    return arm(id, false, inning > 1 || id !== starterId(feed, fielding))
  }

  // Nothing of the half is open yet: the leadoff.
  const change = selectPrePitchChanges(feed, inning, half, revealedThrough).findLast(
    (c) => c.eventType === 'pitching_substitution',
  )
  if (change) return arm(change.pitcher.id, true)
  // No change: the club's starter in inning 1, else the arm who threw his
  // club's last play, in a half already committed. Never this half's first
  // play: its pitcher is whoever FINISHED that at-bat, which a change between
  // its pitches would give away. Fresh by HalfInning.jsx's own rule
  // (selectIsFreshPitcher): a starter taking the mound is news.
  const last = (feed.liveData?.plays?.allPlays ?? []).findLast(
    (p) => p?.about?.inning === inning - 1 && p?.about?.halfInning === half,
  )
  const id = inning > 1 ? last?.matchup?.pitcher?.id : starterId(feed, fielding)
  return arm(id, selectIsFreshPitcher(feed, inning, half, revealedThrough, id))
}

// The club's starter: the boxscore lists its arms in the order they pitched,
// and before his first pitch the list is empty, so the announced probable.
// Known before the first pitch, so it is no spoiler.
const starterId = (feed, side) =>
  feed?.liveData?.boxscore?.teams?.[side]?.pitchers?.[0] ?? feed?.gameData?.probablePitchers?.[side]?.id ?? null

// The Entering card's defense line: each fielder new or moved before the half's
// first pitch. Caller-gated as selectPrePitchChanges is, and it passes the mark.
export function enteringDefense(feed, revealedThrough, inning, half) {
  const words = selectPrePitchChanges(feed, inning, half, revealedThrough)
    .filter((c) => c.fielder?.name && c.fielder.position)
    .map(({ fielder: f }) => `${f.jersey ? `#${f.jersey} ` : ''}${f.name.split(',')[0]} now plays ${f.position}.`)
  return words.length ? words.join(' ') : 'No defensive changes.'
}

// The arm in words: his surname for the bar's "Pitching · Torres ›", and the
// Entering card's pitcher line. A minor-league feed can lack the number, the
// club's name or the man's own name: each part drops out, never a crash.
export function armWords(arm) {
  const surname = (arm?.pitcher?.name ?? '').split(',')[0].trim()
  if (!surname) return { surname: '', line: '' }
  const club = arm.team?.name ? ` for the ${arm.team.name}` : ''
  const jersey = arm.pitcher.jersey ? `#${arm.pitcher.jersey} ` : ''
  return { surname, line: `Pitching${club}: ${jersey}${surname}.` }
}
