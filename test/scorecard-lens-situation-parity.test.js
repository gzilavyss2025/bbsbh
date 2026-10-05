// situation() (the lens bar) and deriveLiveState() (the innings viewer) both
// answer "outs and men on base at the cursor" (#1430). They stay two functions
// because situation() may read only the clamped cards, never the feed (see its
// header). This test is the tie between them: it walks the captured game
// (gamePk 823035) and, at every step, asks both. A fix in one that is missing
// from the other fails here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { scorecardFull, scorecardStep } from '../src/api/scorecardGame.js'
import { halfIndex } from '../src/api/select.js'
import { situation } from '../src/lib/scorecard/situation.js'
import { deriveLiveState } from '../src/api/playbyplay/entriesView.js'
import { computeHalfInningFeed } from '../src/api/playbyplay/halfInningFeed.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

const BASE_NUMBER = { first: 1, second: 2, third: 3 }

test('situation() and deriveLiveState() give the same outs and bases at every step', () => {
  const counts = {}
  const countFor = (inning, half) => counts[`${inning}${half}`] ?? 0
  let through = -1
  let side = null
  let steps = 0
  for (;;) {
    const info = scorecardStep(FEED, through, countFor)
    if (!info) break
    side ??= info.side
    if (info.side !== side) {
      side = info.side // the turn: no tap, same step
      continue
    }
    const view = scorecardFull({ feed: FEED }, side, {
      through,
      step: { halfIdx: through + 1, count: info.count },
    })
    const lens = situation(view, info.inning, info.half)
    // The innings viewer passes its step count as the feed's stepCap.
    const entries = computeHalfInningFeed(
      FEED,
      info.inning,
      info.half,
      info.half === 'top' ? 'away' : 'home',
      info.count,
    )
    const viewer = deriveLiveState(entries, info.count)
    const viewerBases = Object.entries(viewer.bases)
      .filter(([, held]) => held)
      .map(([name]) => BASE_NUMBER[name])
      .sort()
    const where = `${info.half} ${info.inning}, step ${info.count}`
    assert.equal(lens.outs, viewer.outs, `outs differ at ${where}`)
    assert.deepEqual([...lens.bases].sort(), viewerBases, `bases differ at ${where}`)
    steps += 1
    if (info.nextCount >= info.total && info.halfOver) through = halfIndex(info.inning, info.half)
    else counts[`${info.inning}${info.half}`] = info.nextCount
  }
  assert.ok(steps > 50, `walked ${steps} steps`)
})
