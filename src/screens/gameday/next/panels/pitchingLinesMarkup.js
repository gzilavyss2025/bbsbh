// The scorebook's pitching page (Gary, 2026-10-28): one table per club, a row per pitcher in the order
// they entered, in the scorebook's columns. A `.js` builder (checkpointMarkup's pattern) so the
// checkpoint's Pitching page and the Menu's block draw the same table and `npm test` can render it.
// `lines` is dayLine.js's pitchingDayLines, already clamped to the reader's step by the caller (inside a
// SealBox reveal function): this file reads no feed result, only the clubs' names.

const COLUMNS = [['#', 'jersey'], ['R/L', 'hand'], ['IP', 'ip'], ['P', 'pitches'], ['BF', 'bf'], ['H', 'h'], ['R', 'r'], ['ER', 'er'], ['BB', 'bb'], ['K', 'k']]

function club(h, side, name, rows) {
  return h('section', { key: side, className: 'gdpl__club' },
    h('h4', { className: 'gdpl__head' }, name),
    rows.length === 0
      ? h('p', { className: 'gdpl__none' }, 'No pitcher yet')
      : h('table', { className: 'gdpl__table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Pitcher'), ...COLUMNS.map(([c]) => h('th', { key: c, scope: 'col' }, c)))),
        h('tbody', null, ...rows.map((r) => h('tr', { key: r.id, className: 'gdpl__row' },
          h('th', { scope: 'row' }, [r.last, r.first].filter(Boolean).join(', ')),
          ...COLUMNS.map(([c, k]) => h('td', { key: c }, r[k] === '' || r[k] == null ? '—' : String(r[k]))))))))
}

// A club that has not pitched yet still shows its starter, every figure 0 (Gary, 2026-10-29): the
// announced probable (gameData.probablePitchers, a pregame fact), else the first arm on its boxscore staff.
// No result is read: nobody has thrown a pitch for this club at this step.
function starterRow(feed, side) {
  const id = feed?.gameData?.probablePitchers?.[side]?.id ?? feed?.liveData?.boxscore?.teams?.[side]?.pitchers?.[0]
  const p = id != null ? feed?.gameData?.players?.[`ID${id}`] : null
  if (!p) return []
  const worn = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]?.jerseyNumber
  return [{ id, last: p.lastName ?? '', first: p.useName ?? p.firstName ?? '', jersey: worn ?? p.primaryNumber ?? '', hand: p.pitchHand?.code ?? '', ip: '0.0', pitches: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, k: 0 }]
}

export function pitchingLinesMarkup(h, { key, feed, lines }) {
  const name = (side) => feed?.gameData?.teams?.[side]?.teamName ?? feed?.gameData?.teams?.[side]?.name ?? (side === 'away' ? 'Away' : 'Home')
  return h('div', { key, className: 'gdpl' }, club(h, 'away', name('away'), lines?.away?.length ? lines.away : starterRow(feed, 'away')), club(h, 'home', name('home'), lines?.home?.length ? lines.home : starterRow(feed, 'home')))
}
