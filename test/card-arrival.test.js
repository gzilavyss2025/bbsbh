// Slice 3 of 3 of the notification-card redesign (ADR-0113): the arrival animation, the full
// card as the lead-in repeat, and the pitch scene's colours. The seal pin for this slice is
// C4_SEAL in card-cascade.test.js; it passes unchanged.
//
//   1. THE BAND'S PAINT: the club's triad, else the house navy.
//   2. THE GATE: no motion class on a cold load, and motion only through useBecameTrue.
//   3. THE SHARED ANSWER: the repeat asks for nothing.
//   4. THE SCENE'S COLOURS: the pitch's mark colour, never a family colour.
//   5. THE CSS: the spec's times, the reused texture tokens, the reduced-motion state.
//   6. THE CALLERS.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { stripComments, ruleBody } from './helpers/css.js'
import { useArrival } from '../src/hooks/motion/useArrival.js'
import { bandPaint } from '../src/lib/pitcherCard/card.js'
import { keyedCache } from '../src/lib/pitcherCard/cardData.js'
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
import { atBatScenePitches } from '../src/lib/pitcherCard/atBat.js'
import { scenePitches } from '../src/lib/pitcherCard/scene.js'
import { pitchMark } from '../src/lib/pitch/pitchTypes.js'
import { pitchTiles } from '../src/lib/pitcherCard/card.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles', rel)))

// ---- 1. the band's paint ----

const BOTH_MAIN = { away: 'main', home: 'main' }

test('a club with a hand-set triad wears it on the band (Dodgers)', () => {
  const band = bandPaint({ teamId: 119, side: 'home', treatment: BOTH_MAIN })
  assert.equal(band.house, false)
  assert.equal(band.style['--bar-fill'], '#005A9C')
  assert.equal(band.style['--bar-accent'], '#A5ACAF')
  assert.equal(band.style['--bar-text'], '#FFFFFF')
})

test('a club with no triad, or no jersey to read, keeps the house navy', () => {
  for (const args of [
    { teamId: 119, side: 'home', treatment: undefined },
    { teamId: 119, side: 'home', treatment: { away: 'main' } },
    { teamId: null, side: 'home', treatment: BOTH_MAIN },
    { teamId: 99999999, side: 'away', treatment: BOTH_MAIN },
  ]) {
    const band = bandPaint(args)
    assert.equal(band.house, true, JSON.stringify(args))
    assert.equal(band.style, undefined, 'no club property is set')
  }
})

test('a handoff card is the house navy whatever the club has: it asks CardBand for it', () => {
  const handoff = src('components/playbyplay/PitcherHandoffCard.jsx')
  assert.equal([...handoff.matchAll(/<CardBand label=\{TABS\.(departing|final)\} house \/>/g)].length, 2)
  assert.doesNotMatch(handoff, /bandPaint/, 'no club paint reaches a handoff card')
})

test('the band paints from identity only: the same inputs give the same answer', () => {
  assert.deepEqual(bandPaint({ teamId: 158, side: 'away', treatment: BOTH_MAIN }), bandPaint({ teamId: 158, side: 'away', treatment: BOTH_MAIN }))
  // Its signature takes no feed, score or inning (ADR-0030, ADR-0046).
  assert.doesNotMatch(src('lib/pitcherCard/card.js').split('export function bandPaint')[1], /feed|linescore|inning|score/i)
})

// ---- 2. the gate ----

const classOf = (open) => {
  function Probe() {
    return createElement('div', { className: useArrival(open) })
  }
  return renderToStaticMarkup(createElement(Probe))
}

test('a cold load with the data in hand draws arrived, with no motion class', () => {
  assert.equal(classOf(true), '<div class="arrival is-in"></div>')
})

test('a card with no data yet is the plain card', () => {
  assert.equal(classOf(false), '<div class="arrival"></div>')
})

