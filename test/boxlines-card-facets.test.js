// The Game lines card's registry (src/api/boxlines/cardFacets.js, ADR-0069).
// The card itself is a .jsx file the suite cannot import, which is why the
// registry is pure data: the failure this pins is SILENT otherwise.
//
// facets.js is deliberate about an unknown `kind` — it keeps NOTHING, so a
// sheet shows nothing rather than showing every game with a score in it. That
// is the right call for a spoiler surface and the wrong thing to discover in
// production: a door with a typo in its facet opens, loads, and renders an
// empty ledger, and nothing anywhere says why. So every entry is checked here
// against the same facetPlan the sheet will call.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CARD_FACETS, cardFacetsFor, FAMILIES, FOLD_FROM, SECTIONS } from '../src/api/boxlines/cardFacets.js'
import {
  DOOR_COLUMNS,
  DOOR_EMPHASIS,
  careerSplitLine,
  doorCells,
  doorLine,
  mergeCareerSplits,
} from '../src/api/boxlines/careerSplits.js'
import { facetPlan } from '../src/api/boxlines/facets.js'
import { POSTSEASON } from '../src/api/boxlines/rows.js'

const GROUPS = ['hitting', 'pitching']

test('no door narrows the game log or pins an opponent', () => {
  // Either of those is the club facet's shape, and the club facet costs a fetch
  // of its own. A door on this card must be answerable from a join the other
  // doors are already paying for.
  for (const entry of CARD_FACETS) {
    const plan = facetPlan(entry.facet)
    assert.equal(plan.narrowsSplits, false, `${entry.key} must not narrow the game log`)
    assert.equal(plan.opponentId, null, `${entry.key} must not pin an opponent`)
  }
})

test('every door filters rows or moves the game types, and the calendar does both', () => {
  // A door that does NEITHER asks for the whole regular-season log and keeps
  // all of it, which is a sheet of every game he ever played under a label that
  // promised a split. That is the failure this pins. (A typo in a `kind`
  // resolves to a keep-nothing predicate, which reads as "filters" here and is
  // caught by the discrimination test below instead.)
  //
  // It used to pin "never BOTH" as well, and that half is gone on purpose: the
  // calendar doors now widen the fetch to the four postseason rounds AND filter
  // the result down to their own month or weekday, which is exactly both
  // (ADR-0073). Doing both was never a fault — it was just a shape the card had
  // no use for until October had to mean October.
  for (const entry of CARD_FACETS) {
    const plan = facetPlan(entry.facet)
    const filters = typeof plan.keep === 'function'
    const moves = Array.isArray(plan.gameTypes)
    assert.ok(filters || moves, `${entry.key} neither filters rows nor moves the game types`)
    assert.equal(
      filters && moves,
      Boolean(entry.spansPostseason),
      `${entry.key} does both, and only a door spanning the postseason should`,
    )
  }
})

