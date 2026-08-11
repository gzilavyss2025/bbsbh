// The manager detail page's data layer — src/api/managers.js (the coaching
// career and the win-loss record read off the static shards) and
// fetchManagerPlaying (careerTimeline.js, his own playing career).
//
// Every fixture here is a REAL row captured from the sources on 2026-08-11, and
// most of them pin a bug that was live on shipped pages. The /coaches endpoint
// in particular repeats a person once per JERSEY NUMBER he wore in a season,
// which is not documented anywhere and is the root of the first four tests.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dedupeStints,
  groupManagerialRecord,
  currentStint,
  lastManagerialStint,
} from '../src/api/managers.js'
import { fetchManagerPlaying } from '../src/api/careerTimeline.js'

// loadManagerHistory's shaping, minus the network + team-name resolution.
const shape = (raw) =>
  dedupeStints(raw).map((s) => ({
    ...s,
    teamName: `Team ${s.teamId}`,
    isManager: ['MNGR', 'NTRM'].includes(s.jobId),
  }))

// ---------------------------------------------------------------------------
// The jersey-number duplicates
// ---------------------------------------------------------------------------

// Boston 2019 really did return Alex Cora three times — #20, #42 (Jackie
// Robinson Day) and #20 again. attachRecords pins the record to one of them,
// so the other two arrive bare.
const CORA_2019 = [
  { teamId: 111, season: 2018, job: 'Manager', jobId: 'MNGR', record: { w: 108, l: 54 } },
  { teamId: 111, season: 2019, job: 'Manager', jobId: 'MNGR' },
  { teamId: 111, season: 2019, job: 'Manager', jobId: 'MNGR' },
  { teamId: 111, season: 2019, job: 'Manager', jobId: 'MNGR', record: { w: 85, l: 78 } },
]

test('dedupeStints collapses the jersey-number twins onto the row that carries the record', () => {
  const kept = dedupeStints(CORA_2019)
  assert.equal(kept.length, 2)
  assert.deepEqual(kept[1].record, { w: 85, l: 78 })
})

test('a duplicated season no longer prints a phantom "Shared season" row', () => {
  const rows = groupManagerialRecord(shape(CORA_2019))
  assert.equal(rows.filter((r) => r.sharedSeason).length, 0)
  // 2018 and 2019 are consecutive same-team seasons, so they fold into one run
  // — which the phantom rows used to prevent by flushing the group between them.
  assert.equal(rows.length, 1)
  assert.deepEqual(
    { start: rows[0].startSeason, end: rows[0].endSeason, w: rows[0].w, l: rows[0].l },
    { start: 2018, end: 2019, w: 193, l: 132 },
  )
})

// Rob Thomson's Phillies, where the duplicate sat mid-run: the table read
// 2023–24, then a phantom "Shared season" 2025, then 2025–26 — counting 2025
// twice and splitting one continuous tenure into three lines.
const THOMSON = [
  { teamId: 143, season: 2022, job: 'Interim Manager', jobId: 'NTRM', record: { w: 65, l: 46 } },
  { teamId: 143, season: 2023, job: 'Manager', jobId: 'MNGR', record: { w: 90, l: 72 } },
  { teamId: 143, season: 2024, job: 'Manager', jobId: 'MNGR', record: { w: 95, l: 67 } },
  { teamId: 143, season: 2025, job: 'Manager', jobId: 'MNGR' },
  { teamId: 143, season: 2025, job: 'Manager', jobId: 'MNGR', record: { w: 96, l: 66 } },
  { teamId: 143, season: 2026, job: 'Manager', jobId: 'MNGR', record: { w: 9, l: 19 } },
]

test('a duplicate mid-run no longer splits a continuous tenure or double-counts its season', () => {
  const rows = groupManagerialRecord(shape(THOMSON))
  // The interim year stands alone (different interim status), then one run.
  assert.equal(rows.length, 2)
  assert.deepEqual(
    { start: rows[0].startSeason, end: rows[0].endSeason, interim: rows[0].interim },
    { start: 2022, end: 2022, interim: true },
  )
  assert.deepEqual(
    { start: rows[1].startSeason, end: rows[1].endSeason, w: rows[1].w, l: rows[1].l },
    { start: 2023, end: 2026, w: 290, l: 224 },
  )
})