test('every transition hangs off .arrival--play, and nothing else plays', () => {
  const motion = css('motion/arrival.css')
  const rules = [...motion.matchAll(/([^{}]+)\{[^{}]*transition[^{}]*\}/g)].flatMap((m) => m[1].split(','))
  assert.ok(rules.length >= 7)
  for (const sel of rules) assert.match(sel.trim(), /^\.arrival--play\b/, sel)
  // The resting sheet moves nothing: it has no transition and no animation.
  assert.doesNotMatch(css('pitcher-card/arrival.css'), /transition|animation/)
})

test('the arrival is gated by useBecameTrue and reads no game state', () => {
  const hook = src('hooks/motion/useArrival.js')
  assert.match(hook, /useBecameTrue\(open\)/)
  assert.doesNotMatch(hook.replace(/^\s*\/\/.*$/gm, ''), /feed|linescore|derive|revealedThrough|SealBox/)
})

// ---- 3. the shared answer ----

test('the repeat reads the kept answer: one read for an arm and a game', async () => {
  const cache = keyedCache()
  let reads = 0
  const read = async () => {
    reads += 1
    return { line: 'ERA 3.46' }
  }
  assert.equal(cache.peek('a'), null, 'nothing kept before the first ask')
  const [first, second] = await Promise.all([cache.load('a', read), cache.load('a', read)]) // two cards, one request in flight
  assert.equal(first, second)
  assert.equal(reads, 1)
  assert.deepEqual(cache.peek('a'), { line: 'ERA 3.46' }, 'the repeat draws complete on its first render')
  await cache.load('a', read)
  assert.equal(reads, 1, 'a later card asks nothing')
  await cache.load('b', read)
  assert.equal(reads, 2, 'another arm is another read')
})

test('an answer `keep` refuses is returned but not kept: the next ask tries again', async () => {
  const cache = keyedCache()
  let reads = 0
  const read = async () => ({ shard: ++reads > 1 ? { ok: true } : null })
  const keep = (a) => a.shard != null
  assert.equal((await cache.load('a', read, keep)).shard, null)
  assert.equal(cache.peek('a'), null, 'the answer with no shard is not kept')
  assert.deepEqual((await cache.load('a', read, keep)).shard, { ok: true })
  assert.deepEqual(cache.peek('a').shard, { ok: true })
})

test('a failed read is not kept: the next ask tries again', async () => {
  const cache = keyedCache()
  let reads = 0
  await assert.rejects(cache.load('a', async () => { reads += 1; throw new Error('down') }))
  assert.equal(cache.peek('a'), null)
  assert.deepEqual(await cache.load('a', async () => { reads += 1; return { ok: true } }), { ok: true })
  assert.equal(reads, 2)
})

// ---- 4. the scene's colours ----

const row = (code, pitches, avgVelo) => ({ code, pitches, avgVelo })

test('a scene pitch carries its mark colour: the one its tile wears', () => {
  const tiles = pitchTiles([row('FF', 500, 95), row('SL', 300, 86), row('CH', 200, 85)])
  const pitches = scenePitches(tiles, false)
  assert.deepEqual(pitches.map((p) => p.color), ['FF', 'SL', 'CH'].map((c) => pitchMark(c).color))
})

test('a scene pitch that brings its own colour keeps it', () => {
  const tile = { code: 'FF', name: 'Four-seam', family: 'fastball', pct: '100', mph: '95.0', velo: 95, color: '#123456' }
  assert.equal(scenePitches([tile], false)[0].color, '#123456')
})

test('the full card tolerates a missing pitcher, and never shows another key\'s answer', () => {
  const card = src('components/playbyplay/pitcherCard/PitcherCard.jsx')
  assert.match(card, /lefty=\{pitcher\?\.hand === 'L'\} name=\{pitcher\?\.name\}/)
  assert.match(card, /asked\?\.key === key \? asked : null/)
  assert.match(card, /\{ key, line, post, career, last, shard \}/)
})

