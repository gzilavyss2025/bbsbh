// The words of one hot or cold callout (#1855), from a flag of api/hotcold/rule.js. Pure.
//
//   kicker  "Hot start" | "Cold stretch" | "Hot season" — tone, then the sample's weight
//   figure  the stat, set large: "9 HR", ".168 AVG", "2.16 ERA"
//   rest    the sample it is over: "in 40 games (0.23 a game)", "through 52.1 innings"
//   hint    where it sits: "Better than 99% of 3,422 MLB lines at 40 games, 2017–26"
import { rate3 } from '../../../../api/person/shared.js'
import { outsToIp } from '../../../../lib/math/innings.js'

const pct = (v) => `${(v * 100).toFixed(1)}%`
const two = (v) => v.toFixed(2)
const WEIGHT = { early: 'start', firm: 'stretch', real: 'season' }

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
  const kicker = `${flag.tone === 'hot' ? 'Hot' : 'Cold'} ${WEIGHT[flag.weight]}`
  return {
    key: `${flag.role}:${flag.key}`,
    tone: flag.tone,
    kicker: twoWay ? `${kicker} · ${pitching ? 'pitching' : 'hitting'}` : kicker,
    figure,
    rest,
    hint: `${pastWord(flag.tone, flag.percentile)} of ${flag.pool.toLocaleString('en-US')} MLB lines at ${flag.checkpoint} ${unit}${span}`,
  }
}
