import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMatchupNotes, SHORT_MAX } from '../src/api/matchup/notes.js'
import { matchupRatesFor, leagueFor, zScore } from '../src/api/matchup/savant.js'

// League figures are the real ones the nightly job wrote on 2026-08-20, so the
// thresholds in these tests are exercised against the spread the app will
// actually see rather than a round invented one.
const LEAGUE = {
  bat: {
    chase: { m: 31.4, sd: 6.9 }, whiff: { m: 25.8, sd: 7.1 }, hardHit: { m: 37.2, sd: 9.6 },
    pull: { m: 39.4, sd: 8.2 }, gb: { m: 42.9, sd: 7.8 },
  },
  pit: {
    chase: { m: 30.5, sd: 3.6 }, whiff: { m: 25.4, sd: 4.8 }, hardHit: { m: 38.2, sd: 5.1 },
    pull: { m: 39.3, sd: 5.2 }, gb: { m: 42.4, sd: 7.8 },
  },
}
const flat = { chase: 31, whiff: 26, hardHit: 37, pull: 39, gb: 43, pa: 400 }
const data = (bat, pit) => ({ season: 2026, league: LEAGUE, bat: { 1: bat }, pit: { 2: pit } })
const BATTER = { id: 1, first: 'Geraldo', last: 'Perdomo' }
const PITCHER = { id: 2, first: 'Payton', last: 'Tolle' }
const build = (bat, pit, index = 0) =>
  buildMatchupNotes({ data: data(bat, pit), batter: BATTER, pitcher: PITCHER, index })

// --- the reader -------------------------------------------------------------

test('rates and league lookups degrade to null rather than zero', () => {
  const d = data(flat, flat)
  assert.equal(matchupRatesFor(d, 999, 'batting'), null)
  assert.equal(matchupRatesFor(null, 1, 'batting'), null)
  assert.equal(leagueFor(d, 'chase', 'batting').m, 31.4)
  assert.equal(leagueFor(d, 'nope', 'batting'), null)
  // A zero or missing spread is not scoreable — no baseline may be invented.
  assert.equal(leagueFor({ league: { bat: { chase: { m: 5, sd: 0 } } } }, 'chase', 'batting'), null)
})

test('each role is scored against its OWN spread', () => {
  const d = data(flat, flat)
  // 34.6% chase is +1.15 SD for a pitcher but only +0.46 for a hitter, because
  // pitchers vary far less. A shared raw threshold would conflate the two.
  assert.ok(Math.abs(zScore(d, 'chase', 'pitching', 34.6) - 1.14) < 0.02)
  assert.ok(Math.abs(zScore(d, 'chase', 'batting', 34.6) - 0.46) < 0.02)
})

// --- gating -----------------------------------------------------------------

test('no note when either side is ordinary', () => {
  assert.deepEqual(build(flat, flat), [])
  // Batter extreme, pitcher ordinary — still nothing. BOTH sides must collide.
  assert.deepEqual(build({ ...flat, chase: 21.1 }, flat), [])
  assert.deepEqual(build(flat, { ...flat, chase: 35.8 }), [])
})

test('no note without data for either player', () => {
  assert.deepEqual(buildMatchupNotes({ data: data(flat, flat), batter: { id: 77 }, pitcher: PITCHER }), [])
  assert.deepEqual(buildMatchupNotes({ data: null, batter: BATTER, pitcher: PITCHER }), [])
})

test('skill family drops weakness against weakness', () => {
  // Batter chases a lot (a hole) AND the pitcher draws few chases (a hole).
  // Two weaknesses meeting is not a story.
  const notes = build({ ...flat, chase: 45 }, { ...flat, chase: 24 })
  assert.equal(notes.filter((n) => n.kind === 'matchupSkill').length, 0)
})

test('style family fires only when the tendencies point OPPOSITE ways', () => {
  const clash = build({ ...flat, pull: 50.4 }, { ...flat, pull: 33.3 })
  assert.equal(clash.filter((n) => n.kind === 'matchupStyle').length, 1)
  // Both above league average — agreement, not a collision.
  const agree = build({ ...flat, pull: 50.4 }, { ...flat, pull: 46 })
  assert.equal(agree.filter((n) => n.kind === 'matchupStyle').length, 0)
})

test('at most one note per family, the strongest axis winning', () => {
  const notes = build(
    { ...flat, chase: 21.1, whiff: 12, hardHit: 52, pull: 50.4, gb: 29.9 },
    { ...flat, chase: 35.8, whiff: 33, hardHit: 30, pull: 33.3, gb: 59.6 },
  )
  assert.equal(notes.filter((n) => n.kind === 'matchupSkill').length, 1)
  assert.equal(notes.filter((n) => n.kind === 'matchupStyle').length, 1)
})

// --- the voice rules --------------------------------------------------------
// Each of these encodes a finding from the copy reviews. Three of them exist
// because the draft copy was wrong, not merely plain.

