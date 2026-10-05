// The lens bar's choice of state and words (#724, slice L4): src/lib/scorecard/
// bar.js, pinned on the captured real game (gamePk 823035, the fixture
// scorecard-lens-words.test.js reads).
//
// THE PROMISE THAT MATTERS: before the tap, nothing the bar says may depend on
// the sealed at-bat's result (ADR-0046, G8). The last test taps through the
// game and, at every step, builds the bar twice: from the real feed, and from
// a copy whose sealed at-bat ends in a different result. The two must match.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { scorecardFull, scorecardStep } from '../src/api/scorecardGame.js'
import { halfIndex } from '../src/api/select.js'
import { halfCards } from '../src/lib/scorecard/situation.js'
import { runnerMoves } from '../src/lib/scorecard/words.js'
import { barLines, barState, liveLine, tapLocked } from '../src/lib/scorecard/bar.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

// ---------------------------------------------------------------------------
// tapLocked — 700 ms after every reveal and every turn, on an injected clock
// ---------------------------------------------------------------------------

test('tapLocked holds for 700 ms after the last accepted tap, whatever it did', () => {
  assert.equal(tapLocked(1000, null), false, 'no tap yet')
  assert.equal(tapLocked(1000, undefined), false)
  assert.equal(tapLocked(1000, 1000), true, 'the same instant')
  assert.equal(tapLocked(1699, 1000), true, 'one ms inside')
  assert.equal(tapLocked(1700, 1000), false, 'the window is 700 ms, no more')
  assert.equal(tapLocked(1100, 1000, 50), false, 'a caller may pass its own window')
})

// ---------------------------------------------------------------------------
// A page-shaped walk: what ScorecardPage holds after each tap in the lens
// ---------------------------------------------------------------------------

// `mutate(feed, atBatIndex)` lets the spoiler test swap the sealed at-bat's
// result. The cursor values (through, counts) come from the REAL feed so both
// runs stand at the same step.
function walk(feed = FEED) {
  const counts = {}
  const countFor = (inning, half) => counts[`${inning}${half}`] ?? 0
  const out = []
  let through = -1
  let side = null
  let moves = []
  let prev = null
  for (;;) {
    const info = scorecardStep(feed, through, countFor)
    if (!info) return out
    side ??= info.side
    const flip =
      info.side !== side
        ? { inning: info.half === 'bottom' ? info.inning : info.inning - 1, label: `${info.half === 'top' ? 'Top' : 'Bottom'} ${info.inning}` }
        : null
    const view = scorecardFull({ feed }, side, {
      through,
      step: { halfIdx: through + 1, count: info.count },
    })
    out.push({ info, flip, view, side, moves, through, counts: { ...counts } })
    if (flip) {
      side = info.side // Turn
      continue
    }
    // Tap.
    prev = view
    if (info.nextCount >= info.total && info.halfOver) through = halfIndex(info.inning, info.half)
    else counts[`${info.inning}${info.half}`] = info.nextCount
    const nextInfo = scorecardStep(feed, through, countFor)
    if (nextInfo) {
      const nv = scorecardFull({ feed }, side, {
        through,
        step: { halfIdx: through + 1, count: nextInfo.count },
      })
      moves = runnerMoves(halfCards(prev, info.inning), halfCards(nv, info.inning))
    }
  }
}

const bar = (s, extra = {}) => {
  const state = barState({ loading: false, stepInfo: s.info, flip: s.flip })
  return {
    state,
    ...barLines({
      state,
      view: s.view,
      stepInfo: s.info,
      flip: s.flip,
      moves: s.moves,
      lineupPosted: true,
      ...extra,
    }),
  }
}

const STEPS = walk()

// ---------------------------------------------------------------------------
// The state choice
// ---------------------------------------------------------------------------

