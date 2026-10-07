// One memoized read of a static same-origin file, shared by every caller.
//
// THE BUG THIS EXISTS TO CLOSE. The build-time-fetch readers all cached their
// result in a module-level `let cached`, set AFTER the await. That only
// short-circuits a call which starts once the first one has already resolved —
// and React mounts a page's cards on the same tick, so every card that calls in
// before then fires its own fetch of the same file. Measured on a phone-sized
// run: the player page pulled `teams.json` FOURTEEN times and `milb-history.json`
// eight; a lineup page pulled `umpire-accuracy-summary.json` four times. 1.6 MB
// of a player page's 2.8 MB was the same handful of files, re-downloaded.
//
// jerseys.js found this first and fixed itself; this is that fix, once, for
// everyone: memoize the REQUEST, not just its result, so concurrent callers
// await one promise. Nothing about the shape or the failure behaviour changes —
// each reader still owns its own `shape` and its own `fallback`.
//
// An ANSWER that is a failure is memoized too, deliberately: a 404 or a body that
// will not parse gets the fallback, and re-fetching a missing file on every render
// of a session where it is unavailable was never the intent (see the "degrades to
// an empty map so callers see a plain cache miss" note these readers carry). A
// request that never got an answer (offline, a dropped connection) is different:
// the caller gets the fallback, but nothing is stored, and a later call tries again once NO_ANSWER_MS has passed.

// A loader for ONE file. `shape` narrows the parsed JSON to what the reader
// hands out; `fallback` is what a non-200, a parse failure, or an offline
// device resolves to.
// fetch + parse. `res.ok` false or bad JSON rejects with a plain Error (memoized);
// fetch() itself rejecting is tagged `noAnswer` (not memoized).
// An unanswered url is not retried for NO_ANSWER_MS, so an offline phone fires
// one fetch per file, not one per call (#1650); a reconnect recovers after it.
const NO_ANSWER_MS = 30_000
const noAnswerAt = new Map() // url -> Date.now() of its last unanswered fetch

async function fetchJson(url) {
  if (Date.now() - (noAnswerAt.get(url) ?? -Infinity) < NO_ANSWER_MS) {
    throw Object.assign(new Error(`${url} unanswered`), { noAnswer: true })
  }
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    noAnswerAt.set(url, Date.now())
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { noAnswer: true })
  }
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json()
}

export function staticJson(url, { shape = (d) => d, fallback = null } = {}) {
  let has = false
  let value = null
  let inFlight = null
  return async () => {
    // Not `if (value)` — a reader whose fallback IS null (fouls.js,
    // comebackWins.js) would re-fetch a missing file forever.
    if (has) return value
    if (!inFlight) {
      inFlight = fetchJson(url)
        .then(shape)
        .then(
          (data) => ({ data, keep: true }),
          (err) => ({ data: fallback, keep: !err?.noAnswer }),
        )
        .then(({ data, keep }) => {
          if (keep) {
            has = true
            value = data
          }
          inFlight = null
          return data
        })
    }
    return inFlight
  }
}

// The same thing for a SHARDED dataset: one file per key, memoized per key.
// `urlFor` turns the caller's key into the file's path.
export function staticJsonBy(urlFor, { shape = (d) => d, fallback = null } = {}) {
  const done = new Map() // key -> value
  const inFlight = new Map() // key -> promise
  return async (key) => {
    const k = String(key)
    if (done.has(k)) return done.get(k)
    if (!inFlight.has(k)) {
      inFlight.set(
        k,
        fetchJson(urlFor(key))
          .then(shape)
          .then(
            (data) => ({ data, keep: true }),
            (err) => ({ data: fallback, keep: !err?.noAnswer }),
          )
          .then(({ data, keep }) => {
            if (keep) done.set(k, data)
            inFlight.delete(k)
            return data
          }),
      )
    }
    return inFlight.get(k)
  }
}

