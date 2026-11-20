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
  assert.match(t, /Misiorowski, 24, posted a 1\.80 ERA\. He won the NL Cy Young Award and was an All-Star in 2026\./)
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

test('awards from one season share one year, not one each', () => {
  const same = { families: [
    { key: 'Silver Slugger', years: { 2026: [{ league: 'NL', playerId: 7 }] } },
    { key: 'Gold Glove', years: { 2026: [{ league: 'NL', playerId: 7 }] } },
    { key: 'All-MLB First Team', years: { 2026: [{ playerId: 7 }] } },
  ] }
  const star = { id: 7, name: 'Jackson Chourio', war: 4, note: 'Chourio, 22, hit .291.', honors: honorsOf(7, same), allStars: [] }
  const t = text(buildStory({ a: MIL, b: AZ, sendsA: [star], sendsB: [kid], clubs: {}, date: '2026-11-19' }))
  assert.match(t, /He won a Silver Slugger and a Gold Glove and made the All-MLB First Team in 2026\./)
  assert.doesNotMatch(t, /in 2026 and .* in 2026/)
})

test('the money paragraph says who comes out ahead by surplus value', () => {
  const base = { a: MIL, b: AZ, sendsA: [miz], sendsB: [carroll], clubs: {}, nextYear: 2027, date: '2026-11-19' }
  const read = (v) => text(buildStory({ ...base, deal: { ...deal, value: { a: v, b: -v } } }))
  assert.match(read(5e6), /By surplus value, the deal comes out close to even\./)
  assert.match(read(-33e6), /By surplus value, the Diamondbacks come out ahead by about \$33\.0M\./)
  assert.match(read(120e6), /By surplus value, the Brewers come out well ahead, by about \$120\.0M\./)
})

// The angle: what the lede hangs on, and why (story.angle.reason, for debugging).
const lede = (s) => s.paragraphs[0].map((x) => x.text).join('')
const plain = (id, name, war) => ({ id, name, war, note: null, honors: [], allStars: [] })

test('a major award winner leads on the award', () => {
  const s = buildStory({ a: MIL, b: AZ, sendsA: [miz], sendsB: [kid], clubs: {}, date: '2026-11-19' })
  assert.equal(s.angle.key, 'award')
  assert.match(lede(s), /Jacob Misiorowski, the 2026 NL Cy Young winner,/)
})

test('a ranked prospect paid for the star leads on what it cost', () => {
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [kid], clubs: {}, date: '2026-11-19' })
  assert.equal(s.angle.key, 'prospects')
  assert.match(lede(s), /in a two-player deal that costs them Demetrio Crisantes, MLB Pipeline's No\. 84 prospect\.$/)
  // Said once: his paragraph drops the rank the lede gave.
  assert.equal(text(s).match(/No\. 84/g).length, 1)
})

test('a lopsided deal leads on the value, and the money paragraph does not repeat it', () => {
  const v = 120e6
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [plain(2, 'Sam Arm', 1)], clubs: {}, deal: { ...deal, value: { a: v, b: -v } }, nextYear: 2027, date: '2026-11-19' })
  assert.equal(s.angle.key, 'value')
  assert.match(lede(s), /in a two-player deal that tilts well toward the Brewers by surplus value\.$/)
  assert.equal(text(s).match(/surplus value/g).length, 1)
})

test('with no award, prospect or lopsided value, the season frames the lede', () => {
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [plain(2, 'Sam Arm', 1)], clubs, date: '2026-11-19' })
  assert.equal(s.angle.key, 'season')
  assert.match(lede(s), /^Coming off an 86-76 season/)
})

test('a star who takes over a weak starting spot leads on the hole he fills', () => {
  // The taker (AZ) started a 0.3 WAR third baseman; the arrival takes third.
  const lineups = { [AZ]: { spots: [{ spot: '3B', group: 'bat', before: { id: 70, war: 0.3 }, after: { id: 1, war: 5 } }] } }
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [plain(2, 'Sam Arm', 1)], clubs: {}, lineups, date: '2026-11-19' })
  assert.equal(s.angle.key, 'fit')
  assert.match(lede(s), /in a two-player deal that fills their hole at third base\.$/)
})

