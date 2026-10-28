import { checkpointPages } from '../../../../api/gameday/checkpoint.js'
import { batterDayLine, pitchingDayLines } from '../../../../api/gameday/dayLine.js'
import { pitchingLinesMarkup } from '../panels/pitchingLinesMarkup.js'
import { halfIndex } from '../../../../api/select.js'
import { segmentedMarkup } from '../../../../lib/design/segmentedClass.js'
import { ordinal } from '../../../../lib/format.js'

// THE CHECKPOINT'S MARKUP (#2572 slices 3 to 5; design: #2568 round 2).
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

// The half's pitch tally, then the game's lines for both clubs as of the half's end (the scorebook's
// pitching page, pitchingLinesMarkup).
function pitching(h, f, lines) {
  const row = (name, l, key, className) => h('tr', { key, className }, h('td', null, name), h('td', null, l.pitches),
    h('td', null, l.strikes), h('td', null, l.whiffs), h('td', null, l.fouls))
  return [h('table', { key: 'half', className: 'gdcp__table' },
    h('thead', null, h('tr', null, ...['Pitcher', 'Pitches', 'Strikes', 'Whiffs', 'Fouls'].map((c) => h('th', { key: c }, c)))),
    h('tbody', null, ...f.pitchers.map((l) => row(l.last, l, l.id)),
      f.pitchers.length > 1 && row('Half', f, 'tot', 'is-total'))),
  lines && h('div', { key: 'game' }, lines)]
}

// The name opens his hover card and his page (PlayerLink); then the RBI, the out circle, and the code
// at the row's end.
function atBats(h, f, PlayerLink) {
  return h('ol', { className: 'gdcp__rows' }, ...f.rows.map((r, i) => r.kind === 'sub'
    ? h('li', { key: i, className: 'is-sub' }, r.text)
    : h('li', { key: i },
      h('span', { className: 'gdcp__name' }, PlayerLink && r.id != null
        ? h(PlayerLink, { id: r.id, name: [r.first, r.last].filter(Boolean).join(' ') }, [r.first, r.last].filter(Boolean).join(' '))
        : [r.first, r.last].filter(Boolean).join(' ')),
      h('span', null, r.rbi > 0 ? `${r.rbi} RBI` : ''),
      h('span', { className: r.out ? 'gdcp__out' : undefined }, r.out ?? ''),
      h('b', { className: r.calledLooking ? 'is-looking' : undefined }, r.calledLooking ? 'K' : r.code))))
}

// The game page is the due-up alone: the line score lives in the band's tray at the top right (Gary,
// 2026-10-27), so it is not drawn twice.
// Under each name, his line: today's hits-for-at-bats once he has batted (batterDayLine, through the
// revealed halves and none of the half he leads off), else his regular-season average entering the game
// (`entry`, Checkpoint.jsx; spoiler-free, the day before).
function dueLine(feed, b, next, mark, entry) {
  const day = batterDayLine(feed, b.id, { ...next, step: 0, revealedThrough: mark })
  if (day?.ab > 0) return `${day.h}-${day.ab} today`
  if (day?.pa > 0) return `${day.pa === day.bb ? `${day.bb} BB` : `${day.pa} PA`} today`
  const avg = entry?.[b.id]?.avg
  return avg ? `${avg} AVG` : ''
}

// The photo and the names open his hover card and his page (PlayerLink), as the lineup's do.
function gameSoFar(h, f, Headshot, line, PlayerLink) {
  const link = (b, kids) => (PlayerLink ? h(PlayerLink, { id: b.id, name: [b.first, b.last].filter(Boolean).join(' ') }, ...kids) : kids)
  return [
    f.dueUp?.length > 0 && h('div', { key: 'due', className: 'gdcp__due' },
      h('span', { className: 'gdcp__label' }, 'Due up'),
      // Each batter due up as a photo card, the first name small over the surname (as the lineup reads), in batting order.
      h('ol', { className: 'gdcp__dueups' }, ...f.dueUp.map((b) => h('li', { key: b.slot },
        Headshot && link(b, [h(Headshot, { key: 'shot', personId: b.id, name: b.last, tint: false })]),
        link(b, [b.first && h('small', { key: 'f' }, b.first), h('b', { key: 'l', className: 'gdcp__fitname' }, b.last)]),
        h('span', { className: 'gdcp__dueline' }, line(b)))))),
  ]
}

