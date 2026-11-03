// THE WIRE'S WORDS — the number, ordinal and phrasing helpers the player
// notes share (templates.js), set in a newspaper's style.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const word = (n) => WORDS[n] ?? String(n)

// THE VOICE — a newspaper's transactions column: name and age in commas, no
// words the move already says ("before the call"), numbers under 10 spelled
// out, as short as the facts allow. Each template has a few ways to say the same
// facts; `variant` picks one from a hash of the player's id and the move's
// date, so a note never changes between visits and a busy wire varies.
export function variant(facts, moveDate, n) {
  let h = 2166136261
  for (const ch of `${facts?.id ?? 0}:${moveDate ?? ''}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) % n
}
// AP numerals: one through nine in words.
export const num = (n) => (Number.isInteger(n) && n >= 0 && n < 10 ? WORDS[n] : String(n))
// "15.0" innings reads "15".
export const ipText = (ip) => String(ip).replace(/\.0$/, '')

// "no homers" / "one homer" / "26 homers"; "one game" / "125 games".
export const homers = (n) => (n === 0 ? 'no homers' : n === 1 ? 'one homer' : `${num(n)} homers`)
export const gamesText = (n) => (n === 1 ? 'one game' : `${num(n)} games`)

// "a 4.06 ERA", "an 11.12 ERA", "an 8.10 ERA".
export const an = (num) => (/^(8|11|18)/.test(String(num)) ? 'an' : 'a')

export const ordinal = (n) => {
  const v = Number(n)
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] ?? 'th'
  return `${v}${s}`
}
// AP: "third round", "11th round".
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']
export const roundText = (n) => ORDINALS[Number(n)] ?? ordinal(n)
// A draft round as a note says it. The feed writes a competitive-balance
// round as "CB-A" or "CB-B" (Logan Driscoll, 2019), not a number.
const cbRound = (r) => /^CB-?([AB])$/i.exec(String(r ?? ''))?.[1]?.toUpperCase() ?? null
// "the second round", "Competitive Balance Round B", or null.
export function roundPhrase(r) {
  const cb = cbRound(r)
  if (cb) return `Competitive Balance Round ${cb}`
  return Number(r) ? `the ${roundText(r)} round` : null
}
// "second-round pick", "competitive-balance pick", or "draft pick".
export function pickPhrase(r) {
  if (cbRound(r)) return 'competitive-balance pick'
  return Number(r) ? `${roundText(r)}-round pick` : 'draft pick'
}

// "Sproat, 25," or "The 25-year-old"; his last name alone with no age.
export function nameAge(facts, v) {
  if (!facts.age) return facts.lastName ?? 'He'
  return facts.lastName && v === 0 ? `${facts.lastName}, ${facts.age},` : `The ${facts.age}-year-old`
}

// The season so far, present tense: "is hitting .231 with three homers in 40
// games" / "has a 5.12 ERA over 89.2 innings in 22 games".
export function nowText(line, pitcher) {
  return pitcher
    ? `has ${an(line.era)} ${line.era} ERA over ${ipText(line.ip)} innings in ${gamesText(line.games)}`
    : `is hitting ${line.avg} with ${homers(line.hr)} in ${gamesText(line.games)}`
}

export function optionsSentence(facts) {
  const left = facts.contract?.options
  return left == null ? null : left === 0 ? 'He is out of options.' : `He has ${word(left)} option${left === 1 ? '' : 's'} left.`
}

// The same, run on to a sentence: ", with one option left".
export function optionsTail(facts) {
  const left = facts.contract?.options
  if (left == null) return ''
  return left === 0 ? ', and he is out of options' : `, with ${word(left)} option${left === 1 ? '' : 's'} left`
}
