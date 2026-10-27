import { checkpointPages } from '../../../../api/gameday/checkpoint.js'
import { halfIndex } from '../../../../api/select.js'
import { selectRegulationInnings } from '../../../../api/gamestate/gameState.js'
import { segmentedMarkup } from '../../../../lib/design/segmentedClass.js'
import { ordinal } from '../../../../lib/format.js'

// THE CHECKPOINT'S MARKUP (#2572 slices 3 to 5; design: .scratch/gameday-design/round2/checkpoint.js).
// It takes the stage's slot once the third out is revealed. Checkpoint.jsx calls
// checkpointMarkup(createElement, …); node --test renders the same builder with react-dom/server.
//
// checkpointPages is reveal-only, so it is called inside SealBox's reveal function, and only for a
// half at or under `mark` (the caller's gate; checkpoint.js answers null past it as well). Every page
// is in the DOM; checkpoint.css shows them all at T, L and D, and one (`page`) on the phone, all of
// them under Motion: Reduced. A page that answers null (the notes with no bundle) has no tab. The page
// switch is the app's Segmented control. `Seen` (Checkpoint.jsx) records the notes drawn in the callout
// ledger; `on` says whether the phone shows the notes page.

export const LABEL = { tally: 'Tally', pitching: 'Pitching', atBats: 'At-bats', gameSoFar: 'Game', facts: 'Notes' }

const cells = (h, key, list) => h('div', { key, className: 'gdcp__tally' },
  ...list.map(([k, v]) => h('div', { key: k }, h('b', null, v ?? '—'), h('span', null, k))))

function tally(h, f, p) {
  return [cells(h, 'line', [['R', f.runs], ['H', f.hits], ['E', f.errors], ['LOB', f.leftOnBase]]),
    cells(h, 'pitches', [['Pitches', p.pitches], ['Whiffs', p.whiffs], ['Fouls', p.fouls]])]
}

function pitching(h, f) {
  const row = (name, l, key, className) => h('tr', { key, className }, h('td', null, name), h('td', null, l.pitches),
    h('td', null, l.strikes), h('td', null, l.whiffs), h('td', null, l.fouls))
  return h('table', { className: 'gdcp__table' },
    h('thead', null, h('tr', null, ...['Pitcher', 'P', 'S', 'Whiffs', 'Fouls'].map((c) => h('th', { key: c }, c)))),
    h('tbody', null, ...f.pitchers.map((l) => row(l.last, l, l.id)),
      f.pitchers.length > 1 && row('Half', f, 'tot', 'is-total')))
}

function atBats(h, f) {
  return h('ol', { className: 'gdcp__rows' }, ...f.rows.map((r, i) => r.kind === 'sub'
    ? h('li', { key: i, className: 'is-sub' }, r.text)
    : h('li', { key: i },
      h('span', null, r.jersey ? `#${r.jersey}` : ''),
      h('span', { className: 'gdcp__name' }, [r.first?.[0] && `${r.first[0]}.`, r.last].filter(Boolean).join(' ')),
      h('b', { className: r.calledLooking ? 'is-looking' : undefined }, r.calledLooking ? 'K' : r.code),
      h('span', null, r.rbi > 0 ? `${r.rbi} RBI` : ''),
      h('span', { className: r.out ? 'gdcp__out' : undefined }, r.out ?? ''))))
}

