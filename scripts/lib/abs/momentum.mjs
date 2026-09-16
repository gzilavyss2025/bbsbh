// AFTER A WIN, AFTER A LOSS — and the control that is most of the work. The
// sixth pure part of the job behind gen-abs-challenges.mjs (rows.mjs makes the
// rows, bank.mjs replays the bank, chances.mjs counts the denominator,
// ranout.mjs finds the nights a club emptied it, streaks.mjs walks the runs,
// export.mjs ships the file).
//
// THE QUESTION. A club has just had a call go its way, or against it. Does it
// ask again sooner?
//
// THE CONFOUND, which produces a false finding if it is skipped. After a
// failed challenge a club has one fewer in hand, and after two it has none. It
// therefore challenges less afterwards BY RULE, and nothing about nerve,
// confidence or momentum is involved.
//
// Counted straight, the season on file says a club asks 15.21 times per 100
// armed half-innings after a win and 11.31 after a loss — a 26% drop that
// reads as a psychological effect and IS THE RULEBOOK.
//
// HELD EQUAL it is a different number. Take only a club's SECOND challenge of
// the night, with exactly two called and exactly one still in hand, so the one
// thing separating two clubs is how the last call went: 12.71 after a win
// against 12.81 after a loss. The gap all but vanishes and tips the other way.
// Triple-A, held the same way, gives 14.61 against 14.06 — the same size, the
// opposite sign. TWO INDEPENDENT LEAGUES THAT DISAGREE ON THE SIGN HAVE NOT
// FOUND AN EFFECT, and both cuts ship so a reader can see that for himself
// rather than take a sentence for it.
//
// At PLAYER level the same control gives 3.80 against 3.19 in MLB and 4.90
// against 3.72 in Triple-A. Those agree in sign and are worth one to two
// standard errors, which is suggestive and is not a result. The reader ships
// the error beside the gap for that reason (absChallenges.js).
//
// CENSORING IS HANDLED BY THE RATE, NOT BY AVERAGING A WAIT. "Innings until
// the next challenge" cannot be averaged: a club that never asks again has no
// wait to average, and dropping it keeps only the clubs that did ask, which is
// the answer written into the question. So the measure is challenges called
// afterwards over the half-innings the club played still holding one — the
// same denominator chances.mjs uses, which needs the game's length
// (docs/adr/0075).
//
// NO PER-CLUB SPLIT, DELIBERATELY. MLB's 1,459 second challenges over 30 clubs
// is 49 each against an effect of a tenth of a challenge per 100 half-innings.
// A board drawn that way would be manufacturing noise and then ranking it.

import { HALVES, halfKey, replayBank } from './bank.mjs'
import { halfPlayed } from './chances.mjs'

// The two cells every cut is reported in. `strict` is the control: the club's
// second call of the night, with one still in hand.
//
// A CLUB'S SECOND CALL CAN LEAVE IT HOLDING 2, 1 OR 0 — two wins, one of each,
// or two losses. Only the middle case is comparable, and it splits cleanly by
// the last outcome: a club that won its second call got there by losing its
// first, and one that lost its second got there by winning its first. Same
// rulebook position, opposite last night's news.
const STRICT_CALLED = 2
const STRICT_IN_HAND = 1

function cell() {
  return { events: 0, next: 0, chances: 0 }
}

function sealed(c) {
  return { ...c, rate: c.chances > 0 ? c.next / c.chances : null }
}

// Top before bottom, then the order the rows were written in.
function inOrder(challenges) {
  return [...challenges].sort(
    (a, b) =>
      a.inning - b.inning ||
      (a.half === 'top' ? 0 : 1) - (b.half === 'top' ? 0 : 1) ||
      (a.seq ?? 0) - (b.seq ?? 0),
  )
}