test('each row-filtering door keeps a matching row and drops its opposite', () => {
  // The real check that a kind is understood: it must actually discriminate.
  const cases = {
    home: [{ home: true }, { home: false }],
    road: [{ home: false }, { home: true }],
    day: [{ dayNight: 'day' }, { dayNight: 'night' }],
    night: [{ dayNight: 'night' }, { dayNight: 'day' }],
    started: [{ started: true }, { started: false }],
    relief: [{ started: false }, { started: true }],
    // The eight months (#999). A door keyed m4 must keep an April game and
    // drop a May one, which is also what catches an entry whose `sitCode` and
    // `facet.month` drifted apart -- the one way a table-built family can go
    // wrong that a hand-written entry cannot.
    m3: [{ date: '2024-03-28' }, { date: '2024-04-01' }],
    m4: [{ date: '2024-04-30' }, { date: '2024-05-01' }],
    m5: [{ date: '2024-05-01' }, { date: '2024-04-30' }],
    m6: [{ date: '2024-06-15' }, { date: '2024-07-15' }],
    m7: [{ date: '2024-07-04' }, { date: '2024-08-04' }],
    m8: [{ date: '2024-08-04' }, { date: '2024-07-04' }],
    m9: [{ date: '2024-09-15' }, { date: '2024-10-01' }],
    m10: [{ date: '2024-10-01' }, { date: '2024-09-30' }],
    // The seven weekdays (#1001). 2026-09-02 is a Wednesday and 2026-08-30 a
    // Sunday, in every timezone the suite may run in: the helpers read the
    // string rather than building a local-midnight Date.
    w0: [{ date: '2026-08-30' }, { date: '2026-09-02' }],
    w1: [{ date: '2026-08-31' }, { date: '2026-09-02' }],
    w2: [{ date: '2026-09-01' }, { date: '2026-09-02' }],
    w3: [{ date: '2026-09-02' }, { date: '2026-09-03' }],
    w4: [{ date: '2026-09-03' }, { date: '2026-09-02' }],
    w5: [{ date: '2026-09-04' }, { date: '2026-09-02' }],
    w6: [{ date: '2026-09-05' }, { date: '2026-09-02' }],
    // Off the bench (#1002): the positions he played, in the order he played
    // them. A start that later moved to left field is not a pinch-hit game.
    pinchHit: [{ positions: ['PH'] }, { positions: ['DH', 'LF'] }],
    // The park's surface THAT SEASON, off the schedule record's fieldInfo.
    grass: [{ surface: 'grass' }, { surface: 'turf' }],
    turf: [{ surface: 'turf' }, { surface: 'grass' }],
    // Was his name on the card (#1003's hitter half), off the schedule's own
    // lineups. Not `positions`: a defensive replacement reads ['C'], exactly
    // like a start.
    lineupStart: [{ lineupStart: true }, { lineupStart: false }],
    cameIn: [{ lineupStart: false }, { lineupStart: true }],
  }
  for (const entry of CARD_FACETS) {
    const { keep } = facetPlan(entry.facet)
    if (!keep) continue
    const pair = cases[entry.key]
    assert.ok(pair, `${entry.key} filters rows but this test has no case for it`)
    assert.equal(keep(anyRow(pair[0])), true, `${entry.key} should keep its own row`)
    assert.equal(keep(anyRow(pair[1])), false, `${entry.key} should drop the other`)
  }
})

test('the postseason door asks for the four rounds, and never the umbrella P', () => {
  // The one door whose rows are not regular season. It discriminates in the
  // game types rather than in a predicate, so this is its discrimination test.
  // 'P' selects the same games but comes back as every PITCHING row's type,
  // which the type filter then drops — see rows.js.
  const post = CARD_FACETS.find((r) => r.key === 'postseason')
  assert.ok(post, 'the postseason door is missing')
  const plan = facetPlan(post.facet)
  assert.deepEqual(plan.gameTypes, POSTSEASON)
  assert.equal(plan.gameTypes.includes('P'), false)
  assert.equal(plan.gameTypes.includes('R'), false)
})

test('a key appears once: it is the React key and the label key both', () => {
  const keys = CARD_FACETS.map((r) => r.key)
  assert.ok(keys.every(Boolean), 'every door needs a key')
  assert.equal(new Set(keys).size, keys.length)
})

test('every door names exactly one source for its label', () => {
  // careerSplits.js reads one of two: a situation code (all of them share one
  // call) or a career under a game type (one call each). A door naming neither
  // renders no label and so never renders at all; one naming both would take
  // whichever the reader happened to write first.
  for (const entry of CARD_FACETS) {
    const sources = [entry.sitCode, entry.careerGameType, entry.fielding].filter(Boolean)
    assert.equal(sources.length, 1, `${entry.key} names ${sources.length} label sources`)
  }
})

test('a fielding-sourced door prints games and only games', () => {
  // The fielding career carries gamesStarted and no rate stat, so its two
  // doors print "1,674 G" where their neighbours print a five-figure line.
  // The two must travel together: a fielding source without `lineKind` would
  // print "1674 G, undefined PA, undefined, undefined HR, undefined OPS", and
  // a `lineKind` without a fielding source would throw away four real figures.
  for (const entry of CARD_FACETS) {
    assert.equal(
      Boolean(entry.fielding),
      entry.lineKind === 'games',
      `${entry.key}: a fielding source and lineKind 'games' go together`,
    )
    if (entry.fielding) {
      assert.ok(['starts', 'bench'].includes(entry.fielding), `${entry.key} names ${entry.fielding}`)
    }
  }
})

