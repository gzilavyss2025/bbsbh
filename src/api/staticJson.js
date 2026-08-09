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
