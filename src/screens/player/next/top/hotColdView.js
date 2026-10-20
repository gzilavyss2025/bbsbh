// The words of one hot or cold callout (#1855), from a flag of api/hotcold/rule.js. Pure.
//
//   kicker  the sample's weight: "Early start" | "Stretch" | "Full season" (the card's
//           count tag says hot or cold, see toneTag)
//   figure  the stat, alone on its line: "9 HR", ".168 AVG", "2.16 ERA"
//   rest    the sample it is over: "In 40 games (0.23 a game)", "Through 52.1 innings"
//   hint    where it sits, said the way a person would say it and counted exactly
//           (Gary, 2026-10-20): "Only 5 pitchers in the last 10 years had a better ERA
//           over a full season."
//   list    those seasons, ranked, with his own in its place (listView)
import { rate3 } from '../../../../api/person/shared.js'
import { outsToIp } from '../../../../lib/math/innings.js'
import { EARLY_UNDER } from '../../../../api/hotcold/rule.js'
import { FULL_SEASON } from '../../../../api/hotcold/line.js'

const pct = (v) => `${(v * 100).toFixed(1)}%`
const two = (v) => v.toFixed(2)
const WEIGHT = { early: 'Early start', firm: 'Stretch', real: 'Full season' }
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// [figure, rest] for each stat, from the flag's value and his counted line.
const WORDS = {
  hitting: {
    ops: (f, l, n) => [`${rate3(f.value)} OPS`, `through ${n} games`],
    avg: (f, l, n) => [`${rate3(f.value)} AVG`, `through ${n} games`],
    hr: (f, l, n) => [`${l.hr} HR`, `in ${n} games (${two(l.hr / l.g)} a game)`],
    so: (f, l, n) => [`${pct(f.value)} K rate`, `through ${n} games (${l.so} K in ${l.pa} PA)`],
    bb: (f, l, n) => [`${pct(f.value)} walk rate`, `through ${n} games (${l.bb} BB in ${l.pa} PA)`],
    sb: (f, l, n) => [`${l.sb} SB`, `in ${n} games`],
  },
  pitching: {
    era: (f, l, n) => [`${two(f.value)} ERA`, `through ${n} innings`],
    whip: (f, l, n) => [`${two(f.value)} WHIP`, `through ${n} innings`],
    so: (f, l, n) => [`${pct(f.value)} K rate`, `through ${n} innings (${l.so} K, ${l.bf} batters)`],
    bb: (f, l, n) => [`${pct(f.value)} walk rate`, `through ${n} innings (${l.bb} BB, ${l.bf} batters)`],
    hr: (f, l, n) => [`${l.hr} HR allowed`, `in ${n} innings`],
  },
}

// The stat in the sentence, singular: "a better ERA", "a worse batting average". Singular
// on purpose: the page's caps turn a plural "ERAs" into "ERAS".
const NOUN = {
  hitting: { ops: 'OPS', avg: 'batting average', hr: 'home-run pace', so: 'strikeout rate', bb: 'walk rate', sb: 'stolen-base pace' },
  pitching: { era: 'ERA', whip: 'WHIP', so: 'strikeout rate', bb: 'walk rate', hr: 'home-run rate' },
}

// The sample in words (Gary, 2026-10-20): "this early in a season" under EARLY_UNDER,
// "over a full season" from FULL_SEASON (line.js; the count then reads final lines), else
// the checkpoint's count, "through 80 games".
export function sampleWords(checkpoint, unit) {
  if (checkpoint < EARLY_UNDER) return 'this early in a season'
  if (checkpoint >= FULL_SEASON) return 'over a full season'
  return `through ${checkpoint} ${unit}`
}

