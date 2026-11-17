import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applySuggestion, parseAsk, suggest, tokenize } from '../src/api/research/ask.js'
import { buildQuery, parseQuery } from '../src/api/research/filters.js'

const people = { 592450: 'Aaron Judge', 660271: 'Shohei Ohtani', 665742: 'Juan Soto', 543037: 'Gerrit Cole' }
const read = (s) => parseAsk(s, { people, latest: 2026 })
const url = (s) => decodeURIComponent(buildQuery(read(s).q))

// Each sentence and the URL the page builds from it (filters.js buildQuery), and what it skips.
const TABLE = [
  // The example at the top of #2234, and the start screen's first preset.
  ["The last time a lefty hit an opposite-field home run off a lefty's sinker on the inner third", '?res=home_run&pt=SI&loc=inner&fld=oppo&bh=L&ph=L', []],
  // Gary's example in #3137 / #3138: a whole-game question.
  ['When is the last time the Brewers had a game where they allowed 6 runs and all of them came on solo home runs?', '?mode=game&gr=6-6&how=solo&pteam=MIL', []],
  ['How often does a lefty homer off lefties', '?ask=often&res=home_run&bh=L&ph=L', []],
  ['Who has the most homers after an 0-2 count', '?ask=most&res=home_run&cnt=0-2', []],
  ['What happens after a 3-0 count', '?ask=what&cnt=3-0', []],
  ['how often does Judge homer off a lefty with 2 outs in 2024', '?ask=often&res=home_run&ph=L&out=2&yr=2024&bat=592450', []],
  ['last time Soto walked against Gerrit Cole with the bases loaded', '?res=walk&run=123&bat=665742&pit=543037', []],
  ['who has the most walk-off hits since 2020', '?ask=most&res=single.double.triple.home_run&mom=walkoff&yr=2020-2026', []],
  ['hits with risp in the 9th inning or extras between 2015 and 2019', '?res=single.double.triple.home_run&run=-2-.--3.12-.1-3.-23.123&inn=9.x&yr=2015-2019', []],
  ['last time a righty struck out on a full count in the postseason', '?res=strikeout&gt=P&bh=R&cnt=3-2', []],
  ['last time the Cubs scored 10 or more runs on the road', '?mode=game&gr=10-&ha=R&team=CHC', []],
  ['last time the Yankees allowed 3 hits or fewer', '?mode=game&gh=-3&pteam=NYY', []],
  ['how many games did the Dodgers strike out 15 times', '?ask=often&mode=game&team=LAD', ['strike out 15 times']],
  // Words outside the vocabulary are skipped, never guessed.
  ['what happens after a 3-0 count with the bases loaded on a rainy day', '?ask=what&cnt=3-0&run=123', ['rainy day']],
  ['last time the Cubs scored 10 runs at Wrigley', '?mode=game&gr=10-10&team=CHC', ['Wrigley']],
  // A play-only card in a game question cannot filter, so its words are skipped too.
  ['last time the Mets allowed 8 runs to lefties', '?mode=game&gr=8-8&pteam=NYM', ['lefties']],
]

for (const [sentence, want, skipped] of TABLE) {
  test(`reads: ${sentence}`, () => {
    assert.equal(url(sentence), want)
    assert.deepEqual(read(sentence).skipped.map((s) => s.text), skipped)
  })
}

test('the query is the shape parseQuery returns, so it round-trips the URL', () => {
  for (const [sentence] of TABLE) {
    const q = read(sentence).q
    assert.deepEqual(parseQuery(buildQuery(q)), q, sentence)
  }
})

test('the hand after off / against / vs is the pitcher; the first bare hand the batter', () => {
  assert.equal(url('lefty vs lefty'), '?bh=L&ph=L')
  assert.equal(url('off a righty'), '?ph=R')
  assert.equal(url('a righty pitcher'), '?ph=R')
})

test('"all" turns a run phrase into a How runs scored condition; alone it is a chip', () => {
  assert.equal(url('a game where the Rays scored all in one inning'), '?mode=game&how=oneinn&team=TB')
  assert.equal(url('a solo home run'), '?res=home_run&run=---')
})

test('a park: "at <club>" in play mode', () => {
  assert.equal(url('last time Judge homered at the Red Sox'), '?res=home_run&bat=592450&park=BOS')
})

test('a skipped span points at the original text, accents and all', () => {
  const s = 'last homer on a muggy Tuesday'
  const { skipped } = read(s)
  assert.deepEqual(skipped.map(({ start, end }) => s.slice(start, end)), ['muggy Tuesday'])
  assert.deepEqual(tokenize('José’s go-ahead 0-2').map((t) => t.w), ['jose', 'go', 'ahead', '0-2'])
})

test('nothing read: an empty query, every word skipped', () => {
  const r = read('banana split')
  assert.equal(r.read, 0)
  assert.equal(buildQuery(r.q), '')
  assert.deepEqual(r.skipped.map((s) => s.text), ['banana split'])
})

test('suggestions complete the last word with phrases the parser reads', () => {
  const s = suggest('how often does a lefty hit a hom')
  assert.deepEqual(s[0], { text: 'home run', label: 'PA result' })
  assert.equal(applySuggestion('a lefty hit a hom', s[0].text), 'a lefty hit a home run')
  for (const { text } of suggest('bas')) assert.ok(read(text).read > 0, text)
  assert.deepEqual(suggest('a'), [])
})
