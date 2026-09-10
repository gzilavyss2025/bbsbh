// Regenerates public/data/glove-target/{NN}.json — GLOVE TARGET, the spatial
// half of what OpenCommand measures: not just how far a pitcher finishes from
// the catcher's glove, but WHICH WAY he misses.
//
// Buckets on `personId % 100`, like pitch-arsenal and pitch-command, for the
// reason src/lib/shardKey.js gives: one file per pitcher is thousands of tiny
// files, one file for the league makes every player page download the league.
//
// THE SHAPE THIS WRITES, AND WHY IT IS A MISS AND NOT A LOCATION.
//
// The obvious build is a strike zone with a target glyph at the catcher's
// average set-up and the season's actual pitches scattered around it. It does
// not work, and the reason is worth writing down because the card looks
// perfectly reasonable while being wrong.
//
// Every pitch has its OWN target. A catcher sets up outside, then inside, then
// low-away. So a scatter of ABSOLUTE locations around a single average target
// is showing two things added together — where the glove moved, and how far the
// pitcher missed it — with nothing on the card saying which is which. The
// median-miss ring drawn over that scatter would not bisect it: most of the
// spread would be the catcher moving, not the pitcher missing. It would also
// duplicate the Command Map directly above it, which already plots exactly
// where a pitcher's pitches go.
//
// So this stores the MISS VECTOR — actual minus target, per pitch, in inches —
// and the card draws the glove at the origin. Then:
//
//   - the origin IS the target, by construction, for every dot;
//   - the ring at the median miss genuinely halves the cloud;
//   - that ring is the same number the Target Command strip prints (#992),
//     because both are the median of these same distances;
//   - a pitcher who misses consistently high, or consistently arm-side, shows
//     it as an off-centre cloud — which is the thing no other card on the page
//     can say at all.
//
// It also sidesteps a trap the absolute version has to solve: a miss is the
// difference of two heights, so the batter's own strike zone cancels out. There
// is no zone normalisation here to get wrong, and no reason to reach for
// lib/zone/zoneGeometry.js — that projection maps a location into a strike
// zone, and a miss offset has no strike zone to be mapped into.
//
// Runs nightly; see scripts/lib/opencommand.mjs for the dataset, its licence
// and its caching. Run by hand: node scripts/gen-command-zone.mjs [--season=2026]
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeShards } from './lib/io.js'
import { shardKey100 } from '../src/lib/shardKey.js'
import {
  MIN_COMMAND_PITCHES,
  evenSample,
  latestSeason,
  median,
  playIndex,
  streamPitches,
} from './lib/opencommand.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'glove-target')

const seasonArg = process.argv.find((a) => a.startsWith('--season='))
const preferred = seasonArg ? Number(seasonArg.slice('--season='.length)) : new Date().getFullYear()

// How many dots one pitch type carries to the client. A pitcher throws 500+ of
// one pitch in a season; a phone-width card can show a few dozen before the
// cloud turns into a blob and stops reporting a shape. 48 is enough to read a
// bias and a spread, and keeps a bucket of ~8 pitchers in line with the
// pitch-command buckets beside it (tens of KB, not hundreds).
const DOT_CAP = 48

const season = await latestSeason(preferred)
if (!season) {
  await writeShards(outDir, [])
  console.log(`no OpenCommand season at or below ${preferred} — swept ${outDir}`)
  process.exit(0)
}

// pitcherId -> pitchType -> [[missX, missZ, miss], ...], one entry per pitch.
//
// Held for the whole season at once, which is affordable and was measured: the
// play index is one packed string per pitch (see playIndex's header) and these
// are plain numbers, so a full season sits inside a default Node heap.
// Streaming keeps the 47-63 MB targets file itself out of memory entirely.
const byPitcher = new Map()
let kept = 0
let unmatched = 0

const index = await playIndex(season)
for await (const p of streamPitches(season, index)) {
  let types = byPitcher.get(p.pitcherId)
  if (!types) byPitcher.set(p.pitcherId, (types = new Map()))
  let bucket = types.get(p.pitchType)
  if (!bucket) types.set(p.pitchType, (bucket = []))
  bucket.push([p.missX, p.missZ, p.miss])
  kept++
}
// The join loses nothing measurable — every target row matched an index entry
// on the seasons checked — but the count is logged rather than assumed, since a
// future release could change either file's coverage.
unmatched = index.size - kept