// The sentence, from the exact list of past seasons further out than his. The pool counts
// player-seasons: when no player is in the list twice it says "Only 5 pitchers", and when
// one is, "Only 5 times … has a pitcher", so the count stays true. With no list (its file
// failed to load) it says "Among the best … in the last 10 years", with no number.
export function hintWords({ beyond, tone, who, noun, sample, years }) {
  const side = tone === 'hot' ? 'better' : 'worse'
  const one = who.slice(0, -1)
  if (!beyond) return `Among the ${tone === 'hot' ? 'best' : 'worst'} ${sample}${years}.`
  const c = beyond.length
  if (c === 0) return `No ${one}${years} had a ${side} ${noun} ${sample}.`
  const players = new Set(beyond.map((b) => b.id)).size
  if (players === c) return `Only ${c} ${c === 1 ? one : who}${years} had a ${side} ${noun} ${sample}.`
  return `Only ${c} times${years} has a ${one} had a ${side} ${noun} ${sample}.`
}

// One value in a list row, in the stat's own terms.
const per = (v, unit) => (v > 0 ? `1 per ${Math.round(1 / v)} ${unit}` : `0 per ${unit}`)
const LIST_VALUE = {
  hitting: { ops: rate3, avg: rate3, hr: (v) => per(v, 'PA'), so: pct, bb: pct, sb: (v) => `${two(v)} a game` },
  pitching: { era: two, whip: two, so: pct, bb: pct, hr: (v) => per(v, 'batters') },
}

// The rows a list shows before it says "and N more".
export const LIST_MAX = 25

// The seasons further out than his, ranked, then his own: { rows, more }, each row
// { rank, id, name, season, value, self }. Null when the list is unknown or empty, so there
// is nothing to open.
export function listView(flag, { name, season }) {
  if (!flag.beyond?.length) return null
  const fmt = LIST_VALUE[flag.role === 'pitching' ? 'pitching' : 'hitting'][flag.key]
  const rows = flag.beyond.slice(0, LIST_MAX).map((b, i) => (
    { rank: i + 1, id: b.id, name: b.name, season: b.season, value: fmt(b.value), self: false }
  ))
  return {
    rows: [...rows, { rank: flag.beyond.length + 1, id: null, name, season, value: fmt(flag.value), self: true }],
    more: Math.max(0, flag.beyond.length - LIST_MAX),
  }
}

// One flag -> { key, tone, kicker, figure, rest, hint, count, list }. `seasons` is the pooled
// seasons from the tails file (the hint counts them); `twoWay` names the role in the kicker;
// `name` and `season` are his, for his own row in the list.
export function hotColdView(flag, { seasons = [], twoWay = false, name = '', season = null } = {}) {
  const pitching = flag.role === 'pitching'
  const n = pitching ? outsToIp(flag.line.outs) : flag.line.g
  const [figure, rest] = WORDS[pitching ? 'pitching' : 'hitting'][flag.key](flag, flag.line, n)
  const unit = pitching ? 'innings' : 'games'
  const years = seasons.length ? ` in the last ${seasons.length} years` : ''
  const who = pitching ? 'pitchers' : 'hitters'
  const noun = NOUN[pitching ? 'pitching' : 'hitting'][flag.key]
  const kicker = WEIGHT[flag.weight]
  return {
    key: `${flag.role}:${flag.key}`,
    tone: flag.tone,
    kicker: twoWay ? `${kicker} · ${pitching ? 'pitching' : 'hitting'}` : kicker,
    figure,
    rest: cap(rest),
    hint: hintWords({ beyond: flag.beyond, tone: flag.tone, who, noun, sample: sampleWords(flag.checkpoint, unit), years }),
    count: flag.beyond?.length ?? null,
    list: listView(flag, { name, season }),
  }
}

// The card's count tag: "1 hot", "2 cold", "1 hot · 1 cold".
export function toneTag(flags) {
  const n = (tone) => flags.filter((f) => f.tone === tone).length
  return [['hot', n('hot')], ['cold', n('cold')]].filter(([, k]) => k).map(([t, k]) => `${k} ${t}`).join(' · ')
}
