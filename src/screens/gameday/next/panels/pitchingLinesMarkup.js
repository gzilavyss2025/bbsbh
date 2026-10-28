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

export function pitchingLinesMarkup(h, { feed, lines }) {
  const name = (side) => feed?.gameData?.teams?.[side]?.teamName ?? feed?.gameData?.teams?.[side]?.name ?? (side === 'away' ? 'Away' : 'Home')
  return h('div', { className: 'gdpl' }, club(h, 'away', name('away'), lines?.away ?? []), club(h, 'home', name('home'), lines?.home ?? []))
}