test('the at-bat replay colours each pitch by its type, though its scene code is "FF-3"', () => {
  const coordinates = { aY: 26.4, aZ: -17.9, aX: 1.4, pX: 0.5, pZ: 2.1, vX0: 5.7, vY0: -137.9, vZ0: -7.4, x0: -1.7, y0: 50, z0: 6 }
  const event = (pitchNumber, code) => ({
    isPitch: true,
    pitchNumber,
    details: { call: { code: 'C', description: 'Called Strike' }, type: { code, description: code } },
    pitchData: { startSpeed: 94.2, extension: 6.2, coordinates },
  })
  const { pitchDetails } = pitchCardInfo({}, { playEvents: [event(1, 'FF'), event(2, 'SL')] })
  const out = atBatScenePitches(pitchDetails)
  assert.deepEqual(out.map((p) => p.code), ['FF-1', 'SL-2'])
  assert.deepEqual(out.map((p) => p.color), [pitchMark('FF').color, pitchMark('SL').color])
})

test('PitchScene draws lines, rings and trail in that colour, not a family class', () => {
  const scene = src('components/playbyplay/pitcherCard/PitchScene.jsx')
  assert.doesNotMatch(scene, /stroke--/)
  assert.match(scene, /setAttribute\('stroke', p\.color\)/)
  assert.equal([...scene.matchAll(/stroke=\{p\.color\}/g)].length, 2, 'the ghost line and its ring')
  assert.doesNotMatch(css('pitcher-card/card.css'), /stroke--|\.fill--/, 'the family colour rules are gone')
})

test('the faint lines and every arc: widths, opacities and the thin dark edge', () => {
  const card = css('pitcher-card/card.css')
  assert.match(card, /\.pscene__ghost polyline \{[^}]*stroke-width: 1\.8;[^}]*opacity: 0\.8;/)
  assert.match(card, /\.pscene__ghost \.pscene__ring \{[^}]*stroke-width: 1\.6;[^}]*opacity: 0\.85;/)
  assert.match(card, /\.pscene__ghost,\s*\.pscene__trail \{[^}]*filter: drop-shadow\(0 0 0\.7px color-mix\(in srgb, var\(--ink-0\) 90%, transparent\)\)/)
})

test('PitchMix draws no "Other" tile', () => {
  const mix = src('components/playbyplay/pitcherCard/PitchMix.jsx')
  assert.doesNotMatch(mix, /\.other|'other'/)
})

// ---- 5. the css ----

test('the times and the curve are the spec\'s', () => {
  const tokens = css('../tokens/effects.css')
  const tok = (name) => tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim()
  assert.equal(tok('--dur-arrive'), '380ms')
  assert.equal(tok('--dur-arrive-fade'), '260ms')
  assert.equal(tok('--dur-arrive-label'), '220ms')
  assert.equal(tok('--dur-arrive-texture'), '520ms')
  assert.equal(tok('--delay-arrive-label'), '200ms')
  assert.equal(tok('--delay-arrive-texture'), '260ms')
  assert.equal(tok('--dur-snappy'), '160ms') // the tab's fade
  assert.equal(tok('--ease-stamp'), 'cubic-bezier(0.2, 0.9, 0.3, 1)')
  const motion = css('motion/arrival.css')
  assert.match(motion, /clip-path var\(--dur-arrive\) var\(--ease-stamp\)/)
  assert.match(motion, /padding-top var\(--dur-arrive\) var\(--ease-stamp\)/)
  assert.match(motion, /grid-template-rows var\(--dur-arrive\) var\(--ease-stamp\) var\(--unfold-delay\)/)
  assert.match(motion, /opacity var\(--dur-arrive-fade\) ease var\(--unfold-delay\)/)
})

test('the sections unfold at 380, 435 and 490 ms; the handoff table at 380', () => {
  const card = src('components/playbyplay/pitcherCard/PitcherCard.jsx')
  assert.deepEqual([...card.matchAll(/<Unfold [^\n]*delay=\{(\d+)\}/g)].map((m) => Number(m[1])), [380, 435, 490])
  assert.match(src('components/playbyplay/PitcherHandoffCard.jsx'), /<Unfold open=\{open\} delay=\{380\}>/)
})

