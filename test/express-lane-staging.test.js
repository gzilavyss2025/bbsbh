// Express Lane Tier 3 — the staging queue and the film gate
// (src/lib/expresslane/staging.js).
//
// Pure. No network, no IndexedDB, no clock. Every rule the gate has is a
// function of a job object, which is the whole reason the job is one.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canAdvanceTo,
  consentToSkip,
  createJob,
  enqueueHalf,
  evictable,
  filmFrontier,
  gateFor,
  GATE_REASONS,
  isCovered,
  JOB_STATES,
  markByteFailure,
  markComplete,
  markEvicted,
  markResolveMiss,
  markStaged,
  markUnfilmed,
  nextToStage,
  pauseJob,
  resumeJob,
  retryUnfilmedAhead,
  setCursor,
  stagingStatus,
  withMode,
} from '../src/lib/expresslane/staging.js'

// Rail rows, in the shape buildRail returns: a pitch carries a playId, a piece
// of paperwork carries none.
const pitch = (n, half = 1) => ({ key: `p${n}`, playId: `p${n}`, halfIndex: half })
const paperwork = (n, half = 1) => ({ key: `a${n}`, playId: null, halfIndex: half })

function jobWith(rows) {
  return enqueueHalf(createJob({ gamePk: 823035 }), rows)
}

// --- the queue ------------------------------------------------------------

test('a new job holds nothing and is idle', () => {
  const job = createJob({ gamePk: 823035, mode: 'result', feed: 'away' })
  assert.equal(job.gamePk, 823035)
  assert.equal(job.mode, 'result')
  assert.equal(job.feed, 'away')
  assert.equal(job.state, 'idle')
  assert.deepEqual(job.queue, [])
})

test('an unknown mode or booth falls back rather than being carried', () => {
  const job = createJob({ gamePk: 1, mode: 'everything', feed: 'press-box' })
  assert.equal(job.mode, 'result')
  assert.equal(job.feed, 'home')
})

test('enqueueHalf appends in rail order and starts the job running', () => {
  const job = jobWith([pitch(1), paperwork(1), pitch(2)])
  assert.deepEqual(
    job.queue.map((entry) => entry.key),
    ['p1', 'a1', 'p2'],
  )
  assert.equal(job.state, 'running')
})

test('enqueueing the same half twice adds nothing', () => {
  const once = jobWith([pitch(1), pitch(2)])
  const twice = enqueueHalf(once, [pitch(1), pitch(2)])
  assert.equal(twice.queue.length, 2)
  assert.equal(twice, once, 'an append with nothing new returns the same job')
})

test('rows with no playId are queued too, not filtered out', () => {
  // The frontier walks the QUEUE. A paperwork row missing from it would make
  // the walk skip the row rather than pass through it.
  const job = jobWith([paperwork(1), paperwork(2)])
  assert.equal(job.queue.length, 2)
  assert.equal(filmFrontier(job), 'a2')
})

// --- the film gate --------------------------------------------------------

test('paperwork never blocks — the mound-visit deadlock', () => {
  const job = jobWith([paperwork(1)])
  assert.deepEqual(gateFor(job, paperwork(1)), {
    blocked: false,
    reason: 'paperwork',
    escapable: false,
  })
})

test('a pitch with no bytes yet blocks the cursor', () => {
  const job = jobWith([pitch(1)])
  const gate = gateFor(job, pitch(1))
  assert.equal(gate.blocked, true)
  assert.equal(gate.reason, 'waiting')
  assert.equal(gate.escapable, false, 'a clip still arriving is not an escape case')
})

test('a staged pitch is ready and lets the cursor through', () => {
  const job = markStaged(jobWith([pitch(1)]), 'p1')
  assert.deepEqual(gateFor(job, pitch(1)), { blocked: false, reason: 'ready', escapable: false })
})

