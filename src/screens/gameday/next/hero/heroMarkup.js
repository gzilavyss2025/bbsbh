import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { pitchCallCode } from '../../../../api/playbyplay/eventTypes.js'
import { boxModel, contactStats, playLine } from './heroModel.js'

// THE HERO'S MARKUP (#2576, #2568): the scorebook box, the batter named once, the play line, the
// contact numbers and the due-up strip. GamedayHero.jsx calls heroMarkup(createElement, …); node --test
// renders the same builder with react-dom/server (a .jsx file cannot be imported there), passing a
// SealBox stand-in.
//
// `last` is the last finished at-bat as of the reader's cursor (the live snapshot's, already capped), or
// null while nothing of the half is revealed. Every value of an at-bat is read inside SealBox's reveal
// function; the due-up strip is the pre-pitch lineup, caller-gated like DueUpConsole's. Box, label and
// strip sit in the same places sealed or not (one height per tier, hero.css).
//
// `open` ({ count, sub }, sub > 0) is the at-bat the reader is inside (ADR-0123): the box fills with the
// pitches its shown sub-steps passed, and its diamond and code stay under tape until the result tap.

const LEGS = ['M20 36 L36 20', 'M36 20 L20 4', 'M20 4 L4 20', 'M4 20 L20 36']
const DIAMOND = 'M20 36 L36 20 L20 4 L4 20 Z'

const column = (h, head, pips) =>
  h('div', { className: 'gdhero__col' }, h('i', null, head),
    ...pips.map((p, i) => h('span', { key: i, className: p === 'X' ? 'gdhero__pip is-x' : 'gdhero__pip' }, p)))

// `m.taped`: the open box (an empty diamond, the code under tape).
export function scorebookBox(h, m) {
  const label = m.taped ? 'at bat' : m.looking ? 'called third strike' : m.code
  return h('div', { className: 'gdhero__box', role: 'img', 'aria-label': `Scorebook box: ${label}` },
    h('div', { className: 'gdhero__bs' }, column(h, 'B', m.balls), column(h, 'S', m.strikes)),
    h('div', { className: 'gdhero__dia' },
      h('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' },
        h('path', { d: DIAMOND, className: 'gdhero__base' }),
        m.legs >= 4 && h('path', { d: DIAMOND, className: 'gdhero__run' }),
        ...LEGS.slice(0, m.legs).map((d) => h('path', { key: d, d, className: 'gdhero__leg' }))),
      m.out != null && h('span', { className: 'gdhero__out' }, m.out),
      m.taped ? h('span', { className: 'gdhero__code is-taped' }, 'Sealed')
        : h('span', { className: m.looking ? 'gdhero__code is-looking' : 'gdhero__code' }, m.code),
      m.rbi > 0 && h('span', { className: 'gdhero__rbi' }, `${m.rbi} RBI`)))
}

const sealedBox = (h) => h('div', { className: 'gdhero__top' }, h('div', { className: 'gdhero__box is-sealed' }, h('span', null, 'Sealed')))

// The open at-bat: only its shown sub-steps are read, so the last pitch and the result never reach it.
function openBox(h, feed, inning, half, { count, sub }, Headshot, PlayerLink) {
  const o = openAtBat(feed, inning, half, count)
  if (!o) return sealedBox(h)
  const events = o.play?.playEvents ?? []
  const shown = o.steps.slice(0, sub)
  const pitches = shown.filter((s) => s.kind === 'pitch' || s.kind === 'auto')
    .map((s) => s.call ?? pitchCallCode(events.find((e) => e.index === s.index)))
  const m = { ...boxModel({ pitches }), taped: true }
  const now = shown.at(-1)
  const line = now?.kind === 'pitch' && now.pitch ? `Pitch ${now.pitch.no}: ${[now.pitch.type, now.pitch.mph && Math.round(now.pitch.mph)].filter(Boolean).join(' ')}`
    : now?.kind === 'auto' ? events.find((e) => e.index === now.index)?.details?.description ?? '' : ''
  const { batter } = o.card
  return h('div', { className: 'gdhero__top' }, scorebookBox(h, m),
    h('div', { className: 'gdhero__txt' },
      h('div', { className: 'gdhero__who' },
        who(h, PlayerLink, batter)),
      h('p', { className: 'gdhero__line' }, line)),
    shot(h, Headshot, PlayerLink, batter))
}

// The batter's headshot, in a column of its own at the right of the hero.
// The batter's name and headshot open his hover card and his page (PlayerLink).
const fullName = (b) => [b.first, b.last].filter(Boolean).join(' ')
const who = (h, PlayerLink, b) => (PlayerLink ? h(PlayerLink, { id: b.id, name: fullName(b) }, fullName(b)) : fullName(b))
const shot = (h, Headshot, PlayerLink, b) => {
  if (!Headshot) return null
  const img = h(Headshot, { personId: b.id, name: b.last, tint: false })
  return h('div', { className: 'gdhero__shot' }, PlayerLink ? h(PlayerLink, { id: b.id, name: fullName(b) }, img) : img)
}

function result(h, e, Headshot, PlayerLink) {
  const { batter } = e
  const contact = contactStats(e)
  return h('div', { className: 'gdhero__top' }, scorebookBox(h, boxModel(e)),
    h('div', { className: 'gdhero__txt' },
      h('div', { className: 'gdhero__who' },
        who(h, PlayerLink, batter)),
      h('p', { className: 'gdhero__line' }, playLine(e)),
      contact.length > 0 && h('dl', { className: 'gdhero__contact' },
        ...contact.map((c) => h('div', { key: c.label }, h('dt', null, c.label), h('dd', null, c.value, c.unit && h('small', null, c.unit)))))),
    shot(h, Headshot, PlayerLink, batter))
}

export function heroMarkup(h, { SealBox, Headshot = null, PlayerLink = null, feed, inning, half, last, open = null }) {
  return h('div', { className: 'gdhero' },
    open?.sub > 0
      ? h(SealBox, { coverless: true, forceRevealed: true }, () => openBox(h, feed, inning, half, open, Headshot, PlayerLink))
      : last
        ? h(SealBox, { coverless: true, forceRevealed: true }, () => result(h, last, Headshot, PlayerLink))
        : sealedBox(h))
}
