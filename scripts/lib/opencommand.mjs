// THE OPENCOMMAND DATASET — the shared download, cache and join for the three
// generators that read it (gen-command.mjs, gen-command-zone.mjs,
// gen-command-received.mjs).
//
// WHAT IT IS. OpenCommand (github.com/tomdoyo/open-command, dataset at
// huggingface.co/datasets/tomdoyo/open-command) infers, from broadcast video,
// where the CATCHER SET UP for each pitch — then scores a pitcher's command as
// the distance between that target and where the pitch actually crossed.
// Nothing else public measures target-vs-actual, which is why this app reaches
// outside statsapi for it at all. CC BY-NC-SA 4.0: attribution is required and
// commercial use is not permitted, so every surface that renders it carries a
// visible credit line (see src/api/targetCommand.js's ATTRIBUTION).
//
// WHAT THIS FILE TOUCHES, AND WHAT IT REFUSES TO. Only the three flat, final
// tables per season:
//
//   command_scores.csv   ~270 KB   the published per-pitcher rollup
//   targets.csv.gz       47-63 MB  one row per pitch: actual location + target
//   pbp_info.csv.gz      78-107 MB one row per pitch: who threw it, what it was
//
// Everything else in that repo — per-frame CV detections, glove tracks, camera
// poses — is multi-gigabyte pipeline output and is never fetched.
//
// THE DISK CACHE IS NOT AN OPTIMISATION. Three generators read the same two
// large files, and a nightly run that downloaded 170 MB three times would be
// half a gigabyte of someone else's bandwidth for one night's data. Files land
// in node_modules/.cache (already ignored, already disposable) and are reused
// within and across runs; delete that directory to force a refresh.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const CACHE = join(here, '..', '..', 'node_modules', '.cache', 'opencommand')

// The seasons OpenCommand covers. Broadcast-video CV only runs where there is
// broadcast video, so there is no deep history here and never will be: the
// project starts at 2024. A season absent from the dataset is a normal degrade,
// not an error — see latestSeason below.
export const OPENCOMMAND_SEASONS = [2024, 2025, 2026]

export const OPENCOMMAND_URL = 'https://huggingface.co/datasets/tomdoyo/open-command'

export function datasetUrl(season, file) {
  return `${OPENCOMMAND_URL}/resolve/main/${season}/${file}`
}

// Below this many pitches a median miss says more about the sample than the
// pitcher. Deliberately the same figure as commandMap.js's MIN_COMMAND_PITCHES:
// both are "enough pitches of one kind to have a shape", the two cards sit on
// the same tab, and a reader who sees a pitch type on the command map should
// not find it silently missing from the strip beside it.
//
// command_scores.csv publishes no floor of its own — its own `n` runs down to
// 1 — so this is bbsbh's, applied on read, not the source's.
export const MIN_COMMAND_PITCHES = 50

// ---------------------------------------------------------------------------
// DOWNLOAD + CACHE
// ---------------------------------------------------------------------------

