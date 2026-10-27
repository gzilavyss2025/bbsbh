import { selectDueUpDuring } from '../../../../api/dueup.js'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { battingSlot } from '../../../../api/playbyplay/advanceCode.js'
import { pitchCallCode } from '../../../../api/playbyplay/eventTypes.js'
import { boxModel, contactLine, ordinal, playLine } from './heroModel.js'

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
function openBox(h, feed, inning, half, { count, sub }, side) {
  const o = openAtBat(feed, inning, half, count)
  if (!o) return sealedBox(h)
  const events = feed.liveData.plays.allPlays.find((p) => p.about?.atBatIndex === o.card.atBatIndex)?.playEvents ?? []
  const shown = o.steps.slice(0, sub)
  const pitches = shown.filter((s) => s.kind === 'pitch' || s.kind === 'auto')
    .map((s) => s.call ?? pitchCallCode(events.find((e) => e.index === s.index)))
  const m = { ...boxModel({ pitches }), taped: true }
  const now = shown.at(-1)
  const line = now?.kind === 'pitch' && now.pitch ? `Pitch ${now.pitch.no}: ${[now.pitch.type, now.pitch.mph && Math.round(now.pitch.mph)].filter(Boolean).join(' ')}`
    : now?.kind === 'auto' ? events.find((e) => e.index === now.index)?.details?.description ?? '' : ''
  const { batter } = o.card
  const slot = battingSlot(feed, side, batter.id)
  return h('div', { className: 'gdhero__top' }, scorebookBox(h, m),
    h('div', { className: 'gdhero__txt' },
      h('span', { className: 'gdhero__lbl' }, 'At bat'),
      h('div', { className: 'gdhero__who' },
        `${batter.jersey ? `#${batter.jersey} ` : ''}${[batter.first, batter.last].filter(Boolean).join(' ')}`,
        h('small', null, [batter.pos, slot && ordinal(slot)].filter(Boolean).join(' · '))),
      h('p', { className: 'gdhero__line' }, line)))
}

function result(h, e, feed, side) {
  const { batter, pitcher } = e
  const slot = battingSlot(feed, side, batter.id)
  const contact = contactLine(e)
  const sub = [batter.pos, slot && ordinal(slot), pitcher?.last && `vs ${pitcher.last}`].filter(Boolean).join(' · ')
  return h('div', { className: 'gdhero__top' }, scorebookBox(h, boxModel(e)),
    h('div', { className: 'gdhero__txt' },
      h('span', { className: 'gdhero__lbl' }, 'Last result'),
      h('div', { className: 'gdhero__who' },
        `${batter.jersey ? `#${batter.jersey} ` : ''}${[batter.first, batter.last].filter(Boolean).join(' ')}`, h('small', null, sub)),
      h('p', { className: 'gdhero__line' }, playLine(e)),
      contact && h('div', { className: 'gdhero__contact' }, contact)))
}

export function heroMarkup(h, { SealBox, feed, inning, half, mark, last, stepAtBatIndex, open = null, checkpoint = false }) {
  const side = half === 'top' ? 'away' : 'home'
  // A committed half reports no step cursor; the last result's own index is the same cursor.
  // While the checkpoint shows, it carries the due-up (the next half's side); the hero keeps only the box.
  const due = checkpoint ? [] : selectDueUpDuring(feed, inning, half, mark, last?.atBatIndex ?? stepAtBatIndex, 3)?.batters ?? []
  return h('div', { className: 'gdhero' },
    open?.sub > 0
      ? h(SealBox, { coverless: true, forceRevealed: true }, () => openBox(h, feed, inning, half, open, side))
      : last
        ? h(SealBox, { coverless: true, forceRevealed: true }, () => result(h, last, feed, side))
        : sealedBox(h),
    due.length > 0 &&
      h('div', { className: 'gdhero__due' }, h('span', { className: 'gdhero__lbl' }, last ? 'Up' : 'Next'),
        ...due.map((b, i) => h('span', { key: b.slot, className: i === 0 ? 'is-now' : undefined },
          `${ordinal(b.slot)} · ${b.jersey ? `#${b.jersey} ` : ''}${b.last}`))))
}