test('a phantom playId resolves to paperwork and NEVER prompts (#1024)', () => {
  // MLB mints playIds by formula for an intentional walk and for most
  // pitch-timer violations — about 1.2 a game. The row claims a clip and no
  // clip exists. A gate that waits on it deadlocks one game in eight.
  const job = markUnfilmed(jobWith([pitch(1)]), 'p1')
  const gate = gateFor(job, pitch(1))
  assert.equal(gate.blocked, false, 'an empty resolution must not hold the cursor')
  assert.equal(gate.reason, 'no-film')
  assert.equal(
    gate.escapable,
    false,
    'offering the escape here would fire once a game and erode the gate',
  )
})

test('three empty resolutions turn a row into paperwork, and not before', () => {
  let job = jobWith([pitch(1)])
  job = markResolveMiss(job, 'p1')
  assert.equal(gateFor(job, pitch(1)).blocked, true, 'one empty answer may be a late clip')
  job = markResolveMiss(job, 'p1')
  assert.equal(gateFor(job, pitch(1)).blocked, true)
  job = markResolveMiss(job, 'p1')
  assert.equal(gateFor(job, pitch(1)).blocked, false, 'the queue stops asking and moves on')
  assert.equal(gateFor(job, pitch(1)).reason, 'no-film')
})

test('a clip whose bytes keep failing offers the escape, and still blocks', () => {
  let job = jobWith([pitch(1)])
  job = markByteFailure(job, 'p1')
  job = markByteFailure(job, 'p1')
  assert.equal(gateFor(job, pitch(1)).escapable, false)
  job = markByteFailure(job, 'p1')
  const gate = gateFor(job, pitch(1))
  assert.equal(gate.blocked, true, 'the escape is offered, not taken for the scorer')
  assert.equal(gate.reason, 'stalled')
  assert.equal(gate.escapable, true)
})

test('consent lets one row through and is remembered', () => {
  let job = jobWith([pitch(1)])
  job = consentToSkip(job, 'p1')
  assert.deepEqual(gateFor(job, pitch(1)), {
    blocked: false,
    reason: 'consented',
    escapable: false,
  })
})

test('a late clip overrides an unfilmed mark', () => {
  let job = markUnfilmed(jobWith([pitch(1)]), 'p1')
  job = markStaged(job, 'p1')
  assert.equal(gateFor(job, pitch(1)).reason, 'ready')
  assert.equal(job.unfilmed.has('p1'), false)
})

// --- the frontier ---------------------------------------------------------

test('the frontier is contiguous: a staged clip beyond a gap does not count', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3)])
  job = markStaged(job, 'p1')
  job = markStaged(job, 'p3')
  assert.equal(filmFrontier(job), 'p1', 'p3 is staged but the scorer cannot reach it')
})

test('the frontier is null before the pre-roll lands', () => {
  assert.equal(filmFrontier(jobWith([pitch(1), pitch(2)])), null)
})

test('paperwork carries the frontier past itself', () => {
  let job = jobWith([pitch(1), paperwork(1), paperwork(2), pitch(2)])
  job = markStaged(job, 'p1')
  assert.equal(filmFrontier(job), 'a2', 'two mound visits do not stop the frontier')
})

// --- the cursor -----------------------------------------------------------

test('the cursor cannot pass the film, however it is asked to', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3)])
  job = markStaged(job, 'p1')
  job = setCursor(job, 'p1')
  assert.equal(job.cursorKey, 'p1')
  const held = setCursor(job, 'p2')
  assert.equal(held.cursorKey, 'p1', 'p2 has no film')
})

test('a chip three plate appearances ahead cannot jump the gap', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3)])
  job = markStaged(job, 'p1')
  job = markStaged(job, 'p3')
  job = setCursor(job, 'p1')
  assert.equal(canAdvanceTo(job, 'p3'), false, 'p2 is still missing')
  assert.equal(setCursor(job, 'p3').cursorKey, 'p1')
})

test('going backwards is always allowed — those rows are already scored', () => {
  let job = jobWith([pitch(1), pitch(2)])
  job = markStaged(job, 'p1')
  job = markStaged(job, 'p2')
  job = setCursor(job, 'p2')
  assert.equal(setCursor(job, 'p1').cursorKey, 'p1')
})