test('barState: loading wins, then the handoff, then the live edge, else sealed', () => {
  const info = { nextCount: 3, total: 5, halfOver: true }
  const flip = { inning: 3, label: 'Bottom 3' }
  assert.equal(barState({ loading: true, stepInfo: info, flip }), 'loading')
  assert.equal(barState({ loading: false, stepInfo: info, flip }), 'handoff')
  assert.equal(barState({ loading: false, stepInfo: info, flip: null }), 'sealed')
  // ADR-0055 / G10: the cursor at the feed's edge of a half still being played.
  const edge = { nextCount: 5, total: 5, halfOver: false }
  assert.equal(barState({ loading: false, stepInfo: edge, flip: null }), 'edge')
  assert.equal(barState({ loading: false, stepInfo: { ...edge, halfOver: true }, flip: null }), 'sealed')
  // A turn due beats a live edge in the half after it: Turn comes first.
  assert.equal(barState({ loading: false, stepInfo: edge, flip }), 'handoff')
  assert.equal(barState({ loading: false, stepInfo: null, flip: null }), null)
})

test('the fixture walk: leading off, the play in words, the handoff with totals', () => {
  const first = bar(STEPS[0])
  assert.equal(first.state, 'sealed')
  assert.equal(first.lineA, 'Leading off: #22 Yelich.')
  assert.equal(first.situation, 'Top 1 · no outs · bases empty')
  assert.equal(first.label, 'Unwrap #22 Yelich')

  // After one tap: the play in words, from the opened box.
  const second = bar(STEPS[1])
  assert.equal(second.state, 'sealed')
  assert.match(second.lineA, /^\S.* (singled|doubled|tripled|homered|walked|grounded|flied|lined|popped|struck|reached|was hit)/i)
  assert.doesNotMatch(second.lineA, /Leading off/)

  // The first handoff: Top 1 is over, and its totals are committed.
  const turn = STEPS.find((s) => s.flip)
  const handoff = bar(turn)
  assert.equal(handoff.state, 'handoff')
  assert.equal(handoff.lineA, 'Top 1 is over. Rule it off.')
  assert.equal(handoff.label, 'Turn to Bottom 1')
  assert.match(handoff.situation, /^Top 1 · \d+ R · \d+ H · \d+ E · \d+ LOB$/)
  // The page after Turn: the bottom half leads off, with no totals.
  const after = STEPS[STEPS.indexOf(turn) + 1]
  assert.equal(bar(after).state, 'sealed')
  assert.match(bar(after).lineA, /^Leading off: /)
})

test('the totals line waits for the commit: no sealed state ever carries one', () => {
  for (const s of STEPS) {
    const b = bar(s)
    if (b.state !== 'handoff') assert.doesNotMatch(b.situation, /\bR ·/, `${b.state} showed totals`)
  }
})

test('the live edge says who is batting and when it last looked; no totals', () => {
  const edge = { ...STEPS[1].info, nextCount: 5, total: 5, halfOver: false }
  const b = bar({ ...STEPS[1], info: edge })
  assert.equal(b.state, 'edge')
  assert.equal(b.label, 'Waiting for the play')
  assert.match(b.situation, /^Top 1 · /)
  assert.doesNotMatch(b.situation, /\bR ·/)
  assert.equal(liveLine('Arceneaux', 112_000, 100_000), 'Arceneaux is batting · checked 12 s ago')
  assert.equal(liveLine('Arceneaux', 340_000, 100_000), 'Arceneaux is batting · checked 4 min ago')
  assert.equal(liveLine('Arceneaux', 102_000, 100_000), 'Checked just now · nothing new yet')
  assert.equal(liveLine('', 112_000, 100_000), 'A batter is up · checked 12 s ago')
  assert.equal(liveLine('Arceneaux', 112_000, null), 'Arceneaux is batting')
  // No at-bat in the feed yet (the half's last one is open): nobody is up.
  assert.equal(liveLine(null, 112_000, 100_000), 'Waiting for the next batter · checked 12 s ago')
  assert.equal(liveLine(null, 112_000, null), 'Waiting for the next batter')
})

test('loading: no words, no situation, a disabled label', () => {
  const s = STEPS[0]
  const b = barLines({ state: 'loading', view: s.view, stepInfo: s.info, flip: null, moves: [] })
  assert.deepEqual(b, { lineA: '', situation: '', label: 'Loading' })
})