test('a game with no lineup posted belongs to NEITHER lineup door', () => {
  // The app's degrade-gracefully rule, where it matters most: a game the
  // schedule could not answer for leaves `lineupStart` null, and null is not
  // evidence that he came off the bench. Both doors must drop it, or a MiLB
  // game or an old game with no card would quietly become a bench appearance.
  const unknown = anyRow({ lineupStart: null })
  for (const key of ['lineupStart', 'cameIn']) {
    const { keep } = facetPlan(CARD_FACETS.find((r) => r.key === key).facet)
    assert.equal(keep(unknown), false, `${key} kept a game with no lineup`)
  }
})

test('every door is drawable: a label, a kicker, and a title of the player', () => {
  for (const entry of CARD_FACETS) {
    assert.ok(entry.label, `${entry.key} needs a label`)
    assert.ok(entry.kicker.startsWith('Game lines · '), `${entry.key} kicker: ${entry.kicker}`)
    assert.equal(typeof entry.title, 'function', `${entry.key} needs a title`)
    assert.ok(entry.title('Yelich').includes('Yelich'))
    assert.ok(entry.groups.length && entry.groups.every((g) => GROUPS.includes(g)))
  }
})

test('"Box Lines" is the internal name and never reaches a reader', () => {
  // A user-visible string saying "box lines" stops the review (ADR-0069).
  for (const entry of CARD_FACETS) {
    for (const text of [entry.label, entry.kicker, entry.title('Yelich'), entry.footNote ?? '']) {
      assert.doesNotMatch(text, /box\s*lines/i, `"${text}" says the internal name`)
    }
  }
})

test('a hitter is offered no started/relief door, which would keep nothing', () => {
  // The hitting game log carries no gamesStarted, so `started` is null on
  // every hitter row and THAT facet would open an empty sheet. A hitter asks
  // the same question through `lineupStart`, which reads the schedule's own
  // lineups — so the two kinds must not be confused for one another.
  const hitting = cardFacetsFor('hitting')
  assert.equal(
    hitting.some((r) => r.facet.kind === 'started'),
    false,
  )
  const CALENDAR = ['m3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6']
  assert.deepEqual(
    hitting.map((r) => r.key),
    [
      'home',
      'road',
      'grass',
      'turf',
      'day',
      'night',
      ...CALENDAR,
      'lineupStart',
      'cameIn',
      'pinchHit',
      'postseason',
    ],
  )
  assert.deepEqual(
    cardFacetsFor('pitching').map((r) => r.key),
    [
      'home',
      'road',
      'grass',
      'turf',
      'day',
      'night',
      ...CALENDAR,
      'started',
      'relief',
      'postseason',
    ],
  )
  assert.deepEqual(cardFacetsFor('fielding'), [])
})

test('a pitcher is offered no lineup door: he is never on the card', () => {
  // A starting pitcher's name is not in `lineups.homePlayers` at all (those
  // are the nine bats), so the facet would report every start as a bench
  // appearance. MLB's fielding gamesStarted is no help either: for a reliever
  // it counts the games he STARTED on the mound, which is a different question
  // from the one this door asks. Pitchers keep `sp`/`rp`.
  assert.equal(
    cardFacetsFor('pitching').some((r) => r.facet.kind === 'lineupStart'),
    false,
  )
  assert.equal(
    cardFacetsFor('hitting').some((r) => r.facet.kind === 'lineupStart'),
    true,
  )
})

test('a pitcher is offered no pinch-hitting door', () => {
  // `positions` is null on a pitcher's rows -- the hitting game log is the only
  // one that carries positionsPlayed -- so the facet would keep nothing.
  assert.equal(
    cardFacetsFor('pitching').some((r) => r.facet.kind === 'pinchHit'),
    false,
  )
})

test('every door files under a heading the card draws', () => {
  // The card groups by SECTIONS, not by the registry's order, so a door with an
  // unknown section would simply never render -- silently, the way an unknown
  // facet kind would open an empty sheet.
  const known = new Set(SECTIONS.map((s) => s.key))
  for (const entry of CARD_FACETS) {
    assert.ok(known.has(entry.section), `${entry.key} files under "${entry.section}"`)
  }
  // And every heading earns its place: a section with no door would draw a rule
  // and a word over nothing.
  for (const section of SECTIONS) {
    assert.ok(
      CARD_FACETS.some((r) => r.section === section.key),
      `the "${section.title}" heading has no doors`,
    )
    assert.ok(section.title, `${section.key} needs a title`)
  }
})

