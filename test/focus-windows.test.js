// focusWindows / buildTrailItems (src/api/playbyplay/entriesView.js) — focus
// mode's display windows and the at-bat trail's chips.
//
// THE REGRESSION THESE PIN. The windows used to be the reveal walk itself
// (`stepBounds` + a `bounds.filter(b => b <= cap)` count at the caller). A
// stoppage reaches the feed nested at the head of the play that FOLLOWS it, so
// a mound visit announced after an out arrives when the NEXT batter steps in —
// after the tap that revealed the out, with the cap already stored. That grew
// the last boundary past the cap, the count DROPPED, and the reader following
// the newest window was moved back an at-bat mid-half. The replay at the
// bottom of this file reproduces it on a captured real game: 14 of 89 taps.
//
// The second property is the other half of the fix: a card belongs to exactly
// ONE window, and once a window closes, its content never changes underneath
// a reader who already saw it. Windows are anchored on AT-BATS (never on a
// boundary value that can retroactively grow), which is what keeps the COUNT
// of windows monotonic no matter how a live half's trailing notices stream
// in — that count is what the two properties above actually depend on. A mid-
// half notice TRAILS the batter who came before it (matching nextStepBoundary,
// which already bundles it into that batter's own reveal tap) rather than
// leading the batter who comes after — a pitching change is on the page the
// moment you finish the batter who forced it, not one tap later, bundled with
// a result it had nothing to do with (gamePk 823584 bottom 1st: Robert Gasser
// relieved Dustin May after the first out, and the reader had no way to know
// it until they'd already revealed Gasser's own first batter faced).
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { computeHalfInningFeed, focusWindows, nextStepBoundary, buildTrailItems } from '../src/api/playbyplay.js'

// Hand-built entries: focusWindows' contract is defined purely over `kind`, so
// small synthetic arrays exercise it more precisely than a threaded feed.
const ab = (last, extra = {}) => ({ kind: 'atbat', batter: { last, first: '' }, code: '', ...extra })
const note = (eventType) => ({ kind: 'event', eventType })
const placedAt = (last, extra = {}) => ({ kind: 'placed', runner: { last, first: '' }, code: '', ...extra })

const shown = (entries, wins) => wins.map(({ start, end }) => entries.slice(start, end).map(label))
const label = (e) =>
  e.kind === 'atbat' ? `AB:${e.batter.last}` : e.kind === 'placed' ? `PLACED:${e.runner.last}` : `note:${e.eventType}`

test('one window per at-bat, trailing notices staying with the batter who preceded them', () => {
  // The leading note has no earlier at-bat to trail, so it stages the half's
  // first window same as always. The mound visit, coming AFTER Alpha and
  // BEFORE Bravo, now trails Alpha's own window instead of leading Bravo's.
  const entries = [note('pitching_substitution'), ab('Alpha'), note('mound_visit'), ab('Bravo')]
  assert.deepEqual(shown(entries, focusWindows(entries, entries.length)), [
    ['note:pitching_substitution', 'AB:Alpha', 'note:mound_visit'],
    ['AB:Bravo'],
  ])
})

test('the extras placement rides at the head of the leadoff hitter’s window', () => {
  const entries = [placedAt('Turang'), note('caught_stealing_3b'), ab('Lara')]
  assert.deepEqual(shown(entries, focusWindows(entries, entries.length)), [
    ['PLACED:Turang', 'note:caught_stealing_3b', 'AB:Lara'],
  ])
})