// HALF-INNINGS LEFT IN THE GAME THAT THE CLUB COULD HAVE ARGUED IN — the
// denominator, counted from the half AFTER the one the challenge was called
// in.
//
// The challenge's own half is excluded. A club that asks in the top of the
// sixth and asks again in the top of the sixth is not the question; the
// question is what it did from there on, and counting the half it is already
// standing in would credit it an opportunity it has just used.
//
// `atHalf` is what the club held ENTERING each half (bank.mjs), which is
// exactly the test: a club that has run out offers nothing until an extra
// inning arms it again, and then offers those halves honestly.
function armedHalvesAfter(atHalf, from, game) {
  const last = game.final_inning
  let halves = 0
  for (let inning = from.inning; inning <= last; inning++) {
    for (const half of HALVES) {
      if (inning === from.inning && !after(from, half)) continue
      if (!halfPlayed(inning, half, last, game.bottom_played)) continue
      if ((atHalf.get(halfKey(inning, half)) ?? 0) === 0) continue
      halves += 1
    }
  }
  return halves
}

// Within the challenge's own inning, which halves come after it. Only the
// bottom can follow a top.
function after(from, half) {
  return from.half === 'top' && half === 'bottom'
}

// Is this later challenge in a half the denominator counts — a half strictly
// after the one `from` was called in?
function afterHalf(from, later) {
  if (later.inning !== from.inning) return later.inning > from.inning
  return after(from, later.half)
}

// ONE CLUB'S NIGHT, folded into the cells. Every challenge the club called is
// an event, and what follows it is measured from the bank the rule left it
// with.
//
// A game with no length on file is skipped rather than counted short, for the
// reason chances.mjs gives: a NULL read as nought innings would shrink every
// denominator and inflate every rate. `--recheck` backfills the column, so the
// skip is expected to be dead code.
function foldClubGame(challenges, game, out) {
  if (game?.final_inning == null) return
  const ordered = inOrder(challenges)
  const { atHalf, calls } = replayBank(ordered, game.final_inning, game.scheduled_innings ?? null)

  for (let i = 0; i < calls.length; i++) {
    const { at, called, held } = calls[i]
    const won = at.outcome === 'success'
    const chances = armedHalvesAfter(atHalf, at, game)
    // The same club's later calls, and the same MAN's later calls.
    //
    // COUNTED OVER THE SAME HALVES THE DENOMINATOR OFFERS, which is what makes
    // the ratio a rate at all. A club that challenges twice in one half-inning
    // — Keibert Ruiz did it in the first inning on 15 June — contributes
    // neither a chance nor a call from that half: the denominator starts at the
    // next one, so the numerator must too. Counting every later call against a
    // denominator that begins a half later is how a rate quietly exceeds what
    // the club was ever offered.
    let nextClub = 0
    let nextPlayer = 0
    for (let j = i + 1; j < calls.length; j++) {
      const later = calls[j].at
      if (!afterHalf(at, later)) continue
      nextClub += 1
      if (at.player_id != null && later.player_id === at.player_id) nextPlayer += 1
    }

    for (const [unit, next] of [['club', nextClub], ['player', nextPlayer]]) {
      const side = won ? 'win' : 'loss'
      const naive = out[unit].naive[side]
      naive.events += 1
      naive.next += next
      naive.chances += chances
      if (called === STRICT_CALLED && held === STRICT_IN_HAND) {
        const strict = out[unit].strict[side]
        strict.events += 1
        strict.next += next
        strict.chances += chances
      }
    }
  }
}

// Both cuts, for both units, over one level's rows.
export function momentumCuts(rows, games) {
  const byGameTeam = new Map()
  for (const r of rows) {
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r)
    byGameTeam.set(key, list)
  }
  const gameByPk = new Map(games.map((g) => [g.game_pk, g]))

  const out = {
    club: { naive: { win: cell(), loss: cell() }, strict: { win: cell(), loss: cell() } },
    player: { naive: { win: cell(), loss: cell() }, strict: { win: cell(), loss: cell() } },
  }
  for (const [key, challenges] of byGameTeam) {
    foldClubGame(challenges, gameByPk.get(Number(key.split(':')[0])), out)
  }

  return {
    club: {
      naive: { win: sealed(out.club.naive.win), loss: sealed(out.club.naive.loss) },
      strict: { win: sealed(out.club.strict.win), loss: sealed(out.club.strict.loss) },
    },
    player: {
      naive: { win: sealed(out.player.naive.win), loss: sealed(out.player.naive.loss) },
      strict: { win: sealed(out.player.strict.win), loss: sealed(out.player.strict.loss) },
    },
  }
}