test('dedupeStints keeps two genuinely different jobs in one season', () => {
  // Pete Mackanin, Phillies 2015: bench coach, then interim manager in June.
  // Same team, same season, different jobId — not a duplicate.
  const kept = dedupeStints([
    { teamId: 143, season: 2015, job: 'Bench Coach', jobId: 'COAB' },
    { teamId: 143, season: 2015, job: 'Interim Manager', jobId: 'NTRM' },
  ])
  assert.equal(kept.length, 2)
})

// ---------------------------------------------------------------------------
// The honest "we don't know the split" caveat must survive all of the above
// ---------------------------------------------------------------------------

test('a real shared season still surfaces as its own row and is never folded into a run', () => {
  // Pat Murphy's 2015 Padres interim stint — Bud Black managed the first half
  // and no hand-verified transition date is on file, so there is no record.
  const rows = groupManagerialRecord(
    shape([
      { teamId: 135, season: 2015, job: 'Interim Manager', jobId: 'NTRM', sharedSeason: true },
      { teamId: 158, season: 2024, job: 'Manager', jobId: 'MNGR', record: { w: 93, l: 69 } },
      { teamId: 158, season: 2025, job: 'Manager', jobId: 'MNGR', record: { w: 97, l: 65 } },
    ]),
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].sharedSeason, true)
  assert.equal(rows[0].w, null)
  assert.deepEqual({ w: rows[1].w, l: rows[1].l }, { w: 190, l: 134 })
})

test('interim comes from the jobId, not from the job name', () => {
  // 'Manager' is the only non-interim manager title; anything else matching by
  // NAME would flip this row's pill even though its jobId says permanent.
  const rows = groupManagerialRecord(
    shape([{ teamId: 158, season: 2026, job: 'Manager ', jobId: 'MNGR', record: { w: 74, l: 45 } }]),
  )
  assert.equal(rows[0].interim, false)
})

// ---------------------------------------------------------------------------
// The header's current-role line
// ---------------------------------------------------------------------------

test('currentStint prefers an interim manager over an assistant job held the same season', () => {
  // Boston 2026 returned the interim bench coach FIRST and the first-base coach
  // second, so taking the last stored row named the wrong job. Order must not
  // decide this.
  const stints = shape([
    { teamId: 143, season: 2026, job: 'Interim Manager', jobId: 'NTRM' },
    { teamId: 143, season: 2026, job: 'Bench Coach', jobId: 'COAB' },
  ])
  assert.equal(currentStint(stints, 2026).job, 'Interim Manager')
  // ...and the same holds with the rows the other way round.
  assert.equal(currentStint([...stints].reverse(), 2026).job, 'Interim Manager')
})

test('currentStint prefers the interim over a permanent manager row still on file', () => {
  // The 2026 Mets case fetchManager already handles (test/manager.test.js):
  // the fired skipper's row lingers beside the active interim's.
  const stints = shape([
    { teamId: 121, season: 2026, job: 'Manager', jobId: 'MNGR' },
    { teamId: 121, season: 2026, job: 'Interim Manager', jobId: 'NTRM' },
  ])
  assert.equal(currentStint(stints, 2026).jobId, 'NTRM')
})

test('currentStint falls back to the last assistant row when he held no manager job', () => {
  const stints = shape([
    { teamId: 111, season: 2026, job: 'Bullpen Coach', jobId: 'COAU' },
    { teamId: 111, season: 2026, job: 'First Base Coach', jobId: 'COA1' },
  ])
  assert.equal(currentStint(stints, 2026).job, 'First Base Coach')
})

test('currentStint returns null for a season he held no job in', () => {
  const stints = shape([{ teamId: 158, season: 2024, job: 'Manager', jobId: 'MNGR' }])
  assert.equal(currentStint(stints, 2026), null)
})

test('currentStint tolerates a missing stint list instead of throwing', () => {
  // `(stints ?? [])[stints.length - 1]` read `.length` off the raw argument, so
  // the guard that looks like it covers this did nothing at all.
  assert.equal(currentStint(null, 2026), null)
  assert.equal(currentStint(undefined, 2026), null)
  assert.equal(currentStint([], 2026), null)
})

test('lastManagerialStint skips assistant jobs held after he stopped managing', () => {
  const stints = shape([
    { teamId: 158, season: 2020, job: 'Manager', jobId: 'MNGR', record: { w: 29, l: 31 } },
    { teamId: 111, season: 2026, job: 'Bench Coach', jobId: 'COAB' },
  ])
  assert.equal(lastManagerialStint(stints).season, 2020)
})

// ---------------------------------------------------------------------------
// His own playing career
// ---------------------------------------------------------------------------