test('a folded family is a whole run, under one heading, long enough to fold', () => {
  // A family is a run of doors the card hides behind one row. Three ways it can
  // go wrong silently: a member naming a family the card does not draw (its
  // doors vanish), a family whose members straddle two sections (the card draws
  // the fold in the first and the members under it, in the wrong section), and
  // a family too short for FOLD_FROM (it would never fold, so the fold row is
  // dead code).
  const known = new Set(FAMILIES.map((f) => f.key))
  for (const entry of CARD_FACETS) {
    if (!entry.family) continue
    assert.ok(known.has(entry.family), `${entry.key} files under family "${entry.family}"`)
  }
  for (const fam of FAMILIES) {
    const members = CARD_FACETS.filter((r) => r.family === fam.key)
    assert.ok(fam.title, `${fam.key} needs a title`)
    assert.ok(
      members.length >= FOLD_FROM,
      `the "${fam.title}" family holds ${members.length} and would never fold`,
    )
    assert.equal(
      new Set(members.map((r) => r.section)).size,
      1,
      `the "${fam.title}" family spans two headings`,
    )
  }
  // The months and the weekdays, and nothing else.
  assert.deepEqual([...known].sort(), ['month', 'weekday'])
})

test('no entry still wears the retired chip fields', () => {
  // The weekdays were seven two-figure chips before the card became a table
  // (ADR-0073). `chip` and `short` are read by nothing now, so an entry
  // copy-pasted from that era would carry dead fields and, worse, read as
  // though it had asked for a treatment that no longer exists.
  for (const entry of CARD_FACETS) {
    assert.equal(entry.chip, undefined, `${entry.key} still asks to be a chip`)
    assert.equal(entry.short, undefined, `${entry.key} still names a chip's short form`)
  }
})

// A career stat as MLB returns one, per group.
const HIT = { gamesPlayed: 855, plateAppearances: 3616, avg: '.281', homeRuns: 119, ops: '.837' }
const PIT = { gamesPlayed: 247, inningsPitched: '1506.2', era: '3.29', strikeOuts: 1749, baseOnBalls: 391 }

test('a door prints the same five figures, in the same order, as its sheet headline', () => {
  // THE CARD AND THE SHEET ARE TWO RENDERINGS OF ONE STAT OBJECT: the table
  // cells the door shows, and the sentence the sheet heads its rows with. They
  // are built by two functions, so nothing but this stops them drifting — a
  // card reading OPS where its own headline reads SLG would be wrong in a way
  // no reader could catch, because the door is the only place the two meet.
  for (const [group, stat] of [
    ['hitting', HIT],
    ['pitching', PIT],
  ]) {
    const cells = doorCells(null, stat, group)
    assert.equal(cells.length, 5, `${group} does not fill its five columns`)
    assert.equal(DOOR_COLUMNS[group].length, 5, `${group} does not name five columns`)
    assert.equal(DOOR_EMPHASIS[group].length, 5, `${group} does not weight five columns`)
    const line = careerSplitLine(stat, group)
    let at = -1
    for (const cell of cells) {
      const found = line.indexOf(cell, at + 1)
      assert.ok(found > at, `${group}: the headline does not quote "${cell}" after "${cells[0]}"`)
      at = found
    }
  }
})

test('the emphasised column is a rate, never a count', () => {
  // A split is asked "how well", and the card inks the cell that answers.
  // The two groups do NOT answer in the same column — a bat is read on AVG and
  // OPS, an arm on ERA — and the column sitting where a hitter's OPS sits is a
  // pitcher's BB, which answers nothing. Ink it there and the card quietly
  // points at a walk total as though it were the headline figure.
  const RATES = { hitting: ['AVG', 'OPS'], pitching: ['ERA'] }
  for (const group of Object.keys(DOOR_EMPHASIS)) {
    const lit = DOOR_EMPHASIS[group]
      .map((weight, i) => (weight ? DOOR_COLUMNS[group][i] : null))
      .filter(Boolean)
    assert.ok(lit.length > 0, `${group} emphasises nothing`)
    for (const column of lit) {
      assert.ok(RATES[group].includes(column), `${group} emphasises ${column}, which is a count`)
    }
  }
})

