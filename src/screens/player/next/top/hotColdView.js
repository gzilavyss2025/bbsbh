// The words of one hot or cold callout (#1855), from a flag of api/hotcold/rule.js. Pure.
//
//   kicker  the sample's weight: "Early start" | "Stretch" | "Full season" (the card's
//           count tag says hot or cold, see toneTag)
//   figure  the stat, alone on its line: "9 HR", ".168 AVG", "2.16 ERA"
//   rest    the sample it is over: "In 40 games (0.23 a game)", "Through 52.1 innings"
//   hint    where it sits, at the checkpoint the league was read at: "Better than 99% of
//           3,422 MLB seasons through 40 games, 2017–26"
import { rate3 } from '../../../../api/person/shared.js'
import { outsToIp } from '../../../../lib/math/innings.js'

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

// "Better than 98%" / "Worse than 99%": how much of the league the line is past, in the
// tone's own words, so a low ERA never reads as "bottom". A flag sits in a 2% tail, so this
// is 98 or 99; it never says 100%.
export function pastWord(tone, percentile) {
  const past = Math.min(99, Math.floor(Math.max(percentile, 100 - percentile)))
  return `${tone === 'hot' ? 'Better' : 'Worse'} than ${past}%`
}

// One flag -> { key, tone, kicker, figure, rest, hint }. `seasons` is the pooled span from
// the tails file; `twoWay` names the role in the kicker.
export function hotColdView(flag, { seasons = [], twoWay = false } = {}) {
  const pitching = flag.role === 'pitching'
  const n = pitching ? outsToIp(flag.line.outs) : flag.line.g
  const [figure, rest] = WORDS[pitching ? 'pitching' : 'hitting'][flag.key](flag, flag.line, n)
  const unit = pitching ? 'innings' : 'games'
  const span = seasons.length ? `, ${seasons[0]}–${String(seasons[seasons.length - 1]).slice(2)}` : ''
  const kicker = WEIGHT[flag.weight]
  return {
    key: `${flag.role}:${flag.key}`,
    tone: flag.tone,
    kicker: twoWay ? `${kicker} · ${pitching ? 'pitching' : 'hitting'}` : kicker,
    figure,
    rest: cap(rest),
    hint: `${pastWord(flag.tone, flag.percentile)} of ${flag.pool.toLocaleString('en-US')} MLB seasons through ${flag.checkpoint} ${unit}${span}`,
  }
}

// The card's count tag: "1 hot", "2 cold", "1 hot · 1 cold".
export function toneTag(flags) {
  const n = (tone) => flags.filter((f) => f.tone === tone).length
  return [['hot', n('hot')], ['cold', n('cold')]].filter(([, k]) => k).map(([t, k]) => `${k} ${t}`).join(' · ')
}