test('an unknown key moves nothing', () => {
  const job = setCursor(jobWith([pitch(1)]), 'nowhere')
  assert.equal(job.cursorKey, null)
})

// --- what to fetch next ---------------------------------------------------

test('staging runs strictly in queue order and skips covered rows', () => {
  let job = jobWith([paperwork(1), pitch(1), pitch(2)])
  assert.equal(nextToStage(job).key, 'p1', 'paperwork needs no bytes')
  job = markStaged(job, 'p1')
  assert.equal(nextToStage(job).key, 'p2')
  job = markUnfilmed(job, 'p2')
  assert.equal(nextToStage(job), null, 'the queue is drained')
})

test('isCovered is true for consent, for paperwork, for no film and for bytes', () => {
  const job = jobWith([pitch(1)])
  assert.equal(isCovered(job, paperwork(1)), true)
  assert.equal(isCovered(job, pitch(1)), false)
  assert.equal(isCovered(markStaged(job, 'p1'), pitch(1)), true)
  assert.equal(isCovered(markUnfilmed(job, 'p1'), pitch(1)), true)
  assert.equal(isCovered(consentToSkip(job, 'p1'), pitch(1)), true)
})

// --- blocking, pausing and eviction ---------------------------------------

test('four failures in a row block the job; one clip failing does not', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3), pitch(4)])
  job = markByteFailure(job, 'p1')
  job = markByteFailure(job, 'p2')
  job = markByteFailure(job, 'p3')
  assert.equal(job.state, 'running')
  job = markByteFailure(job, 'p4')
  assert.equal(job.state, 'blocked')
  assert.equal(job.blockedReason, 'failures')
})

test('a clip landing clears a block and the run of failures with it', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3), pitch(4)])
  for (const id of ['p1', 'p2', 'p3', 'p4']) job = markByteFailure(job, id)
  job = markStaged(job, 'p1')
  assert.equal(job.state, 'running')
  assert.equal(job.runFailures, 0)
})

test('pause is the scorer and block is the world, and pause cannot mask a block', () => {
  let job = jobWith([pitch(1)])
  job = pauseJob(job)
  assert.equal(job.state, 'paused')
  job = resumeJob(job)
  assert.equal(job.state, 'running')
  for (const id of ['p1', 'p1', 'p1', 'p1']) job = markByteFailure(job, id)
  assert.equal(job.state, 'blocked')
  assert.equal(pauseJob(job).state, 'blocked', 'pausing a blocked job hides why it stopped')
})

test('resuming clears the block and the counters that caused it', () => {
  let job = jobWith([pitch(1)])
  for (const id of ['p1', 'p1', 'p1', 'p1']) job = markByteFailure(job, id)
  job = resumeJob(job)
  assert.equal(job.state, 'running')
  assert.equal(job.blockedReason, null)
  assert.equal(job.runFailures, 0)
})

test('eviction keeps a lookbehind so an expanded plate appearance still has film', () => {
  const rows = Array.from({ length: 10 }, (unused, i) => pitch(i + 1))
  let job = jobWith(rows)
  for (const row of rows) job = markStaged(job, row.playId)
  job = setCursor(job, 'p9')
  assert.deepEqual(evictable(job, { lookbehind: 4 }), ['p1', 'p2', 'p3', 'p4'])
  assert.deepEqual(evictable(job, { lookbehind: 12 }), [], 'nothing goes while the window holds')
})

test('eviction drops nothing before the cursor is placed', () => {
  let job = jobWith([pitch(1), pitch(2)])
  job = markStaged(job, 'p1')
  assert.deepEqual(evictable(job, { lookbehind: 0 }), [])
})

test('markEvicted forgets only what really went', () => {
  let job = markStaged(jobWith([pitch(1), pitch(2)]), 'p1')
  job = markStaged(job, 'p2')
  job = markEvicted(job, ['p1'])
  assert.equal(job.staged.has('p1'), false)
  assert.equal(job.staged.has('p2'), true)
})