test('a games-only door fills one cell and leaves the rest empty', () => {
  // The two lineup doors count games off a FIELDING career, which carries no
  // rate stat. Their four empty cells must be null and not zero: the card draws
  // a quiet mark for null, and a 0 would read as ".000 and none", which is a
  // claim about a career MLB never made.
  const entry = { lineKind: 'games' }
  assert.deepEqual(doorCells(entry, { gamesPlayed: 1672 }, 'hitting'), ['1672', null, null, null, null])
  assert.equal(doorLine(entry, { gamesPlayed: 1672 }, 'hitting'), '1672 G')
  // And no stat at all is no cells, not five nulls — the card drops the door.
  assert.equal(doorCells(entry, null, 'hitting'), null)
})

// Yelich's October and Scherzer's, as MLB returns them: one row per game type,
// never a combined one. Real, fetched 2026-09-15 (personId 592885 / 453286,
// `careerStatSplits&sitCodes=10`).
const OCT_REG = {
  gamesPlayed: 16, plateAppearances: 68, atBats: 54, hits: 24, homeRuns: 2,
  baseOnBalls: 13, hitByPitch: 1, sacFlies: 0, totalBases: 34,
  avg: '.444', obp: '.559', slg: '.630', ops: '1.189',
}
const OCT_POST = {
  gamesPlayed: 26, plateAppearances: 116, atBats: 96, hits: 20, homeRuns: 2,
  baseOnBalls: 20, hitByPitch: 0, sacFlies: 0, totalBases: 29,
  avg: '.208', obp: '.345', slg: '.302', ops: '.647',
}
const OCT_REG_P = { gamesPlayed: 4, outs: 71, earnedRuns: 9, strikeOuts: 31, baseOnBalls: 4, era: '3.42', inningsPitched: '23.2' }
const OCT_POST_P = { gamesPlayed: 32, outs: 459, earnedRuns: 65, strikeOuts: 179, baseOnBalls: 61, era: '3.82', inningsPitched: '153.0' }

test('merging one split with an empty one reproduces the rates MLB published', () => {
  // THE FORMULA IS CHECKED AGAINST MLB, NOT AGAINST ITSELF. Add nothing to a
  // real aggregate and the merge must hand back the very strings MLB printed on
  // it — which is the only way to know the arithmetic behind a COMBINED rate
  // (where MLB publishes no answer to check) is the arithmetic MLB uses.
  //
  // It catches the OPS rounding in particular: OPS is not OBP + SLG at full
  // precision. MLB rounds each half to three places and adds those — Yelich's
  // October is .559 + .630 = 1.189, where the unrounded sum is 1.1884 and
  // prints 1.188.
  const bat = mergeCareerSplits(OCT_REG, { gamesPlayed: 0 }, 'hitting')
  assert.equal(bat.avg, OCT_REG.avg)
  assert.equal(bat.ops, OCT_REG.ops, 'the OPS halves are not being rounded before they are added')
  const post = mergeCareerSplits(OCT_POST, { gamesPlayed: 0 }, 'hitting')
  assert.equal(post.avg, OCT_POST.avg)
  assert.equal(post.ops, OCT_POST.ops)
  const arm = mergeCareerSplits(OCT_REG_P, { outs: 0 }, 'pitching')
  assert.equal(arm.era, OCT_REG_P.era)
  assert.equal(arm.inningsPitched, OCT_REG_P.inningsPitched, 'innings are rebuilt from `outs`, in thirds')
})

test('a combined October adds the counting stats and divides once', () => {
  // A RATE CANNOT BE AVERAGED. .444 over 16 games and .208 over 26 is not .326
  // and not .293 by any blend of the two — it is 44 hits in 150 at-bats.
  const bat = mergeCareerSplits(OCT_REG, OCT_POST, 'hitting')
  assert.equal(bat.gamesPlayed, 42)
  assert.equal(bat.plateAppearances, 184)
  assert.equal(bat.homeRuns, 4)
  assert.equal(bat.avg, '.293')
  assert.equal(bat.ops, '.844')
  // And it is neither input and not their midpoint, which is the whole point.
  assert.ok(bat.avg !== OCT_REG.avg && bat.avg !== OCT_POST.avg)

  const arm = mergeCareerSplits(OCT_REG_P, OCT_POST_P, 'pitching')
  assert.equal(arm.gamesPlayed, 36)
  assert.equal(arm.inningsPitched, '176.2', '530 outs is 176 innings and two thirds')
  assert.equal(arm.era, '3.77')
  assert.equal(arm.strikeOuts, 210)
})