// The line through this half: regulation's columns always (a blank column is no news; 7 for a short
// game), an extra inning's only once it is on the line. At the last half the closing column draws the
// double rule.
function gameSoFar(h, f, abbr, nextLabel, regulation) {
  const span = Math.max(f.innings.length, regulation)
  const cols = Array.from({ length: span }, (_, i) => f.innings[i] ?? { num: i + 1, away: null, home: null })
  const last = f.final ? f.innings.length : 0
  const row = (side) => h('tr', { key: side }, h('th', null, abbr[side]),
    ...cols.map((c) => h('td', { key: c.num, className: c.num === last ? 'is-double' : undefined }, c[side] ?? '')),
    h('td', { className: 'is-total' }, f[side].runs), h('td', null, f[side].hits), h('td', null, f[side].errors))
  return [
    h('table', { key: 'line', className: 'gdcp__line' },
      h('thead', null, h('tr', null, h('th'), ...cols.map((c) => h('th', { key: c.num }, c.num)),
        ...['R', 'H', 'E'].map((c) => h('th', { key: c }, c)))),
      h('tbody', null, row('away'), row('home'))),
    f.dueUp?.length > 0 && h('div', { key: 'due', className: 'gdcp__due' },
      h('span', { className: 'gdcp__label' }, nextLabel ? `Due up · ${nextLabel}` : 'Due up'),
      ...f.dueUp.map((b) => h('span', { key: b.slot }, `${ordinal(b.slot)} · ${b.jersey ? `#${b.jersey} ` : ''}${b.last}`))),
  ]
}

const facts = (h, f, Seen, on) => [
  h('ul', { key: 'list', className: 'gdcp__notes' }, ...f.notes.map((n, i) => h('li', { key: n.dedupeKey ?? i }, n.text))),
  Seen && h(Seen, { key: 'seen', notes: f.notes, on }),
]

function body(h, pages, id, { abbr, nextLabel, regulation, Seen, on }) {
  const f = pages.find((p) => p.id === id).fields
  if (id === 'tally') return tally(h, f, pages.find((p) => p.id === 'pitching').fields)
  if (id === 'pitching') return pitching(h, f)
  if (id === 'atBats') return atBats(h, f)
  if (id === 'gameSoFar') return gameSoFar(h, f, abbr, nextLabel, regulation)
  return facts(h, f, Seen, on === id)
}

const HEAD = { tally: null, pitching: 'Pitching this half', atBats: 'The at-bats', facts: 'Notes for the next half' }

function layer(h, pages, { inning, half, abbr, page, onPage, nextLabel, regulation, Seen }) {
  const ids = pages.map((p) => p.id)
  const on = ids.includes(page) ? page : ids[0]
  const game = pages.find((p) => p.id === 'gameSoFar').fields
  const title = game.final ? 'Final' : `End of the ${half} ${ordinal(inning)}`
  const heads = { ...HEAD, tally: `${half === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)}`, gameSoFar: game.final ? 'Final' : 'The game so far' }
  return h('div', { className: 'gdcp', 'data-pages': ids.length },
    h('div', { className: 'gdcp__head' }, h('span', null, title),
      h('small', null, `${abbr.away} ${game.away.runs} · ${abbr.home} ${game.home.runs}`)),
    segmentedMarkup(h, {
      label: 'Checkpoint pages', value: on, onChange: onPage, fill: true, className: 'gdcp__tabs',
      options: ids.map((id) => ({ value: id, label: LABEL[id] })),
    }),
    h('div', { className: 'gdcp__body' },
      ...ids.map((id) => h('section', {
        key: `${id}-${id === on}`, 'aria-label': LABEL[id],
        className: id === on ? 'gdcp__page is-on' : 'gdcp__page', 'data-page': id,
      }, h('h4', null, heads[id]), body(h, pages, id, { abbr, nextLabel, regulation, Seen, on })))))
}

export function checkpointMarkup(h, { SealBox, Seen = null, feed, inning, half, mark, notes = null, abbr, page, onPage, nextLabel }) {
  if (!feed || !inning || !half || halfIndex(inning, half) > (mark ?? -1)) return null
  return h(SealBox, { coverless: true, forceRevealed: true }, () => {
    const pages = checkpointPages(feed, { inning, half, revealedThrough: mark, notes })
    return pages && layer(h, pages, { inning, half, abbr, page, onPage, nextLabel, regulation: selectRegulationInnings(feed), Seen })
  })
}
