// The box-score's Insights card roll-up — split out of ../callout-notes.js.
// `computeGameCalloutNotes` is REVEAL-ONLY: the whole game is already behind
// the box score's SealBox by the time it's called, which is the only reason
// the result-aware wording here (and in heldNotes.js) is safe. See
// ../callout-notes.js's header for the full two-tenses rule (ADR-0014).

import {
  firstRunPlay,
  firstPAIndexByBatter,
  firstRispPAIndexByBatter,
  NON_PA_EVENT_TYPES,
  BASERUNNING_NOTE_EVENT_TYPES,
  runnerLastName,
} from '../playbyplay.js'
import { personNameParts, dayWord } from '../select.js'
import { ordinal, isNum, clampScore, skew, SCORE_BASE, foldedRecordText, gameResult } from './shared.js'
import { computeCalloutProgress } from './progress.js'
import { buildCallouts } from './liveAtBat.js'
import { VS_TEAM_ROLLUP_MAX } from './vsTeamNote.js'
import { buildLeadReversalNote } from './checkpoints.js'
import {
  buildLeadHeldNote,
  buildTiedAfterHeldNotes,
  buildRunsScoredNote,
  buildRunsAllowedNote,
  buildComebackNote,
  buildCloseGameNotes,
  buildScorelessHeldNotes,
  buildBothScorelessHeldNotes,
  buildDayOfWeekNotes,
} from './heldNotes.js'
import { buildInningRunDiffNote } from './inningAndStarter.js'

// "2026-06-25" -> "6/25" — the season-scoped date the streak prose cites
// ("a streak that began 6/25"). No year: every streak lives inside one season.
const monthDay = (isoDate) =>
  isoDate ? `${Number(isoDate.slice(5, 7))}/${Number(isoDate.slice(8, 10))}` : ''

// A batter's official at-bats tonight, from the live boxscore — read only by
// the Final-only streak-snapped prose, which runs inside the box score's seal.
function tonightAtBats(feed, side, personId) {
  const ab = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${personId}`]?.stats?.batting?.atBats
  return typeof ab === 'number' ? ab : null
}

// The narrative, tonight-included restatement of a leader note for the
// box-score roll-up ("Struck out 7 tonight and leads the Braves with 117
// strikeouts this season") — only built once the game is Final, from the
// `cat`/`inGame`/`total` fields the play-time note carried along.
const timesWord = (n) => (n === 2 ? 'twice' : `${n} times`)
const LEADER_VERB = {
  hr: 'Homered',
  triples: 'Tripled',
  doubles: 'Doubled',
  bb_b: 'Walked',
  hbp: 'Was hit by a pitch',
}
const LEADER_NOUN = {
  hr: 'home runs',
  triples: 'triples',
  doubles: 'doubles',
  bb_b: 'walks',
  hbp: 'times hit by a pitch',
  sb: 'steals',
}
function leaderTonightText(n, teamName, word) {
  if (n.cat === 'so_p') {
    const tonight = n.inGame === 1 ? 'a batter' : n.inGame
    return `Struck out ${tonight} ${word} and leads the ${teamName} with ${n.total} strikeouts this season`
  }
  const noun = LEADER_NOUN[n.cat] ?? 'of those'
  if (n.cat === 'sb') {
    const stole = n.inGame === 1 ? 'Stole a base' : `Stole ${n.inGame} bases`
    return `${stole} ${word} — that's ${n.total} this season, most on the ${teamName}`
  }
  const verb = LEADER_VERB[n.cat] ?? 'Did it'
  return n.inGame === 1
    ? `${verb} ${word} for No. ${n.total} this season — he leads the ${teamName} in ${noun}`
    : `${verb} ${timesWord(n.inGame)} ${word} — now ${n.total} this season, most on the ${teamName}`
}

// The actual starting pitchers, read off each half's first play — the roll-up
// runs post-reveal, so this beats trusting the pre-game probables (a late
// scratch happens). { away, home } pitcher ids, either possibly null.
function actualStarters(feed) {
  let home = null
  let away = null
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const pid = p.matchup?.pitcher?.id
    if (pid == null) continue
    if (p.about?.halfInning === 'top' && home == null) home = pid
    if (p.about?.halfInning === 'bottom' && away == null) away = pid
    if (home != null && away != null) break
  }
  return { home, away }
}

