// The main builder: an ordered feed for one half-inning, interleaving
// plate-appearance cards with mound-visit / pitching-change notes. See
// ../playbyplay.js's header for the module's overall spoiler footing and the
// field-path notes this function's branches are verified against. Split
// (ADR-0038, check-file-size.mjs) out of src/api/playbyplay.js — this single
// function is long enough on its own (the state machinery it walks — pinch-
// runner aliasing, per-batter trip tracking, the visible-step gate — is
// tightly coupled and deliberately NOT decomposed further, see that PR's
// description) that it keeps its own BUDGETS entry in check-file-size.mjs
// rather than splitting below the 600-line cap.

import { personNameParts } from '../select.js'
import { defenseEntering } from '../defense.js'
import {
  BASE_NUM,
  resolveBatter,
  creditedBatterId,
  trimLeadingName,
  buildNameIndex,
  linkifyNames,
} from './shared.js'
import {
  NON_PA_EVENT_TYPES,
  GAME_ADVISORY_EVENT_TYPE,
  BASERUNNING_NOTE_EVENT_TYPES,
  NO_SLOT_CREDIT_EVENT_TYPES,
  STOPPAGE_EVENTS,
  isDelayAdvisory,
} from './eventTypes.js'
import { sentenceCaseEventText, runnerLastName } from './notificationCards.js'
import { pitchCardInfo, matchupPitcher } from './pitchInfo.js'
import { scorebookCode } from './scorebookCode.js'
import {
  interruptedCode,
  legAdvanceCode,
  NATURAL_BASE,
  playErrorCredit,
  battingSlot,
  runnerOutCode,
} from './advanceCode.js'