// A SEASON STORE's index (ADR-0086), `/data/{store}/seasons.json`:
// `{ seasons, current }`. `current` is the latest season with data, so on
// January 1 it still names last season. Memoized per store, like every read
// here; `{ seasons: [], current: null }` when the index is missing.
const seasonIndexes = new Map()
// The whole index is what a page's season picker reads
// (lib/seasons/view.js's resolveSeasonView).
export function seasonIndexOf(store) {
  if (!seasonIndexes.has(store)) {
    seasonIndexes.set(
      store,
      staticJson(`/data/${store}/seasons.json`, {
        shape: (d) => ({ seasons: d?.seasons ?? [], current: d?.current ?? null }),
        fallback: { seasons: [], current: null },
      }),
    )
  }
  return seasonIndexes.get(store)()
}

// The season a store serves when the caller names none, or null.
export async function currentSeasonOf(store) {
  return (await seasonIndexOf(store)).current
}

// Every season on file in a store, oldest first.
export async function seasonsOf(store) {
  return (await seasonIndexOf(store)).seasons
}

// THE ONE RULE FOR "WHICH SEASON" (#1201). A reader of a season store takes
// `{ seasonYear }`: a year, `'all'`, or nothing. Nothing means `current`. A
// year AFTER the last on file means `current` too. The stores sweep no spring
// training, so a new season's year is not on file until Opening Day: a spring
// 2027 game page reads 2026, as it did before #1201, and never a blank card or
// a 404. The same holds for an index memoized before the nightly run added a
// season. A year BEFORE the first on file (or in a gap) means nothing: the
// store never covered it, and `current` would print 2026's figures beside a
// 2024 game (#1202). `'all'` is the store's `all/` folder, which holds only the
// league-wide files; a reader of ONE player's shard adds the seasons up
// instead (readSeasonShard).
//
// `{ strict: true }` is for a SEASON VIEW (#1482). A page that picks its year
// from ONE store and reads others cannot assume they share a last season, so a
// year not on file means nothing, after the last as well as before the first.
// A game page passes nothing and keeps the spring fallback.
//
// The argument is `seasonYear`, never `season`: in umpires.js `u.season` is an
// umpire's season AGGREGATE, and `season.season` must not be able to happen.
//
// -> a folder name (a year or 'all'), or null when there is nothing to read.
export async function seasonFolderOf(store, seasonYear, { strict = false } = {}) {
  if (seasonYear === 'all') return 'all'
  const { seasons, current } = await seasonIndexOf(store)
  if (seasonYear == null) return current
  const year = Number(seasonYear)
  if (seasons.includes(year)) return year
  return !strict && seasons.length > 0 && year > Math.max(...seasons) ? current : null
}

// One whole file of a season store, `/data/{store}/{folder}/{file}`, memoized
// like staticJson. The loader takes `{ seasonYear, strict }` (see seasonFolderOf).
// `fallback` when the index or the file is missing; an `all/` file
// is not on disk until the first nightly run writes it.
export function seasonStaticJson(store, file, { shape, fallback = null } = {}) {
  const bySeason = staticJsonBy((folder) => `/data/${store}/${folder}/${file}`, { shape, fallback })
  return async ({ seasonYear, strict } = {}) => {
    const folder = await seasonFolderOf(store, seasonYear, { strict })
    return folder == null ? fallback : bySeason(folder)
  }
}

// One player's (or one umpire's) slice of a sharded season store, for
// `{ seasonYear }`. `readOne(season)` reads that season's slice, or null. For
// `'all'` it reads every season on file and hands the slices, oldest first, to
// `combine(slices, seasons)` — a pure sum from lib/seasons/combine.js. There is
// no `all/` shard: the client adds one man's seasons, never a league's.
// `strict` is seasonFolderOf's.
export async function readSeasonShard(store, seasonYear, readOne, combine, { strict } = {}) {
  if (seasonYear === 'all') {
    const seasons = await seasonsOf(store)
    if (!seasons.length) return null
    return combine(await Promise.all(seasons.map(readOne)), seasons)
  }
  const folder = await seasonFolderOf(store, seasonYear, { strict })
  return folder == null ? null : readOne(folder)
}