test('rates round — no decimals anywhere in a note', () => {
  for (const n of build({ ...flat, chase: 21.1 }, { ...flat, chase: 35.8 })) {
    assert.doesNotMatch(n.text, /\d\.\d\s*%/, `decimal in short form: ${n.text}`)
    assert.doesNotMatch(n.prose, /\d\.\d\s*%/, `decimal in prose: ${n.prose}`)
  }
})

test('a pitcher is never the subject of "pulled"', () => {
  const [note] = build({ ...flat, pull: 50.4 }, { ...flat, pull: 33.3 })
  assert.doesNotMatch(note.text, /\bgets? pulled\b/)
  assert.doesNotMatch(note.prose, /\bgets? pulled\b/)
  assert.match(note.prose, /hitters pull/)
})

test('a ground-ball rate is never phrased as a batting average', () => {
  const [note] = build({ ...flat, gb: 29.9 }, { ...flat, gb: 59.6 })
  assert.doesNotMatch(note.text, /hits \d+% on the ground/)
  assert.match(note.text, /puts \d+% of his batted balls on the ground/)
})

test('"chase" is only ever the out-of-zone axis, never a synonym for swing', () => {
  // The whiff axis talks about swings and must not borrow the word.
  const [note] = build({ ...flat, whiff: 12 }, { ...flat, whiff: 33 })
  assert.doesNotMatch(note.text, /chase/)
  assert.match(note.text, /swings/)
})

test('short forms stay under the strip ceiling, even with long names', () => {
  const long = { id: 1, first: 'Vladimir', last: 'Guerrero Jr.' }
  const longP = { id: 2, first: 'Yoshinobu', last: 'Yamamoto' }
  for (let index = 0; index < 3; index++) {
    const notes = buildMatchupNotes({
      data: data({ ...flat, chase: 21.1, pull: 50.4 }, { ...flat, chase: 35.8, pull: 33.3 }),
      batter: long, pitcher: longP, index,
    })
    assert.ok(notes.length > 0, 'long names must still produce notes')
    for (const n of notes) {
      assert.ok(n.text.length <= SHORT_MAX, `${n.text.length} chars: ${n.text}`)
    }
  }
})

test('at most one em dash per note, and never a dash plus "but"', () => {
  for (let index = 0; index < 3; index++) {
    for (const n of build({ ...flat, chase: 21.1, pull: 50.4 }, { ...flat, chase: 35.8, pull: 33.3 }, index)) {
      assert.ok((n.text.match(/—/g) ?? []).length <= 1, `two dashes: ${n.text}`)
      assert.doesNotMatch(n.text, /—[^.]*\bbut\b/)
    }
  }
})

test('the sentence SHAPE rotates so consecutive notes do not share one', () => {
  const shapes = new Set()
  for (let index = 0; index < 3; index++) {
    const [note] = build({ ...flat, chase: 21.1 }, { ...flat, chase: 35.8 }, index)
    shapes.add(note.text.includes('—') ? 'dash' : note.text.includes(';') ? 'semicolon' : 'turn')
  }
  assert.equal(shapes.size, 3, 'three indices must yield three distinct shapes')
})

test('the intensifier is conditional, not a default word', () => {
  // A mild collision: both sides clear the threshold but neither is far out,
  // so no "just" is earned on either side.
  const mild = build({ ...flat, chase: 23.2 }, { ...flat, chase: 34.7 })
  assert.ok(mild.length > 0)
  assert.doesNotMatch(mild[0].text, /\bjust\b/)
  // An extreme one earns it on exactly one side, never both.
  const [strong] = build({ ...flat, chase: 14 }, { ...flat, chase: 35.8 })
  assert.equal((strong.text.match(/\bjust\b/g) ?? []).length, 1)
})

test('"just" never lands on a number that is HIGH for its league mean', () => {
  // Regression: emphasis was chosen on |z| alone, which produced "hits just
  // 52% of his batted balls hard" against a league average of 37%.
  const cases = [
    [{ ...flat, hardHit: 52 }, { ...flat, hardHit: 45 }],
    [{ ...flat, chase: 45 }, { ...flat, chase: 36 }],
    [{ ...flat, whiff: 42 }, { ...flat, whiff: 34 }],
    [{ ...flat, hardHit: 55 }, { ...flat, hardHit: 30 }],
  ]
  // Which league mean a "just" number must beat, identified by the clause it
  // sits in — a blanket threshold would either miss "just 36%" on the chase
  // axis or wrongly reject a correct "just 30%" on hard contact.
  const MEAN_FOR = [
    [/chases just/, LEAGUE.bat.chase.m],
    [/draws a chase just/, LEAGUE.pit.chase.m],
    [/misses on just/, LEAGUE.bat.whiff.m],
    [/misses just/, LEAGUE.pit.whiff.m],
    [/hits just/, LEAGUE.bat.hardHit.m],
    [/(allows|gives up) hard contact on just/, LEAGUE.pit.hardHit.m],
  ]
  for (const [bat, pit] of cases) {
    for (const n of build(bat, pit)) {
      const m = n.text.match(/just (\d+)%/)
      if (!m) continue
      const value = Number(m[1])
      const hit = MEAN_FOR.find(([re]) => re.test(n.text))
      assert.ok(hit, `unrecognised "just" clause, add it to MEAN_FOR: ${n.text}`)
      assert.ok(value < hit[1], `"just ${value}%" is above its league mean ${hit[1]}: ${n.text}`)
    }
  }
})