test('the band is 30px of fill and a 3px rule, with the head made room for it', () => {
  const rest = css('pitcher-card/arrival.css')
  assert.match(rest, /--cardband-fill: 30px;/)
  assert.match(rest, /--cardband-rule: 3px;/)
  assert.match(rest, /\.arrival\.is-in > \.change \{\s*padding-top: calc\(var\(--cardband-fill\) \+ var\(--cardband-rule\) \+ var\(--space-3h\)\);/) // 47px
  assert.match(css('pitcher-card/table.css'), /\.pcard > \.change \{\s*padding: calc\(var\(--space-6\) \+ var\(--space-1\)\)/) // 28px above the plain head
})

test('the band reuses the section head\'s texture: no gradient is copied', () => {
  const both = css('pitcher-card/arrival.css') + css('motion/arrival.css')
  assert.doesNotMatch(both, /radial-gradient|linear-gradient/)
  assert.doesNotMatch(both, /ripple|sheen/, 'the --ripple-* and --sheen-* tokens are read by .sectionhead--band')
  assert.match(src('components/playbyplay/pitcherCard/Arrival.jsx'), /cardband sectionhead--band/)
  assert.match(css('system/section-head.css'), /var\(--ripple-light\)[\s\S]*var\(--sheen-dark\)/)
})

test('reduced motion: no transition runs', () => {
  const motion = css('motion/arrival.css')
  const reduced = motion.slice(motion.indexOf('prefers-reduced-motion'))
  assert.match(reduced, /transition: none;/)
  for (const sel of ['.card__name', '> .cardband', '.cardband__label', '> .change', '.unfold']) assert.ok(reduced.includes(sel), sel)
})

test('the full card draws no white of its own: its labels and bands show the event yellow', () => {
  const table = css('pitcher-card/table.css')
  const body = (sel) => table.match(new RegExp(`(?:^|\\n)${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
  assert.match(table, /\.pcard__postrule,\s*\.pcard__mixlabel,\s*\.pcard__lasthead \{[^}]*padding/)
  for (const block of table.match(/\.pcard__postrule,\s*\.pcard__mixlabel,\s*\.pcard__lasthead \{[^}]*\}/g)) assert.doesNotMatch(block, /background/)
  assert.doesNotMatch(body('.pcard__cell .pcard__lbl'), /background/)
  assert.doesNotMatch(table, /--surface-card|--surface-inset/, 'no ground but the card\'s own yellow')
})

test('"Before this at-bat" is an inked tag in the count tag\'s face', () => {
  const tag = css('play-by-play/repeat-tag.css').match(/\.pbp__repeat-tag \{([^}]*)\}/)[1]
  for (const part of ['border: var(--bw-heavy) solid var(--border-stamped)', 'font-family: var(--font-display-tag)', 'text-transform: uppercase', 'width: fit-content']) assert.ok(tag.includes(part), part)
})

// ---- 6. the callers ----

test('the repeat is the full card; ReliefRepeat is gone', () => {
  const pbp = src('components/playbyplay/PlayByPlay.jsx')
  assert.doesNotMatch(pbp, /ReliefRepeat/)
  assert.doesNotMatch(src('components/playbyplay/PitcherNotice.jsx'), /ReliefRepeat/)
  assert.match(pbp, /label=\{repeat \? TABS\.reminder : undefined\}/)
  assert.match(pbp, /\{repeat && <span className="pbp__repeat-tag">Before this at-bat<\/span>\}/)
})

test('the departing arm\'s card arrives with the pitching card, in the house navy', () => {
  const pbp = src('components/playbyplay/PlayByPlay.jsx')
  assert.match(pbp, /after=\{\(open\) =>[\s\S]*<DepartureLineCard[\s\S]*open=\{open\}/)
  const handoff = src('components/playbyplay/PitcherHandoffCard.jsx')
  assert.equal([...handoff.matchAll(/<CardBand label=\{TABS\.(departing|final)\} house \/>/g)].length, 2)
})

// A wide child must scroll inside its own box. `.unfold`'s one implicit column is `auto`, which
// sizes to the child's min-content: a 460px table made the track 460px inside a 296px card, so the
// table's wrap grew with it, had nothing to scroll, and ran past the card on a phone.
test('.unfold\'s column cannot grow past the card, so a wide table scrolls inside it', () => {
  const body = ruleBody(css('pitcher-card/arrival.css'), '.unfold')
  assert.match(body, /grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})
