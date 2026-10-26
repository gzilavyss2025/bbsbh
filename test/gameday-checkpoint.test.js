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
// 824716 SEA@BOS, the round 2 design game (#2568): no callout bundle on file.
const g824716 = load('game-824716.gameday.json')
// 778442 ATH@COL: a 5-4-3 triple play ends the top 2nd. 777747 BOS@MIL: a walk-off in the bottom 10th.
const g778442 = load('game-778442.gameday.json')
const g777747 = load('game-777747.gameday.json')
const page = (pages, id) => pages.find((p) => p.id === id)

test('the pages come in PAGE_ORDER; facts is absent with no notes', () => {
  assert.deepEqual(PAGE_ORDER, ['tally', 'pitching', 'atBats', 'gameSoFar', 'facts'])
  const pages = checkpointPages(g823035, { inning: 1, half: 'top', revealedThrough: 0 })
  assert.deepEqual(pages.map((p) => p.id), ['tally', 'pitching', 'atBats', 'gameSoFar'])
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
  // Changing every later pitch and result changes nothing on this half's pages.
  // Later substitutions stay: an entry event is how lineupEntering (the
  // due-up's gate, ADR-0010) tells a starter from a sub.
  const before = checkpointPages(g823035, { inning: 3, half: 'top', revealedThrough: 4 })
  const later = structuredClone(g823035)
  for (const p of later.liveData.plays.allPlays) {
    if (p.about.inning > 3 || (p.about.inning === 3 && p.about.halfInning === 'bottom')) {
      p.playEvents = (p.playEvents ?? []).filter((e) => !e.isPitch)
      p.result = {}
      p.runners = []
      p.matchup = { pitcher: { id: 1 } }
    }
  }
  // And every later linescore value (the keys stay: their PRESENCE is the
  // final-half read, ADR-0043, never their value). The 3rd's home errors stay:
  // they were made fielding the top 3rd (ADR-0006).
  const scramble = (line) => Object.fromEntries(Object.keys(line ?? {}).map((k) => [k, 99]))
  later.liveData.linescore.innings = later.liveData.linescore.innings.map((i) =>
    i.num > 3 ? { ...i, away: scramble(i.away), home: scramble(i.home) } : i.num === 3 ? { ...i, home: { ...scramble(i.home), errors: i.home.errors } } : i)
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

const ix = (inning, half) => (inning - 1) * 2 + (half === 'top' ? 0 : 1)
const at = (feed, inning, half, extra = {}) =>
  checkpointPages(feed, { inning, half, revealedThrough: ix(inning, half), ...extra })

test('824716 top 2nd: tally, Paez with fouls, eight at-bats, due up', () => {
  const pages = at(g824716, 2, 'top')
  assert.deepEqual(page(pages, 'tally').fields, { runs: 5, hits: 4, errors: 0, leftOnBase: 0 })
  const p = page(pages, 'pitching').fields
  assert.equal(p.pitchers.length, 1)
  const paez = p.pitchers[0]
  assert.equal(paez.last, 'Paez')
  assert.deepEqual([paez.pitches, paez.strikes, paez.whiffs, paez.fouls], [28, 15, 2, 4])
  assert.equal(p.fouls, 4)
  const rows = page(pages, 'atBats').fields.rows
  const abs = rows.filter((r) => r.kind === 'atBat')
  assert.equal(abs.length, 8)
  assert.deepEqual(abs.map((r) => r.last), ['Naylor', 'Young', 'Montes', 'Crawford', 'Rodden', 'Arozarena', 'Canzone', 'Rodríguez'])
  assert.deepEqual(abs[3], { kind: 'atBat', atBatIndex: 11, jersey: '3', first: abs[3].first, last: 'Crawford', code: 'SF9', rbi: 1, out: 1, calledLooking: false })
  assert.deepEqual(abs.map((r) => r.out), [null, null, null, 1, null, null, 2, 3])
  assert.equal(abs[5].rbi, 3)
  // A mound visit is not a row a scorer writes.
  assert.equal(rows.length, 8)
  const g = page(pages, 'gameSoFar').fields
  assert.equal(g.final, false)
  assert.deepEqual(g.dueUp.map((b) => b.last), ['Sogard', 'Durbin', 'Duran'])
  assert.ok(g.dueUp.every((b) => b.slot && b.jersey !== undefined))
  // The line through the top 2nd: the bottom 2nd has no cell yet.
  assert.equal(g.innings.length, 2)
  assert.equal(g.innings[1].away, 5)
  assert.equal(g.innings[1].home, null)
  assert.equal(g.away.runs, page(at(g824716, 1, 'top'), 'tally').fields.runs + 5)
  // No pitcher on the page: a pre-pitch change for the bottom 2nd would leak (#2572).
  assert.ok(!JSON.stringify(g).match(/pitcher/i))
  assert.equal(page(pages, 'facts'), undefined)
})

test('824716 bottom 9th: Milner and Muñoz, the final line, no due-up', () => {
  const pages = at(g824716, 9, 'bottom')
  const p = page(pages, 'pitching').fields
  assert.deepEqual(p.pitchers.map((l) => [l.last, l.pitches, l.fouls]), [['Milner', 7, 0], ['Muñoz', 4, 0]])
  assert.equal(p.fouls, 0)
  const rows = page(pages, 'atBats').fields.rows
  assert.deepEqual(rows.map((r) => r.kind === 'sub' ? r.eventType : r.code),
    ['pitching_substitution', '1B', 'pinch_hitting', 'HR', 'L1', 'pitching_substitution', 'K', '4-3'])
  // The change that opens the half is a row too: the scorer writes Milner in.
  assert.equal(rows[0].playerId, p.pitchers[0].id)
  const g = page(pages, 'gameSoFar').fields
  assert.equal(g.final, true)
  assert.equal(g.dueUp, null)
  assert.deepEqual(g.away, { runs: 9, hits: 14, errors: 1 })
  assert.deepEqual(g.home, { runs: 6, hits: 11, errors: 0 })
  assert.equal(g.innings.length, 9)
})

test('a called third strike has no code and says calledLooking', () => {
  const rows = page(at(g824716, 9, 'top'), 'atBats').fields.rows
  const montes = rows.find((r) => r.last === 'Montes')
  assert.equal(montes.code, '')
  assert.equal(montes.calledLooking, true)
  assert.equal(montes.out, 1)
})

test('778442 top 2nd: a triple play makes all three outs on one row', () => {
  const pages = at(g778442, 2, 'top')
  const abs = page(pages, 'atBats').fields.rows
  assert.equal(abs.at(-1).code, 'TP 5-4-3')
  assert.equal(abs.at(-1).out, 3)
  assert.equal(page(pages, 'gameSoFar').fields.final, false)
  assert.ok(page(pages, 'gameSoFar').fields.dueUp.length > 0)
})

test('777747: the walk-off bottom 10th is the last half; the top 10th is not', () => {
  const last = at(g777747, 10, 'bottom')
  const g = page(last, 'gameSoFar').fields
  assert.equal(g.final, true)
  assert.equal(g.dueUp, null)
  assert.equal(g.innings.length, 10)
  assert.equal(page(last, 'facts'), undefined)
  const top = page(at(g777747, 10, 'top'), 'gameSoFar').fields
  assert.equal(top.final, false)
  assert.equal(top.dueUp.length, 3)
  assert.equal(top.innings[9].home, null)
  // Reviewing an earlier half after the end is not the final line.
  const review = page(checkpointPages(g777747, { inning: 5, half: 'top', revealedThrough: ix(10, 'bottom') }), 'gameSoFar').fields
  assert.equal(review.final, false)
  assert.equal(review.innings.length, 5)
})

test('facts: the next half\'s score-free notes; absent when the list is empty', () => {
  const marginNotes = [{ text: 'Laboring: 24.7 pitches per inning', kind: 'laboring', score: 48, dedupeKey: 'laboring-1' }]
  const pages = at(g824716, 2, 'top', { notes: { bundle: {}, marginNotes } })
  assert.deepEqual(pages.map((p) => p.id), PAGE_ORDER)
  assert.ok(page(pages, 'facts').fields.notes.some((n) => n.kind === 'laboring'))
  // A score-restating kind never makes the page.
  const leak = [{ text: 'SEA lead 5-0', kind: 'leadAfterLive', score: 99, dedupeKey: 'x' }]
  assert.equal(page(at(g824716, 2, 'top', { notes: { bundle: {}, marginNotes: leak } }), 'facts'), undefined)
})

test('824716: no page reads past revealedThrough', () => {
  const before = at(g824716, 4, 'bottom')
  const later = structuredClone(g824716)
  later.liveData.plays.allPlays = later.liveData.plays.allPlays.filter((p) => ix(p.about.inning, p.about.halfInning) <= ix(4, 'bottom'))
  later.liveData.linescore.innings = later.liveData.linescore.innings.filter((i) => i.num <= 4)
  later.gameData.status = { abstractGameState: 'Live', codedGameState: 'I', detailedState: 'In Progress' }
  assert.deepEqual(at(later, 4, 'bottom'), before)
  assert.equal(at(g824716, 5, 'top', { revealedThrough: ix(4, 'bottom') }), null)
})
