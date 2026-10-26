// Checkpoint pages (#2605): the tally and pitching pages for a closed half.
// Pinned on two real games:
//  - 823035 MIL@STL (test/fixtures/game-823035.trimmed.json): top 6 has a
//    pitching change between at-bats (690928 to 694363).
//  - 823169 MIN@SF (game-823169.gameday.json): in top 4, ab28, Tidwell
//    (694918) throws three pitches, then Beck (663941) replaces him mid-at-bat
//    and finishes it. The play's matchup names Beck; the first three are
//    Tidwell's. On the live feed this rule makes every pitcher's pitches and
//    strikes equal his box-score line (checked 2026-10-26).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkpointPages, PAGE_ORDER } from '../src/api/gameday/checkpoint.js'
import { revealInning } from '../src/api/linescore.js'
import { computeDerivedByInning, revealDerived } from '../src/api/derive.js'

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))
const g823035 = load('game-823035.trimmed.json')
const g823169 = load('game-823169.gameday.json')
const page = (pages, id) => pages.find((p) => p.id === id)

test('the pages come in PAGE_ORDER; two are built, two wait for #2572', () => {
  const pages = checkpointPages(g823035, { inning: 1, half: 'top', revealedThrough: 0 })
  assert.deepEqual(pages.map((p) => p.id), PAGE_ORDER)
  assert.deepEqual(pages.map((p) => p.built), [true, true, false, false])
})

test('the tally matches the linescore: R, H, LOB batting; E fielding', () => {
  const derived = computeDerivedByInning(g823035)
  for (let inning = 1; inning <= 9; inning++) {
    for (const half of ['top', 'bottom']) {
      const pages = checkpointPages(g823035, { inning, half, revealedThrough: 99 })
      const bat = revealInning(g823035, inning, half === 'top' ? 'away' : 'home')
      const field = revealInning(g823035, inning, half === 'top' ? 'home' : 'away')
      const tally = page(pages, 'tally').fields
      assert.equal(tally.runs, bat.runs, `${half} ${inning} runs`)
      assert.equal(tally.hits, bat.hits)
      assert.equal(tally.leftOnBase, bat.leftOnBase)
      assert.equal(tally.errors, field.errors)
      const pitching = page(pages, 'pitching').fields
      const d = revealDerived(derived, inning, half)
      assert.equal(pitching.pitches, d.pitches, `${half} ${inning} pitches`)
      assert.equal(pitching.whiffs, d.whiffs, `${half} ${inning} whiffs`)
    }
  }
})

test('a half with a pitching change gives two pitcher lines; a half with one pitcher gives one', () => {
  const top6 = page(checkpointPages(g823035, { inning: 6, half: 'top', revealedThrough: 10 }), 'pitching')
  assert.deepEqual(top6.fields.pitchers.map((l) => l.id), [690928, 694363])
  const top1 = page(checkpointPages(g823035, { inning: 1, half: 'top', revealedThrough: 10 }), 'pitching')
  assert.equal(top1.fields.pitchers.length, 1)
})

test('pitches before a mid-at-bat change belong to the man who threw them', () => {
  const p = page(checkpointPages(g823169, { inning: 4, half: 'top', revealedThrough: 6 }), 'pitching').fields
  assert.deepEqual(p.pitchers.map((l) => l.id), [694918, 663941])
  // Tidwell: ab26 and ab27, plus the first three pitches of ab28.
  const plays = g823169.liveData.plays.allPlays
  const pitchesIn = (ab) => plays.find((x) => x.about.atBatIndex === ab).playEvents.filter((e) => e.isPitch).length
  assert.equal(p.pitchers[0].pitches, pitchesIn(26) + pitchesIn(27) + 3)
  assert.equal(p.pitchers[1].pitches, pitchesIn(28) - 3 + pitchesIn(29))
  assert.equal(p.pitches, p.pitchers[0].pitches + p.pitchers[1].pitches)
})

test('a strike is any pitch that is not a ball', () => {
  const p = page(checkpointPages(g823035, { inning: 1, half: 'top', revealedThrough: 0 }), 'pitching').fields
  const balls = g823035.liveData.plays.allPlays
    .filter((x) => x.about.inning === 1 && x.about.halfInning === 'top')
    .flatMap((x) => x.playEvents ?? [])
    .filter((e) => e.isPitch && e.details?.isBall === true).length
  assert.equal(p.strikes, p.pitches - balls)
})

test('no page reads past revealedThrough', () => {
  // The half itself must be committed: the next half (revealedThrough + 1) is not a checkpoint.
  assert.equal(checkpointPages(g823035, { inning: 3, half: 'top', revealedThrough: 3 }), null)
  // Changing every later play changes nothing on this half's pages.
  const before = checkpointPages(g823035, { inning: 3, half: 'top', revealedThrough: 4 })
  const later = structuredClone(g823035)
  for (const p of later.liveData.plays.allPlays) {
    if (p.about.inning > 3 || (p.about.inning === 3 && p.about.halfInning === 'bottom')) {
      p.playEvents = []
      p.matchup = { pitcher: { id: 1 } }
    }
  }
  assert.deepEqual(checkpointPages(later, { inning: 3, half: 'top', revealedThrough: 4 }), before)
})

test('missing data falls back to null or empty, never throws', () => {
  const empty = checkpointPages({}, { inning: 1, half: 'top', revealedThrough: 0 })
  assert.equal(page(empty, 'tally').fields.runs, null)
  assert.deepEqual(page(empty, 'pitching').fields.pitchers, [])
  assert.equal(checkpointPages(g823035, { half: 'top', revealedThrough: 3 }), null)
  // A half the game never played (no 10th in 823035).
  const none = checkpointPages(g823035, { inning: 10, half: 'bottom', revealedThrough: 99 })
  assert.equal(page(none, 'pitching').fields.pitches, 0)
})

test('two changes in one half: each pitch goes to the pitcher the events put on the mound', () => {
  // Hand-built, the top 6th (the home side fields).
  // Pitcher 2 enters at the head of the half's first play and throws two
  // pitches; pitcher 3 replaces him mid-at-bat and finishes it. The play's
  // matchup names 3. Pitcher 1 threw the top 5th and nothing in the 6th.
  const pitch = (isBall = false) => ({ isPitch: true, details: { isBall } })
  const sub = (id) => ({ isPitch: false, details: { eventType: 'pitching_substitution' }, player: { id } })
  const play = (inning, ab, pitcher, playEvents) => ({
    about: { inning, halfInning: 'top', atBatIndex: ab },
    matchup: { pitcher: { id: pitcher } },
    result: { type: 'atBat', eventType: 'field_out' },
    playEvents,
  })
  const feed = {
    liveData: {
      plays: {
        allPlays: [
          play(5, 0, 1, [pitch(), pitch()]),
          play(6, 1, 3, [sub(2), pitch(), pitch(true), sub(3), pitch(), pitch()]),
        ],
      },
    },
  }
  const p = page(checkpointPages(feed, { inning: 6, half: 'top', revealedThrough: 10 }), 'pitching').fields
  assert.deepEqual(p.pitchers.map((l) => [l.id, l.pitches, l.strikes]), [[2, 2, 1], [3, 2, 2]])
})
