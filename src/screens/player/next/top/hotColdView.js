// The words of one hot or cold callout (#1855), from a flag of api/hotcold/rule.js. Pure.
// The card leads with the sentence (Gary, 2026-10-20, design B):
//
//   headline  said the way a person would say it, counted exactly: "Only 7 pitchers in
//             the last 10 years had a better ERA over a full season."
//   line      his figure and sample: "2.16 ERA · Through 162.2 innings"
//   list      those seasons, ranked, with his own in its place (listView); the card shows
//             the top PREVIEW and a door opens the rest. Mid-season, each row also says
//             where that season ended, and one line sums it up (finishView, #1855 slice 3)
import { rate3 } from '../../../../api/person/shared.js'
import { outsToIp } from '../../../../lib/math/innings.js'
import { EARLY_UNDER } from '../../../../api/hotcold/rule.js'
import { FULL_SEASON } from '../../../../api/hotcold/line.js'

const pct = (v) => `${(v * 100).toFixed(1)}%`
const two = (v) => v.toFixed(2)
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

// "Only" fits a small count; above ONLY_UP_TO it drops (Gary, 2026-10-20): "50 times …".
export const ONLY_UP_TO = 10

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
  const only = c <= ONLY_UP_TO ? 'Only ' : ''
  if (players === c) return `${only}${c} ${c === 1 ? one : who}${years} had a ${side} ${noun} ${sample}.`
  return `${only}${c} times${years} has a ${one} had a ${side} ${noun} ${sample}.`
}

// One value in a list row, in the stat's own terms.
// A pace is short ("1/7 PA", one home run every 7 plate appearances; "0 HR" for none), so a
// leader row keeps room for the name; its "ended" line drops the unit the figure above
// already names.
const per = (v, unit) => (v > 0 ? `1/${Math.round(1 / v)} ${unit}` : '0 HR')
const LIST_VALUE = {
  hitting: { ops: rate3, avg: rate3, hr: (v) => per(v, 'PA'), so: pct, bb: pct, sb: (v) => `${two(v)} a game` },
  pitching: { era: two, whip: two, so: pct, bb: pct, hr: (v) => per(v, 'BF') },
}
const bare = (text) => text.replace(/ (PA|BF)$/, '')

// The rows the card shows before its door, and the rows an open list shows before it says
// "and N more".
export const PREVIEW = 3
export const LIST_MAX = 25

// A row's small line: "2022 · Padres", or the season alone when the club is not known.
const sub = (season, team) => (team ? `${season} · ${team}` : String(season))

// The seasons further out than his, ranked, then his own: { rows, more, finish, door }, each row
// { rank, id, name, sub, value, unit, self }. Null when the list is unknown or empty, so there is
// nothing to show.
export function listView(flag, { name, season }) {
  if (!flag.beyond?.length) return null
  const fmt = LIST_VALUE[flag.role === 'pitching' ? 'pitching' : 'hitting'][flag.key]
  const finish = finishView(flag)
  // Where each season ended (#1855 slice 3, design A), under its figure: "ended .403". His
  // own row says "now". A full-season list has no finish line: its values are the finish.
  const rows = flag.beyond.slice(0, LIST_MAX).map((b, i) => ({
    rank: i + 1, id: b.id, name: b.name, sub: sub(b.season, b.team), value: fmt(b.value), self: false,
    unit: finish && wentOn(flag, b) ? `ended ${bare(fmt(b.finalValue))}` : null,
  }))
  const self = { rank: flag.beyond.length + 1, id: null, name, sub: sub(season, flag.teamName), value: fmt(flag.value), self: true, unit: finish ? 'now' : null }
  const more = Math.max(0, flag.beyond.length - LIST_MAX)
  // The door says what it opens: every row of a short list, the top LIST_MAX of a long one.
  const door = more ? `See the top ${LIST_MAX}` : `See all ${rows.length + 1}`
  return { rows: [...rows, self], more, finish, door }
}

// A season's finish counts only when it went on FINISH_MIN games (innings) past the
// checkpoint, the rule set in slice 1: a season cut short by an injury or a demotion just
// after it says nothing about where a start like his ends up, so its row shows no "ended"
// and the summary leaves it out.
export const FINISH_MIN = 30
const wentOn = (flag, b) => b.finalValue != null && b.finalSample != null && b.finalSample >= flag.checkpoint + FINISH_MIN

// How the seasons further out than his ended (#1855 slice 3), or null when none went on
// (and for a full-season list, whose values are the finish). `moved` counts the seasons
// that ended back toward the league, below their checkpoint value after a high one or above
// it after a low one ("cooled off" from a hot start, "bounced back" from a cold one); one
// that swung right past the middle counts too. The card shows `sentence` under the list.
export function finishView(flag) {
  const done = (flag.beyond ?? []).filter((b) => wentOn(flag, b))
  if (!done.length) return null
  const back = flag.percentile >= 50 ? (b) => b.finalValue < b.value : (b) => b.finalValue > b.value
  const moved = done.filter(back).length
  const verb = flag.tone === 'hot' ? 'cooled off' : 'bounced back'
  return { n: done.length, moved, sentence: `${moved} of ${done.length} ${verb} by the end of the season.` }
}

// One flag -> { key, tone, headline, line, list }. `seasons` is the pooled seasons from the
// tails file (the headline counts them); `twoWay` names the role on the line; `name` and
// `season` are his, for his own row.
export function hotColdView(flag, { seasons = [], twoWay = false, name = '', season = null } = {}) {
  const pitching = flag.role === 'pitching'
  const n = pitching ? outsToIp(flag.line.outs) : flag.line.g
  const [figure, rest] = WORDS[pitching ? 'pitching' : 'hitting'][flag.key](flag, flag.line, n)
  const unit = pitching ? 'innings' : 'games'
  const years = seasons.length ? ` in the last ${seasons.length} years` : ''
  const who = pitching ? 'pitchers' : 'hitters'
  const noun = NOUN[pitching ? 'pitching' : 'hitting'][flag.key]
  const role = twoWay ? `${pitching ? 'Pitching' : 'Hitting'} · ` : ''
  return {
    key: `${flag.role}:${flag.key}`,
    tone: flag.tone,
    headline: hintWords({ beyond: flag.beyond, tone: flag.tone, who, noun, sample: sampleWords(flag.checkpoint, unit), years }),
    line: `${role}${figure} · ${cap(rest)}`,
    list: listView(flag, { name, season }),
  }
}

// The card's count tag: "1 hot", "2 cold", "1 hot · 1 cold".
export function toneTag(flags) {
  const n = (tone) => flags.filter((f) => f.tone === tone).length
  return [['hot', n('hot')], ['cold', n('cold')]].filter(([, k]) => k).map(([t, k]) => `${k} ${t}`).join(' · ')
}
