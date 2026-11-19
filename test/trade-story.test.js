// The trade simulator's news story (src/screens/trade/story/).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { honorsOf, allStarSeasons } from '../src/screens/trade/story/honors.js'
import { buildStory } from '../src/screens/trade/story/build.js'

const MIL = 158, AZ = 109
// Cut from awards-history.json's shape: families[].years[season][] rows.
const awards = { families: [
  { key: 'Cy Young', years: { 2026: [{ league: 'NL', playerId: 694819 }] } },
  { key: 'Rookie of the Year', years: { 2023: [{ league: 'NL', playerId: 682998 }] } },
  { key: 'Gold Glove', years: { 2026: [{ league: 'NL', playerId: 682998 }] } },
  { key: 'Silver Slugger', years: { 2025: [{ league: 'NL', playerId: 682998 }] } },
] }
const allStars = { rosters: { 2026: { NL: { starters: [], bullpen: [{ playerId: 694819 }], substitutes: [] } } } }
const text = (story) => [story.headline, story.dek, ...story.paragraphs.map((p) => p.map((s) => s.text).join(''))].join('\n')

test('honors come from the stored award and All-Star files, best first', () => {
  assert.deepEqual(honorsOf(682998, awards).map((h) => `${h.season} ${h.key}`), ['2023 Rookie of the Year', '2025 Silver Slugger', '2026 Gold Glove'])
  assert.deepEqual(allStarSeasons(694819, allStars), [2026])
  assert.deepEqual(honorsOf(1, awards), [])
})

const miz = { id: 694819, name: 'Jacob Misiorowski', war: 6.6, note: 'Misiorowski, 24, posted a 1.80 ERA.', honors: honorsOf(694819, awards), allStars: [2026] }
const carroll = { id: 682998, name: 'Corbin Carroll', war: 4.2, note: 'Carroll, 26, hit .239.', honors: honorsOf(682998, awards), allStars: [] }
const kid = { id: 5, name: 'Demetrio Crisantes', war: null, note: 'Crisantes, 22, hit .278.', honors: [], allStars: [], topRank: 84, fromId: AZ }
const deal = { payroll: { a: 21.6e6, b: -21.6e6 }, fortyAfter: { a: 43, b: 36 } }
const clubs = {
  [MIL]: { season: 2026, w: 103, l: 59, rank: 1, division: 'National League Central', postseason: 'champion' },
  [AZ]: { season: 2026, w: 86, l: 76, rank: 3, division: 'National League West', postseason: 'out' },
}

test('a full deal reads as a beat writer files it', () => {
  const s = buildStory({ a: MIL, b: AZ, sendsA: [miz], sendsB: [carroll, kid], cutline: [{ text: 'Acquired ' }, { text: 'Corbin Carroll', playerId: 682998 }, { text: '.' }], clubs, deal, nextYear: 2027, date: '2026-11-19' })
  const t = text(s)
  // The Cy Young winner leads, sent away: the headline says trade.
  assert.equal(s.headline, 'Brewers trade Jacob Misiorowski to Diamondbacks in three-player deal')
  assert.match(t, /Misiorowski, 24, posted a 1\.80 ERA\. He won the 2026 NL Cy Young Award and was an All-Star in 2026\./)
  assert.match(t, /He won the 2023 NL Rookie of the Year Award, a Silver Slugger in 2025 and a Gold Glove in 2026\./)
  // The dek names the other side's best honor, one only.
  assert.equal(s.dek, 'The Brewers land Corbin Carroll, who won the 2023 NL Rookie of the Year Award, in a deal that moves three players.')
  assert.match(t, /He is MLB Pipeline's No\. 84 prospect\./)
  // The lede is the news and the motive: the taker's season, then the star and his award.
  assert.match(s.paragraphs[0].map((x) => x.text).join(''), /^Coming off an 86-76 season that ended short of the postseason, the Arizona Diamondbacks (landed|acquired) Jacob Misiorowski, the 2026 NL Cy Young winner, from the Milwaukee Brewers in a three-player deal\.$/)
  // The turn: the other side, led by its best player, the club's season as an aside.
  assert.match(t, /In return, the Brewers, 103-59 and the reigning World Series champions, get two players, led by Corbin Carroll\./)
  assert.match(t, /They also get Demetrio Crisantes\./)
  assert.match(t, /The deal moves \$21\.6M of 2027 payroll to Milwaukee, and the Brewers will have to clear three 40-man spots\./)
  // The wire's record comes last, before the kicker.
  assert.match(t, /The full trade: the Milwaukee Brewers acquired Corbin Carroll\./)
})

test('missing facts drop their sentences and never print a blank', () => {
  const s = buildStory({ a: MIL, b: AZ, sendsA: [{ id: 9, name: 'Joe Smith', honors: [], allStars: [] }], sendsB: [kid], cutline: null, clubs: {}, deal: null, nextYear: 2027, date: '2026-11-19' })
  const t = text(s)
  assert.doesNotMatch(t, /undefined|null|NaN|playoffs/)
  assert.doesNotMatch(t, /went|payroll|title/)
  assert.equal(buildStory({ a: MIL, b: AZ, sendsA: [], sendsB: [], clubs, date: '2026-11-19' }), null)
})

test('a rank the wire note already gives is not said twice', () => {
  const ranked = { id: 7, name: 'Demetrio Crisantes', note: "Crisantes, 22, MLB's No. 84 prospect, hit .278.", honors: [], allStars: [], topRank: 84 }
  const t = text(buildStory({ a: MIL, b: AZ, sendsA: [], sendsB: [ranked], clubs: {}, nextYear: 2027, date: '2026-11-19' }))
  assert.equal(t.match(/No\. 84/g).length, 1)
})
