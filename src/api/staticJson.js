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
// A failure is memoized too, deliberately: the fallback is what the reader
// wants a caller to see, and re-fetching a missing file on every render of a
// session where it is unavailable was never the intent (see the "degrades to
// an empty map so callers see a plain cache miss" note these readers carry).

// A loader for ONE file. `shape` narrows the parsed JSON to what the reader
// hands out; `fallback` is what a non-200, a parse failure, or an offline
// device resolves to.
export function staticJson(url, { shape = (d) => d, fallback = null } = {}) {
  let has = false
  let value = null
  let inFlight = null
  return async () => {
    // Not `if (value)` — a reader whose fallback IS null (fouls.js,
    // comebackWins.js) would re-fetch a missing file forever.
    if (has) return value
    if (!inFlight) {
      inFlight = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`${url} ${res.status}`)
          return res.json()
        })
        .then(shape)
        .catch(() => fallback)
        .then((data) => {
          has = true
          value = data
          inFlight = null
          return value
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
        fetch(urlFor(key))
          .then((res) => {
            if (!res.ok) throw new Error(`${urlFor(key)} ${res.status}`)
            return res.json()
          })
          .then(shape)
          .catch(() => fallback)
          .then((data) => {
            done.set(k, data)
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
function seasonIndexOf(store) {
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

// The whole index, `{ seasons, current }`, for a page's season picker
// (lib/seasons/view.js's resolveSeasonView).
export function seasonIndex(store) {
  return seasonIndexOf(store)
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
// year that is not on file means `current` too. The stores sweep no spring
// training, so a new season's year is not on file until Opening Day: a spring
// 2027 game page reads 2026, as it did before #1201, and never a blank card or
// a 404. The same holds for an index memoized before the nightly run added a
// season. `'all'` is the store's `all/` folder, which holds only the
// league-wide files; a reader of ONE player's shard adds the seasons up
// instead (readSeasonShard).
//
// The argument is `seasonYear`, never `season`: in umpires.js `u.season` is an
// umpire's season AGGREGATE, and `season.season` must not be able to happen.
//
// -> a folder name (a year or 'all'), or null when there is nothing to read.
export async function seasonFolderOf(store, seasonYear) {
  if (seasonYear === 'all') return 'all'
  const { seasons, current } = await seasonIndexOf(store)
  if (seasonYear == null) return current
  const year = Number(seasonYear)
  return seasons.includes(year) ? year : current
}

// One whole file of a season store, `/data/{store}/{folder}/{file}`, memoized
// like staticJson. The loader takes `{ seasonYear }` (see seasonFolderOf).
// `fallback` when the index or the file is missing; an `all/` file
// is not on disk until the first nightly run writes it.
export function seasonStaticJson(store, file, { shape, fallback = null } = {}) {
  const bySeason = staticJsonBy((folder) => `/data/${store}/${folder}/${file}`, { shape, fallback })
  return async ({ seasonYear } = {}) => {
    const folder = await seasonFolderOf(store, seasonYear)
    return folder == null ? fallback : bySeason(folder)
  }
}

// One player's (or one umpire's) slice of a sharded season store, for
// `{ seasonYear }`. `readOne(season)` reads that season's slice, or null. For
// `'all'` it reads every season on file and hands the slices, oldest first, to
// `combine(slices, seasons)` — a pure sum from lib/seasons/combine.js. There is
// no `all/` shard: the client adds one man's seasons, never a league's.
export async function readSeasonShard(store, seasonYear, readOne, combine) {
  if (seasonYear === 'all') {
    const seasons = await seasonsOf(store)
    if (!seasons.length) return null
    return combine(await Promise.all(seasons.map(readOne)), seasons)
  }
  const folder = await seasonFolderOf(store, seasonYear)
  return folder == null ? null : readOne(folder)
}