test('a merge with nothing on one side is the other side, untouched', () => {
  // A March door has no postseason row to add, and a career with no October at
  // all has none for any month. Neither is a reason to recompute anything.
  assert.equal(mergeCareerSplits(OCT_REG, null, 'hitting'), OCT_REG)
  assert.equal(mergeCareerSplits(null, OCT_POST, 'hitting'), OCT_POST)
  assert.equal(mergeCareerSplits(null, null, 'hitting'), null)
})

test('a door that spans the postseason says so on BOTH halves', () => {
  // `spansPostseason` widens the LABEL's fetch and `facet.postseason` widens the
  // ROWS'. Set one without the other and the door states a career it does not
  // open — 42 October games on the line, 16 behind it, and nothing on the page
  // to say why.
  for (const entry of CARD_FACETS) {
    assert.equal(
      Boolean(entry.spansPostseason),
      Boolean(entry.facet.postseason),
      `${entry.key} spans the postseason on one half only`,
    )
  }
  // The calendar doors, and only those: a home game in October is still a home
  // game, but "Home" is not a question about the date and its aggregate is the
  // regular season's.
  const spanning = CARD_FACETS.filter((r) => r.spansPostseason).map((r) => r.facet.kind)
  assert.deepEqual([...new Set(spanning)].sort(), ['month', 'weekday'])
  assert.equal(spanning.length, 15, 'eight months and seven weekdays')
})

test('a spanning calendar facet asks the log for the four rounds as well', () => {
  // The umbrella 'P' must never reach the game log: a pitching log answers it
  // for every row and the sheet comes back empty (rows.js's POSTSEASON).
  for (const entry of CARD_FACETS.filter((r) => r.spansPostseason)) {
    const { gameTypes } = facetPlan(entry.facet)
    assert.deepEqual(gameTypes, ['R', 'F', 'D', 'L', 'W'], `${entry.key} asks for the wrong game types`)
  }
  // Every other door still reads the regular season alone, which is what lets
  // them go on sharing one join. The Postseason door is the exception and the
  // opposite case: it MOVES the game types rather than widening them, because
  // it is not a question about the regular season at all.
  for (const entry of CARD_FACETS.filter((r) => !r.spansPostseason && r.key !== 'postseason')) {
    const { gameTypes } = facetPlan(entry.facet)
    assert.ok(gameTypes == null, `${entry.key} widened the fetch without asking`)
  }
  assert.deepEqual(facetPlan(CARD_FACETS.find((r) => r.key === 'postseason').facet).gameTypes, [
    'F', 'D', 'L', 'W',
  ])
})

test('the month and weekday doors are a complete set, each numbered once', () => {
  // Built from a table rather than written out fifteen times, so the thing to
  // pin is that the table is whole: March through October, Sunday through
  // Saturday, no number twice and none missing.
  const months = CARD_FACETS.filter((r) => r.facet.kind === 'month').map((r) => r.facet.month)
  assert.deepEqual(months, [3, 4, 5, 6, 7, 8, 9, 10])
  const days = CARD_FACETS.filter((r) => r.facet.kind === 'weekday').map((r) => r.facet.day)
  assert.deepEqual(days, [0, 1, 2, 3, 4, 5, 6])
  // The situation code and the facet must name the SAME month. They come from
  // one table row, and this is what says the row was read in the right order.
  for (const entry of CARD_FACETS.filter((r) => r.facet.kind === 'month')) {
    assert.equal(entry.sitCode, String(entry.facet.month), `${entry.key} asks MLB for a different month`)
  }
})

// A gated row as boxLineRows builds it, trimmed to what a facet reads.
function anyRow(over = {}) {
  return {
    date: '2024-07-04',
    gamePk: 1,
    home: true,
    started: true,
    lineupStart: true,
    dayNight: 'day',
    surface: 'grass',
    positions: ['LF'],
    ...over,
  }
}
