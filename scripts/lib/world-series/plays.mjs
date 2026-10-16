// The nightly shard's play-by-play reads for the wsEvents block (gen-callouts.mjs): one pruned
// playByPlay per game. A failed read is null, and the block then drops (wsEventsBlock.js).
import { mapConcurrent } from '../concurrency.mjs'
import { getJson } from '../statsapi.mjs'
import { PLAY_FIELDS } from './events.mjs'

export async function fetchPlays(pks) {
  const out = {}
  await mapConcurrent(pks, 4, async (pk) => {
    out[pk] = await getJson(`/api/v1/game/${pk}/playByPlay?fields=${PLAY_FIELDS}`).catch(() => null)
  })
  return out
}