test('a mid-half notice is visible the moment its own tap reveals it, and never moves window after that', () => {
  // The cap that one "Next at-bat" tap produces sweeps the notice trailing the
  // at-bat it revealed (nextStepBoundary) — so the notice must show up in
  // THAT SAME tap's window, not wait for the batter it precedes.
  const entries = [ab('Alpha'), note('mound_visit'), ab('Bravo')]
  const firstTap = nextStepBoundary(entries, 0)
  assert.equal(firstTap, 2, 'the tap reveals the at-bat and the notice trailing it')

  const atTap = shown(entries, focusWindows(entries, firstTap))
  assert.deepEqual(atTap, [['AB:Alpha', 'note:mound_visit']], 'not deferred to Bravo\'s window')

  // Once Bravo is revealed too, Alpha's window — the notice included — must
  // be byte-for-byte the same as it was a tap ago: a card belongs to exactly
  // one window, and once closed that window's content never changes under a
  // reader who has already seen it.
  const afterNext = shown(entries, focusWindows(entries, nextStepBoundary(entries, firstTap)))
  assert.deepEqual(afterNext, [['AB:Alpha', 'note:mound_visit'], ['AB:Bravo']])
})

test('notes no at-bat will ever follow ride the last window', () => {
  // A closing ejection: nobody is left to bat, so there is no later window to
  // hand them to and dropping them would lose the card entirely.
  const entries = [ab('Alpha'), note('ejection'), note('game_advisory')]
  assert.deepEqual(shown(entries, focusWindows(entries, entries.length)), [
    ['AB:Alpha', 'note:ejection', 'note:game_advisory'],
  ])
})

test('the count of windows never drops when a notice arrives under an unchanged cap', () => {
  // The live edge, exactly as it happens: the reader taps on the at-bat that
  // has resolved, then the next batter steps in and his play arrives carrying
  // the pitching change announced after the out. The cap has not moved.
  const atTap = [ab('Alpha'), ab('Bravo')]
  const cap = nextStepBoundary(atTap, 0)
  const before = focusWindows(atTap, cap).length
  const afterArrival = [ab('Alpha'), note('pitching_substitution'), ab('Bravo')]
  assert.equal(focusWindows(afterArrival, cap).length, before)
  assert.equal(before, 1)
})

test('no window ever reaches past the cap', () => {
  const entries = [ab('Alpha'), note('mound_visit'), ab('Bravo'), ab('Charlie')]
  for (let cap = 0; cap <= entries.length; cap++) {
    for (const w of focusWindows(entries, cap)) {
      assert.ok(w.end <= cap, `window ends at ${w.end}, cap ${cap}`)
      assert.ok(w.start < w.end, 'no empty window')
    }
  }
  assert.deepEqual(focusWindows(entries, 0), [])
})

// The exact real-game shape that motivated the trailing fix: gamePk 823584
// (2026-08-26 MIL@NYM), bottom 1st. Ewing lines out for the first out; Dustin
// May leaves hurt and Robert Gasser relieves him, both announced nested at
// the head of Lindor's play (statsapi's usual placement); Lindor and Bichette
// each make the last two outs. The reveal cap already bundles the injury
// delay and the pitching change into the SAME "Next at-bat" tap that reveals
// Ewing's out (nextStepBoundary) — this pins that the windowed display
// matches, instead of stranding "who's pitching now" until Lindor's own tap.
test('a real mid-inning pitching change is on screen with the batter who forced it, not the next one up', () => {
  const entries = [
    ab('Ewing'),
    note('game_advisory'),
    note('pitching_substitution'),
    ab('Lindor'),
    ab('Bichette'),
  ]
  const firstTap = nextStepBoundary(entries, 0)
  assert.equal(firstTap, 3, 'one tap reveals the out, the injury delay, and the pitching change together')

  assert.deepEqual(shown(entries, focusWindows(entries, firstTap)), [
    ['AB:Ewing', 'note:game_advisory', 'note:pitching_substitution'],
  ])

  const secondTap = nextStepBoundary(entries, firstTap)
  assert.deepEqual(shown(entries, focusWindows(entries, secondTap)), [
    ['AB:Ewing', 'note:game_advisory', 'note:pitching_substitution'],
    ['AB:Lindor'],
  ])
})

test('a cap holding only leading notices still yields the window that shows them', () => {
  // The live edge of an extra half: the placement is posted before the leadoff
  // plate appearance resolves, and is genuinely the only card there is. The
  // alternative is a tap that answers with a blank stage.
  const entries = [placedAt('Contreras'), note('offensive_substitution')]
  assert.deepEqual(shown(entries, focusWindows(entries, 2)), [['PLACED:Contreras', 'note:offensive_substitution']])
})