// Route a stats request by group + sportId. `career` splits only.
function withStatsFetch(byKey, run) {
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = new URL(url)
    const group = u.searchParams.get('group')
    const sportId = u.searchParams.get('sportId') ?? '1'
    const stat = byKey[`${group}:${sportId}`]
    return {
      ok: true,
      status: 200,
      json: async () => (stat ? { stats: [{ splits: [{ stat }] }] } : { stats: [{ splits: [] }] }),
    }
  }
  return run().finally(() => {
    globalThis.fetch = original
  })
}

const HITTER = { code: '4', type: 'Infielder' }
const PITCHER = { code: '1', type: 'Pitcher' }

test('a manager with both a cup of coffee and a real minors career gets BOTH lines', async () => {
  // Charlie Montoyo: 4 games with the 1993 Expos, nine seasons in the minors
  // around them. The MLB line alone was printed under "Playing career" while
  // the clubs rail below listed all nine years.
  await withStatsFetch(
    {
      'hitting:1': { gamesPlayed: 4, atBats: 5, hits: 2, rbi: 3, totalBases: 3 },
      'hitting:11': { gamesPlayed: 402, atBats: 1245, hits: 283, rbi: 120, totalBases: 391 },
    },
    async () => {
      const playing = await fetchManagerPlaying(119271, HITTER)
      assert.equal(playing.group, 'hitting')
      assert.deepEqual(playing.lines.map((l) => l.level), ['mlb', 'milb'])
      // Never summed together — each line keeps its own splits.
      assert.equal(playing.lines[0].splits[0].stat.gamesPlayed, 4)
      assert.equal(playing.lines[1].splits[0].stat.gamesPlayed, 402)
    },
  )
})

test('a two-game minor-league cameo produces no card, matching the rail that drops it', async () => {
  // Rob Thomson: statsapi holds two A+ games. careerTimelineView's
  // CUP_OF_COFFEE_FLOOR (10 G) has always dropped them from the rail, so the
  // card printed ".000/.000/.000" over an empty rail.
  await withStatsFetch({ 'hitting:13': { gamesPlayed: 2, atBats: 7, hits: 0 } }, async () => {
    assert.equal(await fetchManagerPlaying(479080, HITTER), null)
  })
})

test('a single major-league game still counts — any MLB appearance is a career', async () => {
  // Jeff Banister, one at-bat and one hit for the 1991 Pirates. The floor is a
  // MINORS test only; the rail keeps every MLB stop with a game in it.
  await withStatsFetch({ 'hitting:1': { gamesPlayed: 1, atBats: 1, hits: 1, totalBases: 1 } }, async () => {
    const playing = await fetchManagerPlaying(110529, HITTER)
    assert.deepEqual(playing.lines.map((l) => l.level), ['mlb'])
  })
})

test('a former pitcher reads his pitching line, not the batting line beside it', async () => {
  // Every pitcher has a hitting career split too. The position picks the group.
  await withStatsFetch(
    {
      'pitching:1': { gamesPitched: 562, wins: 55, losses: 44, outs: 2655, earnedRuns: 360, hits: 858, baseOnBalls: 236 },
      'hitting:1': { gamesPlayed: 564, atBats: 101, hits: 22 },
    },
    async () => {
      const playing = await fetchManagerPlaying(489334, PITCHER)
      assert.equal(playing.group, 'pitching')
      assert.equal(playing.lines[0].splits[0].stat.wins, 55)
    },
  )
})

test('a misclassified position falls back to the other group rather than hiding a career', async () => {
  await withStatsFetch(
    { 'pitching:1': { gamesPitched: 40, wins: 4, losses: 11, outs: 392, earnedRuns: 91 } },
    async () => {
      const playing = await fetchManagerPlaying(209068, HITTER)
      assert.equal(playing.group, 'pitching')
    },
  )
})

test('a pitcher below the minor-league cameo floor produces no card', async () => {
  // CUP_OF_COFFEE_FLOOR for a pitcher is 5 G or 60 outs — four outings and
  // nine innings is a look, not a stretch of work.
  await withStatsFetch(
    { 'pitching:12': { gamesPitched: 4, inningsPitched: '9.0', outs: 27, earnedRuns: 6 } },
    async () => {
      assert.equal(await fetchManagerPlaying(1, PITCHER), null)
    },
  )
})

test('a manager with no playing data at all returns null', async () => {
  await withStatsFetch({}, async () => {
    assert.equal(await fetchManagerPlaying(427469, HITTER), null)
  })
})