// Fetch `file` for `season` into the cache and return its local path. A file
// already cached is reused as-is; there is no revalidation, because these are
// versioned releases that only change when the author cuts a new one, and a
// nightly job re-reading a day-old copy is the intent rather than a bug.
export async function cachedFile(season, file) {
  await mkdir(CACHE, { recursive: true })
  const path = join(CACHE, `${season}-${file.replace(/\//g, '-')}`)
  const already = await stat(path).catch(() => null)
  if (already && already.size > 0) return path

  const url = datasetUrl(season, file)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenCommand ${season}/${file}: HTTP ${res.status}`)
  // Written to a temp sibling and renamed, so an interrupted download cannot
  // leave a half-file that the next run happily treats as cached — io.js's
  // writeJsonAtomic makes the same move for the same reason.
  const tmp = `${path}.tmp`
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp))
  await rename(tmp, path)
  return path
}

// True when the season has a command_scores.csv at all — the cheap probe a
// generator makes before paying for the big files.
export async function seasonExists(season) {
  const res = await fetch(datasetUrl(season, 'command_scores.csv'), { method: 'HEAD' })
  return res.ok
}

// The newest covered season at or below `preferred`. A generator run in March,
// before the new season's first release, wants last season's file rather than
// nothing; a run against a season OpenCommand has not reached returns null and
// the caller writes an empty dataset (the degrade convention).
export async function latestSeason(preferred) {
  const candidates = OPENCOMMAND_SEASONS.filter((s) => s <= preferred).sort((a, b) => b - a)
  for (const season of candidates) {
    if (await seasonExists(season)) return season
  }
  return null
}

// ---------------------------------------------------------------------------
// PARSING
// ---------------------------------------------------------------------------

// Fields are split on a bare comma, NOT with lib/csv.mjs's quote-aware parser.
// That is safe HERE and only here: every column these readers touch sits BEFORE
// pbp_info's `description` (the one quoted, comma-bearing column in either
// file), so a naive split cannot mis-slice any of them. Reading a column at or
// past `description` means switching to the real parser — hence the guard in
// `columns` below, which fails loudly rather than letting a future column read
// garbage.
const QUOTED_FROM = { 'pbp_info.csv.gz': 10 }

// Line-by-line over a (optionally gzipped) cached CSV, header first. These
// files run to 100 MB and 724,000 rows, so nothing here ever holds the text:
// the caller gets one row at a time and decides what to keep.
async function* csvRows(path, file) {
  const stream = file.endsWith('.gz')
    ? createReadStream(path).pipe(createGunzip())
    : createReadStream(path)
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!header) {
      header = line.split(',')
      yield { header }
      continue
    }
    if (line.length === 0) continue
    yield { cells: line.split(',') }
  }
}

// Resolve the column indexes a caller names, failing loudly when the layout
// moves. A renamed or reordered column in an externally-maintained dataset is
// the single most likely way this pipeline breaks, and it would otherwise
// surface as every pitcher quietly losing his card.
function columns(header, wanted, file) {
  const idx = {}
  for (const name of wanted) {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`OpenCommand ${file}: expected column '${name}' not found — layout changed`)
    const quoted = QUOTED_FROM[file]
    if (quoted != null && i >= quoted) {
      throw new Error(
        `OpenCommand ${file}: column '${name}' sits at or past the quoted 'description' column — ` +
          'this reader splits on a bare comma and cannot read it; use lib/csv.mjs',
      )
    }
    idx[name] = i
  }
  return idx
}

// ---------------------------------------------------------------------------
// command_scores.csv — the published rollup
// ---------------------------------------------------------------------------

// One row per `pitcher x pitch_type` (plus an ALL row per pitcher):
// { pitcher, pitchType, n, naiveIn, inferredIn }.
//
// THE COLUMN THIS FILE DOES NOT HAVE is the one worth naming: there is no
// pitcher_id here, only a display NAME. The id lives in pbp_info.csv.gz, which
// is why pitcherIdsByName below exists at all.
export async function loadCommandScores(season) {
  const file = 'command_scores.csv'
  const path = await cachedFile(season, file)
  const out = []
  let idx = null
  for await (const row of csvRows(path, file)) {
    if (row.header) {
      idx = columns(row.header, ['pitcher', 'pitch_type', 'n', 'naive_in', 'inferred_in'], file)
      continue
    }
    const c = row.cells
    const n = Number(c[idx.n])
    const inferredIn = Number(c[idx.inferred_in])
    if (!Number.isFinite(n) || !Number.isFinite(inferredIn)) continue
    out.push({
      pitcher: c[idx.pitcher],
      pitchType: c[idx.pitch_type],
      n,
      naiveIn: Number(c[idx.naive_in]),
      inferredIn,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// pbp_info.csv.gz — who threw each pitch
// ---------------------------------------------------------------------------

// name -> MLBAM personId, the join command_scores.csv cannot make itself.
//
// AMBIGUOUS NAMES ARE DROPPED, NOT GUESSED. command_scores.csv keys a pitcher
// by name alone, so when two men share one in a season its row is ALREADY the
// two of them blended, and there is no id that row honestly belongs to.
// Measured against the live dataset: 2025 and 2026 are clean (873 names to 873
// ids, 814 to 814), 2024 collides on exactly two — Luis Ortiz (682847/656814)
// and Logan Allen (671106/663531). Both are dropped, so those four pitchers
// show no card rather than one man wearing another's command.
//
// Returns { byName, dropped } — `dropped` is the collision list, for the log.
export async function pitcherIdsByName(season) {
  const file = 'pbp_info.csv.gz'
  const path = await cachedFile(season, file)
  const seen = new Map()
  let idx = null
  for await (const row of csvRows(path, file)) {
    if (row.header) {
      idx = columns(row.header, ['pitcher', 'pitcher_id'], file)
      continue
    }
    const c = row.cells
    const name = c[idx.pitcher]
    const id = c[idx.pitcher_id]
    if (!name || !id) continue
    let ids = seen.get(name)
    if (!ids) seen.set(name, (ids = new Set()))
    ids.add(id)
  }
  const byName = new Map()
  const dropped = []
  for (const [name, ids] of seen) {
    if (ids.size === 1) byName.set(name, Number([...ids][0]))
    else dropped.push({ name, ids: [...ids] })
  }
  return { byName, dropped }
}

// play_id -> `${pitcherId}|${pitchType}`, the index the per-pitch join needs.
//
// PACKED INTO ONE STRING per pitch on purpose. A season is up to 724,000
// pitches, and a Map of two-field objects at that count costs several hundred
// megabytes of heap; one short string keeps a full season comfortably inside a
// default Node heap, which is what lets these generators run on a CI box.
export async function playIndex(season) {
  const file = 'pbp_info.csv.gz'
  const path = await cachedFile(season, file)
  const index = new Map()
  let idx = null
  for await (const row of csvRows(path, file)) {
    if (row.header) {
      idx = columns(row.header, ['play_id', 'pitcher_id', 'pitch_type'], file)
      continue
    }
    const c = row.cells
    index.set(c[idx.play_id], `${c[idx.pitcher_id]}|${c[idx.pitch_type]}`)
  }
  return index
}

// ---------------------------------------------------------------------------
// targets.csv.gz — where it was aimed, where it went
// ---------------------------------------------------------------------------

// THE COORDINATE SYSTEM, verified rather than assumed (CLAUDE.md's rule about
// feed field paths applies double to an outside dataset). Against 20,000 real
// 2026 pitches, `plate_x_in` is EXACTLY `plate_x * 12` and `plate_z_in` exactly
// `plate_z * 12` — residual 0.00 at every percentile. So OpenCommand's inches
// are plain Statcast feet scaled by twelve: same origin, same signs, x the
// catcher's right and z absolute height off the ground. There is no sign flip
// and no zone-relative height to undo, and the target columns share that frame.
export const INCHES_PER_FOOT = 12

// Stream every USABLE pitch of a season, already joined to its pitcher and
// pitch type, as { gamePk, playId, pitcherId, pitchType, plateX, plateZ,
// targetX, targetZ, missX, missZ, miss } — inches throughout, `miss` the
// Euclidean distance between target and actual.
//
// `gamePk` rides along for the catcher-side generator, which has to group a
// season's pitches by the game they were thrown in before it can ask a feed who
// was catching. It comes off the targets row itself; the play index carries no
// game column.
//
// THE TWO FILTERS ARE THE SOURCE'S OWN, and they are not optional: `status`
// must be 'ok' (a pitch where no glove target was found reads 'no target') and
// `plausible` must be 'True' (the pipeline's own check that the inferred target
// is physically sane). Measured on 2026: 499,800 target rows, 6,816 of which
// fail one of the two.
//
// WHY THIS REPRODUCES THE PUBLISHED NUMBER. Taking the median `miss` per
// pitcher and pitch type over exactly these rows reproduces
// command_scores.csv's own `inferred_in` for all 4,011 of 2026's rows — median
// absolute difference 0.0000in, worst 0.025in — and the row counts match its
// `n` exactly. That check is what says this file reads the dataset the way its
// author writes it, and it is what lets the Glove Target card's ring and the
// Target Command strip's figure be the same number rather than two estimates
// of it.
export async function* streamPitches(season, index) {
  const file = 'targets.csv.gz'
  const path = await cachedFile(season, file)
  let idx = null
  for await (const row of csvRows(path, file)) {
    if (row.header) {
      idx = columns(
        row.header,
        ['game_pk', 'play_id', 'plate_x_in', 'plate_z_in', 'status', 'plausible', 'inferred_x_in', 'inferred_z_in'],
        file,
      )
      continue
    }
    const c = row.cells
    if (c[idx.status] !== 'ok' || c[idx.plausible] !== 'True') continue
    const packed = index.get(c[idx.play_id])
    if (!packed) continue
    const plateX = Number(c[idx.plate_x_in])
    const plateZ = Number(c[idx.plate_z_in])
    const targetX = Number(c[idx.inferred_x_in])
    const targetZ = Number(c[idx.inferred_z_in])
    if (![plateX, plateZ, targetX, targetZ].every((v) => Number.isFinite(v))) continue
    const bar = packed.indexOf('|')
    const pitchType = packed.slice(bar + 1)
    if (!pitchType) continue
    const missX = plateX - targetX
    const missZ = plateZ - targetZ
    yield {
      gamePk: Number(c[idx.game_pk]),
      playId: c[idx.play_id],
      pitcherId: Number(packed.slice(0, bar)),
      pitchType,
      plateX,
      plateZ,
      targetX,
      targetZ,
      missX,
      missZ,
      miss: Math.hypot(missX, missZ),
    }
  }
}

// ---------------------------------------------------------------------------
// SMALL PURE HELPERS (unit-tested in test/opencommand.test.js)
// ---------------------------------------------------------------------------

// The median of a numeric array. Sorts a COPY: callers hold these arrays for
// several statistics at once, and a sort in place has surprised this repo
// before.
export function median(values) {
  if (!values || !values.length) return null
  const a = [...values].sort((x, y) => x - y)
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

// Percentile rank of `value` within `population`, ALREADY FLIPPED so a smaller
// miss scores higher — the strip's convention, where 99 is always the good end
// and `lowerIsBetter` only drives the down-arrow beside the label (see
// api/savantPercentiles.js's header).
//
// Midrank on ties, so two pitchers with identical medians rank identically
// rather than by array order, and clamped to 1-99: nobody sits at the 0th
// percentile of a population that contains him.
export function percentileLowerIsBetter(value, population) {
  if (!Number.isFinite(value) || !population || !population.length) return null
  let below = 0
  let equal = 0
  for (const p of population) {
    if (p > value) below++
    else if (p === value) equal++
  }
  const rank = (below + equal / 2) / population.length
  return Math.min(99, Math.max(1, Math.round(rank * 100)))
}

// A deterministic, evenly-spread sample of at most `cap` items — the scatter
// cap the Glove Target card needs.
//
// EVENLY SPREAD, NOT RANDOM, and not the first N. A pitcher throws 500+ of one
// pitch type in a season and the card can carry a few dozen dots; taking the
// first N would draw only April, and a seeded shuffle would redraw a different
// cloud every night for no reader-visible reason. A fixed stride over the
// season's own order samples the whole year and is stable across runs, so a
// nightly regeneration writes a byte-identical file when the season has not
// moved.
export function evenSample(items, cap) {
  if (!items || !items.length || cap <= 0) return []
  if (items.length <= cap) return [...items]
  const out = []
  for (let i = 0; i < cap; i++) out.push(items[Math.floor((i * items.length) / cap)])
  return out
}

// A short, stable digest of a dataset build, for the run log — so two runs that
// produced identical output say so.
export function digest(value) {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12)
}
