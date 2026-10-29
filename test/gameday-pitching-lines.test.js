// The scorebook's pitching page in Gameday (Gary, 2026-10-28): every pitcher's line, both clubs, in
// the scorebook's columns (#, R/L, IP, P, BF, H, R, ER, BB, K), on the checkpoint's Pitching page and
// in the Menu. 824716 is SEA@BOS; a .jsx file cannot load here, so the builders render through
// react-dom/server like the checkpoint's own test.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { pitchingLinesMarkup } from '../src/screens/gameday/next/panels/pitchingLinesMarkup.js'
import { checkpointMarkup } from '../src/screens/gameday/next/checkpoint/checkpointMarkup.js'
import { pitchingDayLines } from '../src/api/gameday/dayLine.js'

const F = JSON.parse(readFileSync(new URL('./fixtures/game-824716.gameday.json', import.meta.url)))
const html = (el) => renderToStaticMarkup(el)
const rows = (s) => [...s.matchAll(/<tr class="gdpl__row">(.*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map((c) => c[1]))

test('one table per club in the scorebook\'s columns, a row per pitcher as of the step', () => {
  const lines = pitchingDayLines(F, { inning: 4, half: 'bottom', revealedThrough: 7 })
  const out = html(pitchingLinesMarkup(createElement, { feed: F, lines }))
  assert.equal((out.match(/<table/g) ?? []).length, 2)
  assert.match(out, /<th[^>]*>R\/L<\/th><th[^>]*>IP<\/th><th[^>]*>P<\/th><th[^>]*>BF<\/th><th[^>]*>H<\/th><th[^>]*>R<\/th><th[^>]*>ER<\/th><th[^>]*>BB<\/th><th[^>]*>K<\/th>/)
  const all = [...lines.away, ...lines.home]
  const r = rows(out)
  assert.equal(r.length, all.length)
  const first = all[0]
  assert.deepEqual(r[0], [`${first.last}, ${first.first}`, String(first.jersey), first.hand, first.ip, ...[first.pitches, first.bf, first.h, first.r, first.er, first.bb, first.k].map(String)])
})

test('a club that has not pitched yet shows its starter with every figure 0 (Gary, 2026-10-29)', () => {
  const out = html(pitchingLinesMarkup(createElement, { feed: F, lines: { away: [], home: [] } }))
  assert.equal((out.match(/<table/g) ?? []).length, 2)
  for (const row of rows(out)) assert.deepEqual(row.slice(3), ['0.0', '0', '0', '0', '0', '0', '0', '0'])
})

test('a scratched probable gives way to the man who actually started (the boxscore staff, first arm)', () => {
  const f = structuredClone(F)
  const started = f.liveData.boxscore.teams.home.pitchers[0]
  const other = Object.values(f.gameData.players).find((p) => p.id !== started && p.pitchHand)
  f.gameData.probablePitchers = { ...f.gameData.probablePitchers, home: { id: other.id } }
  const out = html(pitchingLinesMarkup(createElement, { feed: f, lines: { away: [], home: [] } }))
  const real = f.gameData.players[`ID${started}`]
  assert.ok(out.includes(real.lastName), 'the real starter is named')
  assert.ok(!out.includes(`>${other.lastName},`), 'the scratched probable is not')
})

test('a club with no starter known at all still says "No pitcher yet"', () => {
  const bare = { gameData: { teams: F.gameData.teams, players: {} }, liveData: { boxscore: { teams: {} } } }
  const out = html(pitchingLinesMarkup(createElement, { feed: bare, lines: { away: [], home: [] } }))
  assert.equal((out.match(/No pitcher yet/g) ?? []).length, 2)
})

test('the checkpoint\'s Pitching page carries the game\'s lines as of the half\'s end', () => {
  const SealBox = ({ children }) => children()
  const out = html(checkpointMarkup(createElement, { SealBox, feed: F, inning: 4, half: 'bottom', mark: 7 }))
  const page = out.slice(out.indexOf('data-page="pitching"'), out.indexOf('data-page="atBats"'))
  assert.match(page, /class="gdpl"/)
  const want = pitchingDayLines(F, { inning: 4, half: 'bottom', revealedThrough: 7 })
  assert.equal(rows(page).length, want.away.length + want.home.length)
})