// --- the late-publication sweep -------------------------------------------

test('the re-sweep asks again for film ahead of the cursor, and not behind it', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3)])
  job = markStaged(job, 'p1')
  job = setCursor(job, 'p1')
  job = markUnfilmed(job, 'p2')
  job = markUnfilmed(job, 'p3')
  // A row behind the cursor is already scored; film for it helps nobody.
  job = markUnfilmed(job, 'p1')
  const swept = retryUnfilmedAhead(job)
  assert.equal(swept.unfilmed.has('p2'), false)
  assert.equal(swept.unfilmed.has('p3'), false)
  assert.equal(swept.unfilmed.has('p1'), true, 'behind the cursor is left alone')
})

test('a re-sweep with nothing to ask returns the same job', () => {
  const job = markStaged(jobWith([pitch(1)]), 'p1')
  assert.equal(retryUnfilmedAhead(job), job)
})

// --- mode switching -------------------------------------------------------

test('switching mode clears the queue and keeps what was learned about clips', () => {
  let job = jobWith([pitch(1), pitch(2)])
  job = markStaged(job, 'p1')
  job = markUnfilmed(job, 'p2')
  job = consentToSkip(job, 'p2')
  const full = withMode(job, 'full')
  assert.equal(full.mode, 'full')
  assert.deepEqual(full.queue, [], 'the mode defines the queue, so the caller re-enqueues')
  assert.equal(full.staged.has('p1'), true, 'Result to Full keeps every staged clip')
  assert.equal(full.unfilmed.has('p2'), true)
  assert.equal(full.consented.has('p2'), true)
})

test('switching to the mode already set changes nothing', () => {
  const job = jobWith([pitch(1)])
  assert.equal(withMode(job, 'result'), job)
})

// --- what a staging indicator may read ------------------------------------

test('the status counts film AHEAD of the cursor and never the game', () => {
  let job = jobWith([pitch(1), pitch(2), pitch(3), pitch(4)])
  job = markStaged(job, 'p1')
  job = markStaged(job, 'p2')
  job = markStaged(job, 'p3')
  job = setCursor(job, 'p1')
  const status = stagingStatus(job)
  assert.equal(status.filmAhead, 2)
  assert.equal(status.waiting, true)
  assert.equal(status.state, 'running')
  assert.equal(
    Object.hasOwn(status, 'total'),
    false,
    'a game-wide total states whether the game went to extras (ADR-0008)',
  )
})

test('every gate reason and every job state is one the catalogs name', () => {
  // The two exported lists are what a surface switches on. A reason or a state
  // that is not in them is one the screen has no wording for.
  const rows = [pitch(1), pitch(2), pitch(3), pitch(4), paperwork(1)]
  let job = jobWith(rows)
  const seen = new Set()
  const record = () => {
    assert.ok(JOB_STATES.includes(job.state), `unknown state ${job.state}`)
    for (const row of rows) {
      const { reason } = gateFor(job, row)
      assert.ok(GATE_REASONS.includes(reason), `unknown reason ${reason}`)
      seen.add(reason)
    }
  }
  record()
  job = markStaged(job, 'p1')
  job = markUnfilmed(job, 'p2')
  job = consentToSkip(job, 'p3')
  for (let i = 0; i < 3; i += 1) job = markByteFailure(job, 'p4')
  record()
  job = pauseJob(job)
  record()
  job = markComplete(resumeJob(job))
  record()
  assert.deepEqual([...seen].sort(), [...GATE_REASONS].sort(), 'every reason is reachable')
})

test('a drained queue reports complete and stops waiting', () => {
  let job = markStaged(jobWith([pitch(1)]), 'p1')
  job = markComplete(job)
  const status = stagingStatus(job)
  assert.equal(status.state, 'complete')
  assert.equal(status.waiting, false)
})
