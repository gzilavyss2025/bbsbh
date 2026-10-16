// The nightly shard's play-by-play reads for the wsEvents block (gen-callouts.mjs): one pruned
// playByPlay per game. getJson already retries (lib/statsapi.mjs); a read that still fails is
// logged with its gamePk and is null, and the block then drops (wsEventsBlock.js). `get` and
// `log` are injectable.
import { mapConcurrent } from '../concurrency.mjs'
import { getJson } from '../statsapi.mjs'
import { PLAY_FIELDS } from './events.mjs'

export async function fetchPlays(pks, { get = getJson, log = console.warn } = {}) {
  const out = {}
  await mapConcurrent(pks, 4, async (pk) => {
    try {
      out[pk] = await get(`/api/v1/game/${pk}/playByPlay?fields=${PLAY_FIELDS}`)
    } catch (err) {
      log(`wsEvents: playByPlay read failed for gamePk ${pk}, wsEvents block will drop: ${err.message}`)
      out[pk] = null
    }
  })
  return out
}
