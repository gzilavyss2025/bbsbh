import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { selectDueUpDuring } from '../../../../api/dueup.js'
import { halfIndex } from '../../../../api/select.js'
import { pitchCallCode } from '../../../../api/playbyplay/eventTypes.js'
import { boxModel, contactStats, cutShort, playLine } from './heroModel.js'
import { runnerOutCode } from '../../../../api/playbyplay/advanceCode.js'

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
// `flight`: an element laid over the diamond cell (the ball flight's handle, result() below), or null;
// `zone` the same over the pitch columns (the strike zone's).
export function scorebookBox(h, m, flight = null, zone = null) {
  const label = m.taped ? 'at bat' : m.looking ? 'called third strike' : m.code
  return h('div', { className: 'gdhero__box', role: 'img', 'aria-label': `Scorebook box: ${label}` },
    h('div', { className: 'gdhero__bs' }, column(h, 'B', m.balls), column(h, 'S', m.strikes), zone),
    h('div', { className: 'gdhero__dia' },
      h('svg', { viewBox: '4 4 32 32', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        h('path', { d: DIAMOND, className: 'gdhero__base' }),
        m.legs >= 4 && h('path', { d: DIAMOND, className: 'gdhero__run' }),
        ...LEGS.slice(0, m.legs).map((d) => h('path', { key: d, d, className: 'gdhero__leg' }))),
      h('span', { className: m.out != null ? 'gdhero__out is-out' : 'gdhero__out' }, m.out ?? ''),
      // The box holds the kind of result, heavy only for a hit; the fielders sit in the diamond (splitCode).
      m.taped ? h('span', { className: 'gdhero__code is-taped' }, 'Sealed')
        : h('span', { className: ['gdhero__code', m.hit && 'is-hit', m.looking && 'is-looking'].filter(Boolean).join(' ') }, m.box ?? m.code),
      !m.taped && m.mid && h('span', { className: 'gdhero__play' }, m.mid),
      !m.taped && m.rbi > 0 && h('span', { className: 'gdhero__rbi' }, `${m.rbi} RBI`),
      flight))
}

// Nothing of the half on screen yet: the blank scorebook box, ruled and empty, its result box under the
// tape, the same box an at-bat fills in (no values, so nothing to seal but the drawing).
const BLANK = { balls: [], strikes: [], legs: 0, out: null, rbi: 0, taped: true }
// Beside it, the batter at the plate: the leadoff man from the pre-pitch lineup (dueup.js, caller-gated
// to the half the reader may reach, as the stage's rest frame is), named, with his headshot.
function sealedBox(h, up = null, Headshot = null, PlayerLink = null) {
  return h('div', { className: 'gdhero__top' }, scorebookBox(h, BLANK),
    up && h('div', { className: 'gdhero__txt' }, h('div', { className: 'gdhero__who' }, who(h, PlayerLink, up))),
    up && shot(h, Headshot, PlayerLink, up))
}
const atPlate = (feed, inning, half, mark) =>
  feed && halfIndex(inning, half) <= (mark ?? -1) + 1 ? selectDueUpDuring(feed, inning, half, mark, null, 1)?.batters?.[0] ?? null : null

// The open at-bat: only its shown sub-steps are read, so the last pitch and the result never reach it.
function openBox(h, feed, inning, half, { count, sub }, Headshot, PlayerLink, Line) {
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
      playText(h, Line, line)),
    shot(h, Headshot, PlayerLink, batter))
}

// The play's words. `Line` (GamedayHero.jsx) sets them smaller when they would run past the space, so a
// long play is read whole rather than cut off with an ellipsis; without it (the suite) a plain paragraph.
const playText = (h, Line, text) => (Line ? h(Line, { text }) : h('p', { className: 'gdhero__line' }, text))

// The batter's headshot, in a column of its own at the right of the hero.
// The batter's name and headshot open his hover card and his page (PlayerLink).
const fullName = (b) => [b.first, b.last].filter(Boolean).join(' ')
const who = (h, PlayerLink, b) => (PlayerLink ? h(PlayerLink, { id: b.id, name: fullName(b) }, fullName(b)) : fullName(b))
const shot = (h, Headshot, PlayerLink, b) => {
  if (!Headshot) return null
  const img = h(Headshot, { personId: b.id, name: b.last, tint: false })
  return h('div', { className: 'gdhero__shot' }, PlayerLink ? h(PlayerLink, { id: b.id, name: fullName(b) }, img) : img)
}

// An at-bat the half's last out cut short: the out that did it leads the words ("CS 2-4"), then how it
// happened, then the count he was left at.
function words(h, feed, e) {
  if (!e.interrupted) return playLine(e)
  const cut = cutShort(feed?.liveData?.plays?.allPlays?.find((p) => p.about?.atBatIndex === e.atBatIndex), runnerOutCode)
  if (!cut) return playLine(e)
  return [h('b', { key: 'c', className: 'gdhero__cut' }, cut.code), ' ', cut.text, ' ', playLine(e)]
}

// The diamond is the handle for where the ball went (`Flight`, charts/BallFlight.jsx, as the old
// Gameday's feed had it): hover on a desktop, tap on a phone. A ball not put in play, or a park with
// no layout, draws no handle (BallFlight stands down itself).
// The pitch columns are the handle for the strike zone and the pitches with their speeds (`Zone`,
// GamedayHero.jsx: the old feed's StrikeZoneModal), on a click.
function result(h, e, Headshot, PlayerLink, Line, feed, Flight = null, Zone = null) {
  const { batter } = e
  const contact = contactStats(e)
  const flight = Flight && e.battedBall ? h(Flight, { ball: e.battedBall, batter, code: e.code ?? '', facts: false, arc: false, head: false, hover: false }) : null
  const zone = Zone ? h(Zone, { entry: e }) : null
  return h('div', { className: 'gdhero__top' }, scorebookBox(h, boxModel(e), flight, zone),
    h('div', { className: 'gdhero__txt' },
      h('div', { className: 'gdhero__who' },
        who(h, PlayerLink, batter)),
      playText(h, Line, words(h, feed, e)),
      contact.length > 0 && h('dl', { className: 'gdhero__contact' },
        ...contact.map((c) => h('div', { key: c.label }, h('dt', null, c.label), h('dd', null, c.value, c.unit && h('small', null, c.unit)))))),
    shot(h, Headshot, PlayerLink, batter))
}

export function heroMarkup(h, { SealBox, Headshot = null, PlayerLink = null, Line = null, Flight = null, Zone = null, feed, inning, half, last, open = null, mark = null }) {
  return h('div', { className: 'gdhero' },
    open?.sub > 0
      ? h(SealBox, { coverless: true, forceRevealed: true }, () => openBox(h, feed, inning, half, open, Headshot, PlayerLink, Line))
      : last
        ? h(SealBox, { coverless: true, forceRevealed: true }, () => result(h, last, Headshot, PlayerLink, Line, feed, Flight, Zone))
        : sealedBox(h, atPlate(feed, inning, half, mark), Headshot, PlayerLink))
}