const CODES = { pitching_substitution: 'P', mound_visit: 'MV', stolen_base_2b: 'SB' }
const codeFor = (t) => CODES[t]

test('a chip carries the notice marks of the cards trailing IT, not the next batter', () => {
  const entries = [ab('Alpha', { code: '6-3' }), note('pitching_substitution'), note('mound_visit'), ab('Bravo', { code: 'K' })]
  const items = buildTrailItems(entries, focusWindows(entries, entries.length), codeFor)
  assert.deepEqual(
    items.map((i) => ({ name: i.name, code: i.code, notices: i.notices })),
    [
      { name: 'Alpha', code: '6-3', notices: ['P', 'MV'] },
      { name: 'Bravo', code: 'K', notices: [] },
    ],
  )
})

test('the placement chip names the leadoff batter, and the runner only when he is alone', () => {
  const withBatter = [placedAt('Turang', { code: 'AR' }), ab('Lara', { code: '1B' })]
  assert.deepEqual(
    buildTrailItems(withBatter, focusWindows(withBatter, withBatter.length), codeFor).map((i) => [i.name, i.code]),
    [['Lara', '1B']],
  )
  // Alone at the live edge — and named for whoever occupies the base now: the
  // last pinch runner in the chain (gamePk 823263 top 11, Bae for Contreras).
  const alone = [placedAt('Contreras', { code: 'AR', pinchRunners: [{ last: 'Bae' }] })]
  assert.deepEqual(
    buildTrailItems(alone, focusWindows(alone, 1), codeFor).map((i) => [i.name, i.code, i.kind]),
    [['Bae', 'AR', 'placed']],
  )
})

// The replay, on the captured feed the spoiler invariant is pinned to (see
// invariant-real-game.test.js). Every "Next at-bat" tap of every half, with the
// feed truncated to the plays that existed at the moment of the tap — then the
// next batter steps in and his play arrives. The reader's window count must
// never fall, and no window may reach past the stored cap.
const FEED = JSON.parse(readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'))

test('replaying the captured game live, the reader is never moved backwards', () => {
  const allPlays = FEED.liveData.plays.allPlays
  const truncTo = (n) => ({
    ...FEED,
    liveData: { ...FEED.liveData, plays: { ...FEED.liveData.plays, allPlays: allPlays.slice(0, n) } },
  })
  let taps = 0
  for (let inning = 1; inning <= FEED.liveData.linescore.innings.length; inning++) {
    for (const half of ['top', 'bottom']) {
      const side = half === 'top' ? 'away' : 'home'
      const idxs = allPlays
        .map((p, i) => (p.about?.inning === inning && p.about?.halfInning === half ? i : -1))
        .filter((i) => i >= 0)
      let cap = 0
      for (let k = 0; k < idxs.length; k++) {
        const atTap = computeHalfInningFeed(truncTo(idxs[k] + 1), inning, half, side, cap)
        const next = nextStepBoundary(atTap, cap)
        if (next <= cap) continue
        cap = next
        taps += 1
        const count = focusWindows(computeHalfInningFeed(truncTo(idxs[k] + 1), inning, half, side, cap), cap).length
        if (idxs[k + 1] == null) continue
        // The next batter steps in, carrying whatever was announced after the
        // out. The reader has NOT tapped, so the cap is unchanged.
        const grown = computeHalfInningFeed(truncTo(idxs[k + 1] + 1), inning, half, side, cap)
        const after = focusWindows(grown, cap)
        assert.ok(
          after.length >= count,
          `${half} ${inning} tap ${k + 1}: ${count} windows became ${after.length} when the next play arrived`,
        )
        for (const w of after) assert.ok(w.end <= cap, 'a window reached past the stored cap')
      }
    }
  }
  assert.ok(taps > 50, `expected a full game of taps, replayed ${taps}`)
})