// One decimal inch. The dots are drawn a few pixels across on a phone; a
// thousandth of an inch of stored precision is three bytes a dot that no reader
// can see, across ~200,000 dots.
const round1 = (n) => Math.round(n * 10) / 10

const entries = new Map() // shard key -> { season, pit: {} }
let pitchers = 0
let rows = 0

for (const [pitcherId, types] of byPitcher) {
  const out = {}

  // ALL is derived here rather than accumulated alongside every type, which
  // would have stored each pitch twice for a season. A pitcher's own buckets
  // are a couple of thousand numbers, so concatenating them per pitcher costs
  // nothing — and iterating a Map is insertion-ordered, so the concatenation is
  // the same on every run.
  const all = []
  for (const bucket of types.values()) all.push(...bucket)

  const pack = (pitches) => {
    if (pitches.length < MIN_COMMAND_PITCHES) return null
    // SAMPLED IN DISTANCE ORDER, not season order, and this is what makes the
    // card honest at a glance. A stride over the season picks an unbiased 48
    // pitches, but 48 draws of a 1,100-pitch cloud land wherever they land: the
    // ring would sit slightly off the middle of the dots actually on screen
    // (measured: a 7.78in ring over a drawn cloud whose own median was 7.50in),
    // and a reader counting dots inside it would be counting a sampling
    // accident. Striding over the DISTANCE-sorted season takes one pitch per
    // radial quantile instead, so the drawn cloud carries the season's real
    // spread and the ring halves it by construction. Direction is untouched —
    // each dot keeps the direction the pitch actually missed in, so an off-
    // centre cloud still means what it means.
    //
    // V8's sort is stable, so equal distances keep season order and a rerun
    // over unchanged data writes an identical file.
    const ordered = [...pitches].sort((a, b) => a[2] - b[2])
    return {
      n: pitches.length,
      // The ring's radius, and the same statistic the Target Command strip
      // prints for this pitcher and pitch type — one number, computed one way,
      // so the two cards on this tab can never disagree.
      miss: Number(median(pitches.map((p) => p[2])).toFixed(2)),
      // WHICH WAY he misses, over EVERY pitch rather than the sampled dots.
      // The card could take this off the forty-eight it draws, and that was the
      // first build; it is worse for a reason worth keeping. A sentence as flat
      // as "he misses low and arm-side" ought to rest on the two thousand
      // pitches the season actually holds, not on a forty-eight-dot sample
      // whose own median wanders an inch either way — a caption that changes
      // its mind between nightly runs, on data that did not move, is a caption
      // a reader learns to distrust.
      //
      // MEDIAN, not mean, like every other figure on these two cards: one pitch
      // spiked at the backstop should not be allowed to write the sentence.
      bias: [
        round1(median(pitches.map((p) => p[0]))),
        round1(median(pitches.map((p) => p[1]))),
      ],
      dots: evenSample(ordered, DOT_CAP).map(([x, z]) => [round1(x), round1(z)]),
    }
  }

  const packedAll = pack(all)
  if (packedAll) out.ALL = packedAll
  for (const [pitchType, bucket] of types) {
    const packed = pack(bucket)
    if (packed) out[pitchType] = packed
  }

  // A pitcher whose every pitch type is under the floor, and whose season as a
  // whole is too, carries no card — the degrade convention, not an empty entry.
  if (!Object.keys(out).length) continue
  pitchers++
  rows += Object.keys(out).length

  const key = shardKey100(pitcherId)
  let shard = entries.get(key)
  // NO generatedAt in a shard. These files are rewritten in full every night,
  // and a timestamp in each would dirty all 100 of them on a night when not one
  // pitch changed — the churn gen-contracts-shards.mjs already taught this repo
  // to avoid. The season is the only header a reader needs.
  if (!shard) entries.set(key, (shard = { season, pit: {} }))
  shard.pit[pitcherId] = out
}

const { written, swept } = await writeShards(outDir, [...entries].map(([k, v]) => [k, v]))

console.log(
  `wrote ${written} bucket(s) to ${outDir} (swept ${swept}) — ${season}: ` +
    `${pitchers} pitchers, ${rows} pitch-type rows, ${kept.toLocaleString()} pitches kept, ` +
    `${unmatched.toLocaleString()} indexed pitches with no usable target row, cap ${DOT_CAP} dots`,
)