test('a club out of the postseason that gets ranked prospects back leads on the restock', () => {
  const org = { ...plain(3, 'Kid Two', null), orgRank: 4 }
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [org], clubs: { [MIL]: { ...clubs[AZ] } }, date: '2026-11-19' })
  assert.equal(s.angle.key, 'restock')
  assert.match(lede(s), /in a two-player deal that restocks the Brewers with prospects\.$/)
})

// Example trades: each picks the angle it should, and none prints a hole.
const EXAMPLES = [
  ['star for prospects', { sendsA: [miz], sendsB: [kid] }, 'award'],
  ['prospect cost', { sendsA: [plain(1, 'Joe Star', 5)], sendsB: [kid, plain(2, 'Sam Arm', 1)] }, 'prospects'],
  ['salary dump', { sendsA: [plain(1, 'Big Contract', 0.5)], sendsB: [plain(2, 'Cheap Arm', 0.2)], deal: { ...deal, value: { a: 60e6, b: -60e6 } } }, 'value'],
  ['reliever swap', { sendsA: [{ ...plain(1, 'Lefty Pen', 1.2), pos: 'P' }], sendsB: [{ ...plain(2, 'Righty Pen', 1.1), pos: 'P' }] }, 'season'],
  ['champion sells for depth', { sendsA: [plain(1, 'Vet Bat', 2)], sendsB: [plain(2, 'Depth Guy', 0)] }, 'season'],
]
for (const [name, parts, key] of EXAMPLES) {
  test(`example trade: ${name}`, () => {
    const s = buildStory({ a: MIL, b: AZ, clubs, nextYear: 2027, date: '2026-11-19', ...parts })
    assert.equal(s.angle.key, key, s.angle.reason)
    assert.doesNotMatch(text(s), /undefined|null|NaN|\s\.(\s|$)|playoffs/m)
  })
}

test('the headline follows the angle', () => {
  const lineups = { [AZ]: { spots: [{ spot: 'LF', group: 'bat', before: { id: 70, war: 0.3 }, after: { id: 1, war: 5 } }] } }
  const fit = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [plain(2, 'Sam Arm', 1)], clubs: {}, lineups, date: '2026-11-19' })
  assert.equal(fit.headline, 'Diamondbacks fill left-field hole with Joe Star in two-player deal with Brewers')
  const cost = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [kid], clubs: {}, date: '2026-11-19' })
  assert.equal(cost.headline, 'Diamondbacks send top prospect Demetrio Crisantes to Brewers for Joe Star')
  const org = { ...plain(3, 'Kid Two', null), orgRank: 4 }
  const restock = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [org], clubs: { [MIL]: { ...clubs[AZ] } }, date: '2026-11-19' })
  assert.equal(restock.headline, 'Brewers trade Joe Star to Diamondbacks for prospects')
})

test('honors that all come from one season name the year once, at the end', () => {
  const one = { families: [
    { key: 'Cy Young', years: { 2026: [{ league: 'AL', playerId: 8 }] } },
    { key: 'All-MLB First Team', years: { 2026: [{ playerId: 8 }] } },
  ] }
  const ace = { id: 8, name: 'Cam Schlittler', war: 6, note: 'Schlittler, 25, posted a 1.95 ERA.', honors: honorsOf(8, one), allStars: [2026] }
  const t = text(buildStory({ a: MIL, b: AZ, sendsA: [ace], sendsB: [kid], clubs: {}, date: '2026-11-19' }))
  assert.match(t, /He won the AL Cy Young Award, made the All-MLB First Team and was an All-Star, all in 2026\./)
})

test('the prospect cost is named once up top: no dek repeats him', () => {
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [kid], clubs: {}, date: '2026-11-19' })
  assert.equal(s.dek, null)
})

test('a return with a big-leaguer in it is not "for prospects"', () => {
  const org = { ...plain(3, 'Kid Two', null), orgRank: 4 }
  const s = buildStory({ a: MIL, b: AZ, sendsA: [plain(1, 'Joe Star', 5)], sendsB: [org, plain(4, 'Reg Ular', 4)], clubs: { [MIL]: { ...clubs[AZ] } }, date: '2026-11-19' })
  assert.notEqual(s.angle.key, 'restock')
})