test('minor league: no lineup and no name still gives a working bar', () => {
  const s = STEPS[0]
  const view = { ...s.view, grid: { ...s.view.grid, frontier: { ...s.view.grid.frontier, batter: null } } }
  const b = barLines({ state: 'sealed', view, stepInfo: s.info, flip: null, moves: [], lineupPosted: false })
  assert.equal(b.label, 'Unwrap the next at-bat')
  assert.equal(b.lineA, 'Lineup not posted yet. Names fill in as they bat.')
  // A man with a name but no number.
  const named = { ...s.view.grid.frontier, batter: { last: 'Quillen', jersey: '' } }
  const v2 = { ...s.view, grid: { ...s.view.grid, frontier: named } }
  const b2 = barLines({ state: 'sealed', view: v2, stepInfo: s.info, flip: null, moves: [], lineupPosted: true })
  assert.equal(b2.label, 'Unwrap Quillen')
  assert.equal(b2.lineA, 'Leading off: Quillen.')
})

// ---------------------------------------------------------------------------
// The frontier's batter, which names the Unwrap button
// ---------------------------------------------------------------------------

test('the grid names the frontier batter, who is the one the sealed box will hold', () => {
  const sealed = STEPS.filter((x) => x.view.grid.frontier)
  assert.ok(sealed.length > 20)
  for (const s of sealed) assert.ok(s.view.grid.frontier.batter?.last, 'a name on every frontier')
})

// ---------------------------------------------------------------------------
// SPOILER INVARIANT
// ---------------------------------------------------------------------------

// The same feed with the play at `atBatIndex` ending a different way. Only the
// result changes: the batter, the pitches and the order of plays do not.
function withResult(feed, atBatIndex, eventType, event) {
  const copy = structuredClone(feed)
  const play = copy.liveData.plays.allPlays.find((p) => p.about?.atBatIndex === atBatIndex)
  play.result = { ...play.result, eventType, event, description: `${event}.` }
  return copy
}

test('before the tap, the bar reads the same whatever the sealed at-bat turns out to be', () => {
  let checked = 0
  for (const s of STEPS) {
    if (s.flip) continue
    // The sealed at-bat: the first at-bat entry past the cursor. It is the
    // card the NEXT tap opens; find its atBatIndex off the full-game sheet.
    const full = scorecardFull({ feed: FEED }, s.side, { through: Infinity })
    const sealed = halfCards(full, s.info.inning)
      .filter((c) => c.kind === 'atbat')
      .map((c) => c.atBatIndex)
    const next = sealed.find((i) => !halfCards(s.view, s.info.inning).some((c) => c.atBatIndex === i))
    if (next == null) continue
    // 1. The clamp: every card the bar can read is already on the sheet.
    for (const c of halfCards(s.view, s.info.inning)) assert.ok(c.atBatIndex < next, 'no card past the clamp')
    // 2. The result swap: two different endings, one and the same bar.
    const counts = s.counts
    const countFor = (inning, half) => counts[`${inning}${half}`] ?? 0
    const barFor = (feed) => {
      const info = scorecardStep(feed, s.through, countFor)
      const view = scorecardFull({ feed }, s.side, {
        through: s.through,
        step: { halfIdx: s.through + 1, count: info.count },
      })
      const state = barState({ loading: false, stepInfo: info, flip: null })
      return { state, ...barLines({ state, view, stepInfo: info, flip: null, moves: s.moves, lineupPosted: true }) }
    }
    const homer = barFor(withResult(FEED, next, 'home_run', 'Home Run'))
    const k = barFor(withResult(FEED, next, 'strikeout', 'Strikeout'))
    assert.deepEqual(homer, k, `step ${checked}: the bar leaked the sealed at-bat's result`)
    assert.deepEqual(homer, barFor(FEED), `step ${checked}: the bar differs from the real feed's`)
    checked += 1
  }
  assert.ok(checked >= 20, `walked ${checked} steps`)
})

// ---------------------------------------------------------------------------
// THE LIVE EDGE IS A BATTER STILL UP, not the last entry the feed holds
// ---------------------------------------------------------------------------

