// The nightly shard's play-by-play reads for the wsEvents block (gen-callouts.mjs): one pruned
// playByPlay per game. A read is tried twice; one that still fails is logged with its gamePk and
// is null, and the block then drops (wsEventsBlock.js). `get`, `log` and `sleep` are injectable.
import { mapConcurrent } from '../concurrency.mjs'
import { withRetry } from '../net/retry.mjs'
import { getJson } from '../statsapi.mjs'
import { PLAY_FIELDS } from './events.mjs'

export async function fetchPlays(pks, { get = getJson, log = console.warn, sleep } = {}) {
  const out = {}
  await mapConcurrent(pks, 4, async (pk) => {
    try {
      out[pk] = await withRetry(() => get(`/api/v1/game/${pk}/playByPlay?fields=${PLAY_FIELDS}`), { tries: 2, delayMs: 1000, sleep })
    } catch (err) {
      log(`wsEvents: playByPlay read failed for gamePk ${pk}, wsEvents block will drop: ${err.message}`)
      out[pk] = null
    }
  })
  return out
}
