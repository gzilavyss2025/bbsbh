// The lens bar's plain words (#724): "Okafor doubled." for the box just
// opened, then "Quillen to 3rd." for each runner that play moved.
//
// READS ONLY OPENED CARDS. Both functions take cards off the scorecard page's
// clamped `view` (see situation.js's header), never the feed, so they cannot
// name a sealed at-bat or a runner's later fate. runnerMoves diffs two renders
// of the sheet, the same idea as the page's ink-in diff; it never looks ahead.
//
// The runner reads reuse Express Lane's runnersOnBase / runnersDeparted. They
// read only the cards they are given, which is exactly this footing.

import { cardKey, runnersDeparted, runnersOnBase } from '../../api/expresslane/runners.js'
import { baseWord, runnerName } from './situation.js'

// The verbs in the #724 brief, section 4, and the other outs and reaches the
// feed sends in most games (sacrifices, force outs, double plays,
// interference), so line A is a sentence. An event not here still falls back
// to the feed's own eventType words, set off as a label ("Okafor: runner
// double play."), never a broken sentence.
const VERBS = {
  single: 'singled',
  double: 'doubled',
  triple: 'tripled',
  home_run: 'homered',
  walk: 'walked',
  intent_walk: 'walked',
  hit_by_pitch: 'was hit by a pitch',
  strikeout: 'struck out',
  strikeout_double_play: 'struck out',
  grounded_into_double_play: 'grounded into a double play',
  fielders_choice: 'reached on a fielder’s choice',
  fielders_choice_out: 'reached on a fielder’s choice',
  sac_fly: 'hit a sacrifice fly',
  sac_fly_double_play: 'hit a sacrifice fly into a double play',
  sac_bunt: 'laid down a sacrifice bunt',
  sac_bunt_double_play: 'bunted into a double play',
  force_out: 'hit into a force out',
  double_play: 'hit into a double play',
  triple_play: 'hit into a triple play',
  strikeout_triple_play: 'struck out',
  catcher_interf: 'reached on catcher’s interference',
  batter_interference: 'was out for interference',
  fan_interference: 'reached on fan interference',
  other_out: 'was out',
}
// A field_out takes its verb from the out kind the sheet already prints
// (classifyOut, card.outType).
// classifyOut can also read a double play or a sacrifice off the description;
// any other field_out is just an out.
const OUT_VERBS = {
  GO: 'grounded out',
  FO: 'flied out',
  LO: 'lined out',
  PO: 'popped out',
  DP: 'hit into a double play',
  SF: 'hit a sacrifice fly',
  SAC: 'laid down a sacrifice bunt',
}
// The fielder by scorebook number, for "reached on an error by the shortstop".
// Not select.js's POSITION_LOWER: that map names the position ("first base"),
// and this line needs the man ("first baseman").
const FIELDERS = ['', 'pitcher', 'catcher', 'first baseman', 'second baseman', 'third baseman',
  'shortstop', 'left fielder', 'center fielder', 'right fielder']

function verbFor(card) {
  const et = card.eventType
  if (et === 'field_error') {
    const fielder = FIELDERS[Number(String(card.code ?? '').slice(1))]
    return fielder ? `reached on an error by the ${fielder}` : 'reached on an error'
  }
  if (et === 'field_out') return OUT_VERBS[card.outType] ?? 'was out'
  return VERBS[et] ?? null
}

// The opened box in words: { name, verb, atBatIndex, text }, or null for a box
// that holds no result of the batter's own (the placed runner, an at-bat the
// half ended in the middle of, a live count).
export function playWords(card) {
  if (card?.kind !== 'atbat' || card.interrupted || !card.eventType) return null
  const name = card.batter?.last ?? ''
  const verb = verbFor(card)
  const who = name || 'The batter'
  // An unknown event: the feed's own words as a label, not as a verb.
  const text = verb ? `${who} ${verb}.` : `${who}: ${card.eventType.replaceAll('_', ' ')}.`
  return { name, verb: verb ?? card.eventType.replaceAll('_', ' '), atBatIndex: card.atBatIndex ?? null, text }
}

// Which box a move belongs to, for the runner-move tint: `pa:{atBatIndex}`, or
// `placed:{runnerId}` for the extra-innings placed runner, who took no plate
// appearance and so has no atBatIndex to match on.
export const moveKey = cardKey

// What the newest step did to the men already on base: [{ name, kind: 'to' |
// 'scores' | 'out', base, from, atBatIndex, key }], lead runner first. `base` is
// where he went (4 = home); an out with no recorded base has `base: null`.
// The batter's own box is not a move: playWords says it.
export function runnerMoves(prevCards, nextCards) {
  const was = new Map(runnersOnBase(prevCards).map(({ base, card }) => [cardKey(card), base]))
  const move = (card, kind, base, from) => ({
    name: runnerName(card),
    kind,
    base,
    from,
    atBatIndex: card.atBatIndex ?? null,
    // The box to tint (moveKey): the placed runner has no atBatIndex.
    key: cardKey(card),
  })
  const moves = []
  for (const { base, card } of runnersOnBase(nextCards)) {
    const from = was.get(cardKey(card))
    if (from != null && base > from) moves.push(move(card, 'to', base, from))
  }
  for (const { from, card, fate } of runnersDeparted(prevCards, nextCards)) {
    moves.push(fate === 'scored' ? move(card, 'scores', 4, from) : move(card, 'out', card.outAt, from))
  }
  return moves.sort((a, b) => b.from - a.from)
}

export function movesText(moves) {
  return (moves ?? [])
    .map((m) => {
      const what =
        m.kind === 'to' ? `to ${baseWord(m.base)}` : m.kind === 'scores' ? 'scores' : m.base ? `out at ${baseWord(m.base)}` : 'out'
      return `${m.name || 'The runner'} ${what}.`
    })
    .join(' ')
}
