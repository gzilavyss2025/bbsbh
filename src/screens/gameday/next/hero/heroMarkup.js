import { selectDueUpDuring } from '../../../../api/dueup.js'
import { battingSlot } from '../../../../api/playbyplay/advanceCode.js'
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

const LEGS = ['M20 36 L36 20', 'M36 20 L20 4', 'M20 4 L4 20', 'M4 20 L20 36']
const DIAMOND = 'M20 36 L36 20 L20 4 L4 20 Z'

const column = (h, head, pips) =>
  h('div', { className: 'gdhero__col' }, h('i', null, head),
    ...pips.map((p, i) => h('span', { key: i, className: p === 'X' ? 'gdhero__pip is-x' : 'gdhero__pip' }, p)))

function scorebookBox(h, m) {
  return h('div', { className: 'gdhero__box', role: 'img', 'aria-label': `Scorebook box: ${m.looking ? 'called third strike' : m.code}` },
    h('div', { className: 'gdhero__bs' }, column(h, 'B', m.balls), column(h, 'S', m.strikes)),
    h('div', { className: 'gdhero__dia' },
      h('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' },
        h('path', { d: DIAMOND, className: 'gdhero__base' }),
        m.legs >= 4 && h('path', { d: DIAMOND, className: 'gdhero__run' }),
        ...LEGS.slice(0, m.legs).map((d) => h('path', { key: d, d, className: 'gdhero__leg' }))),
      m.out != null && h('span', { className: 'gdhero__out' }, m.out),
      h('span', { className: m.looking ? 'gdhero__code is-looking' : 'gdhero__code' }, m.code),
      m.rbi > 0 && h('span', { className: 'gdhero__rbi' }, `${m.rbi} RBI`)))
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

export function heroMarkup(h, { SealBox, feed, inning, half, mark, last, stepAtBatIndex }) {
  const side = half === 'top' ? 'away' : 'home'
  const due = selectDueUpDuring(feed, inning, half, mark, stepAtBatIndex, 3)?.batters ?? []
  return h('div', { className: 'gdhero' },
    last
      ? h(SealBox, { coverless: true, forceRevealed: true }, () => result(h, last, feed, side))
      : h('div', { className: 'gdhero__top' }, h('div', { className: 'gdhero__box is-sealed' }, h('span', null, 'Sealed'))),
    due.length > 0 &&
      h('div', { className: 'gdhero__due' }, h('span', { className: 'gdhero__lbl' }, last ? 'Up' : 'Next'),
        ...due.map((b, i) => h('span', { key: b.slot, className: i === 0 ? 'is-now' : undefined },
          `${ordinal(b.slot)} · ${b.jersey ? `#${b.jersey} ` : ''}${b.last}`))))
}