test('a clause that owns its own subject is never prefixed with a name', () => {
  // Regression: the pull axis reads "hitters pull 33% against Newcomb", and
  // the assembler used to paste the pitcher's name in front of every pitcher
  // clause — producing "Newcomb hitters pull 33% against him".
  for (let index = 0; index < 3; index++) {
    for (const n of build({ ...flat, pull: 50.4 }, { ...flat, pull: 33.3 }, index)) {
      assert.doesNotMatch(n.text, /\b[A-Z][a-z]+ hitters\b/, n.text)
      assert.doesNotMatch(n.prose, /\b[A-Z][a-z]+ hitters\b/, n.prose)
    }
  }
})

test('a clean fraction reads as words and takes the right preposition', () => {
  const [note] = build({ ...flat, pull: 50.4 }, { ...flat, pull: 33.3 })
  assert.match(note.text, /pulls half his batted balls/)
  assert.doesNotMatch(note.text, /half of his/)
})

test('every note is scoped to the season and carries both renderings', () => {
  for (const n of build({ ...flat, chase: 21.1, pull: 50.4 }, { ...flat, chase: 35.8, pull: 33.3 })) {
    assert.match(n.text, /this season/)
    assert.ok(n.prose.length > n.text.length, 'prose must say more than the strip')
    assert.ok(n.score > 0 && n.score <= 100)
    assert.ok(n.dedupeKey.startsWith('matchup-'))
  }
})

test('short forms use surnames, prose uses the full name on first reference', () => {
  const [note] = build({ ...flat, chase: 21.1 }, { ...flat, chase: 35.8 })
  assert.doesNotMatch(note.text, /Geraldo|Payton/)
  assert.match(note.prose, /Geraldo Perdomo/)
  assert.match(note.prose, /Payton Tolle/)
})

test('a bigger collision outscores a smaller one', () => {
  const [mild] = build({ ...flat, chase: 23.2 }, { ...flat, chase: 34.7 })
  const [huge] = build({ ...flat, chase: 12 }, { ...flat, chase: 42 })
  assert.ok(huge.score > mild.score, `${huge.score} !> ${mild.score}`)
})

// --- the spoiler invariant --------------------------------------------------

test('a note never contains tonight-derived material', () => {
  // The builder is handed no feed at all, which is the structural guarantee:
  // it CANNOT read a score, an inning, or a line. This test pins that the
  // signature stays that way.
  const notes = build({ ...flat, chase: 21.1 }, { ...flat, chase: 35.8 })
  assert.ok(notes.length > 0)
  assert.equal(buildMatchupNotes.length, 1, 'builder takes one options object and no feed')
})

// --- resolving the two players for a half -----------------------------------

test('a half resolves its due-up hitters AND the arm on the mound', async () => {
  const { matchupNotesForHalf } = await import('../src/api/matchup/forHalf.js')
  const { buildFeed } = await import('./fixtures/mini-game.js')
  const feed = buildFeed()

  // Regression: the first implementation took the pitcher from `defenseEntering`,
  // which returns the eight fielders plus the DH and NO pitcher — the scorebook
  // diamond excludes him by design. Every matchup note silently failed to build.
  // Give the fixture's leadoff trio and its starter a collision and require one.
  const collide = { chase: 31, whiff: 26, hardHit: 37, pull: 39, gb: 43, pa: 400 }
  const d = {
    season: 2026,
    league: LEAGUE,
    bat: { 1: { ...collide, chase: 14 }, 2: collide, 3: collide },
    pit: { 200: { ...collide, chase: 40 } },
  }
  const notes = matchupNotesForHalf({ feed, data: d, inning: 1, half: 'top', revealedThrough: -1 })
  assert.ok(notes.length > 0, 'the leadoff hitter and the starter must produce a note')
  assert.match(notes[0].text, /Ashby/)
  assert.match(notes[0].text, /Starter/)
})

test('a half further out than the reader has reached resolves nobody', async () => {
  const { matchupNotesForHalf } = await import('../src/api/matchup/forHalf.js')
  const { buildFeed } = await import('./fixtures/mini-game.js')
  const feed = buildFeed()
  const collide = { chase: 31, whiff: 26, hardHit: 37, pull: 39, gb: 43, pa: 400 }
  const d = {
    season: 2026, league: LEAGUE,
    bat: { 1: { ...collide, chase: 14 }, 2: collide, 3: collide },
    pit: { 200: { ...collide, chase: 40 } },
  }
  // Nothing revealed, staging a half deep in the game: who is pitching by then
  // is exactly the game-flow spoiler the reveal boundary withholds.
  assert.deepEqual(
    matchupNotesForHalf({ feed, data: d, inning: 6, half: 'top', revealedThrough: -1 }),
    [],
  )
})