// A note about one starter ("His first World Series start", "in his starts") is read beside no photo
// here, so his surname takes the place of "his". Only these two kinds: elsewhere a note's "his" can be
// another man's (a matchup note is keyed to the hitter but "his slider" is the pitcher's).
const NAMED_KINDS = new Set(['wsStarterStart', 'starterRec'])
const named = (n, nameOf) => {
  const last = NAMED_KINDS.has(n.kind) && n.personId != null ? nameOf(n.personId) : null
  if (!last) return n.text
  return n.text.replace(/^His /, `${last}'s `).replace(/ his /g, ` ${last}'s `)
}

// `Scroll` (Checkpoint.jsx) lets the list scroll in its box and bounces a cue while more is below.
const facts = (h, f, Seen, on, nameOf, Scroll) => {
  const list = h('ul', { key: 'list', className: 'gdcp__notes' }, ...f.notes.map((n, i) => h('li', { key: n.dedupeKey ?? i }, named(n, nameOf))))
  return [
  Scroll ? h(Scroll, { key: 'list' }, list) : list,
  Seen && h(Seen, { key: 'seen', notes: f.notes, on }),
  ]
}

function body(h, pages, id, { Seen, on, Headshot, nameOf, Scroll, PlayerLink, line, lines }) {
  const f = pages.find((p) => p.id === id).fields
  if (id === 'tally') return tally(h, f, pages.find((p) => p.id === 'pitching').fields)
  if (id === 'pitching') return pitching(h, f, lines)
  if (id === 'atBats') return atBats(h, f, PlayerLink)
  if (id === 'gameSoFar') return gameSoFar(h, f, Headshot, line, PlayerLink)
  return facts(h, f, Seen, on === id, nameOf, Scroll)
}

// Only the notes carry a heading (Gary, 2026-10-27): the other pages' figures say what they are.
const HEAD = { tally: null, pitching: null, gameSoFar: null, atBats: null, facts: 'Game notes' }

function layer(h, pages, { inning, half, page, onPage, Seen, Headshot, nameOf, Scroll, PlayerLink, line, lines }) {
  const ids = pages.map((p) => p.id)
  const on = ids.includes(page) ? page : ids[0]
  const game = pages.find((p) => p.id === 'gameSoFar').fields
  // The broadcast's words: after the top it is the middle of the inning, after the bottom its end.
  const title = game.final ? 'Final' : `${half === 'top' ? 'Middle' : 'End'} ${ordinal(inning)}`
  const heads = HEAD
  return h('div', { className: 'gdcp', 'data-pages': ids.length },
    h('div', { className: 'gdcp__head' }, h('span', null, title)), // the score is the band's, so the head names the half only
    segmentedMarkup(h, {
      label: 'Checkpoint pages', value: on, onChange: onPage, fill: true, className: 'gdcp__tabs',
      options: ids.map((id) => ({ value: id, label: LABEL[id] })),
    }),
    h('div', { className: 'gdcp__body' },
      ...ids.map((id) => h('section', {
        key: `${id}-${id === on}`, 'aria-label': LABEL[id],
        className: id === on ? 'gdcp__page is-on' : 'gdcp__page', 'data-page': id,
      }, heads[id] && h('h4', null, heads[id]), body(h, pages, id, { Seen, on, Headshot, nameOf, Scroll, PlayerLink, line, lines })))))
}

export function checkpointMarkup(h, { SealBox, Seen = null, Headshot = null, Scroll = null, PlayerLink = null, entry = null, feed, inning, half, mark, notes = null, page, onPage}) {
  if (!feed || !inning || !half || halfIndex(inning, half) > (mark ?? -1)) return null
  return h(SealBox, { coverless: true, forceRevealed: true }, () => {
    const pages = checkpointPages(feed, { inning, half, revealedThrough: mark, notes })
    const next = half === 'top' ? { inning, half: 'bottom' } : { inning: inning + 1, half: 'top' }
    const line = (b) => dueLine(feed, b, next, mark, entry)
    const nameOf = (id) => feed.gameData?.players?.[`ID${id}`]?.lastName ?? null
    const lines = pitchingLinesMarkup(h, { feed, lines: pitchingDayLines(feed, { inning, half, revealedThrough: mark }) })
    return pages && layer(h, pages, { inning, half, page, onPage, Seen, Headshot, nameOf, Scroll, PlayerLink, line, lines })
  })
}