// Every call-out that actually fired somewhere in the game, deduped (latest
// wording wins — a count note's number grows through the game) and enriched
// with each note's headshot/logo identity — the box score's Insights card
// roll-up of the same notes that appear piecemeal on individual at-bat cards
// in the innings view (see buildCallouts above), plus the whole-game-only
// families (lead reversal/held, runs scored/allowed, comeback, starter
// records, inning run differentials, streak endings). Sorted by worthiness
// `score`, most impactful first — the card shows the top few and folds the
// rest behind Show more.
//
// Walks the raw feed directly rather than routing through
// computeHalfInningFeed (one call per half, with its pitch-detail and
// baserunning-advancement passes) since none of that is needed here — just
// each play's own result, batter, pitcher, and any baserunning event it
// carries. REVEAL-ONLY: the whole game is already behind the box score's
// SealBox by the time this is called, same rule as computeGameSuperlatives —
// which is also the ONLY reason the result-aware wording here is safe (see
// the module header's two-tenses rule and ADR-0014). When the game isn't
// decided yet (an in-progress box-score view), gameResult reports non-final
// and every folded variant stays in entering-tense.
// `vsTeam` (the separately-fetched vs-team-splits file, api/vsTeamSplits.js)
// is optional — the career-vs-opponent note simply doesn't fire without it.
export function computeGameCalloutNotes(feed, bundle, vsTeam) {
  if (!bundle) return []

  // A note's `side`/`oppSide` ('away'|'home') resolve to the bundle's own
  // identity for that club — real teamId (for TeamLogo) + display name.
  const identify = (note) => {
    let personName = ''
    if (note.personId != null) {
      const { first, last } = personNameParts(feed?.gameData?.players?.[`ID${note.personId}`] ?? {})
      personName = [first, last].filter(Boolean).join(' ')
    }
    return {
      text: note.text,
      personId: note.personId ?? null,
      personName,
      teamId: note.side ? bundle[note.side]?.teamId ?? null : null,
      teamName: note.side ? bundle[note.side]?.name ?? '' : '',
      oppTeamId: note.oppSide ? bundle[note.oppSide]?.teamId ?? null : null,
      oppTeamName: note.oppSide ? bundle[note.oppSide]?.name ?? '' : '',
      kind: note.kind ?? null,
      score: note.score ?? 0,
    }
  }

  const result = gameResult(feed)
  const firstRun = firstRunPlay(feed)
  const firstPA = firstPAIndexByBatter(feed)
  const firstRispPA = firstRispPAIndexByBatter(feed)
  const progress = computeCalloutProgress(feed)
  // "today" for a day game, "tonight" for a night game — every result-aware
  // rewrite below (all of them fold in what happened THIS game) uses this
  // instead of a hard-coded "tonight".
  const word = dayWord(feed)

  // Dedupe by dedupeKey (falling back to the text itself), LATEST wording
  // winning in place — so "Riding a 14-game on-base streak" gives way to
  // "Extends his on-base streak to 15", and a count note keeps its final
  // number rather than one card per occurrence.
  const byKey = new Map() // key -> index into ordered
  const ordered = []
  const add = (note) => {
    if (!note) return
    const key = note.dedupeKey ?? note.text
    const at = byKey.get(key)
    if (at != null) {
      ordered[at] = note
      return
    }
    byKey.set(key, ordered.length)
    ordered.push(note)
  }

  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const battingSide = play.about?.halfInning === 'top' ? 'away' : 'home'
    const pitcherId = play.matchup?.pitcher?.id
    const pitcherPerson = pitcherId != null ? feed?.gameData?.players?.[`ID${pitcherId}`] ?? {} : {}
    const pitcher =
      pitcherId != null
        ? { id: pitcherId, ...personNameParts(pitcherPerson), hand: pitcherPerson.pitchHand?.code ?? '' }
        : null
    // Same note shape computeHalfInningFeed builds, `runnerLast` included —
    // the roll-up rewrites the steal families into its own attributed wording
    // below, but building a thinner note here is how the two paths drift, and
    // the last drift of exactly this kind is what left the play card's steal
    // call-outs unattributed in the first place.
    const baserunningNotes = (play.playEvents ?? [])
      .filter((e) => !e.isPitch && BASERUNNING_NOTE_EVENT_TYPES.has(e.details?.eventType))
      .map((e) => ({
        eventType: e.details.eventType,
        runnerId: e.player?.id ?? null,
        runnerLast: runnerLastName(feed, e.player?.id ?? null),
      }))
    const entry = {
      eventType: play.result?.eventType ?? null,
      batterId: play.matchup?.batter?.id,
      atBatIndex: play.about?.atBatIndex ?? null,
      pitcher,
      baserunningNotes,
    }
    for (const note of buildCallouts(entry, {
      bundle, firstRun, firstPA, firstRispPA, battingSide, vsTeam, progress,
    })) {
      add(note)
    }
  }

  // The foulSpoiler card restated with tonight's own tally (same dedupeKey,
  // so this wording replaces the entering one whenever he actually spoiled a
  // few) — tonight's-events narration, the roll-up's normal tense.
  for (const [pid, spoiler] of Object.entries(bundle.foulSpoilers ?? {})) {
    const tonight = progress.foulsByBatter?.get(Number(pid)) ?? 0
    if (tonight < 3) continue
    const seasonWord =
      spoiler.rank === 1
        ? `he averages an MLB-best ${spoiler.perGame} a game`
        : `he averages ${spoiler.perGame} a game, No. ${spoiler.rank} in MLB`
    add({
      text: `Fouled off ${tonight} ${word} — ${seasonWord}`,
      personId: Number(pid),
      side: sideOfBatter(feed, Number(pid)),
      kind: 'foulSpoiler',
      dedupeKey: `foulspoiler-${pid}`,
      score: clampScore(SCORE_BASE.foulSpoiler + Math.max(0, 11 - spoiler.rank) + Math.min(6, tonight - 3)),
    })
  }

  // Result-aware rewrites of the per-play families (see the two-tenses rule in
  // the module header): once the game is decided, records fold tonight in and
  // the count/streak notes restate themselves narratively, tonight's own
  // events named ("Struck out 7 tonight…", "Stole a base in the 4th…").
  const dropped = new Set() // ordered[] indices to leave out of the roll-up
  if (result.final) {
    for (const [i, n] of ordered.entries()) {
      const teamName = n.side ? bundle[n.side]?.name : ''

      // Record notes ("W-L when …") fold tonight's result in.
      if (n.rec && teamName) {
        const won = n.side === result.winnerSide
        const when = n.kind === 'homerRec' ? 'when he goes deep' : n.when ?? null
        if (when) {
          ordered[i] = { ...n, text: foldedRecordText(n.rec.w, n.rec.l, won, teamName, when) }
        }
        continue
      }

      // Leader notes fold in what he actually did tonight. A leader note with
      // no in-game count means the category never fired tonight — it can only
      // exist mid-rewrite for steals (below), so leave any such note alone.
      if (n.kind === 'leader' && n.total != null && n.inGame > 0 && teamName) {
        ordered[i] = { ...n, text: leaderTonightText(n, teamName, word) }
        continue
      }

      // Steal-streak cards: only worth a roll-up spot when something happened
      // on the bases tonight — a steal extends the run, a caught stealing ends
      // it. The entering "has stolen N straight" card with no attempt is play-
      // card staging, not a post-game insight.
      if (n.kind === 'sbStreak' && n.personId != null) {
        const run = n.run ?? 0
        const game = progress.sbGame.get(n.personId)
        const caughtInning = progress.caught.get(n.personId)
        if (caughtInning != null) {
          ordered[i] = {
            ...n,
            text: `Was caught stealing in the ${ordinal(caughtInning)}, ending a run of ${run + (game?.beforeCaught ?? 0)} straight steals`,
            score: clampScore(SCORE_BASE.onBaseEnded + Math.min(10, run - 4)),
          }
        } else if (game?.n > 0) {
          const stole =
            game.n === 1 && game.firstInning != null
              ? `Stole a base in the ${ordinal(game.firstInning)}`
              : game.n === 1
                ? `Stole a base ${word}`
                : `Stole ${game.n} bases ${word}`
          ordered[i] = {
            ...n,
            text: `${stole} and has now stolen ${run + game.n} straight without being caught`,
          }
        } else {
          dropped.add(i)
        }
        continue
      }

      // An extended on-base streak reads with its full arc once the night is
      // in the books — how long, and since when.
      if (n.kind === 'onBaseExtended' && n.streak && n.start) {
        ordered[i] = {
          ...n,
          text: `Reached base again ${word} — his on-base streak is now ${n.streak} straight games, dating to ${monthDay(n.start)}`,
        }
        continue
      }

      // A new season-high (or elite-tier) pitch tonight reads with the
      // "tonight" framing once the game is decided — the live card's
      // "New season high for X — …" already named him, so the roll-up drops
      // that repetition and leads with the result-aware verb instead.
      if (n.kind === 'veloPeak' && isNum(n.mph)) {
        ordered[i] = {
          ...n,
          text: n.isSeasonHigh
            ? `Hit a new season-high ${n.mph.toFixed(1)} mph ${word}`
            : `Touched ${n.mph.toFixed(1)} mph ${word} — one of the hardest pitches he's thrown all season`,
        }
      }
    }

    // An on-base streak that got no knock all night is OVER — the flip side
    // of the extends note, only knowable (and only tellable) post-game. Told
    // with tonight's line and the streak's starting date when we have them:
    // "Went 0-for-3 tonight, snapping a 10-game on-base streak that began 6/25".
    for (const [idStr, s] of Object.entries(bundle.streaks ?? {})) {
      const id = Number(idStr)
      if (!s?.onBase || !firstPA.has(id) || progress.reached.has(id)) continue
      const battingSide = bundle.away && bundle.home ? sideOfBatter(feed, id) : null
      const ab = battingSide != null ? tonightAtBats(feed, battingSide, id) : null
      const began = s.onBaseStart ? ` that began ${monthDay(s.onBaseStart)}` : ''
      add({
        text:
          isNum(ab) && ab > 0
            ? `Went 0-for-${ab} ${word}, snapping a ${s.onBase}-game on-base streak${began}`
            : `His ${s.onBase}-game on-base streak came to an end ${word}`,
        personId: id,
        side: battingSide,
        kind: 'onBaseEnded',
        dedupeKey: `onbase-${id}`,
        score: clampScore(SCORE_BASE.onBaseEnded + Math.min(15, s.onBase - 8)),
      })
    }

    // Each club's record in its starter's starts, moved by tonight.
    const starters = actualStarters(feed)
    for (const side of ['away', 'home']) {
      const pid = starters[side]
      const rec = pid != null ? bundle.starterRecords?.[pid]?.teamStarts : null
      const teamName = bundle[side]?.name
      if (!rec || !isNum(rec.w) || !isNum(rec.l) || !teamName) continue
      add({
        text: foldedRecordText(rec.w, rec.l, side === result.winnerSide, teamName, 'in his starts'),
        personId: pid,
        side,
        kind: 'starterRec',
        dedupeKey: `starterRec-${pid}`,
        score: clampScore(SCORE_BASE.starterRec + 40 * skew(rec.w, rec.l)),
      })
    }
  }

  add(buildLeadReversalNote(feed, bundle))
  add(buildLeadHeldNote(feed, bundle, result))
  for (const note of buildTiedAfterHeldNotes(feed, bundle, result)) add(note)
  add(buildRunsScoredNote(feed, bundle, result))
  add(buildRunsAllowedNote(feed, bundle, result))
  add(buildComebackNote(feed, bundle, result))
  for (const note of buildCloseGameNotes(feed, bundle, result)) add(note)
  for (const note of buildScorelessHeldNotes(feed, bundle, result)) add(note)
  for (const note of buildBothScorelessHeldNotes(feed, bundle, result)) add(note)
  for (const note of buildDayOfWeekNotes(feed, bundle, result)) add(note)

  // Each club's single most lopsided inning-differential note (its signature
  // inning), tonight's runs in that inning folded in once decided. One per
  // club — the full per-inning sweep belongs to the pre-half strip, not here.
  const inningsRows = feed?.liveData?.linescore?.innings ?? []
  for (const side of ['away', 'home']) {
    let best = null
    for (let n = 1; n <= 9; n++) {
      const row = result.final ? inningsRows.find((r) => r.num === n) : null
      const myRuns = row ? row[side === 'away' ? 'away' : 'home']?.runs : null
      const oppRuns = row ? row[side === 'away' ? 'home' : 'away']?.runs : null
      const note = buildInningRunDiffNote(
        bundle, side, n,
        typeof myRuns === 'number' ? myRuns : 0,
        typeof oppRuns === 'number' ? oppRuns : 0,
        word,
      )
      if (note && (!best || note.margin > best.margin)) best = note
    }
    add(best)
  }

  // A game against a familiar club can clear the vs-opponent gate for a whole
  // lineup's worth of hitters at once, and the roll-up sums BOTH clubs — so
  // this one family is capped to the few most extreme lines (by worthiness
  // score, which folds in how far past its threshold each landed) rather than
  // letting it crowd out the rest of the card. The innings view is untouched:
  // there each note sits alone on the batter's own first-PA card, where
  // volume was never the problem.
  let keep = ordered.filter((_, i) => !dropped.has(i))
  const vsNotes = keep.filter((n) => n.kind === 'vsTeam')
  if (vsNotes.length > VS_TEAM_ROLLUP_MAX) {
    const top = new Set(
      [...vsNotes].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, VS_TEAM_ROLLUP_MAX),
    )
    keep = keep.filter((n) => n.kind !== 'vsTeam' || top.has(n))
  }

  // Most impactful first — the whole point of the worthiness score. Ties keep
  // first-fired order (sort is stable), so the game's own chronology breaks them.
  return [...keep].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(identify)
}

// Which side a batter hit for tonight, from his first plate appearance — used
// only by the streak-ended note, where the player isn't attached to any one
// play we're already holding.
function sideOfBatter(feed, batterId) {
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    if (p.matchup?.batter?.id === batterId && !NON_PA_EVENT_TYPES.has(p.result?.eventType)) {
      return p.about?.halfInning === 'top' ? 'away' : 'home'
    }
  }
  return null
}