// The fixture cut after Top 1's last play (the third out), and marked live.
// The next half has no play yet, so the half is not over (ADR-0055).
function liveCut({ inProgress = false } = {}) {
  const copy = structuredClone(FEED)
  copy.gameData.status.abstractGameState = 'Live'
  const plays = copy.liveData.plays.allPlays
  const lastTop1 = plays.findLastIndex((p) => p.about.inning === 1 && p.about.halfInning === 'top')
  copy.liveData.plays.allPlays = plays.slice(0, lastTop1 + 1)
  if (inProgress) {
    const p = copy.liveData.plays.allPlays.at(-1)
    // The shape of a play still being pitched (verified live, gamePk 824238):
    // isComplete false, and a result with its type but no event yet.
    p.about.isComplete = false
    p.result = { type: 'atBat' }
    p.runners = []
  }
  return copy
}

// The bar for a reader who has opened every entry but the last one.
function barAtLast(feed) {
  let count = 0
  let info
  for (;;) {
    info = scorecardStep(feed, -1, () => count)
    if (info.nextCount >= info.total) break
    count = info.nextCount
  }
  const view = scorecardFull({ feed }, 'top', { through: -1, step: { halfIdx: 0, count: info.count } })
  const state = barState({ loading: false, stepInfo: info, flip: null, frontier: view.grid.frontier })
  return { info, state, ...barLines({ state, view, stepInfo: info, flip: null, moves: [] }) }
}

test('a finished at-bat at the end of a live feed is sealed and opens, not "At bat"', () => {
  const b = barAtLast(liveCut())
  assert.equal(b.info.halfOver, false, 'the next half has not started')
  assert.equal(b.state, 'sealed', 'the third out is in the feed: Unwrap must open it')
  assert.match(b.label, /^Unwrap #\d+ \S+/)
})

test('the at-bat still in progress is the live edge', () => {
  const b = barAtLast(liveCut({ inProgress: true }))
  assert.equal(b.state, 'edge')
  assert.equal(b.label, 'Waiting for the play')
})

test('after the last finished at-bat opens, a live half waits with no frontier', () => {
  const feed = liveCut()
  const total = scorecardStep(feed, -1, () => 0).total
  const info = scorecardStep(feed, -1, () => total)
  const view = scorecardFull({ feed }, 'top', { through: -1, step: { halfIdx: 0, count: total } })
  assert.equal(view.grid.frontier, null)
  assert.equal(barState({ loading: false, stepInfo: info, flip: null, frontier: view.grid.frontier }), 'edge')
})

// L10 review: the reader opened the third out while the half was live, and a
// poll then brought the next half's first play. Every box of Top 1 is open,
// the half is over, and no seal is left: the half is SPENT. The bar must not
// offer "Unwrap the next at-bat" (the frame holds no seal), and the page
// commits the half on its own, as the innings viewer does (stepCommitReady).
test('a spent half (all open, then the next half starts) is not a seal to unwrap', () => {
  const parked = liveCut()
  const total = scorecardStep(parked, -1, () => 0).total
  assert.equal(scorecardStep(parked, -1, () => total).spent, false, 'live: the cursor parks, nothing commits')

  const next = structuredClone(parked)
  next.liveData.plays.allPlays.push(structuredClone(FEED.liveData.plays.allPlays[next.liveData.plays.allPlays.length]))
  const info = scorecardStep(next, -1, () => total)
  assert.equal(info.halfOver, true, 'the next half has a play now')
  assert.equal(info.spent, true)
  const view = scorecardFull({ feed: next }, 'top', { through: -1, step: { halfIdx: 0, count: total } })
  assert.equal(view.grid.frontier, null, 'no seal on the sheet')
  assert.equal(barState({ loading: false, stepInfo: info, flip: null, frontier: null }), 'loading')

  // A half with boxes still sealed is never spent, live or over.
  assert.equal(scorecardStep(next, -1, () => 0).spent, false)
  assert.equal(scorecardStep(FEED, -1, () => 0).spent, false)
})
