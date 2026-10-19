// One-off: node measure.mjs  -> prints the numbers for docs/contact-replay.md (#2345)
const GAMES = [
  [849810, '2026-10-15'], [849811, '2026-10-14'], [849812, '2026-10-12'], [849818, '2026-10-15'], [849820, '2026-10-12'],
  [822679, '2026-09-27'], [823408, '2026-09-27'], [824705, '2026-09-27'], [824948, '2026-09-27'],
]
const url = ([pk, d]) =>
  `https://baseballsavant.mlb.com/statcast_search/csv?${new URLSearchParams({
    all: 'true', type: 'details', player_type: 'batter', hfGT: 'R|F|D|L|W|',
    game_date_gt: d, game_date_lt: d, game_pk: pk,
  })}`
function csv(text) {
  const rows = []; let row = [], f = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = '' }
    else f += c
  }
  const h = rows.shift()
  return rows.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])))
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo) }
const HIT = new Set(['single', 'double', 'triple', 'home_run'])
const NOT_OUT = new Set(['field_error', 'fielders_choice'])
const all = []
for (const g of GAMES) {
  const r = csv(await (await fetch(url(g))).text()).filter((x) => x.game_pk === String(g[0]))
  console.log('game', g[0], g[1], 'rows', r.length)
  r.forEach((x) => all.push(x))
}
const contact = all.filter((r) => ['hit_into_play', 'foul', 'foul_tip'].includes(r.description))
const withI = (rs) => rs.map((r) => r.intercept_ball_minus_batter_pos_y_inches).filter((v) => v !== '' && v != null).map(Number)
for (const [name, rs] of [['all contact', contact], ['in play', contact.filter((r) => r.description === 'hit_into_play')], ['foul', contact.filter((r) => r.description !== 'hit_into_play')]]) {
  const v = withI(rs)
  console.log(name, 'swings', rs.length, 'n', v.length, 'median', pct(v, .5).toFixed(2), 'p10', pct(v, .1).toFixed(2), 'p90', pct(v, .9).toFixed(2), 'min', Math.min(...v), 'max', Math.max(...v))
}
const bip = all.filter((r) => r.description === 'hit_into_play' && r.estimated_ba_using_speedangle !== '' && !NOT_OUT.has(r.events))
const kind = (r) => (HIT.has(r.events) ? 'hit' : 'out')
console.log('bip with xBA', bip.length, 'hits', bip.filter((r) => kind(r) === 'hit').length, 'outs', bip.filter((r) => kind(r) === 'out').length)
console.log('excluded', all.filter((r) => r.description === 'hit_into_play' && r.estimated_ba_using_speedangle !== '' && NOT_OUT.has(r.events)).length, 'bip w/o xBA', all.filter((r) => r.description === 'hit_into_play' && r.estimated_ba_using_speedangle === '').length)
console.log('events', [...new Set(bip.map((r) => r.events))].join(','))
const teamGames = new Set(all.map((r) => `${r.game_pk}|${r.inning_topbot}`)).size
for (const [hardCut, luckyCut] of [[.45, .2], [.5, .25], [.55, .3]]) {
  const hl = bip.filter((r) => kind(r) === 'out' && Number(r.estimated_ba_using_speedangle) >= hardCut)
  const lk = bip.filter((r) => kind(r) === 'hit' && Number(r.estimated_ba_using_speedangle) < luckyCut)
  const outs = bip.filter((r) => kind(r) === 'out').length, hits = bip.filter((r) => kind(r) === 'hit').length
  console.log(`hard-luck >=${hardCut}: ${hl.length} (${(100 * hl.length / outs).toFixed(1)}% of outs, ${(100 * hl.length / bip.length).toFixed(1)}% of BIP, ${(hl.length / teamGames).toFixed(2)}/team-game) | lucky <${luckyCut}: ${lk.length} (${(100 * lk.length / hits).toFixed(1)}% of hits, ${(100 * lk.length / bip.length).toFixed(1)}% of BIP, ${(lk.length / teamGames).toFixed(2)}/team-game)`)
}
console.log('team-games', teamGames)
