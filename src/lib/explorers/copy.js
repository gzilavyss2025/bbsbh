// THE EXPLORERS' BASEBALL COPY: the small rules every explorer card writes its sentences with,
// so they all sound like one beat writer (docs/explorers.md, "Copy"). Pure; tested in
// test/explorer-copy.test.js.
//   - club nicknames in a sentence ("the Red Sox"), abbreviations only in a score or a tight row
//   - a headline is past tense ("Durbin singled"); a play as it happens is present ("Durbin singles")
//   - ordinals for innings and pitches ("the 13th", "the 18th pitch")
//   - a player by his last name, suffixes dropped ("Acuña", not "Jr.")
import { teamAbbr } from '../teams.js'
import { teamClubName } from '../teams/names.js'

export const abbr = (id) => teamAbbr({ id })
export const club = (id) => teamClubName(id) ?? abbr(id)
export const ord = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`
export const lastName = (n) => (n ?? '').split(' ').filter((w) => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).slice(-1)[0] ?? ''

const PAST = [
  [/\bstrikes out\b/, 'struck out'], [/\bis (walked|hit|out|forced)\b/, 'was $1'], [/\bhits\b/, 'hit'],
  [/\b(single|double|triple|score)s\b/, '$1d'],
  [/\bflies\b/, 'flied'], [/\blines\b/, 'lined'], [/\bpops\b/, 'popped'],
  [/\b(homer|walk|bunt|reach|ground)(e?)s\b/, '$1ed'],
]
// A present-tense play ("Realmuto doubles") told after the fact ("Realmuto doubled").
export const past = (t) => PAST.reduce((x, [re, to]) => x.replace(re, to), t)