// Ordered feed for one half-inning: plate-appearance cards interleaved with
// mound-visit / pitching-change notes, first-at-bat first. `battingSide` is
// 'away' | 'home' (top bats away, bottom bats home — same convention as the
// rest of InningViewer).
// `stepCap` (ADR-0016, at-bat stepping): when not null, caps how many entries
// are considered "visible" so far. A play's effect on any card OTHER than its
// own — a later out on the bases, an advance that lets an earlier runner
// score — must not be written onto that earlier, already-revealed card until
// the play that causes it is itself within the visible window; otherwise a
// batter's diamond would show his eventual fate (e.g. scoring on a hit two
// batters later) the moment his own at-bat is revealed, before that later
// play has been shown. A play's own card/notes always push onto `entries`
// regardless of stepCap — visibility only gates what OTHER, already-pushed
// cards get retroactively annotated with.
export function computeHalfInningFeed(feed, inningNum, half, battingSide, stepCap = null) {
  const plays = (feed?.liveData?.plays?.allPlays ?? []).filter(
    (p) => p?.about?.inning === inningNum && p?.about?.halfInning === half,
  )

  // Each batting-side player's own fielding position as of entering THIS
  // half (see resolveBatter's doc) — a player on this side can only gain a
  // NEW fielding assignment during a half they're on DEFENSE, i.e. strictly
  // between halves from this function's point of view, never mid-way through
  // the batting half being rendered here, so one snapshot per call suffices.
  // `Infinity` for revealedThrough is safe on the same footing as BoxScore's
  // own whole-game read (defense.js's doc): this function is reveal-only and
  // only ever runs inside (inningNum, half)'s own SealBox reveal render, and
  // defenseEntering itself never looks past that half's first pitch.
  const positionEntering = new Map()
  for (const spot of defenseEntering(feed, battingSide, inningNum, half, Infinity) ?? []) {
    const cur = spot.entries[spot.entries.length - 1]
    if (cur?.id != null) positionEntering.set(cur.id, spot.position)
  }

  const entries = []
  // batterId -> index of his CURRENT (most recent) atbat card. A batter who
  // bats around comes up more than once in the half; this always points at
  // his latest trip, never a stale earlier one.
  const originIndex = new Map()
  const nameIndex = buildNameIndex(feed)

  // Pinch runners: an `offensive_substitution` whose incoming man is a Runner
  // (position abbreviation 'PR') drops a fresh runner onto the base of a runner
  // already aboard. He takes no plate appearance, so he owns no card — alias his
  // id to the runner he replaced (chained, so a pinch runner FOR a pinch runner
  // still resolves back to the batter whose card it is) so all of his later
  // baserunning flows onto that card, and record the swap so the card can strike
  // the replaced batter's name and pencil the pinch runner in (see PlayByPlay).
  // Field paths (player.id incoming, replacedPlayer.id outgoing,
  // position.abbreviation, numeric `base`) verified against gamePk 776137/776141.
  const prAlias = new Map() // pinch-runner id -> replaced runner id
  // Resolve a runner id to the card-owning batter, following pinch-runner swaps
  // to their root (an id that never pinch-ran returns unchanged).
  const rootRunner = (id) => {
    let cur = id
    const seen = new Set()
    while (prAlias.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      cur = prAlias.get(cur)
    }
    return cur
  }

  // Advancement tracking, per batter. A batter can only lead off a second
  // plate appearance in the same half (the lineup batting around) once his
  // first trip on the bases is fully resolved — scored or put out, since he
  // can't simultaneously be a live baserunner and the man due up — so these
  // maps hold at most one LIVE trip per batter id at a time. `finalizeTrip`
  // snapshots the current trip onto its card; called both when a repeat
  // batter's new card bumps out the old trip, and once at the end for every
  // batter's final (or only) trip.
  const progress = new Map() // batterId -> furthest base of his current trip (1-3, 4 = run)
  const legs = new Map() // batterId -> { baseNum: { code, slot } } for his current trip
  const earnedByBatter = new Map() // batterId -> whether his run was EARNED (only set when he scored)
  const finalizeTrip = (batterId) => {
    const cardIndex = originIndex.get(batterId)
    if (cardIndex == null) return
    const base = progress.get(batterId) ?? 0
    entries[cardIndex].scored = base === 4
    entries[cardIndex].reached = base
    entries[cardIndex].legNotations = legs.get(batterId) ?? {}
    // A run that scored UNEARNED (reached/advanced on an error or passed ball)
    // is circled on the diamond, the scorer's convention; default earned when
    // the feed doesn't say so, so a missing flag never mis-circles a clean run.
    entries[cardIndex].earned = earnedByBatter.has(batterId) ? earnedByBatter.get(batterId) : true
  }

  // Whether any real pitch has been thrown yet this half — used below to
  // recognize the half's very first pitching change (announced before its
  // first pitch) as the one selectHalfStartingPitcher already reports via
  // HalfInning's persistent "Now Pitching" card, so this feed doesn't push a
  // second, duplicate card for it.
  let anyPitchInHalf = false
  for (const play of plays) {
    const batterId = play.matchup?.batter?.id
    // `result.type === 'atBat'` is required, not just a truthy eventType — mid-
    // inning stoppages (pitching changes, defensive subs) can transiently surface
    // as their OWN top-level play before the feed folds them into the next real
    // PA's playEvents (see the header comment above); such a play carries the
    // PREVIOUS batter's stale matchup.batter with a substitution's prose as its
    // description, which would otherwise be mistaken for that batter's own card.
    // The pregame/mid-game "Game Advisory" placeholder (GAME_ADVISORY_EVENT_TYPE)
    // is excluded the same way — it carries the NEXT batter's matchup instead of
    // a stale one, but is just as much not a real plate appearance. Same guard
    // `pitchers.js` uses for batters-faced counts.
    //
    // Resolved BEFORE the playEvents scan below, not after it, because the scan
    // needs to know whether this play will get a card: a baserunning note that
    // leads one is pushed in feed order during the scan (see that branch).
    const isRealPA =
      play.result?.type === 'atBat' &&
      batterId != null &&
      !NON_PA_EVENT_TYPES.has(play.result?.eventType) &&
      play.result?.eventType !== GAME_ADVISORY_EVENT_TYPE
    const runners = play.runners ?? []

    // Non-pitch playEvents split two ways: STOPPAGE_EVENTS (mound visits,
    // subs) are their own interstitial notes; baserunning events (caught
    // stealing, pickoffs, steals, wild pitches, passed balls, balks) carry the
    // prose account of a play that has no batting result of its own — collect
    // them to hang on the card of the plate appearance they happened during
    // (they live inside that PA's playEvents), so the feed explains the out /
    // advance instead of leaving a bare mark on the diamond.
    const baserunningNotes = []
    // A pinch runner's strike-through-and-pencil-in on the ORIGIN card (the
    // batter he's running for) is a retroactive annotation, so it must not
    // appear on that earlier, already-revealed card until the pinch-running
    // notification itself is within the visible step window (ADR-0016) —
    // stepping through "he walked" must not silently show who ran for him
    // before that notification card has been reached. Each entry carries the
    // index of its own notification, NOT the enclosing play's visibility:
    // since nextStepBoundary sweeps trailing notes into the previous at-bat's
    // step, a step routinely ends MID-play, after this notice and before the
    // card of the play it leads. Gating on the play would then show "Peraza
    // runs for Schanuel" a full step before Schanuel's own card was struck
    // through — the two halves of one substitution, split across two taps.
    const pendingPinchRunnerCards = []
    // Whether a pitch has been thrown in THIS play yet — a stoppage after one
    // interrupted the at-bat in progress rather than following the previous
    // one, which is what decides the step it belongs to (see nextStepBoundary).
    let pitchInPlay = false
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) {
        anyPitchInHalf = true
        pitchInPlay = true
        continue
      }
      const et = e.details?.eventType
      if (et === 'pitching_substitution' && !anyPitchInHalf) {
        // The half's very FIRST pitching change, before its first pitch, is
        // the same identity selectHalfStartingPitcher already reads (the
        // half's first play's matchup.pitcher) and HalfInning renders as its
        // persistent "Now Pitching" card for as long as the half is
        // reachable — before AND after reveal, unlike the staged pre-pitch
        // list this mirrors (see HalfInning's PrePitchChanges, which excludes
        // a pre-pitch pitching change for the same reason). Pushing it here
        // too would duplicate that header card once this half is revealed/
        // stepped into. A genuine MID-half change (anyPitchInHalf already
        // true) still gets its own card below, same as ever.
        continue
      }
      if (et === GAME_ADVISORY_EVENT_TYPE) {
        // Mostly the feed's own lifecycle bookkeeping, which says nothing a
        // scorer writes down — but the same eventType also carries the in-game
        // stoppages (injury, on-field, weather), which ARE the account of why a
        // half stopped. isDelayAdvisory draws that line; see its own doc.
        if (!isDelayAdvisory(e.details?.description)) continue
        const text = sentenceCaseEventText(e.details.description)
        entries.push({
          kind: 'event',
          eventType: GAME_ADVISORY_EVENT_TYPE,
          midAtBat: pitchInPlay,
          // The man the delay is about when the feed names one — an injury
          // delay carries the injured player, which is who the note is for.
          playerId: e.player?.id ?? null,
          text,
          segments: linkifyNames(text, nameIndex),
        })
        continue
      }
      if (STOPPAGE_EVENTS.has(et)) {
        const text = sentenceCaseEventText(e.details.description)
        entries.push({
          kind: 'event',
          eventType: et,
          midAtBat: pitchInPlay,
          text,
          playerId: e.player?.id ?? null,
          position:
            et === 'defensive_substitution' || et === 'defensive_switch'
              ? e.position?.abbreviation ?? ''
              : undefined,
          segments: linkifyNames(text, nameIndex),
        })
      } else if (et === 'offensive_substitution' && e.position?.abbreviation === 'PR') {
        // A pinch runner entering mid-flow — its own notification at the
        // moment it happens (see pinchRunningPlayers), separate from the
        // strike-through this same swap leaves on the replaced runner's card.
        // text/segments are a fallback only (EventNote), for the vanishingly
        // unlikely case the incoming runner isn't in gameData.players.
        const text = sentenceCaseEventText(e.details?.description ?? '')
        const noteIndex = entries.length
        entries.push({
          kind: 'event',
          eventType: 'pinch_running',
          midAtBat: pitchInPlay,
          pinchId: e.player?.id ?? null,
          replacedId: e.replacedPlayer?.id ?? null,
          base: e.base ?? null,
          text,
          segments: linkifyNames(text, nameIndex),
        })
        // Alias right here, at the moment the swap happens, so a batter who
        // bats around later (and gets a fresh card + originIndex entry)
        // doesn't retroactively steal a pinch-runner note that belonged to
        // his earlier trip — this bookkeeping must stay immediate regardless
        // of stepCap, or later baserunning on this same pinch runner couldn't
        // resolve back to the right origin card. The actual card annotation
        // (pendingPinchRunnerCards) is deferred to the step check below.
        const pinchId = e.player?.id
        const replacedId = e.replacedPlayer?.id
        if (pinchId != null && replacedId != null) {
          prAlias.set(pinchId, replacedId)
          const cardIndex = originIndex.get(rootRunner(replacedId))
          if (cardIndex != null) {
            const person = feed?.gameData?.players?.[`ID${pinchId}`] ?? {}
            pendingPinchRunnerCards.push({
              cardIndex,
              noteIndex,
              id: pinchId,
              ...personNameParts(person),
              jersey: person.primaryNumber ?? '',
              base: e.base ?? null,
            })
          }
        }
      } else if (et === 'offensive_substitution' && e.player?.id != null) {
        // A pinch hitter entering mid-flow — its own "now batting" notice at
        // the moment he's announced, matching every OTHER substitution type
        // (a fresh fielder, a pitching change, a pinch runner) rather than
        // showing up with no announcement of his own, just his own at-bat
        // card a moment later (see BatterNotice, PlayByPlay.jsx). Unlike the
        // pinch-runner branch above there is no origin card to strike
        // through — he isn't replacing anyone already carded, he simply bats
        // next — so this is a plain notification, same shape as
        // pinch_running's fallback text/segments.
        const text = sentenceCaseEventText(e.details?.description ?? '')
        entries.push({
          kind: 'event',
          eventType: 'pinch_hitting',
          midAtBat: pitchInPlay,
          playerId: e.player.id,
          text,
          segments: linkifyNames(text, nameIndex),
        })
      } else if (et === 'runner_placed' && e.player?.id != null) {
        // The extra-innings automatic runner, placed on 2nd to begin the half.
        // He takes no plate appearance — no pitches, no result, no RBI — but
        // he is a live baserunner from the first pitch on, so he gets a CARD
        // rather than the sub-line under the leadoff batter he used to get.
        // That card is the whole point: registering him in `originIndex` is
        // what gives the advancement bookkeeping below somewhere to write his
        // legs, his out on the bases, and his run. Without one, every bit of
        // his trip was computed and then dropped on the floor for want of an
        // origin card — no diamond, no run in the stepped tally, and a pinch
        // runner FOR him resolving to nothing (see rootRunner/prAlias).
        //
        // `kind: 'placed'`, deliberately a THIRD kind rather than an at-bat
        // card carrying a flag. Two guards elsewhere key on `kind === 'atbat'`
        // and are correct as written only if a placement doesn't answer to it:
        // nextStepBoundary (a placement is not a step of its own — it bundles
        // forward with the leadoff plate appearance, exactly as today's event
        // note does, so no already-stored step count changes meaning) and
        // PlayByPlay's `hasAtBat` (a live half whose only fetched content is
        // the placement must not read as a whole revealed half).
        //
        // Field paths verified live against gamePk 777747's 10th, both halves:
        // `player.id` is the runner, `base` the base he's given (2), the event
        // is a non-pitch `action` nested at the head of the half's first plate
        // appearance. `runner_placed` stays in BASERUNNING_NOTE_EVENT_TYPES —
        // callout-notes.js reads that same exported set — so the duplicate
        // sub-line is suppressed by taking this branch first, not by narrowing
        // the set out from under that caller.
        const runnerId = e.player.id
        const runner = resolveBatter(feed, battingSide, runnerId, positionEntering.get(runnerId))
        const base = e.base ?? 2
        const cardIndex = entries.length
        entries.push({
          kind: 'placed',
          runnerId,
          runner,
          base,
          // The scorer's mark for the automatic runner, in the slot a batting
          // result would occupy. Books differ (AR / XIR / GR); AR is the most
          // widely used, and the card's own sentence explains it besides.
          code: 'AR',
          descSegments: linkifyNames(
            trimLeadingName(e.details?.description, runner.fullName),
            nameIndex,
          ),
          outNumber: null,
          outAt: null,
          outCode: '',
          // Seeded to the base he's GIVEN, not 0 — that's what makes his first
          // real leg (2nd → 3rd) register as a leg at 3 instead of being
          // discarded as "not past where he already stands". The two legs
          // below it are never notated: he didn't run them, and the diamond
          // draws them as the dotted ghost path instead (PlayDiamond's
          // `placedAt`).
          reached: base,
          scored: false,
          earned: true,
          legNotations: {},
        })
        originIndex.set(runnerId, cardIndex)
        progress.set(runnerId, base)
      } else if (BASERUNNING_NOTE_EVENT_TYPES.has(et) && e.details?.description) {
        // `e.player.id` on a baserunning playEvent is the runner it's about (the
        // stealer / picked-off man) — verified against a live steal — so a
        // leader call-out on a steal can key on the RUNNER, not the batter.
        // `runnerLast` rides along for the same reason the call-out keys on
        // him: these notes hang on the card of whoever was BATTING, so a
        // call-out about the runner has to name him or it reads as the
        // batter's (see api/callout-notes.js's steal families).
        const rid = e.player?.id ?? null
        const note = {
          eventType: et,
          runnerId: rid,
          runnerLast: runnerLastName(feed, rid),
          segments: linkifyNames(e.details.description, nameIndex),
          midAtBat: pitchInPlay,
        }
        baserunningNotes.push(note)
        // For a play that WILL get an at-bat card, push this event's own
        // narrative card HERE, in playEvents order, so it keeps its true
        // position against the stoppage notes pushed inline above. Collecting
        // these and flushing them after the scan (what the isRealPA branch
        // below used to do) sorted every baserunning event after every stoppage
        // in its play no matter when each happened — 49 plays in an 854-game
        // sweep, reading as cause and effect reversed: a mound visit before the
        // wild pitch that prompted it (gamePk 823102's top 3), an ejection
        // before the balk being argued (gamePk 823514's bottom 5). This moves
        // only WHERE the card lands; `card.baserunningNotes` below still gets
        // the same array, which is what callout-notes.js reads.
        //
        // A play with no card of its own is left alone — the else branch hangs
        // these on an interrupted card or pushes them standalone, and neither
        // can run until the scan has finished.
        if (isRealPA) {
          entries.push({
            kind: 'event',
            eventType: et,
            midAtBat: note.midAtBat,
            playerId: rid,
            segments: note.segments,
          })
        }
      }
    }

    // Whose plate appearance this CARD is — normally `matchup.batter`, but a
    // batter replaced mid-count can still own the result (Rule 9.15(b) — see
    // shared.js's creditedBatterId for the shape and the games behind it).
    // Carding it under `matchup.batter` regardless put the substitute's name,
    // number, position and headshot over the other man's strikeout, and left
    // trimLeadingName a name the sentence never starts with, so one card
    // printed both ("GARCIA, EDUARDO — K — Jett Williams strikes out on a foul
    // tip.", gamePk 816170's top 1).
    //
    // Only the card identity moves: `runners[]`, `progress`, `legs` and the
    // out attribution below keep speaking `matchup.batter`'s id, which is what
    // the feed's runner entries use on such a play. Safe because the rule
    // fires on strikeouts only — the credited batter is out, with no trip for
    // that bookkeeping to lose.
    const cardBatterId = isRealPA ? creditedBatterId(feed, play, batterId) : batterId

    if (isRealPA) {
      const batter = resolveBatter(
        feed,
        battingSide,
        cardBatterId,
        positionEntering.get(cardBatterId),
      )
      const { pitchEvents, pitches, pitchDetails } = pitchCardInfo(feed, play)
      const pitcher = matchupPitcher(feed, play)

      // A baserunning event nested in THIS play's own events (a steal, wild
      // pitch, passed ball…) happened DURING this plate appearance, before its
      // own batted-ball result, and has already been pushed as its own leading
      // notification card up in the playEvents scan — in feed order, so it sits
      // correctly against any stoppage note from the same play. `card
      // .baserunningNotes` below carries the same events for callout-notes.js.

      const cardIndex = entries.length
      // A batter who reaches safely and is then thrown out stretching for an
      // extra base (singled, out at 2nd on the throw) gets TWO runners[]
      // entries on this SAME play: his own plate-appearance result
      // (`movement.start` null — he started this leg from home) and a later,
      // separate leg for the extra-base attempt (`movement.start` set — he
      // was already standing on a base when THAT leg happened). Prefer the
      // start-null entry here so scorebookCode reads his own hit, not the
      // out that came after it (see `stretchOut` below, which reads the
      // other one). Verified against gamePk 817477's bottom 2nd (Cameron
      // Sisneros singles, out at 2nd on the throw): two entries, same
      // playIndex, reach-then-out in that order — falling back to the bare
      // `.find()` keeps this a no-op for the common one-entry case.
      const batterRunner =
        runners.find((r) => r.details?.runner?.id === batterId && r.movement?.start == null) ??
        runners.find((r) => r.details?.runner?.id === batterId)
      const card = {
        kind: 'atbat',
        batterId: cardBatterId,
        // The play's own identity + result event, for the leader/scoring-first
        // call-outs (see api/callouts.js): the batter's PA result eventType
        // (home_run, walk, strikeout…) drives which leader note can fire, and
        // atBatIndex lets the caller mark the play that scored the game's first
        // run. Spoiler-free to READ here — this whole module is reveal-only.
        atBatIndex: play.about?.atBatIndex ?? null,
        eventType: play.result?.eventType ?? null,
        // The terminal pitch's playId — matches a video highlight clip's guid
        // 1:1 (see api/highlights.js). Verified against both batted-ball and
        // strikeout-ending plays; null when the PA has no pitch events on
        // record (shouldn't happen for a real PA, but null-guard anyway).
        playId: pitchEvents.at(-1)?.playId ?? null,
        batter,
        pitcher,
        pitches,
        pitchDetails,
        // The side this PA was actually batted from ('L'/'R') — read off the
        // play's own matchup rather than the player's default batSide, since a
        // switch hitter's real side varies by at-bat. Feeds the pitch-zone
        // panel's batter-box silhouette; spoiler-free (bio fact, not a result).
        batSide: play.matchup?.batSide?.code ?? '',
        rbi: play.result?.rbi ?? 0,
        // The full prose account of the play (batter name trimmed off the
        // front — it's already on the card), split so the other players named
        // in it (fielders, a scoring runner) render as uppercase spans.
        descSegments: linkifyNames(
          trimLeadingName(play.result?.description, batter.fullName),
          nameIndex,
        ),
        // Scorebook denotation drawn above the diamond (1B, F8, 6-3…).
        ...scorebookCode(play, batterRunner),
        // Prose for any baserunning event (a steal, a caught stealing, a wild
        // pitch…) that occurred during this plate appearance.
        baserunningNotes,
        outNumber: null,
        // Furthest base this batter reached / whether he scored — filled in
        // by the advancement bookkeeping below, which follows him as a
        // baserunner across the rest of his trip.
        reached: 0,
        scored: false,
        earned: true,
        // The live, still-in-progress PA: no result yet, so `code` above is
        // empty. `about.isComplete: false` is the feed's own signal (verified
        // live, gamePk 824238). A count in progress is not a spoiler.
        live: play.about?.isComplete === false ? { balls: play.count?.balls ?? 0, strikes: play.count?.strikes ?? 0 } : null,
      }
      entries.push(card)
      // A repeat plate appearance — the lineup batting around — bumps out
      // whatever's tracked under this batter id. His prior trip is already
      // fully resolved (out or scored) by now, so bank it on his earlier
      // card before resetting for this new trip.
      // Keyed on the card's OWNER (cardBatterId), so this map and `card
      // .batterId` never disagree about whose card index this is.
      if (originIndex.has(cardBatterId)) {
        finalizeTrip(cardBatterId)
        progress.delete(cardBatterId)
        legs.delete(cardBatterId)
        earnedByBatter.delete(cardBatterId)
      }
      originIndex.set(cardBatterId, cardIndex)

      if (batterRunner?.movement?.isOut) {
        card.outNumber = batterRunner.movement.outNumber
      }
      // The stretching-out leg itself (see batterRunner's doc above) — drawn
      // on his own diamond the same way any other runner's caught-advancing
      // out is (a capped path + the fielding chain, by the base he was
      // retired at); his own hit is already covered by scorebookCode above.
      const stretchOut = runners.find(
        (r) => r.details?.runner?.id === batterId && r.movement?.isOut && r.movement?.start != null,
      )
      if (stretchOut) {
        card.outNumber = stretchOut.movement.outNumber
        card.outAt = BASE_NUM[stretchOut.movement.outBase] ?? null
        card.outCode = runnerOutCode(play, stretchOut)
      }
    } else {
      // A top-level baserunning play with no plate appearance of its own — an
      // inning-ending caught stealing or pickoff, or a walk-off steal / wild
      // pitch — closes out whoever was mid-count at the plate. Two accounts
      // ride this play and would otherwise vanish:
      //
      //  1. The prose. Unlike a MID-PA baserunning event (a nested playEvent
      //     with its own description, collected into baserunningNotes above),
      //     a top-level play's account lives only in its result.description
      //     (verified against gamePk 823764, bottom 7: "Cooper Pratt caught
      //     stealing 2nd base…" appears in no playEvent). Fold it in as a note
      //     unless a nested note already told the same story.
      //  2. The interrupted at-bat itself. The play's pitch events are the
      //     pitches thrown to the batter who was up — they are NOT re-listed
      //     when his at-bat restarts from scratch next inning (same feed fact
      //     derive.js/pitchers.js lean on to count these pitches; see
      //     NON_PA_EVENT_TYPES' doc). Verified against the same game: Luis
      //     Lara saw 4 pitches (1-2) on the caught_stealing_2b play, then led
      //     off the 8th with a fresh count. Without a card those pitches
      //     appear in the half's PITCHES total but nowhere in the feed.
      //
      // So: with pitches on record, emit an INTERRUPTED at-bat card for the
      // batter — pitch ladder and zone detail as usual, but no scorebook code,
      // no out badge, an empty diamond, and the prose notes attached — else
      // fall back to standalone event notes. The batter deliberately does NOT
      // enter originIndex: he never reached base, and any runner attribution
      // must keep resolving to real cards (his own earlier trip this half, if
      // the lineup batted around).
      const isBaserunningPlay =
        play.result?.type === 'atBat' && NON_PA_EVENT_TYPES.has(play.result?.eventType)
      const notes = [...baserunningNotes]
      if (
        isBaserunningPlay &&
        play.result?.description &&
        !notes.some((n) => n.eventType === play.result?.eventType)
      ) {
        const outRunner = runners.find((r) => r.movement?.isOut) ?? runners[0]
        const rid = outRunner?.details?.runner?.id ?? null
        notes.push({
          eventType: play.result.eventType,
          runnerId: rid,
          runnerLast: runnerLastName(feed, rid),
          segments: linkifyNames(play.result.description, nameIndex),
        })
      }
      const { pitchEvents, pitches, pitchDetails } =
        isBaserunningPlay && batterId != null ? pitchCardInfo(feed, play) : { pitchEvents: [] }
      // A half can only truly end on THIS play if it recorded the half's 3rd
      // out, or the game itself is over (a walk-off steal/wild pitch/passed
      // ball/balk with the bases loaded — none of those carry an out of their
      // own, but ending the GAME necessarily ends the half too). Checked
      // against `play.count.outs` (outs AFTER this play), not merely whether
      // SOME runner was put out here — a caught stealing/pickoff for the
      // half's 1st or 2nd out doesn't end anything either, and the card's own
      // text flatly claims "the inning ended on the bases," which would be
      // false for those. Without this guard at all, a plain stolen base —
      // which never records an out and so can never by itself end a half —
      // was misread as inning-ending the moment it showed up as its own
      // top-level play, which the live feed does transiently mid-poll (before
      // folding the steal into the still-in-progress batter's own plate-
      // appearance update) — the same transient-top-level-play artifact
      // already documented for mound visits/pitching changes at the top of
      // this file. That produced a bogus "SB →" interrupted at-bat card while
      // the batter was still up, which vanished again once the batter's real,
      // completed PA arrived on a later poll (observed live, Brewers @
      // Giants). With this guard a play that isn't genuinely the 3rd out (or
      // game-ending) always falls through to the plain event-note branch
      // below instead — the runner's own "stole 2nd base"/"caught stealing"
      // card, with no claim the at-bat or the half ended.
      const halfCouldEndHere =
        play.count?.outs === 3 || feed?.gameData?.status?.abstractGameState === 'Final'
      if (pitchEvents.length > 0 && halfCouldEndHere) {
        // The interruption sentence is the card's own description (there is no
        // batting result to describe); the count at the stoppage is a real
        // scorer's note — on an inning-ending play it does NOT carry over
        // (the batter restarts at 0-0), so it exists nowhere else.
        const { balls, strikes } = play.count ?? {}
        const countTail =
          balls != null && strikes != null ? ` with the count ${balls}-${strikes}` : ''
        entries.push({
          kind: 'atbat',
          interrupted: true,
          batterId,
          atBatIndex: play.about?.atBatIndex ?? null,
          eventType: play.result?.eventType ?? null,
          playId: pitchEvents.at(-1)?.playId ?? null,
          batter: resolveBatter(feed, battingSide, batterId, positionEntering.get(batterId)),
          pitcher: matchupPitcher(feed, play),
          pitches,
          pitchDetails,
          batSide: play.matchup?.batSide?.code ?? '',
          rbi: play.result?.rbi ?? 0,
          descSegments: [
            { text: `At-bat not completed — the inning ended on the bases${countTail}.` },
          ],
          code: interruptedCode(play.result?.eventType),
          codeKind: 'interrupted',
          baserunningNotes: notes,
          outNumber: null,
          reached: 0,
          scored: false,
          earned: true,
          legNotations: {},
        })
      } else {
        for (const n of notes) {
          entries.push({
            kind: 'event',
            eventType: n.eventType,
            // No pitch was thrown in this play at all — that's why there's no
            // card to hang the prose on — so it interrupted no at-bat and
            // steps with the one before it (see nextStepBoundary).
            midAtBat: false,
            playerId: n.runnerId,
            segments: n.segments,
          })
        }
      }
    }

    // This play's own card/notes (if any) just pushed above — whether ITS
    // effect on other, already-carded runners may be applied yet depends on
    // whether the play itself is within the visible step window.
    const visible = stepCap == null || entries.length <= stepCap

    // See pendingPinchRunnerCards above — only pencil the incoming runner
    // onto the origin card once the pinch-running notification that announces
    // him is itself within the visible step window. Keyed on that NOTICE's
    // own index rather than the enclosing play's `visible`: a step ends after
    // the notes trailing an at-bat and before the card of the play they lead
    // (nextStepBoundary), so `visible` is false for that play precisely when
    // the notice IS on screen — which would show the swap announced and the
    // struck-through name a whole tap apart.
    for (const p of pendingPinchRunnerCards) {
      if (stepCap != null && p.noteIndex >= stepCap) continue
      const card = entries[p.cardIndex]
      card.pinchRunners = card.pinchRunners ?? []
      card.pinchRunners.push({ id: p.id, last: p.last, first: p.first, jersey: p.jersey, base: p.base })
    }

    // A runner other than this play's batter can also be put out here — a
    // force, a caught stealing, the back half of a double play. That runner
    // already has their own card from when they batted (walked, singled...),
    // several cards back. This later out only adds their sequence number to
    // that card; it doesn't replace how they got on base with a description
    // of the play that ended it.
    if (visible) {
      for (const r of runners) {
        const rid = r.details?.runner?.id
        if (rid == null || rid === batterId || !r.movement?.isOut) continue
        // A pinch runner resolves back to the card of the batter he ran for.
        const origin = originIndex.get(rootRunner(rid))
        if (origin == null) continue // no known origin card — nothing to attach to
        entries[origin].outNumber = r.movement.outNumber
        // Where and how he was cut down, for the diamond's tick + out code.
        entries[origin].outAt = BASE_NUM[r.movement.outBase] ?? null
        entries[origin].outCode = runnerOutCode(play, r)
      }
    }

    // Advancement bookkeeping for this same play, folded into this same
    // per-play pass (rather than a separate walk over `plays`) so a repeat
    // batter's finalize-and-reset above lands strictly between his two
    // trips, instead of conflating them under one cumulative "furthest base
    // reached." Record the furthest base each runner reached this play (and
    // whether he scored) into `progress`/`legs`, so his diamond can shade the
    // bases he legged out — filled solid when he came around to score. Also
    // record, per base, HOW he got there (BB, GO, 2B…), for the notations
    // drawn along the base paths — with the lineup slot of the hitter who
    // drove him over — but for the BATTER's own trip only the base BEYOND
    // what his own reach code already implies gets a notation (see
    // NATURAL_BASE below) — a double's "2B" up top already explains 2nd; it's
    // only a further, same-play bonus base (a single plus a fielding error
    // that lets him take an extra 90 feet) that needs its own leg label. Only
    // a plate appearance credits a hitter; steals/wild pitches advance a
    // runner on their own, so those carry no slot. An out on the bases
    // doesn't advance him.
    // The credited batter's slot, not the finisher's — it is his plate
    // appearance that drove a runner over. A substitute always takes the slot
    // of the man he replaced anyway, so the two agree in practice.
    const batterSlot = isRealPA ? battingSlot(feed, battingSide, cardBatterId) : null
    // The feed can split one runner's multi-base move into separate legs, and
    // NOT only across separate plays: when a wild pitch / steal happens mid-
    // count during the FOLLOWING batter's plate appearance, that batter's own
    // play carries the earlier runner's whole rest-of-the-way chain in its
    // OWN runners[] array — one entry per leg, each with its own eventType,
    // in chronological order (verified against gamePk 818039's bottom 5th:
    // Yerlin Confidan's single-play `runners[]` holds Alfredo Duno's 1B→2B
    // wild-pitch leg, then his 2B→3B steal leg, then his 3B→score leg off
    // the single itself — three entries, one runner, one play). A single
    // play can also stretch a steal into a further base on a throwing error
    // the same way (gamePk 817477's top 2nd: Ben McLaughlin's 1B→2B steal
    // leg, then a separate 2B→3B error leg on the same play). So: give EVERY
    // entry its own notation — comparing each leg's base against how far
    // this runner has progressed SO FAR (across earlier plays and any
    // earlier leg already processed this same play) rather than collapsing a
    // play down to one "furthest" leg, which used to silently drop every
    // intermediate leg's own code (a runner who WP'd to 2nd then stole 3rd
    // used to show only his eventual "reached home" notation, with no trace
    // of the WP or the SB). How he advanced is read from the runner's OWN
    // movement event, not the play's batting result: a steal / wild pitch /
    // passed ball / balk during another batter's PA is recorded on the
    // runner (details.eventType), so it must be tagged SB/WP/PB/BK rather
    // than the batter's BB/K/GO. Such a self-advance credits no hitter (slot
    // null); an advance driven by the batter's plate appearance credits his
    // lineup slot.
    if (visible) {
      // The batter's own natural reach base (his top-of-diamond code already
      // explains it) — a further base on this same play only gets a leg
      // notation once he's past it.
      const naturalBase = NATURAL_BASE[play.result?.eventType] ?? 1
      // One continuous advance can still arrive as several same-play legs
      // (2nd-to-3rd, then 3rd-to-home off the same hit) rather than the
      // genuinely different-eventType legs the per-leg notation above exists
      // for (WP then SB, SB then E5). Track the immediately preceding leg
      // written for each runner WITHIN THIS PLAY ONLY, so a leg whose code
      // and slot match it collapses onto the furthest base instead of
      // penciling the same mark twice.
      const playLastLeg = new Map()
      for (const r of runners) {
        const rid = r.details?.runner?.id
        if (rid == null || r.movement?.isOut) continue
        const base = BASE_NUM[r.movement?.end] ?? 0
        if (base === 0) continue
        // Credit a pinch runner's advance to the batter whose card he inherited.
        const canon = rootRunner(rid)
        // Not a genuine leg — this entry doesn't move him past where he
        // already stands, whether from an earlier play or an earlier leg
        // within THIS same play (processed in feed order above).
        if (base <= (progress.get(canon) ?? 0)) continue
        const rEt = r.details?.eventType
        const code = legAdvanceCode(play, r)
        const slot = rEt && NO_SLOT_CREDIT_EVENT_TYPES.has(rEt) ? null : batterSlot
        progress.set(canon, base)
        // A run (base 4) records whether it was earned — false only when the
        // feed explicitly says so, so a clean run is never mistakenly circled.
        if (base === 4) earnedByBatter.set(canon, r.details?.earned !== false)
        const prevLeg = playLastLeg.get(canon)
        if (canon !== batterId) {
          const m = legs.get(canon) ?? {}
          if (prevLeg && prevLeg.code === code && prevLeg.slot === slot) delete m[prevLeg.base]
          m[base] = { code, slot }
          legs.set(canon, m)
          playLastLeg.set(canon, { base, code, slot })
        } else if (base > naturalBase) {
          // A bonus base on the batter's own trip — attribute it to this
          // play's error (the fielder who's actually charged, even if the
          // feed's own error credit landed on a different runner's leg —
          // see playErrorCredit) when there is one, else fall back to the
          // same code his fellow baserunners would get for this play. No
          // slot superscript here — that notes which TEAMMATE's at-bat
          // drove a runner over, and a batter can't drive himself.
          const m = legs.get(canon) ?? {}
          const ownCode = playErrorCredit(play) ?? code
          if (prevLeg && prevLeg.code === ownCode && prevLeg.slot === null) delete m[prevLeg.base]
          m[base] = { code: ownCode, slot: null }
          legs.set(canon, m)
          playLastLeg.set(canon, { base, code: ownCode, slot: null })
        }
      }
    }
  }

  // Bank every batter's final (or only) trip.
  for (const batterId of originIndex.keys()) finalizeTrip(batterId)

  return entries
}
